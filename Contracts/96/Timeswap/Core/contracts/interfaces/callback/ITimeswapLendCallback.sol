// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

/// @title Callback for ITimeswapPair#lend
/// @notice Any contract that calls ITimeswapPair#lend must implement this interface
interface ITimeswapLendCallback {
    /// @notice Called to `msg.sender` after initiating a lend from ITimeswapPair#lend.
    /// @dev In the implementation you must pay the asset token owed for the lend transaction.
    /// The caller of this method must be checked to be a TimeswapPair deployed by the canonical TimeswapFactory.
    /// @param assetIn The amount of asset tokens owed due to the pool for the lend transaction
    /// @param data Any data passed through by the caller via the ITimeswapPair#lend call
    function timeswapLendCallback(
        uint256 assetIn,
        bytes calldata data
    ) external;
}