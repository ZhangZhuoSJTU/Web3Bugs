// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

/// @title Callback for ITimeswapPair#borrow
/// @notice Any contract that calls ITimeswapPair#borrow must implement this interface
interface ITimeswapBorrowCallback {
    /// @notice Called to `msg.sender` after initiating a borrow from ITimeswapPair#borrow.
    /// @dev In the implementation you must pay the collateral token owed for the borrow transaction.
    /// The caller of this method must be checked to be a TimeswapPair deployed by the canonical TimeswapFactory.
    /// @param collateralIn The amount of asset tokens owed due to the pool for the borrow transaction
    /// @param data Any data passed through by the caller via the ITimeswapPair#borrow call
    function timeswapBorrowCallback(
        uint112 collateralIn,
        bytes calldata data
    ) external;
}