pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./interfaces/IDexHandler.sol";
import "./interfaces/IBonding.sol";
import "./interfaces/IMiningService.sol";
import "./libraries/UniswapV2Library.sol";
import "./Permissions.sol";


/// @title Reward Reinvestor
/// @author 0xScotch <scotch@malt.money>
/// @notice Provide a way to programmatically reinvest Malt rewards
contract RewardReinvestor is Initializable, Permissions {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  ERC20 public malt;
  ERC20 public rewardToken;
  ERC20 public stakeToken;

  IDexHandler public dexHandler;
  IBonding public bonding;
  IMiningService public miningService;
  address public treasury;

  event ProvideReinvest(address account, uint256 reward);
  event SplitReinvest(address account, uint256 amountReward);
  event SetDexHandler(address dexHandler);
  event SetBonding(address bonding);
  event SetMiningService(address miningService);
  event SetTreasury(address _treasury);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _maltToken,
    address _rewardToken,
    address _dexHandler,
    address _bonding,
    address _miningService,
    address _uniswapV2Factory,
    address _treasury
  ) external initializer {
    _adminSetup(_timelock);
    _setupRole(ADMIN_ROLE, initialAdmin);

    malt = ERC20(_maltToken);
    rewardToken = ERC20(_rewardToken);
    dexHandler = IDexHandler(_dexHandler);
    bonding = IBonding(_bonding);
    miningService = IMiningService(_miningService);
    treasury = _treasury;

    stakeToken = ERC20(UniswapV2Library.pairFor(_uniswapV2Factory, _maltToken, _rewardToken));
  }

  function provideReinvest(uint256 rewardLiquidity) external {
    _retrieveReward(rewardLiquidity);

    uint256 rewardBalance = rewardToken.balanceOf(address(this));

    // This is how much malt is required
    uint256 maltLiquidity = dexHandler.getOptimalLiquidity(address(malt), address(rewardToken), rewardBalance);

    // Transfer the remaining Malt required
    malt.safeTransferFrom(msg.sender, address(this), maltLiquidity);

    _bondAccount(msg.sender);

    emit ProvideReinvest(msg.sender, rewardLiquidity);
  }

  function splitReinvest(uint256 rewardLiquidity) external {
    _retrieveReward(rewardLiquidity);

    uint256 rewardBalance = rewardToken.balanceOf(address(this));

    rewardToken.safeTransfer(address(dexHandler), rewardBalance.div(2));

    dexHandler.buyMalt();

    _bondAccount(msg.sender);

    emit SplitReinvest(msg.sender, rewardLiquidity);
  }

  function _retrieveReward(uint256 rewardLiquidity) internal {
    require(rewardLiquidity > 0, "Cannot reinvest 0");

    miningService.withdrawRewardsForAccount(
      msg.sender,
      rewardLiquidity
    );
  }

  function _bondAccount(address account) internal {
    malt.safeTransfer(address(dexHandler), malt.balanceOf(address(this)));
    rewardToken.safeTransfer(address(dexHandler), rewardToken.balanceOf(address(this)));

    (,,uint256 liquidityCreated) = dexHandler.addLiquidity();

    stakeToken.approve(address(bonding), liquidityCreated);

    bonding.bondToAccount(account, liquidityCreated);

    // If there is any carry / left overs then send to treasury
    uint256 maltBalance = malt.balanceOf(address(this));
    uint256 rewardTokenBalance = rewardToken.balanceOf(address(this));

    if (maltBalance > 0) {
      malt.safeTransfer(treasury, maltBalance);
    }

    if (rewardTokenBalance > 0) {
      rewardToken.safeTransfer(treasury, rewardTokenBalance);
    }
  }

  function setDexHandler(address _dexHandler)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_dexHandler != address(0), "Not address 0");
    dexHandler = IDexHandler(_dexHandler);
    emit SetDexHandler(_dexHandler);
  }

  function setBonding(address _bonding)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_bonding != address(0), "Not address 0");
    bonding = IBonding(_bonding);
    emit SetBonding(_bonding);
  }

  function setMiningService(address _miningService)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_miningService != address(0), "Not address 0");
    miningService = IMiningService(_miningService);
    emit SetMiningService(_miningService);
  }

  function setTreasury(address _treasury)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_treasury != address(0), "Not address 0");
    treasury = _treasury;
    emit SetTreasury(_treasury);
  }
}
