// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IGenericMinerV2.sol";
import "../../libraries/WadRayMath.sol";
import "../../libraries/ABDKMath64x64.sol";

/*
    GenericMiner is based on ERC2917. https://github.com/gnufoo/ERC2917-Proposal

    The Objective of GenericMiner is to implement a decentralized staking mechanism, which calculates _users' share
    by accumulating stake * time. And calculates _users revenue from anytime t0 to t1 by the formula below:

        user_accumulated_stake(time1) - user_accumulated_stake(time0)
       _____________________________________________________________________________  * (gross_stake(t1) - gross_stake(t0))
       total_accumulated_stake(time1) - total_accumulated_stake(time0)

    The boost feature reuses the same principle and applies a multiplier to the stake.

    The boost multiplier formula is the following : a + b / (c + e^-((veMIMO / d) - e))
*/

contract GenericMinerV2 is IGenericMinerV2 {
  using ABDKMath64x64 for int128;
  using ABDKMath64x64 for uint256;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  IERC20 internal immutable _par;
  IGovernanceAddressProvider internal immutable _a;

  BoostConfig internal _boostConfig;

  mapping(address => UserInfo) internal _users;

  uint256 internal _totalStake;
  uint256 internal _totalStakeWithBoost;

  uint256 internal _mimoBalanceTracker;
  uint256 internal _accMimoAmountPerShare;

  uint256 internal _parBalanceTracker;
  uint256 internal _accParAmountPerShare;

  modifier onlyManager {
    require(_a.parallel().controller().hasRole(_a.parallel().controller().MANAGER_ROLE(), msg.sender), "LM010");
    _;
  }

  constructor(IGovernanceAddressProvider _addresses, BoostConfig memory boostConfig) public {
    require(address(_addresses) != address(0), "LM000");
    _a = _addresses;
    _par = IERC20(_addresses.parallel().stablex());
    require(boostConfig.a >= 1 && boostConfig.d > 0 && boostConfig.maxBoost >= 1, "LM004");
    _boostConfig = boostConfig;

    emit BoostConfigSet(_boostConfig);
  }

  /**
    Sets new boost config
    @dev can only be called by protocol manager
    @param newBoostConfig contains all boost multiplier parameters, see {IGenericMinerV2 - BoostConfig}
   */
  function setBoostConfig(BoostConfig memory newBoostConfig) external onlyManager {
    require(newBoostConfig.a >= 1 && newBoostConfig.d > 0 && newBoostConfig.maxBoost >= 1, "LM004");
    _boostConfig = newBoostConfig;

    emit BoostConfigSet(_boostConfig);
  }

  /**
    Releases outstanding rewards balances to the user
    @param _user the address of the user for which the reward tokens will be released
  */
  function releaseRewards(address _user) public virtual override {
    UserInfo memory _userInfo = _users[_user];
    _releaseRewards(_user, _userInfo);
    _userInfo.accAmountPerShare = _accMimoAmountPerShare;
    _userInfo.accParAmountPerShare = _accParAmountPerShare;
    _updateBoost(_user, _userInfo);
  }

  /**
    Reapplies the boost of the user, useful if a whale's vMIMO has decreased but their boost is still the original value
  */
  function updateBoost(address _user) public {
    UserInfo memory userInfo = _users[_user];
    _updateBoost(_user, userInfo);
  }

  /**
    Returns the number of tokens a user has staked
    @param _user the address of the user
    @return number of staked tokens
  */
  function stake(address _user) public view override returns (uint256) {
    return _users[_user].stake;
  }

  /**
    Returns the number of tokens a user has staked with the boost
    @param _user the address of the user
    @return number of staked tokens with boost
  */
  function stakeWithBoost(address _user) public view override returns (uint256) {
    return _users[_user].stakeWithBoost;
  }

  /**
    Returns the number of tokens a user can claim via `releaseMIMO`
    @param _user the address of the user
    @return number of MIMO tokens that the user can claim
  */
  function pendingMIMO(address _user) public view override returns (uint256) {
    UserInfo memory _userInfo = _users[_user];
    return _pendingMIMO(_userInfo.stakeWithBoost, _userInfo.accAmountPerShare);
  }

  /**
    Returns the number of PAR tokens the user has earned as a reward
    @param _user the address of the user
    @return number of PAR tokens that will be sent automatically when staking/unstaking
  */
  function pendingPAR(address _user) public view override returns (uint256) {
    UserInfo memory _userInfo = _users[_user];
    return _pendingPAR(_userInfo.stakeWithBoost, _userInfo.accParAmountPerShare);
  }

  function par() public view override returns (IERC20) {
    return _par;
  }

  function a() public view override returns (IGovernanceAddressProvider) {
    return _a;
  }

  function boostConfig() public view override returns (BoostConfig memory) {
    return _boostConfig;
  }

  function totalStake() public view override returns (uint256) {
    return _totalStake;
  }

  function totalStakeWithBoost() public view override returns (uint256) {
    return _totalStakeWithBoost;
  }

  /**
    Returns the userInfo stored of a user
    @param _user the address of the user
    @return `struct UserInfo {
      uint256 stake;
      uint256 stakeWithBoost;
      uint256 accAmountPerShare;
      uint256 accParAmountPerShare;
    }`
  **/
  function userInfo(address _user) public view override returns (UserInfo memory) {
    return _users[_user];
  }

  /**
    Refreshes the global state and subsequently increases a user's stake
    This is an internal call and meant to be called within derivative contracts
    @param user the address of the user
    @param value the amount by which the stake will be increased
  */
  function _increaseStake(address user, uint256 value) internal {
    require(value > 0, "LM101");
    UserInfo memory _userInfo = _users[user];

    _releaseRewards(user, _userInfo);
    _totalStake = _totalStake.add(value);
    _userInfo.stake = _userInfo.stake.add(value);
    _userInfo.accAmountPerShare = _accMimoAmountPerShare;
    _userInfo.accParAmountPerShare = _accParAmountPerShare;
    _updateBoost(user, _userInfo);

    emit StakeIncreased(user, value);
  }

  /**
    Refreshes the global state and subsequently decreases the stake a user has
    This is an internal call and meant to be called within derivative contracts
    @param user the address of the user
    @param value the amount by which the stake will be reduced
  */
  function _decreaseStake(address user, uint256 value) internal {
    require(value > 0, "LM101");
    UserInfo memory _userInfo = _users[user];
    require(_userInfo.stake >= value, "LM102");

    _releaseRewards(user, _userInfo);
    _totalStake = _totalStake.sub(value);
    _userInfo.stake = _userInfo.stake.sub(value);
    _userInfo.accAmountPerShare = _accMimoAmountPerShare;
    _userInfo.accParAmountPerShare = _accParAmountPerShare;
    _updateBoost(user, _userInfo);

    emit StakeDecreased(user, value);
  }

  function _releaseRewards(address _user, UserInfo memory _userInfo) internal {
    uint256 pendingMIMO = _pendingMIMO(_userInfo.stakeWithBoost, _userInfo.accAmountPerShare);
    uint256 pendingPAR = _pendingPAR(_userInfo.stakeWithBoost, _userInfo.accParAmountPerShare);
    _refresh();

    if (_userInfo.stakeWithBoost > 0) {
      _mimoBalanceTracker = _mimoBalanceTracker.sub(pendingMIMO);
      _parBalanceTracker = _parBalanceTracker.sub(pendingPAR);
    }

    if (pendingMIMO > 0) {
      require(_a.mimo().transfer(_user, pendingMIMO), "LM100");
    }
    if (pendingPAR > 0) {
      require(_par.transfer(_user, pendingPAR), "LM100");
    }
  }

  /**
    Updates the internal state variables based on user's veMIMO hodlings
    @param _user the address of the user
   */
  function _updateBoost(address _user, UserInfo memory _userInfo) internal {
    // if user had a boost already, first remove it from the totalStakeWithBoost
    if (_userInfo.stakeWithBoost > 0) {
      _totalStakeWithBoost = _totalStakeWithBoost.sub(_userInfo.stakeWithBoost);
    }
    uint256 multiplier = _getBoostMultiplier(_user);
    _userInfo.stakeWithBoost = _userInfo.stake.wadMul(multiplier);
    _totalStakeWithBoost = _totalStakeWithBoost.add(_userInfo.stakeWithBoost);
    _users[_user] = _userInfo;
  }

  /**
    Refreshes the global state and subsequently updates a user's stake
    This is an internal call and meant to be called within derivative contracts
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
    Updates the internal state variables after accounting for newly received MIMO and PAR reward tokens
  */
  function _refresh() internal {
    if (_totalStake == 0) {
      return;
    }
    uint256 currentMimoBalance = _a.mimo().balanceOf(address(this));
    uint256 currentParBalance = _par.balanceOf(address(this));
    uint256 mimoReward = currentMimoBalance.sub(_mimoBalanceTracker);
    uint256 parReward = currentParBalance.sub(_parBalanceTracker);

    _mimoBalanceTracker = currentMimoBalance;
    _accMimoAmountPerShare = _accMimoAmountPerShare.add(mimoReward.rayDiv(_totalStakeWithBoost));
    _parBalanceTracker = currentParBalance;
    _accParAmountPerShare = _accParAmountPerShare.add(parReward.rayDiv(_totalStakeWithBoost));
  }

  /**
    Returns the number of tokens a user can claim via `releaseMIMO`
    @return number of MIMO tokens that the user can claim
  */
  function _pendingMIMO(uint256 _userStakeWithBoost, uint256 _userAccAmountPerShare) internal view returns (uint256) {
    if (_totalStakeWithBoost == 0) {
      return 0;
    }
    uint256 currentBalance = _a.mimo().balanceOf(address(this));
    uint256 reward = currentBalance.sub(_mimoBalanceTracker);
    uint256 accMimoAmountPerShare = _accMimoAmountPerShare.add(reward.rayDiv(_totalStakeWithBoost));
    return _userStakeWithBoost.rayMul(accMimoAmountPerShare.sub(_userAccAmountPerShare));
  }

  /**
    Returns the number of PAR tokens the user has earned as a reward
    @return number of PAR tokens that will be sent automatically when staking/unstaking
  */
  function _pendingPAR(uint256 _userStakeWithBoost, uint256 _userAccParAmountPerShare) internal view returns (uint256) {
    if (_totalStakeWithBoost == 0) {
      return 0;
    }
    uint256 currentBalance = _par.balanceOf(address(this));
    uint256 reward = currentBalance.sub(_parBalanceTracker);
    uint256 accParAmountPerShare = _accParAmountPerShare.add(reward.rayDiv(_totalStakeWithBoost));

    return _userStakeWithBoost.rayMul(accParAmountPerShare.sub(_userAccParAmountPerShare));
  }

  /**
    Returns the boost multiplier the user is eligible for
    @param _user the address of the user
    @return the boost multiplier based on the user's veMIMO per the boost formula : a + b / (c + e^-((veMIMO / d) - e))
   */
  function _getBoostMultiplier(address _user) internal view returns (uint256) {
    uint256 veMIMO = _a.votingEscrow().balanceOf(_user);

    if (veMIMO == 0) return 1e18;

    // Convert boostConfig variables to signed 64.64-bit fixed point numbers
    int128 a = ABDKMath64x64.fromUInt(_boostConfig.a);
    int128 b = ABDKMath64x64.fromUInt(_boostConfig.b);
    int128 c = ABDKMath64x64.fromUInt(_boostConfig.c);
    int128 e = ABDKMath64x64.fromUInt(_boostConfig.e);
    int128 DECIMALS = ABDKMath64x64.fromUInt(1e18);

    int128 e1 = veMIMO.divu(_boostConfig.d); // x/25000
    int128 e2 = e1.sub(e); // x/25000 - 6
    int128 e3 = e2.neg(); // -(x/25000 - 6)
    int128 e4 = e3.exp(); // e^-(x/25000 - 6)
    int128 e5 = e4.add(c); // 1 + e^-(x/25000 - 6)
    int128 e6 = b.div(e5).add(a); // 1 + 3/(1 + e^-(x/25000 - 6))
    uint64 e7 = e6.mul(DECIMALS).toUInt(); // convert back to uint64
    uint256 multiplier = uint256(e7); // convert to uint256

    require(multiplier >= 1e18 && multiplier <= _boostConfig.maxBoost, "LM103");

    return multiplier;
  }
}
