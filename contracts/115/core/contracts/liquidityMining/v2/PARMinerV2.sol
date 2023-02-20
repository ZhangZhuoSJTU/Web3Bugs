// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IGenericMinerV2.sol";
import "../../dex/interfaces/IDexAddressProvider.sol";
import "../../interfaces/IVaultsDataProvider.sol";
import "../../libraries/ABDKMath64x64.sol";
import "../../libraries/WadRayMath.sol";

contract PARMinerV2 is IGenericMinerV2 {
  using ABDKMath64x64 for int128;
  using ABDKMath64x64 for uint256;
  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using WadRayMath for uint256;

  IERC20 internal _par;
  IGovernanceAddressProvider internal _a;
  IDexAddressProvider internal immutable _dexAP;

  BoostConfig internal _boostConfig;

  mapping(address => UserInfo) internal _users;

  uint256 internal _totalStake;
  uint256 internal _totalStakeWithBoost;
  uint256 internal _liquidateCallerReward;

  uint256 internal _mimoBalanceTracker;
  uint256 internal _accMimoAmountPerShare;

  uint256 internal _parBalanceTracker;
  uint256 internal _accParAmountPerShare;

  modifier onlyManager {
    require(_a.parallel().controller().hasRole(_a.parallel().controller().MANAGER_ROLE(), msg.sender), "LM010");
    _;
  }

  constructor(
    IGovernanceAddressProvider govAP,
    IDexAddressProvider dexAP,
    BoostConfig memory boostConfig
  ) public {
    require(address(govAP) != address(0), "LM000");
    require(address(dexAP) != address(0), "LM000");
    require(boostConfig.a >= 1 && boostConfig.d > 0 && boostConfig.maxBoost >= 1, "LM004");
    _a = govAP;
    _dexAP = dexAP;
    _liquidateCallerReward = 200 ether;

    _par = IERC20(govAP.parallel().stablex());
    _par.approve(address(_a.parallel().core()), uint256(-1));

    _boostConfig = boostConfig;

    emit BoostConfigSet(boostConfig);
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
    Sets liquidation call reward amount
    @dev can only be called by protocol manager
    @param amount the amount to reward liquidate method callers with
   */
  function setLiquidateCallerReward(uint256 amount) external onlyManager {
    _liquidateCallerReward = amount;
  }

  /**
    Deposit an ERC20 pool token for staking
    @dev this function uses `transferFrom()` and requires pre-approval via `approve()` on the ERC20
    @param amount the amount of tokens to be deposited. Unit is in WEI
  **/
  function deposit(uint256 amount) public {
    _par.safeTransferFrom(msg.sender, address(this), amount);
    _increaseStake(msg.sender, amount);
  }

  /**
    Withdraw staked ERC20 pool tokens. Will fail if user does not have enough tokens staked
    @param amount the amount of tokens to be withdrawn. Unit is in WEI
  **/
  function withdraw(uint256 amount) public {
    _par.safeTransfer(msg.sender, amount);
    _decreaseStake(msg.sender, amount);
  }

  /**
    Liquidate a vault with a specific amount, and sell collaterall back to PAR
    @param vaultId the ID of the vault to be liquidated
    @param amount the amount of debt+liquidationFee to repay
    @param dexIndex the index of dex in dex address provider mapping
    @param dexTxData the tx data used to sell collateral back to PAR
  **/
  function liquidate(
    uint256 vaultId,
    uint256 amount,
    uint256 dexIndex,
    bytes calldata dexTxData
  ) public {
    uint256 parBalanceBefore = _par.balanceOf(address(this));

    IVaultsDataProvider.Vault memory vault = _a.parallel().vaultsData().vaults(vaultId);
    IERC20 collateralToken = IERC20(vault.collateralType);
    _a.parallel().core().liquidatePartial(vaultId, amount);

    (address proxy, address router) = _dexAP.dexMapping(dexIndex);
    collateralToken.approve(proxy, collateralToken.balanceOf(address(this)));
    router.call(dexTxData);
    _par.safeTransfer(msg.sender, _liquidateCallerReward);
    require(_par.balanceOf(address(this)) > parBalanceBefore, "LM104");
    _refreshPAR(_totalStake);
  }

  /**
    Releases outstanding rewards balances to the user
    @param _user the address of the user for which the reward tokens will be released
  */
  function releaseRewards(address _user) public override {
    UserInfo memory _userInfo = _users[_user];
    _releaseRewards(_user, _userInfo, _totalStake, false);
    _userInfo.accAmountPerShare = _accMimoAmountPerShare;
    _userInfo.accParAmountPerShare = _accParAmountPerShare;
    _updateBoost(_user, _userInfo);
  }

  /**
    Restakes the outstanding PAR reward balance to the user. Instead of sending the PAR to the user, it will be added to their stake
    @param _user the address of the user for which the PAR tokens will be restaked
  */
  function restakePAR(address _user) public {
    UserInfo storage userInfo = _users[_user];
    _refresh();
    _refreshPAR(_totalStake);
    uint256 pendingPAR = userInfo.stakeWithBoost.rayMul(_accParAmountPerShare.sub(userInfo.accParAmountPerShare));
    _parBalanceTracker = _parBalanceTracker.sub(pendingPAR);
    userInfo.accParAmountPerShare = _accParAmountPerShare;

    _increaseStake(_user, pendingPAR);
  }

  /**
    Reapplies the boost of the user, useful a whale's vMIMO has decreased but their boost is still the original value
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
    @return nnumber of PAR tokens that will be sent automatically when staking/unstaking
  */
  function pendingPAR(address _user) public view override returns (uint256) {
    UserInfo memory _userInfo = _users[_user];
    uint256 currentBalance = _par.balanceOf(address(this)).sub(_totalStake);
    uint256 reward = currentBalance.sub(_parBalanceTracker);
    uint256 accParAmountPerShare = _accParAmountPerShare.add(reward.rayDiv(_totalStakeWithBoost));

    return _pendingPAR(accParAmountPerShare, _userInfo.stakeWithBoost, _userInfo.accParAmountPerShare);
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

  function liquidateCallerReward() public view returns (uint256) {
    return _liquidateCallerReward;
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
    @param _user the address of the user
    @param _value the amount by which the stake will be increased
  */
  function _increaseStake(address _user, uint256 _value) internal {
    require(_value > 0, "LM101");

    UserInfo memory _userInfo = _users[_user];

    uint256 newTotalStake = _totalStake.add(_value);

    _releaseRewards(_user, _userInfo, newTotalStake, true);
    uint256 pendingPAR = _pendingPAR(_accParAmountPerShare, _userInfo.stakeWithBoost, _userInfo.accParAmountPerShare);
    _totalStake = newTotalStake;
    _userInfo.stake = _userInfo.stake.add(_value);
    _userInfo.accAmountPerShare = _accMimoAmountPerShare;
    _userInfo.accParAmountPerShare = _accParAmountPerShare;

    if (pendingPAR > 0) {
      _userInfo.stake = _userInfo.stake.add(pendingPAR);
      _totalStake = _totalStake.add(pendingPAR);
    }

    _updateBoost(_user, _userInfo);

    emit StakeIncreased(_user, _value.add(pendingPAR));
  }

  /**
    Refreshes the global state and subsequently decreases the stake a user has
    This is an internal call and meant to be called within derivative contracts
    @param _user the address of the user
    @param _value the amount by which the stake will be reduced
  */
  function _decreaseStake(address _user, uint256 _value) internal {
    require(_value > 0, "LM101");
    UserInfo memory _userInfo = _users[_user];
    require(_userInfo.stake >= _value, "LM102");

    uint256 newTotalStake = _totalStake.sub(_value);

    _releaseRewards(_user, _userInfo, newTotalStake, false);
    _totalStake = newTotalStake;
    _userInfo.stake = _userInfo.stake.sub(_value);
    _userInfo.accAmountPerShare = _accMimoAmountPerShare;
    _userInfo.accParAmountPerShare = _accParAmountPerShare;
    _updateBoost(_user, _userInfo);

    emit StakeDecreased(_user, _value);
  }

  /**
    Releases outstanding rewards balances to the user
    @param _user the address of the user for which the reward tokens will be released
  */
  function _releaseRewards(
    address _user,
    UserInfo memory _userInfo,
    uint256 _newTotalStake,
    bool _restakePAR
  ) internal {
    uint256 pendingMIMO = _pendingMIMO(_userInfo.stakeWithBoost, _userInfo.accAmountPerShare);
    _refresh();
    _refreshPAR(_newTotalStake);
    uint256 pendingPAR = _pendingPAR(_accParAmountPerShare, _userInfo.stakeWithBoost, _userInfo.accParAmountPerShare);
    if (_userInfo.stakeWithBoost > 0) {
      _mimoBalanceTracker = _mimoBalanceTracker.sub(pendingMIMO);
      _parBalanceTracker = _parBalanceTracker.sub(pendingPAR);
    }

    if (pendingPAR > 0 && !_restakePAR) {
      require(_par.transfer(_user, pendingPAR), "LM100");
    }
    if (pendingMIMO > 0) {
      require(_a.mimo().transfer(_user, pendingMIMO), "LM100");
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
    Updates the internal state variables after accounting for newly received MIMO tokens
  */
  function _refresh() internal {
    if (_totalStake == 0) {
      return;
    }
    uint256 currentMimoBalance = _a.mimo().balanceOf(address(this));
    uint256 mimoReward = currentMimoBalance.sub(_mimoBalanceTracker);
    _mimoBalanceTracker = currentMimoBalance;
    _accMimoAmountPerShare = _accMimoAmountPerShare.add(mimoReward.rayDiv(_totalStakeWithBoost));
  }

  /**
    Updates the internal state variables after accounting for newly received PAR tokens
    @dev need to pass updated stake as arg because reward token and stake token are the same
    @param newTotalStake updated total stake in PAR tokens
  */
  function _refreshPAR(uint256 newTotalStake) internal {
    if (_totalStake == 0) {
      return;
    }
    uint256 currentParBalance = _par.balanceOf(address(this)).sub(newTotalStake);
    uint256 parReward = currentParBalance.sub(_parBalanceTracker);

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
  function _pendingPAR(
    uint256 accParAmountPerShare,
    uint256 _userStakeWithBoost,
    uint256 _userAccParAmountPerShare
  ) internal view returns (uint256) {
    if (_totalStakeWithBoost == 0) {
      return 0;
    }
    return _userStakeWithBoost.rayMul(accParAmountPerShare.sub(_userAccParAmountPerShare));
  }

  /**
    Returns the boost multiplier the user is eligible for
    @param _user the address of the user
    @return the boost multuplie based on the user's veMIMO per the boost formula : a + b / (c + e^-((veMIMO / d) - e))
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
