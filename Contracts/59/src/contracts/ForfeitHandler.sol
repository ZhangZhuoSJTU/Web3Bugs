pragma solidity >=0.6.6;

import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./Permissions.sol";


/// @title Forfeit Handler
/// @author 0xScotch <scotch@malt.money>
/// @notice When a user unbonds, their unvested rewards are forfeited. This contract decides what to do with those funds
contract ForfeitHandler is Initializable, Permissions {
  ERC20 public rewardToken;
  address public treasuryMultisig;
  address public swingTrader;

  uint256 public swingTraderRewardCut = 500;
  uint256 public treasuryRewardCut = 500;

  event Forfeit(address sender, uint256 amount);
  event SetRewardCut(uint256 treasuryCut, uint256 swingTraderCut);
  event SetTreasury(address treasury);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _rewardToken,
    address _treasuryMultisig,
    address _swingTrader
  ) external initializer {
    _adminSetup(_timelock);
    _setupRole(ADMIN_ROLE, initialAdmin);

    rewardToken = ERC20(_rewardToken);
    treasuryMultisig = _treasuryMultisig;
    swingTrader = _swingTrader;
  }

  function handleForfeit() public {
    uint256 balance = rewardToken.balanceOf(address(this));

    if (balance == 0) {
      return;
    }

    uint256 swingTraderCut = balance.mul(swingTraderRewardCut).div(1000);
    uint256 treasuryCut = balance - swingTraderCut;

    if (swingTraderCut > 0) {
      rewardToken.safeTransfer(swingTrader, swingTraderCut);
    }

    if (treasuryCut > 0) {
      rewardToken.safeTransfer(treasuryMultisig, treasuryCut);
    }

    emit Forfeit(msg.sender, balance);
  }

  /*
   * PRIVILEDGED METHODS
   */
  function setRewardCut(
    uint256 _treasuryCut,
    uint256 _swingTraderCut
  )
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_treasuryCut.add(_swingTraderCut) == 1000, "Reward cut must add to 100%");

    treasuryRewardCut = _treasuryCut;
    swingTraderRewardCut = _swingTraderCut;

    emit SetRewardCut(_treasuryCut, _swingTraderCut);
  }

  function setTreasury(address _treasury)
    external
    onlyRole(ADMIN_ROLE, "Must have admin role")
  {
    require(_treasury != address(0), "Cannot set 0 address");

    treasuryMultisig = _treasury;

    emit SetTreasury(_treasury);
  }
}
