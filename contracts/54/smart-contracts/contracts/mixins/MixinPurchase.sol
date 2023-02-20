// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './MixinDisable.sol';
import './MixinKeys.sol';
import './MixinLockCore.sol';
import './MixinFunds.sol';


/**
 * @title Mixin for the purchase-related functions.
 * @author HardlyDifficult
 * @dev `Mixins` are a design pattern seen in the 0x contracts.  It simply
 * separates logically groupings of code to ease readability.
 */
contract MixinPurchase is
  MixinFunds,
  MixinDisable,
  MixinLockCore,
  MixinKeys
{
  event RenewKeyPurchase(address indexed owner, uint newExpiration);

  /**
  * @dev Purchase function
  * @param _value the number of tokens to pay for this purchase >= the current keyPrice - any applicable discount
  * (_value is ignored when using ETH)
  * @param _recipient address of the recipient of the purchased key
  * @param _referrer address of the user making the referral
  * @param _data arbitrary data populated by the front-end which initiated the sale
  * @dev Setting _value to keyPrice exactly doubles as a security feature. That way if the lock owner increases the
  * price while my transaction is pending I can't be charged more than I expected (only applicable to ERC-20 when more
  * than keyPrice is approved for spending).
  */
  function purchase(
    uint256 _value,
    address _recipient,
    address _referrer,
    bytes calldata _data
  ) external payable
    onlyIfAlive
    notSoldOut
  {
    require(_recipient != address(0), 'INVALID_ADDRESS');

    // Assign the key
    Key storage toKey = keyByOwner[_recipient];
    uint idTo = toKey.tokenId;
    uint newTimeStamp;

    if (idTo == 0) {
      // Assign a new tokenId (if a new owner or previously transferred)
      _assignNewTokenId(toKey);
      // refresh the cached value
      idTo = toKey.tokenId;
      _recordOwner(_recipient, idTo);
      newTimeStamp = block.timestamp + expirationDuration;
      toKey.expirationTimestamp = newTimeStamp;

      // trigger event
      emit Transfer(
        address(0), // This is a creation.
        _recipient,
        idTo
      );
    } else if (toKey.expirationTimestamp > block.timestamp) {
      // This is an existing owner trying to extend their key
      newTimeStamp = toKey.expirationTimestamp + expirationDuration;
      toKey.expirationTimestamp = newTimeStamp;
      emit RenewKeyPurchase(_recipient, newTimeStamp);
    } else {
      // This is an existing owner trying to renew their expired key
      newTimeStamp = block.timestamp + expirationDuration;
      toKey.expirationTimestamp = newTimeStamp;

      // reset the key Manager to 0x00
      _setKeyManagerOf(idTo, address(0));

      emit RenewKeyPurchase(_recipient, newTimeStamp);
    }

    (uint inMemoryKeyPrice, uint discount, uint tokens) = _purchasePriceFor(_recipient, _referrer, _data);
    if (discount > 0)
    {
      unlockProtocol.recordConsumedDiscount(discount, tokens);
    }

    // Record price without any tips
    unlockProtocol.recordKeyPurchase(inMemoryKeyPrice, _referrer);

    // We explicitly allow for greater amounts of ETH or tokens to allow 'donations'
    uint pricePaid;
    if(tokenAddress != address(0))
    {
      pricePaid = _value;
      IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
      token.transferFrom(msg.sender, address(this), pricePaid);
    }
    else
    {
      pricePaid = msg.value;
    }
    require(pricePaid >= inMemoryKeyPrice, 'INSUFFICIENT_VALUE');

    if(address(onKeyPurchaseHook) != address(0))
    {
      onKeyPurchaseHook.onKeyPurchase(msg.sender, _recipient, _referrer, _data, inMemoryKeyPrice, pricePaid);
    }
  }

  /**
   * @notice returns the minimum price paid for a purchase with these params.
   * @dev minKeyPrice considers any discount from Unlock or the OnKeyPurchase hook
   */
  function purchasePriceFor(
    address _recipient,
    address _referrer,
    bytes calldata _data
  ) external view
    returns (uint minKeyPrice)
  {
    (minKeyPrice, , ) = _purchasePriceFor(_recipient, _referrer, _data);
  }

  /**
   * @notice returns the minimum price paid for a purchase with these params.
   * @dev minKeyPrice considers any discount from Unlock or the OnKeyPurchase hook
   * unlockDiscount and unlockTokens are the values returned from `computeAvailableDiscountFor`
   */
  function _purchasePriceFor(
    address _recipient,
    address _referrer,
    bytes memory _data
  ) internal view
    returns (uint minKeyPrice, uint unlockDiscount, uint unlockTokens)
  {
    if(address(onKeyPurchaseHook) != address(0))
    {
      minKeyPrice = onKeyPurchaseHook.keyPurchasePrice(msg.sender, _recipient, _referrer, _data);
    }
    else
    {
      minKeyPrice = keyPrice;
    }

    if(minKeyPrice > 0)
    {
      (unlockDiscount, unlockTokens) = unlockProtocol.computeAvailableDiscountFor(_recipient, minKeyPrice);
      require(unlockDiscount <= minKeyPrice, 'INVALID_DISCOUNT_FROM_UNLOCK');
      minKeyPrice -= unlockDiscount;
    }
  }
}
