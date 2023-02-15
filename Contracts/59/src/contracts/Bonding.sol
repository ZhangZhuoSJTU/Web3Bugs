pragma solidity >=0.6.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

import "./interfaces/IDAO.sol";
import "./interfaces/IMiningService.sol";
import "./interfaces/IDexHandler.sol";
import "./interfaces/IMaltDataLab.sol";

import "./Permissions.sol";


struct UserState {
  uint256 bonded;

  // TODO calculate average bonded period for log calc Tue 03 Aug 2021 11:22:39 BST
  uint256 bondedEpoch;
}

struct EpochState {
  uint256 lastTotalBonded;
  uint256 lastUpdateTime;
  uint256 cumulativeTotalBonded;
}


/// @title LP Bonding
/// @author 0xScotch <scotch@malt.money>
/// @notice The contract which LP tokens are bonded to to make a user eligible for protocol rewards
contract Bonding is Initializable, Permissions {
  ERC20 public malt;
  ERC20 public rewardToken;
  ERC20 public stakeToken;
  IDAO public dao;
  IMiningService public miningService;
  IDexHandler public dexHandler;
  IMaltDataLab public maltDataLab;

  uint256 internal _globalBonded;
  uint256 internal _currentEpoch;
  address internal offering;
  mapping(address => UserState) internal userState;
  mapping(uint256 => EpochState) internal epochState;

  event Bond(address indexed account, uint256 value);
  event Unbond(address indexed account, uint256 value);
  event UnbondAndBreak(address indexed account, uint256 amountLPToken, uint256 amountMalt, uint256 amountReward);

  function initialize(
    address _timelock,
    address initialAdmin,
    address _malt,
    address _rewardToken,
    address _stakeToken,
    address _dao,
    address _miningService,
    address _offering,
    address _dexHandler,
    address _maltDataLab
  ) external initializer {
    _adminSetup(_timelock);

    _setupRole(ADMIN_ROLE, initialAdmin);

    dao = IDAO(_dao);
    offering = _offering;
    stakeToken = ERC20(_stakeToken);
    miningService = IMiningService(_miningService);
    dexHandler = IDexHandler(_dexHandler);
    malt = ERC20(_malt);
    rewardToken = ERC20(_rewardToken);
    maltDataLab = IMaltDataLab(_maltDataLab);
  }

  function bond(uint256 amount) external {
    bondToAccount(msg.sender, amount);
  }

  function bondToAccount(address account, uint256 amount)
    public
  {
    if (msg.sender != offering) {
      _notSameBlock();
    }
    require(amount > 0, "Cannot bond 0");

    miningService.onBond(account, amount);

    _bond(account, amount);
  }

  function unbond(uint256 amount)
    external
  {
    require(amount > 0, "Cannot unbond 0");

    uint256 bondedBalance = balanceOfBonded(msg.sender);

    require(bondedBalance > 0, "< bonded balance");
    require(amount <= bondedBalance, "< bonded balance");

    // Avoid leaving dust behind
    if (amount.add(1e16) > bondedBalance) {
      amount = bondedBalance;
    }

    miningService.onUnbond(msg.sender, amount);

    _unbond(amount);
  }

  function unbondAndBreak(uint256 amount)
    external
  {
    require(amount > 0, "Cannot unbond 0");

    uint256 bondedBalance = balanceOfBonded(msg.sender);

    require(bondedBalance > 0, "< bonded balance");
    require(amount <= bondedBalance, "< bonded balance");

    // Avoid leaving dust behind
    if (amount.add(1e16) > bondedBalance) {
      amount = bondedBalance;
    }

    miningService.onUnbond(msg.sender, amount);

    _unbondAndBreak(amount);
  }

  /*
   * PUBLIC VIEW FUNCTIONS
   */
  function averageBondedValue(uint256 epoch) public view returns (uint256) {
    EpochState storage state = epochState[epoch];
    uint256 epochLength = dao.epochLength();
    uint256 timeElapsed = epochLength;
    uint256 epochStartTime = dao.getEpochStartTime(epoch);
    uint256 diff;
    uint256 lastUpdateTime = state.lastUpdateTime;
    uint256 lastTotalBonded = state.lastTotalBonded;

    if (lastUpdateTime == 0) {
      lastUpdateTime = epochStartTime;
    }

    if (lastTotalBonded == 0) {
      lastTotalBonded = _globalBonded;
    }

    if (block.timestamp < epochStartTime) {
      return 0;
    }

    if (epochStartTime + epochLength <= lastUpdateTime) {
      return maltDataLab.realValueOfLPToken((state.cumulativeTotalBonded) / epochLength);
    }

    if (epochStartTime + epochLength < block.timestamp) {
      // The desired epoch is in the past
      diff = (epochStartTime + epochLength) - lastUpdateTime;
    } else {
      diff = block.timestamp - lastUpdateTime;
      timeElapsed = block.timestamp - epochStartTime;
    }

    if (timeElapsed == 0) {
      // Only way timeElapsed should == 0 is when block.timestamp == epochStartTime
      // Therefore just return the lastTotalBonded value
      return maltDataLab.realValueOfLPToken(lastTotalBonded);
    }

    uint256 endValue = state.cumulativeTotalBonded + (lastTotalBonded.mul(diff));
    return maltDataLab.realValueOfLPToken((endValue) / timeElapsed);
  }

  function totalBonded() public view returns (uint256) {
    return _globalBonded;
  }

  function balanceOfBonded(address account) public view returns (uint256) {
    return userState[account].bonded;
  }

  function bondedEpoch(address account) public view returns (uint256) {
    return userState[account].bondedEpoch;
  }

  function epochData(uint256 epoch) public view returns(uint256, uint256, uint256) {
    return (epochState[epoch].lastTotalBonded, epochState[epoch].lastUpdateTime, epochState[epoch].cumulativeTotalBonded);
  }

  /*
   * INTERNAL VIEW FUNCTIONS
   */
  function _balanceCheck() internal view {
    require(stakeToken.balanceOf(address(this)) >= totalBonded(), "Balance inconsistency");
  }

  /*
   * INTERNAL FUNCTIONS
   */
  function _bond(address account, uint256 amount) internal {
    stakeToken.safeTransferFrom(msg.sender, address(this), amount);

    _addToBonded(account, amount);

    _balanceCheck();

    emit Bond(account, amount);
  }

  function _unbond(uint256 amountLPToken) internal notSameBlock {
    _removeFromBonded(msg.sender, amountLPToken, "LP: Insufficient bonded balance");

    stakeToken.safeTransfer(msg.sender, amountLPToken);

    _balanceCheck();

    emit Unbond(msg.sender, amountLPToken);
  }

  function _unbondAndBreak(uint256 amountLPToken) internal notSameBlock {
    _removeFromBonded(msg.sender, amountLPToken, "LP: Insufficient bonded balance");

    stakeToken.safeTransfer(address(dexHandler), amountLPToken);

    (uint256 amountMalt, uint256 amountReward) = dexHandler.removeLiquidity();

    malt.safeTransfer(msg.sender, amountMalt);
    rewardToken.safeTransfer(msg.sender, amountReward);

    _balanceCheck();

    emit UnbondAndBreak(msg.sender, amountLPToken, amountMalt, amountReward);
  }

  function _addToBonded(address account, uint256 amount) internal {
    userState[account].bonded = userState[account].bonded.add(amount);

    _updateEpochState(_globalBonded.add(amount));

    if (userState[account].bondedEpoch == 0) {
      userState[account].bondedEpoch = dao.epoch();
    }
  }

  function _removeFromBonded(address account, uint256 amount, string memory reason) internal {
    userState[account].bonded = userState[account].bonded.sub(amount, reason);

    _updateEpochState(_globalBonded.sub(amount, reason));
  }

  function _updateEpochState(uint256 newTotalBonded) internal {
    EpochState storage state = epochState[_currentEpoch];
    uint256 epoch = dao.epoch();
    uint256 epochStartTime = dao.getEpochStartTime(_currentEpoch);
    uint256 lastUpdateTime = state.lastUpdateTime;
    uint256 lengthOfEpoch = dao.epochLength();
    uint256 epochEndTime = epochStartTime + lengthOfEpoch;

    if (lastUpdateTime == 0) {
      lastUpdateTime = epochStartTime;
    }

    if (lastUpdateTime > epochEndTime) {
      lastUpdateTime = epochEndTime;
    }

    if (epoch == _currentEpoch) {
      // We are still in the same epoch. Just update
      uint256 finalTime = block.timestamp;
      if (block.timestamp > epochEndTime) {
        // We are past the end of the epoch so cap to end of epoch
        finalTime = epochEndTime;
      } 

      uint256 diff = finalTime - lastUpdateTime;

      if (diff > 0) {
        state.cumulativeTotalBonded = state.cumulativeTotalBonded + (state.lastTotalBonded.mul(diff));

        state.lastUpdateTime = finalTime;
        state.lastTotalBonded = newTotalBonded;
      }
    } else {
      // We have crossed at least 1 epoch boundary

      // Won't underflow due to check on lastUpdateTime above
      uint256 diff = epochEndTime - lastUpdateTime;

      state.cumulativeTotalBonded = state.cumulativeTotalBonded + (state.lastTotalBonded.mul(diff));
      state.lastUpdateTime = epochEndTime;
      state.lastTotalBonded = _globalBonded;

      for (uint256 i = _currentEpoch + 1; i <= epoch; i += 1) {
        state = epochState[i];
        epochStartTime = dao.getEpochStartTime(i);
        epochEndTime = epochStartTime + lengthOfEpoch;
        state.lastTotalBonded = _globalBonded;

        if (epochEndTime < block.timestamp) {
          // The desired epoch is in the past
          diff = lengthOfEpoch;
          state.lastUpdateTime = epochEndTime;
        } else {
          diff = block.timestamp - epochStartTime;
          state.lastUpdateTime = block.timestamp;
        }

        state.cumulativeTotalBonded = state.lastTotalBonded.mul(diff);
      }

      state.lastTotalBonded = newTotalBonded;
      _currentEpoch = epoch;
    } 

    _globalBonded = newTotalBonded;
  }

  /*
   * PRIVILEDGED FUNCTIONS
   */
  function setMiningService(address _miningService)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_miningService != address(0), "Cannot set 0 address");
    miningService = IMiningService(_miningService);
  }

  function setDAO(address _dao)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_dao != address(0), "Cannot set 0 address");
    dao = IDAO(_dao);
  }

  function setDexHandler(address _dexHandler)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    require(_dexHandler != address(0), "Cannot set 0 address");
    dexHandler = IDexHandler(_dexHandler);
  }

  function setCurrentEpoch(uint256 _epoch)
    public
    onlyRole(ADMIN_ROLE, "Must have admin privs")
  {
    _currentEpoch = _epoch;
  }
}
