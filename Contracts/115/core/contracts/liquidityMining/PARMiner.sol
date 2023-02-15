// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/WadRayMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./interfaces/IMIMO.sol";
import "./interfaces/IGenericMiner.sol";

contract PARMiner {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  struct UserInfo {
    uint256 stake;
    uint256 accAmountPerShare;
    uint256 accParAmountPerShare;
  }

  event StakeIncreased(address indexed user, uint256 stake);
  event StakeDecreased(address indexed user, uint256 stake);

  IERC20 public par;

  mapping(address => UserInfo) internal _users;

  uint256 public totalStake;
  IGovernanceAddressProvider public a;

  uint256 internal _balanceTracker;
  uint256 internal _accAmountPerShare;

  uint256 internal _parBalanceTracker;
  uint256 internal _accParAmountPerShare;

  constructor(IGovernanceAddressProvider _addresses) public {
    require(address(_addresses) != address(0));
    a = _addresses;

    par = IERC20(_addresses.parallel().stablex());
  }

  /**
    Deposit an ERC20 pool token for staking
    @dev this function uses `transferFrom()` and requires pre-approval via `approve()` on the ERC20.
    @param amount the amount of tokens to be deposited. Unit is in WEI.
  **/
  function deposit(uint256 amount) public {
    par.safeTransferFrom(msg.sender, address(this), amount);
    _increaseStake(msg.sender, amount);
  }

  /**
    Withdraw staked ERC20 pool tokens. Will fail if user does not have enough tokens staked.
    @param amount the amount of tokens to be withdrawn. Unit is in WEI.
  **/
  function withdraw(uint256 amount) public {
    par.safeTransfer(msg.sender, amount);
    _decreaseStake(msg.sender, amount);
  }

  /**
    Releases the outstanding MIMO balance to the user.
    @param _user the address of the user for which the MIMO tokens will be released.
  */
  function releaseMIMO(address _user) public virtual {
    UserInfo storage userInfo = _users[_user];
    _refresh();
    _refreshPAR(totalStake);
    uint256 pending = userInfo.stake.rayMul(_accAmountPerShare.sub(userInfo.accAmountPerShare));
    _balanceTracker = _balanceTracker.sub(pending);
    userInfo.accAmountPerShare = _accAmountPerShare;
    require(a.mimo().transfer(_user, pending));
  }

  /**
    Releases the outstanding PAR reward balance to the user.
    @param _user the address of the user for which the PAR tokens will be released.
  */
  function releasePAR(address _user) public virtual {
    UserInfo storage userInfo = _users[_user];
    _refresh();
    _refreshPAR(totalStake);
    uint256 pending = userInfo.stake.rayMul(_accParAmountPerShare.sub(userInfo.accParAmountPerShare));
    _parBalanceTracker = _parBalanceTracker.sub(pending);
    userInfo.accParAmountPerShare = _accParAmountPerShare;
    require(par.transfer(_user, pending));
  }

  /**
    Restakes the outstanding PAR reward balance to the user. Instead of sending the PAR to the user, it will be added to their stake
    @param _user the address of the user for which the PAR tokens will be restaked.
  */
  function restakePAR(address _user) public virtual {
    UserInfo storage userInfo = _users[_user];
    _refresh();
    _refreshPAR(totalStake);
    uint256 pending = userInfo.stake.rayMul(_accParAmountPerShare.sub(userInfo.accParAmountPerShare));
    _parBalanceTracker = _parBalanceTracker.sub(pending);
    userInfo.accParAmountPerShare = _accParAmountPerShare;

    _increaseStake(_user, pending);
  }

  /**
    Returns the number of tokens a user has staked.
    @param _user the address of the user.
    @return number of staked tokens
  */
  function stake(address _user) public view returns (uint256) {
    return _users[_user].stake;
  }

  /**
    Returns the number of tokens a user can claim via `releaseMIMO`.
    @param _user the address of the user.
    @return number of MIMO tokens that the user can claim
  */
  function pendingMIMO(address _user) public view returns (uint256) {
    uint256 currentBalance = a.mimo().balanceOf(address(this));
    uint256 reward = currentBalance.sub(_balanceTracker);
    uint256 accAmountPerShare = _accAmountPerShare.add(reward.rayDiv(totalStake));

    return _users[_user].stake.rayMul(accAmountPerShare.sub(_users[_user].accAmountPerShare));
  }

  /**
    Returns the number of PAR tokens the user has earned as a reward
    @param _user the address of the user.
    @return nnumber of PAR tokens that will be sent automatically when staking/unstaking
  */
  function pendingPAR(address _user) public view returns (uint256) {
    uint256 currentBalance = par.balanceOf(address(this)).sub(totalStake);
    uint256 reward = currentBalance.sub(_parBalanceTracker);
    uint256 accParAmountPerShare = _accParAmountPerShare.add(reward.rayDiv(totalStake));

    return _users[_user].stake.rayMul(accParAmountPerShare.sub(_users[_user].accParAmountPerShare));
  }

  /**
    Returns the userInfo stored of a user.
    @param _user the address of the user.
    @return `struct UserInfo {
      uint256 stake;
      uint256 rewardDebt;
    }`
  **/
  function userInfo(address _user) public view returns (UserInfo memory) {
    return _users[_user];
  }

  /**
    Refreshes the global state and subsequently decreases the stake a user has.
    This is an internal call and meant to be called within derivative contracts.
    @param user the address of the user
    @param value the amount by which the stake will be reduced
  */
  function _decreaseStake(address user, uint256 value) internal {
    require(value > 0, "STAKE_MUST_BE_GREATER_THAN_ZERO"); //TODO cleanup error message

    UserInfo storage userInfo = _users[user];
    require(userInfo.stake >= value, "INSUFFICIENT_STAKE_FOR_USER"); //TODO cleanup error message
    _refresh();
    uint256 newTotalStake = totalStake.sub(value);
    _refreshPAR(newTotalStake);

    uint256 pending = userInfo.stake.rayMul(_accAmountPerShare.sub(userInfo.accAmountPerShare));
    _balanceTracker = _balanceTracker.sub(pending);
    userInfo.accAmountPerShare = _accAmountPerShare;

    uint256 pendingPAR = userInfo.stake.rayMul(_accParAmountPerShare.sub(userInfo.accParAmountPerShare));

    _parBalanceTracker = _parBalanceTracker.sub(pendingPAR);
    userInfo.accParAmountPerShare = _accParAmountPerShare;

    userInfo.stake = userInfo.stake.sub(value);
    totalStake = newTotalStake;

    if (pending > 0) {
      require(a.mimo().transfer(user, pending));
    }
    if (pendingPAR > 0) {
      require(par.transfer(user, pendingPAR));
    }

    emit StakeDecreased(user, value);
  }

  /**
    Refreshes the global state and subsequently increases a user's stake.
    This is an internal call and meant to be called within derivative contracts.
    @param user the address of the user
    @param value the amount by which the stake will be increased
  */
  function _increaseStake(address user, uint256 value) internal {
    require(value > 0, "STAKE_MUST_BE_GREATER_THAN_ZERO"); //TODO cleanup error message

    UserInfo storage userInfo = _users[user];

    _refresh();

    uint256 newTotalStake = totalStake.add(value);
    _refreshPAR(newTotalStake);

    uint256 pending;
    uint256 pendingPAR;
    if (userInfo.stake > 0) {
      pending = userInfo.stake.rayMul(_accAmountPerShare.sub(userInfo.accAmountPerShare));
      _balanceTracker = _balanceTracker.sub(pending);

      // maybe we should add the accumulated PAR to the stake of the user instead?
      pendingPAR = userInfo.stake.rayMul(_accParAmountPerShare.sub(userInfo.accParAmountPerShare));
      _parBalanceTracker = _parBalanceTracker.sub(pendingPAR);
    }

    totalStake = newTotalStake;
    userInfo.stake = userInfo.stake.add(value);

    userInfo.accAmountPerShare = _accAmountPerShare;
    userInfo.accParAmountPerShare = _accParAmountPerShare;

    if (pendingPAR > 0) {
      // add pendingPAR balance to stake and totalStake instead of sending it back
      userInfo.stake = userInfo.stake.add(pendingPAR);
      totalStake = totalStake.add(pendingPAR);
    }
    if (pending > 0) {
      require(a.mimo().transfer(user, pending));
    }

    emit StakeIncreased(user, value.add(pendingPAR));
  }

  /**
    Refreshes the global state and subsequently updates a user's stake.
    This is an internal call and meant to be called within derivative contracts.
    @param user the address of the user
    @param stake the new amount of stake for the user
  */
  function _updateStake(address user, uint256 stake) internal returns (bool) {
    uint256 oldStake = _users[user].stake;
    if (stake > oldStake) {
      _increaseStake(user, stake.sub(oldStake));
    }
    if (stake < oldStake) {
      _decreaseStake(user, oldStake.sub(stake));
    }
  }

  /**
    Updates the internal state variables after accounting for newly received MIMO tokens.
  */
  function _refresh() internal {
    if (totalStake == 0) {
      return;
    }
    uint256 currentBalance = a.mimo().balanceOf(address(this));
    uint256 reward = currentBalance.sub(_balanceTracker);
    _balanceTracker = currentBalance;
    _accAmountPerShare = _accAmountPerShare.add(reward.rayDiv(totalStake));
  }

  /**
    Updates the internal state variables after accounting for newly received PAR tokens.
  */
  function _refreshPAR(uint256 newTotalStake) internal {
    if (totalStake == 0) {
      return;
    }
    uint256 currentParBalance = par.balanceOf(address(this)).sub(newTotalStake);
    uint256 parReward = currentParBalance.sub(_parBalanceTracker);

    _parBalanceTracker = currentParBalance;
    _accParAmountPerShare = _accParAmountPerShare.add(parReward.rayDiv(totalStake));
  }
}
