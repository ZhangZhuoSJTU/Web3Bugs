pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "../AuctionParticipant.sol";

/// @title Reward Overflow Pool
/// @author 0xScotch <scotch@malt.money>
/// @notice Allows throttler contract to request capital when the current epoch underflows desired reward
contract RewardOverflowPool is Initializable, AuctionParticipant {
  uint256 public maxFulfillment = 500; // 50%
  address public throttler;

  event FulfilledRequest(uint256 amount);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _rewardThrottle,
    address _rewardToken,
    address _auction,
    address _impliedCollateralService
  ) external initializer {
    _adminSetup(_timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);
    _setupRole(REWARD_THROTTLE_ROLE, _rewardThrottle);

    throttler = _rewardThrottle;

    setupParticipant(
      _impliedCollateralService,
      _rewardToken,
      _auction
    );
  }

  function requestCapital(uint256 amount)
    external
    onlyRole(REWARD_THROTTLE_ROLE, "Must have Reward throttle privs")
    returns (uint256 fulfilledAmount)
  {
    uint256 balance = auctionRewardToken.balanceOf(address(this));

    if (balance == 0) {
      return 0;
    }

    // This is the max amount allowable
    fulfilledAmount = balance.mul(maxFulfillment).div(1000);

    if (amount <= fulfilledAmount) {
      fulfilledAmount = amount;
    } 

    auctionRewardToken.safeTransfer(throttler, fulfilledAmount);

    emit FulfilledRequest(fulfilledAmount);

    return fulfilledAmount;
  }

  /*
   * INTERNAL FUNCTIONS
   */
  function _handleRewardDistribution(uint256 amount) override internal {
    // reset claimable rewards as all rewards stay here
    claimableRewards = 0;
  }

  /*
   * PRIVILEDGED FUNCTIONS
   */
  function setMaxFulfillment(uint256 _maxFulfillment) external onlyRole(ADMIN_ROLE, "Must have admin privs") {
    require(_maxFulfillment > 0, "Can't have 0 max fulfillment");
    require(_maxFulfillment <= 1000, "Can't have above 100% max fulfillment");

    maxFulfillment = _maxFulfillment;
  }

  function setThrottler(address _throttler) external onlyRole(ADMIN_ROLE, "Must have admin privs") {
    require(_throttler != address(0), "Not address 0");

    revokeRole(REWARD_THROTTLE_ROLE, throttler);
    _setupRole(REWARD_THROTTLE_ROLE, _throttler);

    throttler = _throttler;
  }
}
