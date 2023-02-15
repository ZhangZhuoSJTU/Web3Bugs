// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

/// @notice Used for adding additional checks and/or data recording when
/// interacting with the Collateral vault.
interface IHook {
    /**
     * @dev Emitted via `setVault()`.
     * @param vault The new vault address
     */
    event VaultChanged(address vault);

    /**
     * @dev This hook should only contain calls to external contracts, where
     * the actual implementation and state of a feature will reside.
     *
     * `initialAmount` for `deposit()` and `withdraw()` is the `amount`
     * parameter passed in by the caller.
     *
     * `finalAmount` for `deposit()` is the Base Token amount provided by
     * the user and any latent contract balance that is included in the
     * deposit.
     *
     * `finalAmount` for `withdraw()` is the Base Token amount returned
     * by the configured Strategy.
     *
     * Only callable by the vault.
     * @param sender The account calling the Collateral vault
     * @param initialAmount The amount passed to the Collateral vault
     * @param finalAmount The amount actually involved in the transaction
     */
    function hook(
        address sender,
        uint256 initialAmount,
        uint256 finalAmount
    ) external;

    /**
     * @notice Sets the vault that will be allowed to call this hook.
     * @dev Only callable by owner().
     * @param newVault The vault address
     */
    function setVault(address newVault) external;
}
