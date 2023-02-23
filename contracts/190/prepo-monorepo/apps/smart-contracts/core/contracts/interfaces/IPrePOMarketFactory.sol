// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "./IPrePOMarket.sol";

/**
 * @notice Deploys a PrePOMarket and two LongShortToken contracts to serve as
 * the token pair.
 */
interface IPrePOMarketFactory {
  /// @dev Emitted via `setCollateralValidity()`.
  /// @param collateral the collateral changed
  /// @param allowed whether the collateral is valid
  event CollateralValidityChanged(address collateral, bool allowed);

  /// @dev Emitted via `createMarket()`.
  /// @param market The market created
  /// @param longShortHash The market unique id
  event MarketAdded(address market, bytes32 longShortHash);

  /**
   * @notice Deploys a PrePOMarket with the given parameters and two
   * LongShortToken contracts to serve as the token pair.
   * @dev Parameters are all passed along to their respective arguments
   * in the PrePOMarket constructor.
   *
   * Token names are generated from `tokenNameSuffix` as the name
   * suffix and `tokenSymbolSuffix` as the symbol suffix.
   *
   * "LONG "/"SHORT " are appended to respective names, "L_"/"S_" are
   * appended to respective symbols.
   *
   * e.g. preSTRIPE 100-200 30-September 2021 =>
   * LONG preSTRIPE 100-200 30-September-2021.
   *
   * e.g. preSTRIPE_100-200_30SEP21 => L_preSTRIPE_100-200_30SEP21.
   * @param tokenNameSuffix The name suffix for the token pair
   * @param tokenSymbolSuffix The symbol suffix for the token pair
   * @param longTokenSalt Salt to influence the Long token contract address
   * @param shortTokenSalt Salt to influence the Short token contract address
   * @param collateral The address of the collateral token
   * @param governance The address of the governance contract
   * @param floorLongPrice The floor price for the Long token
   * @param ceilingLongPrice The ceiling price for the Long token
   * @param floorValuation The floor valuation for the Market
   * @param ceilingValuation The ceiling valuation for the Market
   * @param expiryTime The expiry time for the Market
   */
  function createMarket(
    string memory tokenNameSuffix,
    string memory tokenSymbolSuffix,
    bytes32 longTokenSalt,
    bytes32 shortTokenSalt,
    address collateral,
    address governance,
    uint256 floorLongPrice,
    uint256 ceilingLongPrice,
    uint256 floorValuation,
    uint256 ceilingValuation,
    uint256 expiryTime
  ) external;

  /**
   * @notice Sets whether a collateral contract is valid for assignment to
   * new PrePOMarkets.
   * @param collateral The address of the collateral contract
   * @param validity Whether the collateral contract should be valid
   */
  function setCollateralValidity(address collateral, bool validity) external;

  /**
   * @notice Returns whether collateral contract is valid for assignment to
   * new PrePOMarkets.
   * @param collateral The address of the collateral contract
   * @return Whether the collateral contract is valid
   */
  function isCollateralValid(address collateral) external view returns (bool);

  /**
   * @dev `longShortHash` is a keccak256 hash of the long token address and
   * short token address of the PrePOMarket.
   * @param longShortHash PrePOMarket unique identifier
   * @return PrePOMarket address corresponding to the market id
   */
  function getMarket(bytes32 longShortHash)
    external
    view
    returns (IPrePOMarket);
}
