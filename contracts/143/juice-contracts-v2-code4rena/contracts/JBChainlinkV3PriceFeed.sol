// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import './interfaces/IJBPriceFeed.sol';
import './libraries/JBFixedPointNumber.sol';

/** 
  @notice 
  A generalized price feed for the Chainlink AggregatorV3Interface.

  @dev
  Adheres to -
  IJBPriceFeed: General interface for the methods in this contract that interact with the blockchain's state according to the protocol's rules.
*/
contract JBChainlinkV3PriceFeed is IJBPriceFeed {
  // A library that provides utility for fixed point numbers.
  using JBFixedPointNumber for uint256;

  //*********************************************************************//
  // --------------------- public stored properties -------------------- //
  //*********************************************************************//

  /** 
    @notice 
    The feed that prices are reported from.
  */
  AggregatorV3Interface public feed;

  //*********************************************************************//
  // ------------------------- external views -------------------------- //
  //*********************************************************************//

  /** 
    @notice 
    Gets the current price from the feed, normalized to the specified number of decimals.

    @param _decimals The number of decimals the returned fixed point price should include.

    @return The current price of the feed, as a fixed point number with the specified number of decimals.
  */
  function currentPrice(uint256 _decimals) external view override returns (uint256) {
    // Get the latest round information. Only need the price is needed.
    (, int256 _price, , , ) = feed.latestRoundData();

    // Get a reference to the number of decimals the feed uses.
    uint256 _feedDecimals = feed.decimals();

    // Return the price, adjusted to the target decimals.
    return uint256(_price).adjustDecimals(_feedDecimals, _decimals);
  }

  //*********************************************************************//
  // -------------------------- constructor ---------------------------- //
  //*********************************************************************//

  /** 
    @param _feed The feed to report prices from.
  */
  constructor(AggregatorV3Interface _feed) {
    feed = _feed;
  }
}
