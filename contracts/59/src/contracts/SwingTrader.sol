pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./Permissions.sol";
import "./interfaces/IAuction.sol";
import "./interfaces/IRewardThrottle.sol";
import "./interfaces/IDexHandler.sol";


/// @title Swing Trader
/// @author 0xScotch <scotch@malt.money>
/// @notice The sole aim of this contract is to defend peg and try to profit in the process.
/// @dev It does so from a privileged internal position where it is allowed to purchase on the AMM even in recovery mode
contract SwingTrader is Initializable, Permissions {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  ERC20 public collateralToken;
  ERC20 public malt;
  IDexHandler public dexHandler;
  IRewardThrottle public rewardThrottle;

  uint256 internal deployedCapital;
  uint256 public lpProfitCut = 500; // 50%

  function initialize(
    address _timelock,
    address initialAdmin,
    address _collateralToken,
    address _malt,
    address _dexHandler,
    address _stabilizerNode,
    address _rewardThrottle
  ) external initializer {
    _adminSetup(_timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);
    _setupRole(STABILIZER_NODE_ROLE, _stabilizerNode);

    collateralToken = ERC20(_collateralToken);
    malt = ERC20(_malt);
    dexHandler = IDexHandler(_dexHandler);
    rewardThrottle = IRewardThrottle(_rewardThrottle);
  }

  function buyMalt(uint256 maxCapital)
    external
    onlyRole(STABILIZER_NODE_ROLE, "Must have stabilizer node privs")
    returns (uint256 capitalUsed)
  {
    if (maxCapital == 0) {
      return 0;
    }

    uint256 balance = collateralToken.balanceOf(address(this));

    if (balance == 0) {
      return 0;
    }

    if (maxCapital < balance) {
      balance = maxCapital;
    }

    collateralToken.safeTransfer(address(dexHandler), balance);
    dexHandler.buyMalt();

    deployedCapital = deployedCapital + balance;

    return balance;
  }

  function sellMalt(uint256 maxAmount)
    external
    onlyRole(STABILIZER_NODE_ROLE, "Must have stabilizer node privs")
    returns (uint256 amountSold)
  {
    if (maxAmount == 0) {
      return 0;
    }

    uint256 totalMaltBalance = malt.balanceOf(address(this));
    uint256 balance = totalMaltBalance;

    if (balance == 0) {
      return 0;
    }

    (uint256 basis,) = costBasis();

    if (maxAmount < totalMaltBalance) {
      balance = maxAmount;
    }

    malt.safeTransfer(address(dexHandler), balance);
    uint256 rewards = dexHandler.sellMalt();

    if (rewards <= deployedCapital && maxAmount != totalMaltBalance) {
      // If all malt is spent we want to reset deployed capital
      deployedCapital = deployedCapital - rewards;
    } else {
      deployedCapital = 0;
    }

    uint256 maltDecimals = malt.decimals();
    uint256 decimals = collateralToken.decimals();    

    uint256 profit = 0;

    if (maltDecimals == decimals) {
      uint256 soldBasis = basis.mul(balance).div(10**decimals);

      if (rewards > soldBasis) {
        profit = rewards.sub(soldBasis);
      }
    } else if (maltDecimals > decimals) {
      uint256 diff = maltDecimals - decimals;
      uint256 soldBasis = basis.mul(balance.div(10**diff)).div(10**decimals);

      if (rewards > soldBasis) {
        profit = rewards.sub(soldBasis);
      }
    } else {
      uint256 diff = decimals - maltDecimals;
      uint256 soldBasis = basis.mul(balance.mul(10**diff)).div(10**decimals);

      if (rewards > soldBasis) {
        profit = rewards.sub(soldBasis);
      }
    }

    if (profit > 0) {
      uint256 lpCut = profit.mul(lpProfitCut).div(1000);

      collateralToken.safeTransfer(address(rewardThrottle), lpCut);
      rewardThrottle.handleReward();
    }

    return balance;
  }

  function costBasis() public view returns (uint256 cost, uint256 decimals) {
    // Always returns using the decimals of the collateralToken as that is the 
    // currency costBasis is calculated in
    decimals = collateralToken.decimals();    
    uint256 maltBalance = malt.balanceOf(address(this));

    if (deployedCapital == 0 || maltBalance == 0) {
      return (0, decimals);
    }

    uint256 maltDecimals = malt.decimals();    

    if (maltDecimals == decimals) {
      return (deployedCapital.mul(10**decimals).div(maltBalance), decimals);
    } else if (maltDecimals > decimals) {
      uint256 diff = maltDecimals - decimals;
      return (deployedCapital.mul(10**decimals).div(maltBalance.div(10**diff)), decimals);
    } else {
      uint256 diff = decimals - maltDecimals;
      return (deployedCapital.mul(10**decimals).div(maltBalance.mul(10**diff)), decimals);
    }
  }

  function setLpProfitCut(uint256 _profitCut) public onlyRole(ADMIN_ROLE, "Must have admin privs") {
    require(_profitCut >= 0 && _profitCut <= 1000, "Must be between 0 and 100%");
    lpProfitCut = _profitCut;  
  }
}
