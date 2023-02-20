// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

/// @title Callback for ITimeswapPair#mint
/// @notice Any contract that calls ITimeswapPair#mint must implement this interface
interface ITimeswapMintCallback {
    /// @notice Called to `msg.sender` after initiating a mint from ITimeswapPair#mint.
    /// @dev In the implementation you must pay the asset token and collateral token owed for the mint transaction.
    /// The caller of this method must be checked to be a TimeswapPair deployed by the canonical TimeswapFactory.
    /// @param assetIn The amount of asset tokens owed due to the pool for the mint transaction.
    /// @param collateralIn The amount of collateral tokens owed due to the pool for the min transaction.
    /// @param data Any data passed through by the caller via the ITimeswapPair#mint call
    function timeswapMintCallback(
        uint256 assetIn,
        uint112 collateralIn,
        bytes calldata data
    ) external;
}