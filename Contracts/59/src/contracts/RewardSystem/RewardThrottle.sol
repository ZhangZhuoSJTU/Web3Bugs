pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../Permissions.sol";
import "../interfaces/IDAO.sol";
import "../interfaces/IOverflow.sol";
import "../interfaces/IBonding.sol";
import "../interfaces/IDistributor.sol";

import "hardhat/console.sol";

struct State {
  uint256 profit;
  uint256 rewarded;
  uint256 bondedValue;
  uint256 throttle;
}

/// @title Reward Throttle
/// @author 0xScotch <scotch@malt.money>
/// @notice The contract in charge of smoothing out rewards and attempting to find a steady APR
/// @dev The use of smoothingPeriod has some flaws. At the very least the length should be longer
contract RewardThrottle is Initializable, Permissions {
  ERC20 public rewardToken;
  IDAO public dao;
  IBonding public bonding;
  IOverflow public overflowPool;
  IDistributor public distributor;

  uint256 public throttle = 200; // 20%
  uint256 public smoothingPeriod = 48; // 48 epochs = 24 hours

  uint256 internal _activeEpoch;
  mapping(uint256 => State) internal _state;

  event RewardOverflow(uint256 epoch, uint256 overflow);
  event HandleReward(uint256 epoch, uint256 amount);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _dao,
    address _overflowPool,
    address _bonding,
    address _distributor,
    address _rewardToken
  ) external initializer {
    _adminSetup(_timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);

    dao = IDAO(_dao);
    overflowPool = IOverflow(_overflowPool);
    bonding = IBonding(_bonding);
    distributor = IDistributor(_distributor);
    rewardToken = ERC20(_rewardToken);
  }

  function handleReward() public {
    uint256 balance = rewardToken.balanceOf(address(this));

    uint256 epoch = dao.epoch();

    checkRewardUnderflow();

    if (epoch > _activeEpoch) {
      _activeEpoch = epoch;
      _state[_activeEpoch].bondedValue = bonding.averageBondedValue(_activeEpoch); 
      _state[_activeEpoch].profit = balance;
      _state[_activeEpoch].rewarded = 0;
      _state[_activeEpoch].throttle = throttle;
    } else {
      _state[_activeEpoch].profit = _state[_activeEpoch].profit.add(balance);
      _state[_activeEpoch].throttle = throttle; 
    }

    // Fetch targetAPR before we update current epoch state
    uint256 aprTarget = targetAPR();

    // Distribute balance to the correct places
    if (aprTarget > 0 && _epochAprGivenReward(epoch, balance) > aprTarget) {
      uint256 remainder = _getRewardOverflow(balance, aprTarget);
      emit RewardOverflow(_activeEpoch, remainder);

      if (remainder > 0) {
        rewardToken.safeTransfer(address(overflowPool), remainder);

        if (balance > remainder) {
          _sendToDistributor(balance - remainder, _activeEpoch);
        }
      }
    } else {
      _sendToDistributor(balance, _activeEpoch);
    }

    emit HandleReward(epoch, balance);
  }

  /*
   * PUBLIC VIEW FUNCTIONS
   */
  function epochAPR(uint256 epoch) public view returns (uint256) {
    // This returns an implied APR based on the distributed rewards and bonded LP at the given epoch
    State memory epochState = _state[epoch];

    uint256 bondedValue = epochState.bondedValue;
    if (bondedValue == 0) {
      bondedValue = bonding.averageBondedValue(epoch); 
      if (bondedValue == 0) {
        return 0;
      }
    }

    // 10000 = 100%
    return epochState.rewarded.mul(10000).mul(dao.epochsPerYear()).div(bondedValue);
  }

  function averageAPR(uint256 startEpoch, uint256 endEpoch) public view returns (uint256) {
    require(startEpoch < endEpoch, "Start cannot be before the end");

    uint256 totalAPR = 0;
    for (uint256 i = startEpoch; i < endEpoch; i += 1) {
      totalAPR = totalAPR.add(epochAPR(i));
    }

    return totalAPR / (endEpoch - startEpoch);
  }

  function targetAPR() public view returns (uint256) {
    uint256 epoch = dao.epoch();
    (uint256 target,) = getTargets(epoch, smoothingPeriod);
    return target;
  }

  function targetEpochProfit() public view returns (uint256) {
    uint256 epoch = dao.epoch();
    (, uint256 epochProfitTarget) = getTargets(epoch, smoothingPeriod);
    return epochProfitTarget;
  }

  function getTargets(uint256 epoch, uint256 smoothing) public view returns (uint256, uint256) {
    // Average full APR over smoothingPeriod. Throttled by throttle
    uint256 maxPeriod = Math.min(epoch, smoothing);

    uint256 totalProfit = 0;
    uint256 totalBondedValue = 0;

    // Don't use the current epoch as part of the target calculations
    for (uint256 i = 1; i <= maxPeriod; i = i + 1) {
      totalProfit = totalProfit + _state[epoch - i].profit;
      totalBondedValue = totalBondedValue + _state[epoch - i].bondedValue;
    }

    if (totalBondedValue == 0) {
      return (0, 0);
    }

    totalProfit = totalProfit / maxPeriod;
    totalBondedValue = totalBondedValue / maxPeriod;

    // 10k is used here for more granularity on the APR %
    uint256 fullAPR = totalProfit.mul(10000).mul(dao.epochsPerYear()).div(totalBondedValue);
    // throttle is up to 1000. 1000 = 100%
    uint256 aprTarget = fullAPR.mul(throttle).div(1000);

    // (Target APR, Target profit per epoch)
    return (aprTarget, _desiredProfit(aprTarget, _state[epoch].bondedValue));
  }

  function epochData(uint256 epoch) public view returns (
    uint256 profit,
    uint256 rewarded,
    uint256 bondedValue,
    uint256 throttleAmount
  ) {
    return (
      _state[epoch].profit,
      _state[epoch].rewarded,
      _state[epoch].bondedValue,
      _state[epoch].throttle
    );
  }

  /*
   * INTERNAL VIEW FUNCTIONS
   */
  function _desiredProfit(uint256 apr, uint256 bondedValue) internal view returns (uint256) {
    return apr.mul(bondedValue).div(dao.epochsPerYear()).div(10000);
  }

  function _epochAprGivenReward(uint256 epoch, uint256 reward) internal view returns (uint256) {
    // This returns an implied APR based on the distributed rewards and bonded LP at the given epoch
    State memory epochState = _state[epoch];
    
    if (epochState.bondedValue == 0) {
      return 0;
    }

    // 10000 = 100%
    return (epochState.rewarded.add(reward)).mul(10000).mul(dao.epochsPerYear()).div(epochState.bondedValue);
  }

  function _getRewardOverflow(uint256 declaredReward, uint256 desiredAPR) internal view returns (uint256 remainder) {
    State memory epochState = _state[_activeEpoch];

    if (desiredAPR == 0) {
      // If desired APR is zero then just allow all rewards through
      return 0;
    }

    uint256 targetProfit = desiredAPR.mul(epochState.bondedValue).div(dao.epochsPerYear()).div(10000);

    if (targetProfit <= epochState.rewarded) {
      return declaredReward;
    }

    uint256 undeclaredReward = targetProfit - epochState.rewarded;

    if (undeclaredReward >= declaredReward) {
      // Declared reward doesn't make up for the difference yet
      return 0;
    }

    remainder = declaredReward - undeclaredReward;
  }

  function _getRewardUnderflow(uint256 desiredAPR, uint256 epoch) internal view returns (uint256 amount) {
    State memory epochState = _state[epoch];

    uint256 targetProfit = desiredAPR.mul(epochState.bondedValue).div(dao.epochsPerYear()).div(10000);

    if (targetProfit <= epochState.rewarded) {
      // Rewarded more than target already. 0 underflow
      return 0;
    }

    return targetProfit - epochState.rewarded;
  }

  /*
   * INTERNAL FUNCTIONS
   */
  function _sendToDistributor(uint256 amount, uint256 epoch) internal {
    if (amount == 0) {
      return;
    }
    rewardToken.safeTransfer(address(distributor), amount);
    distributor.declareReward(amount);

    _state[epoch].rewarded = _state[epoch].rewarded.add(amount);
    _state[epoch].bondedValue = bonding.averageBondedValue(epoch); 
  }

  function checkRewardUnderflow() public {
    uint256 epoch = dao.epoch();

    // Fill in gaps so APR target is correct
    _fillInEpochGaps(epoch);

    if (epoch > _activeEpoch) {
      for (uint256 i = _activeEpoch; i < epoch; i = i + 1) {
        (uint256 desiredAPR,) = getTargets(i, smoothingPeriod);

        if (epochAPR(i) < desiredAPR) {
          uint256 underflow = _getRewardUnderflow(desiredAPR, i);

          if (underflow > 0) {
            uint256 balance = overflowPool.requestCapital(underflow);

            _sendToDistributor(balance, i);
          }
        } 
      }
    }
  }

  function _fillInEpochGaps(uint256 epoch) internal {
    _state[_activeEpoch].bondedValue = bonding.averageBondedValue(_activeEpoch); 
    // Avoid issues if gap between rewards is greater than one epoch
    for (uint256 i = _activeEpoch + 1; i < epoch; i = i + 1) {
      if (_state[i].rewarded == 0 && _state[i].bondedValue == 0) {
        _state[i].bondedValue = bonding.averageBondedValue(i); 
        _state[i].profit = 0;
        _state[i].rewarded = 0;
        _state[i].throttle = throttle;
      }
    }
  }

  /*
   * PRIVILEDGED FUNCTIONS
   */
  function setDao(address _dao) external onlyRole(ADMIN_ROLE, "Must have admin privs") {
    require(_dao != address(0), "Not address 0");
    dao = IDAO(_dao);
  }

  function setBonding(address _bonding) external onlyRole(ADMIN_ROLE, "Must have admin privs") {
    require(_bonding != address(0), "Not address 0");
    bonding = IBonding(_bonding);
  }

  function setDistributor(address _distributor) external onlyRole(ADMIN_ROLE, "Must have admin privs") {
    require(_distributor != address(0), "Not address 0");
    distributor = IDistributor(_distributor);
  }

  function setOverflowPool(address _overflowPool) external onlyRole(ADMIN_ROLE, "Must have admin privs") {
    require(_overflowPool != address(0), "Not address 0");
    overflowPool = IOverflow(_overflowPool);
  }

  function setThrottle(uint256 _throttle) external onlyRole(ADMIN_ROLE, "Must have admin privs") {
    require(_throttle <= 1000, "Cannot have throttle above 100%");
    throttle = _throttle;
  }

  function setSmoothingPeriod(uint256 _smoothingPeriod) external onlyRole(ADMIN_ROLE, "Must have admin privs") {
    require(_smoothingPeriod > 0, "No zero smoothing period");
    smoothingPeriod = _smoothingPeriod;
  }
}
