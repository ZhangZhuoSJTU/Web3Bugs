// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './MixinKeys.sol';
import './MixinLockCore.sol';
import './MixinRoles.sol';
import './MixinFunds.sol';


contract MixinRefunds is
  MixinRoles,
  MixinFunds,
  MixinLockCore,
  MixinKeys
{
  // CancelAndRefund will return funds based on time remaining minus this penalty.
  // This is calculated as `proRatedRefund * refundPenaltyBasisPoints / BASIS_POINTS_DEN`.
  uint public refundPenaltyBasisPoints;

  uint public freeTrialLength;

  event CancelKey(
    uint indexed tokenId,
    address indexed owner,
    address indexed sendTo,
    uint refund
  );

  event RefundPenaltyChanged(
    uint freeTrialLength,
    uint refundPenaltyBasisPoints
  );

  function _initializeMixinRefunds() internal
  {
    // default to 10%
    refundPenaltyBasisPoints = 1000;
  }

  /**
   * @dev Invoked by the lock owner to destroy the user's ket and perform a refund and cancellation
   * of the key
   */
  function expireAndRefundFor(
    address payable _keyOwner,
    uint amount
  ) external
    onlyLockManager
    hasValidKey(_keyOwner)
  {
    _cancelAndRefund(_keyOwner, amount);
  }

  /**
   * @dev Destroys the key and sends a refund based on the amount of time remaining.
   * @param _tokenId The id of the key to cancel.
   */
  function cancelAndRefund(uint _tokenId)
    external
    onlyKeyManagerOrApproved(_tokenId)
  {
    address payable keyOwner = payable(ownerOf(_tokenId));
    uint refund = _getCancelAndRefundValue(keyOwner);

    _cancelAndRefund(keyOwner, refund);
  }

  /**
   * Allow the owner to change the refund penalty.
   */
  function updateRefundPenalty(
    uint _freeTrialLength,
    uint _refundPenaltyBasisPoints
  ) external
    onlyLockManager
  {
    emit RefundPenaltyChanged(
      _freeTrialLength,
      _refundPenaltyBasisPoints
    );

    freeTrialLength = _freeTrialLength;
    refundPenaltyBasisPoints = _refundPenaltyBasisPoints;
  }

  /**
   * @dev Determines how much of a refund a key owner would receive if they issued
   * a cancelAndRefund block.timestamp.
   * Note that due to the time required to mine a tx, the actual refund amount will be lower
   * than what the user reads from this call.
   */
  function getCancelAndRefundValueFor(
    address _keyOwner
  )
    external view
    returns (uint refund)
  {
    return _getCancelAndRefundValue(_keyOwner);
  }

  /**
   * @dev cancels the key for the given keyOwner and sends the refund to the msg.sender.
   */
  function _cancelAndRefund(
    address payable _keyOwner,
    uint refund
  ) internal
  {
    Key storage key = keyByOwner[_keyOwner];

    emit CancelKey(key.tokenId, _keyOwner, msg.sender, refund);
    // expirationTimestamp is a proxy for hasKey, setting this to `block.timestamp` instead
    // of 0 so that we can still differentiate hasKey from hasValidKey.
    key.expirationTimestamp = block.timestamp;

    if (refund > 0) {
      // Security: doing this last to avoid re-entrancy concerns
      _transfer(tokenAddress, _keyOwner, refund);
    }

    // inform the hook if there is one registered
    if(address(onKeyCancelHook) != address(0))
    {
      onKeyCancelHook.onKeyCancel(msg.sender, _keyOwner, refund);
    }
  }

  /**
   * @dev Determines how much of a refund a key owner would receive if they issued
   * a cancelAndRefund now.
   * @param _keyOwner The owner of the key check the refund value for.
   */
  function _getCancelAndRefundValue(
    address _keyOwner
  )
    private view
    hasValidKey(_keyOwner)
    returns (uint refund)
  {
    Key storage key = keyByOwner[_keyOwner];
    // Math: safeSub is not required since `hasValidKey` confirms timeRemaining is positive
    uint timeRemaining = key.expirationTimestamp - block.timestamp;
    if(timeRemaining + freeTrialLength >= expirationDuration) {
      refund = keyPrice;
    } else {
      refund = keyPrice * timeRemaining / expirationDuration;
    }

    // Apply the penalty if this is not a free trial
    if(freeTrialLength == 0 || timeRemaining + freeTrialLength < expirationDuration)
    {
      uint penalty = keyPrice * refundPenaltyBasisPoints / BASIS_POINTS_DEN;
      if (refund > penalty) {
        refund -= penalty;
      } else {
        refund = 0;
      }
    }
  }
}
