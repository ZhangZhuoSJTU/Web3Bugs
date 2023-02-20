// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./IQuantConfig.sol";

/// @title For centrally managing a log of settlement prices, for each option.
/// @author Rolla
interface IPriceRegistry {
    struct PriceWithDecimals {
        uint256 price;
        uint8 decimals;
    }

    event PriceStored(
        address indexed _oracle,
        address indexed _asset,
        uint256 indexed _expiryTimestamp,
        uint256 _settlementPrice,
        uint8 _settlementPriceDecimals
    );

    /// @notice Set the price at settlement for a particular asset, expiry
    /// @param _asset asset to set price for
    /// @param _settlementPrice price at settlement
    /// @param _expiryTimestamp timestamp of price to set
    function setSettlementPrice(
        address _asset,
        uint256 _expiryTimestamp,
        uint256 _settlementPrice,
        uint8 _settlementPriceDecimals
    ) external;

    /// @notice quant central configuration
    function config() external view returns (IQuantConfig);

    /// @notice Fetch the settlement price with decimals from an oracle for an asset at a particular timestamp.
    /// @param _oracle oracle which price should come from
    /// @param _asset asset to fetch price for
    /// @param _expiryTimestamp timestamp we want the price for
    /// @return the price (with decimals) which has been submitted for the asset at the timestamp by that oracle
    function getSettlementPriceWithDecimals(
        address _oracle,
        address _asset,
        uint256 _expiryTimestamp
    ) external view returns (PriceWithDecimals memory);

    /// @notice Fetch the settlement price from an oracle for an asset at a particular timestamp.
    /// @notice Rounds down if there's extra precision from the oracle
    /// @param _oracle oracle which price should come from
    /// @param _asset asset to fetch price for
    /// @param _expiryTimestamp timestamp we want the price for
    /// @return the price which has been submitted for the asset at the timestamp by that oracle
    function getSettlementPrice(
        address _oracle,
        address _asset,
        uint256 _expiryTimestamp
    ) external view returns (uint256);

    /// @notice Check if the settlement price for an asset exists from an oracle at a particular timestamp
    /// @param _oracle oracle from which price comes from
    /// @param _asset asset to check price for
    /// @param _expiryTimestamp timestamp of price
    /// @return whether or not a price has been submitted for the asset at the timestamp by that oracle
    function hasSettlementPrice(
        address _oracle,
        address _asset,
        uint256 _expiryTimestamp
    ) external view returns (bool);
}
