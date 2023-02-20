// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {ERC20} from "solmate/tokens/ERC20.sol";

/// @title CERC20
/// @author Compound Labs and Rari Capital
/// @notice Minimal Compound/Fuse Comptroller interface.
abstract contract CERC20 is ERC20 {
    /// @notice Deposit an amount of underlying tokens to the CERC20.
    /// @param underlyingAmount Amount of underlying tokens to deposit.
    /// @return An error code or zero if there was no error in the deposit.
    function mint(uint256 underlyingAmount) external virtual returns (uint256);

    /// @notice Borrow an amount of underlying tokens from the CERC20.
    /// @param underlyingAmount Amount of underlying tokens to borrow.
    /// @return An error code or zero if there was no error in the borrow.
    function borrow(uint256 underlyingAmount) external virtual returns (uint256);

    /// @notice Repay an amount of underlying tokens to the CERC20.
    /// @param underlyingAmount Amount of underlying tokens to repay.
    /// @return An error code or zero if there was no error in the repay.
    function repayBorrow(uint256 underlyingAmount) external virtual returns (uint256);

    /// @notice Returns the underlying balance of a specific user.
    /// @param user The user who's balance the CERC20 will retrieve.
    /// @return The amount of underlying tokens the user is entitled to.
    function balanceOfUnderlying(address user) external view virtual returns (uint256);

    /// @notice Returns the amount of underlying tokens a cToken redeemable for.
    /// @return The amount of underlying tokens a cToken is redeemable for.
    function exchangeRateStored() external view virtual returns (uint256);

    /// @notice Withdraw a specific amount of underlying tokens from the CERC20.
    /// @param underlyingAmount Amount of underlying tokens to withdraw.
    /// @return An error code or zero if there was no error in the withdraw.
    function redeemUnderlying(uint256 underlyingAmount) external virtual returns (uint256);

    /// @notice Return teh current borrow balance of a user in the CERC20.
    /// @param user The user to get the borrow balance for.
    /// @return The current borrow balance of the user.
    function borrowBalanceCurrent(address user) external virtual returns (uint256);

    /// @notice Repay a user's borrow on their behalf.
    /// @param user The user who's borrow to repay.
    /// @param underlyingAmount The amount of debt to repay.
    /// @return An error code or zero if there was no error in the repayBorrowBehalf.
    function repayBorrowBehalf(address user, uint256 underlyingAmount) external virtual returns (uint256);
}
