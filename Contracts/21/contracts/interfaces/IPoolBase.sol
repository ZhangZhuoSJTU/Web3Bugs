// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../storage/PoolStorage.sol';

/// @title Sherlock Pool Controller
/// @author Evert Kors
/// @notice This contract is for every token pool
/// @dev Contract is meant to be included as a facet in the diamond
/// @dev Storage library is used
/// @dev Storage pointer is calculated based on last _token argument
interface IPoolBase {
  //
  // Events
  //

  //
  // View methods
  //

  /// @notice Returns the fee used on `_token` cooldown activation
  /// @param _token Token used
  /// @return Cooldown fee scaled by uint32(-1)
  function getCooldownFee(IERC20 _token) external view returns (uint32);

  /// @notice Returns SherX weight for `_token`
  /// @param _token Token used
  /// @return SherX weight scaled by uint16(-1)
  function getSherXWeight(IERC20 _token) external view returns (uint16);

  /// @notice Returns account responsible for `_token`
  /// @param _token Token used
  /// @return Account address
  function getGovPool(IERC20 _token) external view returns (address);

  /// @notice Returns boolean indicating if `_token` can be used for protocol payments
  /// @param _token Token used
  /// @return Premium boolean
  function isPremium(IERC20 _token) external view returns (bool);

  /// @notice Returns boolean indicating if `_token` can be used for staking
  /// @param _token Token used
  /// @return Staking boolean
  function isStake(IERC20 _token) external view returns (bool);

  /// @notice Returns current `_token` balance for `_protocol`
  /// @param _protocol Protocol identifier
  /// @param _token Token used
  /// @return Current balance
  function getProtocolBalance(bytes32 _protocol, IERC20 _token) external view returns (uint256);

  /// @notice Returns current `_token` premium for `_protocol`
  /// @param _protocol Protocol identifier
  /// @param _token Token used
  /// @return Current premium per block
  function getProtocolPremium(bytes32 _protocol, IERC20 _token) external view returns (uint256);

  /// @notice Returns linked lockToken for `_token`
  /// @param _token Token used
  /// @return Address of lockToken
  function getLockToken(IERC20 _token) external view returns (ILock);

  /// @notice Returns if `_protocol` is whitelisted for `_token`
  /// @param _protocol Protocol identifier
  /// @param _token Token used
  /// @return Boolean indicating whitelist status
  function isProtocol(bytes32 _protocol, IERC20 _token) external view returns (bool);

  /// @notice Returns array of whitelisted protcols
  /// @param _token Token used
  /// @return Array protocol identifiers
  function getProtocols(IERC20 _token) external view returns (bytes32[] memory);

  /// @notice Returns `_token` untake entry for `_staker` with id `_id`
  /// @param _staker Account that started unstake process
  /// @param _id ID of unstaking entry
  /// @param _token Token used
  /// @return Unstaking entry
  function getUnstakeEntry(
    address _staker,
    uint256 _id,
    IERC20 _token
  ) external view returns (PoolStorage.UnstakeEntry memory);

  /// @notice Return total debt in  `_token` whitelisted protocols accrued
  /// @param _token Token used
  /// @return Total accrued debt
  function getTotalAccruedDebt(IERC20 _token) external view returns (uint256);

  /// @notice Return current size of first money out pool
  /// @param _token Token used
  /// @return First money out size
  function getFirstMoneyOut(IERC20 _token) external view returns (uint256);

  /// @notice Return debt in  `_token` `_protocol` accrued
  /// @param _protocol Protocol identifier
  /// @param _token Token used
  /// @return Accrued debt
  function getAccruedDebt(bytes32 _protocol, IERC20 _token) external view returns (uint256);

  /// @notice Return total premium per block that whitelisted protocols are accrueing as debt
  /// @param _token Token used
  /// @return Total amount of premium
  function getTotalPremiumPerBlock(IERC20 _token) external view returns (uint256);

  /// @notice Returns block debt was last accrued.
  /// @param _token Token used
  /// @return Block number
  function getPremiumLastPaid(IERC20 _token) external view returns (uint40);

  /// @notice Return total amount of `_token` used as underlying for SHERX
  /// @param _token Token used
  /// @return Amount used as underlying
  function getSherXUnderlying(IERC20 _token) external view returns (uint256);

  /// @notice Return total amount of `_staker` unstaking entries for `_token`
  /// @param _staker Account used
  /// @param _token Token used
  /// @return Amount of entries
  function getUnstakeEntrySize(address _staker, IERC20 _token) external view returns (uint256);

  /// @notice Returns initial active unstaking enty for `_staker`
  /// @param _staker Account used
  /// @param _token Token used
  /// @return Initial ID of unstaking entry
  function getInitialUnstakeEntry(address _staker, IERC20 _token) external view returns (uint256);

  /// @notice Returns amount staked in `_token` that is not included in a yield strategy
  /// @param _token Token used
  /// @return Amount staked
  function getUnactivatedStakersPoolBalance(IERC20 _token) external view returns (uint256);

  /// @notice Returns amount staked in `_token` including yield strategy
  /// @param _token Token used
  /// @return Amount staked
  function getStakersPoolBalance(IERC20 _token) external view returns (uint256);

  /// @notice Returns `_staker` amount staked in `_token`
  /// @param _staker Account used
  /// @param _token Token used
  /// @return Amount staked
  function getStakerPoolBalance(address _staker, IERC20 _token) external view returns (uint256);

  /// @notice Returns unminted SHERX for `_token`
  /// @param _token Token used
  /// @return Unminted SHERX
  function getTotalUnmintedSherX(IERC20 _token) external view returns (uint256);

  /// @notice Returns stored amount of SHERX not allocated to stakers
  /// @param _token Token used
  /// @return Unallocated amount of SHERX
  function getUnallocatedSherXStored(IERC20 _token) external view returns (uint256);

  /// @notice Returns current amount of SHERX not allocated to stakers
  /// @param _token Token used
  /// @return Unallocated amount of SHERX
  function getUnallocatedSherXTotal(IERC20 _token) external view returns (uint256);

  /// @notice Returns current amount of SHERX not allocated to `_user`
  /// @param _user Staker in token
  /// @param _token Token used
  /// @return Unallocated amount of SHERX
  function getUnallocatedSherXFor(address _user, IERC20 _token) external view returns (uint256);

  /// @notice Returns SHERX distributed to `_token` stakers per block
  /// @param _token Token used
  /// @return Amount of SHERX distributed
  function getTotalSherXPerBlock(IERC20 _token) external view returns (uint256);

  /// @notice Returns SHERX distributed per block to sender for staking in `_token`
  /// @param _token Token used
  /// @return Amount of SHERX distributed
  function getSherXPerBlock(IERC20 _token) external view returns (uint256);

  /// @notice Returns SHERX distributed per block to `_user` for staking in `_token`
  /// @param _user Account used
  /// @param _token Token used
  /// @return Amount of SHERX distributed
  function getSherXPerBlock(address _user, IERC20 _token) external view returns (uint256);

  /// @notice Returns SHERX distributed per block when staking `_amount` of `_token`
  /// @param _amount Amount of tokens
  /// @param _token Token used
  /// @return SHERX to be distrubuted if staked
  function getSherXPerBlock(uint256 _amount, IERC20 _token) external view returns (uint256);

  /// @notice Returns block SHERX was last accrued to `_token`
  /// @param _token Token used
  /// @return Block last accrued
  function getSherXLastAccrued(IERC20 _token) external view returns (uint40);

  /// @notice Current exchange rate from lockToken to `_token`
  /// @param _token Token used
  /// @return Current exchange rate
  function LockToTokenXRate(IERC20 _token) external view returns (uint256);

  /// @notice Current exchange rate from lockToken to `_token` using `_amount`
  /// @param _amount Amount to be exchanged
  /// @param _token Token used
  /// @return Current exchange rate
  function LockToToken(uint256 _amount, IERC20 _token) external view returns (uint256);

  /// @notice Current exchange rate from `_token` to lockToken
  /// @param _token Token used
  /// @return Current exchange rate
  function TokenToLockXRate(IERC20 _token) external view returns (uint256);

  /// @notice Current exchange rate from `_token` to lockToken using `_amount`
  /// @param _amount Amount to be exchanged
  /// @param _token Token used
  /// @return Current exchange rate
  function TokenToLock(uint256 _amount, IERC20 _token) external view returns (uint256);

  //
  // State changing methods
  //

  /// @notice Set `_fee` used for activating cooldowns on `_token`
  /// @param _fee Fee scaled by uint32(-1)
  /// @param _token Token used
  function setCooldownFee(uint32 _fee, IERC20 _token) external;

  /// @notice Deposit `_amount` of `_token` on behalf of `_protocol`
  /// @param _protocol Protocol identifier
  /// @param _amount Amount of tokens
  /// @param _token Token used
  function depositProtocolBalance(
    bytes32 _protocol,
    uint256 _amount,
    IERC20 _token
  ) external;

  /// @notice Withdraw `_amount` of `_token` on behalf of `_protocol` to `_receiver`
  /// @param _protocol Protocol identifier
  /// @param _amount Amount of tokens
  /// @param _receiver Address receiving the amount
  /// @param _token Token used
  function withdrawProtocolBalance(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver,
    IERC20 _token
  ) external;

  /// @notice Start unstaking flow for sender with `_amount` of lockTokens
  /// @param _amount Amount of lockTokens
  /// @param _token Token used
  /// @return ID of unstaking entry
  /// @dev e.g. _token is DAI, _amount is amount of lockDAI
  function activateCooldown(uint256 _amount, IERC20 _token) external returns (uint256);

  /// @notice Cancel unstaking `_token` with entry `_id` for sender
  /// @param _id ID of unstaking entry
  /// @param _token Token used
  function cancelCooldown(uint256 _id, IERC20 _token) external;

  /// @notice Returns lockTokens to _account if unstaking entry _id is expired
  /// @param _account Account that initiated unstaking flow
  /// @param _id ID of unstaking entry
  /// @param _token Token used
  function unstakeWindowExpiry(
    address _account,
    uint256 _id,
    IERC20 _token
  ) external;

  /// @notice Unstake _token for sender with entry _id, send to _receiver
  /// @param _id ID of unstaking entry
  /// @param _receiver Account receiving the tokens
  /// @param _token Token used
  /// @return amount of tokens unstaked
  function unstake(
    uint256 _id,
    address _receiver,
    IERC20 _token
  ) external returns (uint256 amount);

  /// @notice Pay off accrued debt of whitelisted protocols
  /// @param _token Token used
  function payOffDebtAll(IERC20 _token) external;

  /// @notice Remove `_protocol` from `_token` whitelist, send remaining balance to `_receiver`
  /// @param _protocol Protocol indetifier
  /// @param _index Entry of protocol in storage array
  /// @param _forceDebt If protocol has outstanding debt, pay off
  /// @param _receiver Receiver of remaining deposited balance
  /// @param _token Token used
  function cleanProtocol(
    bytes32 _protocol,
    uint256 _index,
    bool _forceDebt,
    address _receiver,
    IERC20 _token
  ) external;
}
