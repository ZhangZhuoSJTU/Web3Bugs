// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.7;

/// @notice Enforces Collateral deposit caps.
interface ICollateralDepositRecord {
    /// @dev Emitted via `setGlobalDepositCap()`.
    /// @param amount New global deposit cap
    event GlobalDepositCapChanged(uint256 amount);

    /// @dev Emitted via `setAccountDepositCap()`.
    /// @param amount New account deposit cap
    event AccountDepositCapChanged(uint256 amount);

    /// @dev Emitted via `setAllowedHook()`.
    /// @param hook Hook with changed permissions
    /// @param allowed Whether the hook is allowed
    event AllowedHooksChanged(address hook, bool allowed);

    /**
     * @dev This function will be called by a Collateral hook before the fee
     * is subtracted from the initial `amount` passed in.
     *
     * Only callable by allowed hooks.
     *
     * Reverts if the incoming deposit brings either total over their
     * respective caps.
     *
     * `finalAmount` is added to both the global and account-specific
     * deposit totals.
     * @param sender The account making the Collateral deposit
     * @param finalAmount The amount actually deposited by the user
     */
    function recordDeposit(address sender, uint256 finalAmount) external;

    /**
     * @notice Called by a Collateral hook before the fee is subtracted from
     * the amount withdrawn from the Strategy.
     * @dev `finalAmount` is subtracted from both the global and
     * account-specific deposit totals.
     *
     * Only callable by allowed hooks.
     * @param sender The account making the Collateral withdrawal
     * @param finalAmount The amount actually withdrawn by the user
     */
    function recordWithdrawal(address sender, uint256 finalAmount) external;

    /**
     * @notice Sets the global cap on assets backing Collateral in circulation.
     * @dev Only callable by owner().
     * @param newGlobalDepositCap The new global deposit cap
     */
    function setGlobalDepositCap(uint256 newGlobalDepositCap) external;

    /**
     * @notice Sets the cap on net Base Token deposits per user.
     * @dev Only callable by owner().
     * @param newAccountDepositCap The new account deposit cap
     */
    function setAccountDepositCap(uint256 newAccountDepositCap) external;

    /**
     * @notice Sets if a contract is allowed to record deposits
     * and withdrawals.
     * @dev Only callable by owner().
     * @param hook The contract address
     * @param allowed Whether or not the contract will be allowed
     */
    function setAllowedHook(address hook, bool allowed) external;

    /**
     * @notice Gets the maximum Base Token amount that is allowed to be
     * deposited (net of withdrawals).
     * @dev Deposits are not allowed if `globalDepositAmount` exceeds
     * the `globalDepositCap`.
     * @return Base Token amount
     */
    function getGlobalDepositCap() external view returns (uint256);

    /// @return Net total of Base Token deposited.
    function getGlobalDepositAmount() external view returns (uint256);

    /**
     * @dev An account will not be allowed to deposit if their net deposits
     * exceed `accountDepositCap`.
     * @return The cap on net Base Token deposits per user
     */
    function getAccountDepositCap() external view returns (uint256);

    /**
     * @param account The account to retrieve net deposits for
     * @return The net total amount of Base Token deposited by a user
     */
    function getNetDeposit(address account) external view returns (uint256);

    /**
     * @notice Returns whether the contract is allowed to record deposits and
     * withdrawals.
     * @param hook The contract to retrieve allowed status for
     * @return Whether the contract is allowed
     */
    function isHookAllowed(address hook) external view returns (bool);
}
