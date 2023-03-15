// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@paulrberg/contracts/math/PRBMath.sol';
import './interfaces/IJBPrices.sol';

/** 
  @notice 
  Manages and normalizes price feeds.

  @dev
  Adheres to -
  IJBPrices: General interface for the methods in this contract that interact with the blockchain's state according to the protocol's rules.

  @dev
  Inherits from -
  Ownable: Includes convenience functionality for checking a message sender's permissions before executing certain transactions.
*/
contract JBPrices is IJBPrices, Ownable {
  //*********************************************************************//
  // --------------------------- custom errors ------------------------- //
  //*********************************************************************//
  error PRICE_FEED_ALREADY_EXISTS();
  error PRICE_FEED_NOT_FOUND();

  //*********************************************************************//
  // --------------------- public stored properties -------------------- //
  //*********************************************************************//

  /** 
    @notice 
    The available price feeds.

    @dev
    The feed returns the number of `_currency` units that can be converted to 1 `_base` unit.

    _currency The currency units the feed's resulting price is in terms of.
    _base The base currency unit being priced by the feed.
  */
  mapping(uint256 => mapping(uint256 => IJBPriceFeed)) public override feedFor;

  //*********************************************************************//
  // ------------------------- external views -------------------------- //
  //*********************************************************************//

  /** 
    @notice
    Gets the number of `_currency` units that can be converted to 1 `_base` unit.

    @param _currency The currency units the resulting price is in terms of.
    @param _base The base currency unit being priced.
    @param _decimals The number of decimals the returned fixed point price should include.
    
    @return The price of the currency in terms of the base, as a fixed point number with the specified number of decimals.
  */
  function priceFor(
    uint256 _currency,
    uint256 _base,
    uint256 _decimals
  ) external view override returns (uint256) {
    // If the currency is the base, return 1 since they are priced the same. Include the desired number of decimals.
    if (_currency == _base) return 10**_decimals;

    // Get a reference to the feed.
    IJBPriceFeed _feed = feedFor[_currency][_base];

    // If it exists, return the price.
    if (_feed != IJBPriceFeed(address(0))) return _feed.currentPrice(_decimals);

    // Get the inverse feed.
    _feed = feedFor[_base][_currency];

    // If it exists, return the inverse price.
    if (_feed != IJBPriceFeed(address(0)))
      return PRBMath.mulDiv(10**_decimals, 10**_decimals, _feed.currentPrice(_decimals));

    // No price feed available, revert.
    revert PRICE_FEED_NOT_FOUND();
  }

  //*********************************************************************//
  // ---------------------------- constructor -------------------------- //
  //*********************************************************************//

  /** 
    @param _owner The address that will own the contract.
  */
  constructor(address _owner) {
    // Transfer the ownership.
    transferOwnership(_owner);
  }

  //*********************************************************************//
  // ---------------------- external transactions ---------------------- //
  //*********************************************************************//

  /** 
    @notice 
    Add a price feed for a currency in terms of the provided base currency.

    @dev
    Current feeds can't be modified.

    @param _currency The currency units the feed's resulting price is in terms of.
    @param _base The base currency unit being priced by the feed.
    @param _feed The price feed being added.
  */
  function addFeedFor(
    uint256 _currency,
    uint256 _base,
    IJBPriceFeed _feed
  ) external override onlyOwner {
    // There can't already be a feed for the specified currency.
    if (feedFor[_currency][_base] != IJBPriceFeed(address(0))) revert PRICE_FEED_ALREADY_EXISTS();

    // Store the feed.
    feedFor[_currency][_base] = _feed;

    emit AddFeed(_currency, _base, _feed);
  }
}
