pragma solidity 0.5.17;

import '../interfaces/hooks/ILockKeyPurchaseHook.sol';
import '../interfaces/hooks/ILockKeyCancelHook.sol';
import '../interfaces/IPublicLock.sol';


/**
 * @title Test contract for lock event hooks.
 * @author Nick Mancuso (unlock-protocol.com)
 */
contract TestEventHooks is ILockKeyPurchaseHook, ILockKeyCancelHook
{
  event OnKeyPurchase(
    address lock,
    address from,
    address recipient,
    address referrer,
    uint minKeyPrice,
    uint pricePaid
  );
  event OnKeyCancel(
    address lock,
    address operator,
    address to,
    uint refund
  );

  uint public discount;
  bool public isPurchaseSupported;

  function configure(
    bool _isPurchaseSupported,
    uint _discount
  ) public
  {
    isPurchaseSupported = _isPurchaseSupported;
    discount = _discount;
  }

  function onKeyPurchase(
    address _from,
    address _recipient,
    address _referrer,
    bytes calldata /*_data*/,
    uint _minKeyPrice,
    uint _pricePaid
  ) external
  {
    emit OnKeyPurchase(msg.sender, _from, _recipient, _referrer, _minKeyPrice, _pricePaid);
  }

  function keyPurchasePrice(
    address /*from*/,
    address /*recipient*/,
    address /*referrer*/,
    bytes calldata /*data*/
  ) external view
    returns (uint minKeyPrice)
  {
    require(isPurchaseSupported, 'PURCHASE_BLOCKED_BY_HOOK');
    minKeyPrice = IPublicLock(msg.sender).keyPrice();
    if(discount < minKeyPrice)
    {
      minKeyPrice -= discount;
    }
    else
    {
      minKeyPrice = 0;
    }
  }

  function onKeyCancel(
    address _operator,
    address _to,
    uint _refund
  ) external
  {
    emit OnKeyCancel(msg.sender, _operator, _to, _refund);
  }
}