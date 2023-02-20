pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@uniswap/lib/contracts/libraries/Babylonian.sol';
import '@uniswap/lib/contracts/libraries/FullMath.sol';

import "../Permissions.sol";
import "../libraries/UniswapV2Library.sol";


/// @title Uniswap Interaction Handler
/// @author 0xScotch <scotch@malt.money>
/// @notice A simple contract to make interacting with UniswapV2 pools easier.
/// @notice The buyMalt method is locked down to avoid circumventing recovery mode
/// @dev Makes use of UniswapV2Router02. Would be more efficient to go direct
contract UniswapHandler is Initializable, Permissions {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  bytes32 public constant BUYER_ROLE = keccak256("BUYER_ROLE");

  ERC20 public malt;
  ERC20 public rewardToken;
  ERC20 public lpToken;
  IUniswapV2Router02 public router;
  address public uniswapV2Factory;

  address[] public buyers;
  mapping(address => bool) public buyersActive;

  event AddMaltBuyer(address buyer);
  event RemoveMaltBuyer(address buyer);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _maltToken,
    address _rewardToken,
    address _lpToken,
    address _router,
    address _uniswapV2Factory
  ) external initializer {
    _adminSetup(_timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);
    _setRoleAdmin(BUYER_ROLE, ADMIN_ROLE);

    malt = ERC20(_maltToken);
    rewardToken = ERC20(_rewardToken);
    router = IUniswapV2Router02(_router);

    lpToken = ERC20(_lpToken);
    uniswapV2Factory = _uniswapV2Factory;
  }

  /*
   * PUBLIC VIEW FUNCTIONS
   */
  function calculateMintingTradeSize(uint256 priceTarget) external view returns (uint256) {
    return _calculateTradeSize(address(malt), address(rewardToken), priceTarget);
  }

  function calculateBurningTradeSize(uint256 priceTarget) external view returns (uint256) {
    return _calculateTradeSize(address(rewardToken), address(malt), priceTarget);
  }

  function reserves() public view returns (uint256 maltSupply, uint256 rewardSupply) {
    // TODO use datalab anywhere that calls this Tue 05 Oct 2021 20:56:41 BST
    (maltSupply, rewardSupply) = UniswapV2Library.getReserves(
      uniswapV2Factory,
      address(malt),
      address(rewardToken)
    );
  }

  function maltMarketPrice() public view returns (uint256 price, uint256 decimals) {
    // TODO use datalab anywhere that calls this Tue 05 Oct 2021 20:56:41 BST
    (uint256 maltReserves, uint256 rewardReserves) = UniswapV2Library.getReserves(
      uniswapV2Factory,
      address(malt),
      address(rewardToken)
    );

    if (maltReserves == 0 || rewardReserves == 0) {
      price = 0;
      decimals = 18;
      return (price, decimals);
    }

    uint256 rewardDecimals = rewardToken.decimals();
    uint256 maltDecimals = malt.decimals();

    if (rewardDecimals > maltDecimals) {
      uint256 diff = rewardDecimals - maltDecimals;
      price = rewardReserves.mul(10**rewardDecimals).div(maltReserves.mul(10**diff));
      decimals = rewardDecimals;
    } else if (rewardDecimals < maltDecimals) {
      uint256 diff = maltDecimals - rewardDecimals;
      price = (rewardReserves.mul(10**diff)).mul(10**rewardDecimals).div(maltReserves);
      decimals = maltDecimals;
    } else {
      price = rewardReserves.mul(10**rewardDecimals).div(maltReserves);
      decimals = rewardDecimals;
    }
  }

  function getOptimalLiquidity(address tokenA, address tokenB, uint256 liquidityB)
    external view returns (uint256 liquidityA)
  {
    // TODO use datalab anywhere that calls this Tue 05 Oct 2021 20:56:41 BST
    (uint256 reservesA, uint256 reservesB) = UniswapV2Library.getReserves(
      uniswapV2Factory,
      tokenA,
      tokenB
    );

    liquidityA = UniswapV2Library.quote(
      liquidityB,
      reservesB,
      reservesA
    );
  }

  /*
   * MUTATION FUNCTIONS
   */
  function buyMalt()
    external
    onlyRole(BUYER_ROLE, "Must have buyer privs")
    returns (uint256 purchased)
  {
    uint256 rewardBalance = rewardToken.balanceOf(address(this));

    if (rewardBalance == 0) {
      return 0;
    }

    rewardToken.approve(address(router), rewardBalance);

    address[] memory path = new address[](2);
    path[0] = address(rewardToken);
    path[1] = address(malt);

    router.swapExactTokensForTokens(
      rewardBalance,
      0, // amountOutMin
      path,
      address(this),
      now
    );

    purchased = malt.balanceOf(address(this));
    malt.safeTransfer(msg.sender, purchased);
  }

  function sellMalt() external returns (uint256 rewards) {
    uint256 maltBalance = malt.balanceOf(address(this));

    if (maltBalance == 0) {
      return 0;
    }

    malt.approve(address(router), maltBalance);

    address[] memory path = new address[](2);
    path[0] = address(malt);
    path[1] = address(rewardToken);

    router.swapExactTokensForTokens(
      maltBalance,
      0,
      path,
      address(this),
      now
    );

    rewards = rewardToken.balanceOf(address(this));
    rewardToken.safeTransfer(msg.sender, rewards);
  }

  function addLiquidity() external returns (
    uint256 maltUsed,
    uint256 rewardUsed,
    uint256 liquidityCreated
  ) {
    uint256 maltBalance = malt.balanceOf(address(this));
    uint256 rewardBalance = rewardToken.balanceOf(address(this));

    if (maltBalance == 0 || rewardBalance == 0) {
      return (0, 0, 0);
    }

    rewardToken.approve(address(router), rewardBalance);
    malt.approve(address(router), maltBalance);

    // TODO maybe make slippage tolerance here adjustable Fri 19 Nov 2021 16:45:57 GMT
    (maltUsed, rewardUsed, liquidityCreated) = router.addLiquidity(
      address(malt),
      address(rewardToken),
      maltBalance,
      rewardBalance,
      maltBalance.mul(95).div(100),
      rewardBalance.mul(95).div(100),
      msg.sender, // transfer LP tokens to sender
      now
    );

    if (maltUsed < maltBalance) {
      malt.safeTransfer(msg.sender, maltBalance.sub(maltUsed));
    }

    if (rewardUsed < rewardBalance) {
      rewardToken.safeTransfer(msg.sender, rewardBalance.sub(rewardUsed));
    }
  }

  function removeLiquidity() external returns (uint256 amountMalt, uint256 amountReward) {
    uint256 liquidityBalance = lpToken.balanceOf(address(this));

    if (liquidityBalance == 0) {
      return (0, 0);
    }

    lpToken.approve(address(router), liquidityBalance);

    (amountMalt, amountReward) = router.removeLiquidity(
      address(malt),
      address(rewardToken),
      liquidityBalance,
      0,
      0,
      msg.sender, // transfer broken LP tokens to sender
      now
    );

    if (amountMalt == 0 || amountReward == 0) {
      liquidityBalance = lpToken.balanceOf(address(this));
      lpToken.safeTransfer(msg.sender, liquidityBalance);
      return (amountMalt, amountReward);
    }
  }

  /*
   * PRIVATE METHODS
   */
  function _calculateTradeSize(address sellToken, address buyToken, uint256 priceTarget) private view returns (uint256) {
    // TODO use data lab average Tue 05 Oct 2021 20:40:23 BST
    (uint256 sellReserves, uint256 buyReserves) = UniswapV2Library.getReserves(
      uniswapV2Factory,
      sellToken,
      buyToken
    );

    uint256 invariant = sellReserves.mul(buyReserves);

    uint256 buyBase = 10**uint256(ERC20(buyToken).decimals());

    uint256 leftSide = Babylonian.sqrt(
      FullMath.mulDiv(
        invariant.mul(1000),
        priceTarget,
        buyBase.div(priceTarget).mul(buyBase).mul(997)
      )
    );

    uint256 rightSide = sellReserves.mul(1000).div(997);

    if (leftSide < rightSide) return 0;

    return leftSide.sub(rightSide);
  }

  /*
   * PRIVILEDGED METHODS
   */
  function addNewBuyer(address _buyer)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
    notSameBlock
  {
    require(_buyer != address(0), "Cannot use address 0");

    if (buyersActive[_buyer]) {
      return;
    }

    buyersActive[_buyer] = true;
    buyers.push(_buyer);

    _setupRole(BUYER_ROLE, _buyer);

    emit AddMaltBuyer(_buyer);
  }

  function removeBuyer(address _buyer)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
    notSameBlock
  {
    if (buyers.length == 0 || !buyersActive[_buyer]) {
      return;
    }

    address buyer;
    buyersActive[_buyer] = false;

    emit RemoveMaltBuyer(_buyer);
    revokeRole(BUYER_ROLE, _buyer);

    // Loop until the second last element
    for (uint i = 0; i < buyers.length - 1; i = i + 1) {
      if (buyers[i] == _buyer) {
        // Replace the current item with the last and pop the last away.
        buyers[i] = buyers[buyers.length - 1];
        buyers.pop();
        return;
      }
    }

    // If we made it here then the buyers being removed is the last item
    buyers.pop();
  }

  // TODO ensure this contract is whitelisted for under peg transfers Mon 06 Sep 2021 23:49:31 BST
}
