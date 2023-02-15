pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../Permissions.sol";
import "../interfaces/IBonding.sol";
import "../interfaces/IForfeit.sol";
import "../interfaces/IRewardMine.sol";

import "hardhat/console.sol";

struct State {
  uint256 declaredBalance;
}

struct FocalPoint {
  uint256 id;
  uint256 focalLength;
  uint256 endTime;

  uint256 rewarded;
  uint256 vested;

  uint256 lastVestingTime;
}

/// @title Reward Vesting Distributor
/// @author 0xScotch <scotch@malt.money>
/// @notice The contract in charge of implementing the focal vesting scheme for rewards
contract RewardDistributor is Initializable, Permissions {
  uint256 public focalID = 1; // Avoid issues with defaulting to 0
  uint256 public focalLength = 2 days;

  bytes32 public constant THROTTLER_ROLE = keccak256("THROTTLER_ROLE");
  bytes32 public constant REWARD_MINE_ROLE = keccak256("REWARD_MINE_ROLE");
  bytes32 public constant FOCAL_LENGTH_UPDATER_ROLE = keccak256("FOCAL_LENGTH_UPDATER_ROLE");

  address public throttler;
  IRewardMine public rewardMine;
  IForfeit public forfeitor;
  ERC20 public rewardToken;
  IBonding public bonding;

  State internal _globals;
  FocalPoint[] internal focalPoints;

  event DeclareReward(
    uint256 amount,
    address rewardToken
  );
  event Forfeit(address account, address rewardToken, uint256 forfeited);
  event RewardFocal(
    uint256 id,
    uint256 focalLength,
    uint256 endTime,
    uint256 rewarded
  );

  function initialize(
    address _timelock,
    address initialAdmin,
    address _rewardMine,
    address _bonding,
    address _throttler,
    address _forfeitor,
    address _rewardToken
  ) external initializer {
    _adminSetup(_timelock);
    _setupRole(FOCAL_LENGTH_UPDATER_ROLE, _timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);

    _roleSetup(THROTTLER_ROLE, _throttler);
    _roleSetup(FOCAL_LENGTH_UPDATER_ROLE, initialAdmin);
    _roleSetup(REWARD_MINE_ROLE, _rewardMine);

    rewardToken = ERC20(_rewardToken);

    throttler = _throttler;
    rewardMine = IRewardMine(_rewardMine);
    forfeitor = IForfeit(_forfeitor);
    bonding = IBonding(_bonding);

    focalPoints.push();
    focalPoints.push();
  }

  function vest() public {
    if (_globals.declaredBalance == 0) {
      return;
    }
    uint256 vestedReward = 0;

    FocalPoint storage vestingFocal = _getVestingFocal();
    FocalPoint storage activeFocal = _getActiveFocal();

    vestedReward = _getVestableQuantity(vestingFocal);
    uint256 activeReward = _getVestableQuantity(activeFocal);

    vestedReward = vestedReward.add(activeReward);

    // Send vested amount to liquidity mine
    rewardToken.safeTransfer(address(rewardMine), vestedReward);

    // increment focalID if time is past the halfway mark
    // through a focal period
    if (block.timestamp >= _getNextFocalStart(activeFocal)) {
      _incrementFocalPoint();
    }
  }

  /* PUBLIC VIEW FUNCTIONS */
  function totalDeclaredReward() public view returns (uint256) {
    return _globals.declaredBalance;
  }

  /* INTERNAL VIEW FUNCTIONS */
  function _getFocalIndex(uint256 id) internal pure returns (uint8 index) {
    return uint8(id % 2);
  }

  function _getVestingFocal() internal view returns (FocalPoint storage) {
    // Can add 1 as the modulo ensures we wrap correctly
    uint8 index = _getFocalIndex(focalID + 1);
    return focalPoints[index];
  }

  /* INTERNAL FUNCTIONS */
  function _getActiveFocal() internal returns (FocalPoint storage) {
    uint8 index = _getFocalIndex(focalID);
    FocalPoint storage focal = focalPoints[index];

    if (focal.id != focalID) {
      // If id is not focalID then reinitialize the struct
      _resetFocalPoint(focalID, block.timestamp + focalLength);
    }

    return focal;
  }

  function _rewardCheck(uint256 reward) internal {
    require(reward > 0, "Cannot declare 0 reward");

    _globals.declaredBalance = _globals.declaredBalance.add(reward);

    uint256 totalReward = rewardToken.balanceOf(address(this)) + rewardMine.totalReleasedReward();

    require(_globals.declaredBalance <= totalReward, "Insufficient balance");
  }

  function _forfeit(uint256 forfeited) internal {
    require(forfeited <= _globals.declaredBalance, "Cannot forfeit more than declared");

    _globals.declaredBalance = _globals.declaredBalance.sub(forfeited);

    rewardToken.safeTransfer(address(forfeitor), forfeited);
    forfeitor.handleForfeit();

    uint256 totalReward = rewardToken.balanceOf(address(this)) + rewardMine.totalReleasedReward();

    require(_globals.declaredBalance <= totalReward, "Insufficient balance");

    emit Forfeit(msg.sender, address(rewardToken), forfeited);
  }

  function _resetFocalPoint(uint256 id, uint256 endTime) internal {
    uint8 index = _getFocalIndex(id);
    FocalPoint storage newFocal = focalPoints[index];
    
    newFocal.id = id;
    newFocal.focalLength = focalLength;
    newFocal.endTime = endTime;
    newFocal.rewarded = 0;
    newFocal.vested = 0;
    newFocal.lastVestingTime = endTime - focalLength;
  }

  function _incrementFocalPoint() internal {
    FocalPoint storage oldFocal = _getActiveFocal();

    // This will increment every 24 hours so overflow on uint256
    // isn't an issue.
    focalID = focalID + 1;

    // Emit event that documents the focalPoint that has just ended
    emit RewardFocal(
      oldFocal.id,
      oldFocal.focalLength,
      oldFocal.endTime,
      oldFocal.rewarded
    );

    uint256 newEndTime = oldFocal.endTime + focalLength / 2;

    _resetFocalPoint(focalID, newEndTime);
  }

  function _getNextFocalStart(FocalPoint storage focal) internal view returns (uint256) {
    return focal.endTime - (focal.focalLength / 2);
  }

  function _getVestableQuantity(FocalPoint storage focal) internal returns (
    uint256 vestedReward
  ) {
    uint256 currentTime = block.timestamp;

    if (focal.lastVestingTime >= currentTime) {
      return 0;
    }

    if (currentTime > focal.endTime) {
      currentTime = focal.endTime;
    }

    // Time in between last vesting call and end of focal period
    uint256 timeRemaining = focal.endTime - focal.lastVestingTime;

    if (timeRemaining == 0) {
      return 0;
    }

    // Time since last vesting call
    uint256 vestedTime = currentTime - focal.lastVestingTime;

    uint256 remainingReward = focal.rewarded - focal.vested;

    vestedReward = remainingReward.mul(vestedTime).div(timeRemaining);

    focal.vested = focal.vested.add(vestedReward);
    focal.lastVestingTime = currentTime;

    return vestedReward;
  }

  /*
   * PRIVILEDGED METHODS
   */
  function declareReward(uint256 amount)
    external
    onlyRole(THROTTLER_ROLE, "Only throttler role")
  {
    _rewardCheck(amount);

    if (bonding.totalBonded() == 0) {
      // There is no accounts to distribute the rewards to so forfeit it
      _forfeit(amount);
      return;
    } 

    // Vest current reward before adding new reward to ensure
    // Everything is up to date before we add new reward
    vest();

    FocalPoint storage activeFocal = _getActiveFocal();
    activeFocal.rewarded = activeFocal.rewarded.add(amount);

    emit DeclareReward(amount, address(rewardToken));
  }

  function forfeit(uint256 amount)
    public
    onlyRole(REWARD_MINE_ROLE, "Only reward mine")
  {
    if (amount > 0) {
      _forfeit(amount);
    }
  }

  function decrementRewards(uint256 amount)
    public
    onlyRole(REWARD_MINE_ROLE, "Only reward mine")
  {
    require(amount <= _globals.declaredBalance, "Can't decrement more than total reward balance");

    if (amount > 0) {
      _globals.declaredBalance = _globals.declaredBalance.sub(amount);
    }
  }

  function setFocalLength(uint256 _focalLength)
    public 
    onlyRole(FOCAL_LENGTH_UPDATER_ROLE, "Only focal length updater")
  {
    // Cannot have focal length under 1 hour
    require(_focalLength >= 3600, "Focal length too small");
    focalLength = _focalLength;
  }

  function setThrottler(address _throttler)
    public 
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_throttler != address(0), "Cannot set 0 address as throttler");
    _swapRole(_throttler, address(throttler), THROTTLER_ROLE);
    throttler = _throttler;
  }

  function setRewardMine(address _rewardMine)
    public 
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_rewardMine != address(0), "Cannot set 0 address as rewardMine");
    _swapRole(_rewardMine, address(rewardMine), REWARD_MINE_ROLE);
    rewardMine = IRewardMine(_rewardMine);
  }

  function setForfeitor(address _forfeitor)
    public 
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_forfeitor != address(0), "Cannot set 0 address as forfeitor");
    forfeitor = IForfeit(_forfeitor);
  }

  function setRewardToken(address _rewardToken)
    public 
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_rewardToken != address(0), "Cannot set 0 address as reward Token");
    rewardToken = ERC20(_rewardToken);
  }

  function setBonding(address _bonding)
    public 
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_bonding != address(0), "Cannot set 0 address as bonding");
    bonding = IBonding(_bonding);
  }

  function addFocalLengthUpdater(address _updater)
    public 
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_updater != address(0), "Cannot set 0 address as focal length updater");
    _roleSetup(FOCAL_LENGTH_UPDATER_ROLE, _updater);
  }

  function removeFocalLengthUpdater(address _updater)
    public 
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    revokeRole(FOCAL_LENGTH_UPDATER_ROLE, _updater);
  }
}
