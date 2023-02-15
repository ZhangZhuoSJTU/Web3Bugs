// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;
pragma abicoder v2;

/* Standard Band oracle interface. Prices are queried by pair, i.e. what is
 * the price of the given base currency in units of the quote currency?
 *    see:
 *  https://kovan.etherscan.io/address/0xDA7a001b254CD22e46d3eAB04d937489c93174C3#code
 *  https://docs.matic.network/docs/develop/oracles/bandstandarddataset/
 */
interface IBandOracle {
  struct ReferenceData {
    uint256 rate; // exchange rate for base/quote in 1e18 scale
    uint256 lastUpdatedBase; // secs after epoch, last time base updated
    uint256 lastUpdatedQuote; // secs after epoch, last time quote updated
  }

  /*
   *Returns price data for given base/quote pair. Reverts if not available.
   */
  function getReferenceData(string memory _base, string memory _quote) external view returns (ReferenceData memory);

  /*
   * Batch version of getReferenceData(...).
   */
  function getReferenceDataBulk(string[] memory _bases, string[] memory _quotes)
    external
    view
    returns (ReferenceData[] memory);
}
