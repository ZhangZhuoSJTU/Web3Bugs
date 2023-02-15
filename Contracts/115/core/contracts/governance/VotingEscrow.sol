// SPDX-License-Identifier: AGPL-3.0
/* solium-disable security/no-block-members */
pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IVotingEscrow.sol";
import "./interfaces/IGovernanceAddressProvider.sol";
import "../liquidityMining/interfaces/IGenericMiner.sol";

/**
 * @title  VotingEscrow
 * @notice Lockup GOV, receive vGOV (voting weight that decays over time)
 * @dev    Supports:
 *            1) Tracking MIMO Locked up
 *            2) Decaying voting weight lookup
 *            3) Closure of contract
 */
contract VotingEscrow is IVotingEscrow, ReentrancyGuard {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint256 public constant MAXTIME = 1460 days; // 365 * 4 years
  uint256 public minimumLockTime = 1 days;
  bool public expired = false;
  IERC20 public override stakingToken;

  mapping(address => LockedBalance) public locked;

  string public override name;
  string public override symbol;
  // solhint-disable-next-line
  uint256 public constant override decimals = 18;

  // AddressProvider
  IGovernanceAddressProvider public a;
  IGenericMiner public miner;

  constructor(
    IERC20 _stakingToken,
    IGovernanceAddressProvider _a,
    IGenericMiner _miner,
    string memory _name,
    string memory _symbol
  ) public {
    require(address(_stakingToken) != address(0));
    require(address(_a) != address(0));
    require(address(_miner) != address(0));

    stakingToken = _stakingToken;
    a = _a;
    miner = _miner;

    name = _name;
    symbol = _symbol;
  }

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender), "Caller is not a Manager");
    _;
  }

  /** @dev Modifier to ensure contract has not yet expired */
  modifier contractNotExpired() {
    require(!expired, "Contract is expired");
    _;
  }

  /**
   * @dev Creates a new lock
   * @param _value Total units of StakingToken to lockup
   * @param _unlockTime Time at which the stake should unlock
   */
  function createLock(uint256 _value, uint256 _unlockTime) external override nonReentrant contractNotExpired {
    LockedBalance memory locked_ = LockedBalance({ amount: locked[msg.sender].amount, end: locked[msg.sender].end });

    require(_value > 0, "Must stake non zero amount");
    require(locked_.amount == 0, "Withdraw old tokens first");
    require(_unlockTime > block.timestamp, "Can only lock until time in the future");
    require(_unlockTime.sub(block.timestamp) > minimumLockTime, "Lock duration should be larger than minimum locktime");

    _depositFor(msg.sender, _value, _unlockTime, locked_, LockAction.CREATE_LOCK);
  }

  /**
   * @dev Increases amount of stake thats locked up & resets decay
   * @param _value Additional units of StakingToken to add to exiting stake
   */
  function increaseLockAmount(uint256 _value) external override nonReentrant contractNotExpired {
    LockedBalance memory locked_ = LockedBalance({ amount: locked[msg.sender].amount, end: locked[msg.sender].end });

    require(_value > 0, "Must stake non zero amount");
    require(locked_.amount > 0, "No existing lock found");
    require(locked_.end > block.timestamp, "Cannot add to expired lock. Withdraw");

    _depositFor(msg.sender, _value, 0, locked_, LockAction.INCREASE_LOCK_AMOUNT);
  }

  /**
   * @dev Increases length of lockup & resets decay
   * @param _unlockTime New unlocktime for lockup
   */
  function increaseLockLength(uint256 _unlockTime) external override nonReentrant contractNotExpired {
    LockedBalance memory locked_ = LockedBalance({ amount: locked[msg.sender].amount, end: locked[msg.sender].end });

    require(locked_.amount > 0, "Nothing is locked");
    require(locked_.end > block.timestamp, "Lock expired");
    require(_unlockTime > locked_.end, "Can only increase lock time");
    require(_unlockTime.sub(locked_.end) > minimumLockTime, "Lock duration should be larger than minimum locktime");

    _depositFor(msg.sender, 0, _unlockTime, locked_, LockAction.INCREASE_LOCK_TIME);
  }

  /**
   * @dev Withdraws all the senders stake, providing lockup is over
   */
  function withdraw() external override {
    _withdraw(msg.sender);
  }

  /**
   * @dev Ends the contract, unlocking all stakes.
   * No more staking can happen. Only withdraw.
   */
  function expireContract() external override onlyManager contractNotExpired {
    expired = true;
    emit Expired();
  }

  /**
   * @dev Set miner address.
   * @param _miner new miner contract address
   */
  function setMiner(IGenericMiner _miner) external override onlyManager contractNotExpired {
    miner = _miner;
  }

  /**
   * @dev Set minimumLockTime.
   * @param _minimumLockTime minimum lockTime
   */
  function setMinimumLockTime(uint256 _minimumLockTime) external override onlyManager contractNotExpired {
    minimumLockTime = _minimumLockTime;
  }

  /***************************************
                    GETTERS
    ****************************************/

  /**
   * @dev Gets the user's votingWeight at the current time.
   * @param _owner User for which to return the votingWeight
   * @return uint256 Balance of user
   */
  function balanceOf(address _owner) public view override returns (uint256) {
    return balanceOfAt(_owner, block.timestamp);
  }

  /**
   * @dev Gets a users votingWeight at a given block timestamp
   * @param _owner User for which to return the balance
   * @param _blockTime Timestamp for which to calculate balance. Can not be in the past
   * @return uint256 Balance of user
   */
  function balanceOfAt(address _owner, uint256 _blockTime) public view override returns (uint256) {
    require(_blockTime >= block.timestamp, "Must pass block timestamp in the future");

    LockedBalance memory currentLock = locked[_owner];

    if (currentLock.end <= _blockTime) return 0;
    uint256 remainingLocktime = currentLock.end.sub(_blockTime);
    if (remainingLocktime > MAXTIME) {
      remainingLocktime = MAXTIME;
    }

    return currentLock.amount.mul(remainingLocktime).div(MAXTIME);
  }

  /**
   * @dev Deposits or creates a stake for a given address
   * @param _addr User address to assign the stake
   * @param _value Total units of StakingToken to lockup
   * @param _unlockTime Time at which the stake should unlock
   * @param _oldLocked Previous amount staked by this user
   * @param _action See LockAction enum
   */
  function _depositFor(
    address _addr,
    uint256 _value,
    uint256 _unlockTime,
    LockedBalance memory _oldLocked,
    LockAction _action
  ) internal {
    LockedBalance memory newLocked = LockedBalance({ amount: _oldLocked.amount, end: _oldLocked.end });

    // Adding to existing lock, or if a lock is expired - creating a new one
    newLocked.amount = newLocked.amount.add(_value);
    if (_unlockTime != 0) {
      newLocked.end = _unlockTime;
    }
    locked[_addr] = newLocked;

    if (_value != 0) {
      stakingToken.safeTransferFrom(_addr, address(this), _value);
    }

    miner.releaseMIMO(_addr);

    emit Deposit(_addr, _value, newLocked.end, _action, block.timestamp);
  }

  /**
   * @dev Withdraws a given users stake, providing the lockup has finished
   * @param _addr User for which to withdraw
   */
  function _withdraw(address _addr) internal nonReentrant {
    LockedBalance memory oldLock = LockedBalance({ end: locked[_addr].end, amount: locked[_addr].amount });
    require(block.timestamp >= oldLock.end || expired, "The lock didn't expire");
    require(oldLock.amount > 0, "Must have something to withdraw");

    uint256 value = uint256(oldLock.amount);

    LockedBalance memory currentLock = LockedBalance({ end: 0, amount: 0 });
    locked[_addr] = currentLock;

    stakingToken.safeTransfer(_addr, value);
    miner.releaseMIMO(_addr);

    emit Withdraw(_addr, value, block.timestamp);
  }
}
