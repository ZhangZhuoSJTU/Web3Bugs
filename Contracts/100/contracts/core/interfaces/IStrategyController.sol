// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "./IStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Strategy Controller acts as an intermediary between the Strategy
 * and the PrePO Collateral contract.
 *
 * The Collateral contract should never interact with the Strategy directly
 * and only perform operations via the Strategy Controller.
 */
interface IStrategyController {
    /// @dev Emitted via `setVault()`.
    /// @param vault The new vault address
    event VaultChanged(address vault);

    /// @dev Emitted via `migrate()`.
    /// @param oldStrategy The old strategy address
    /// @param newStrategy The new strategy address
    /// @param amount The amount migrated
    event StrategyMigrated(
        address oldStrategy,
        address newStrategy,
        uint256 amount
    );

    /**
     * @notice Deposits the specified amount of Base Token into the Strategy.
     * @dev Only the vault (Collateral contract) may call this function.
     *
     * Assumes approval to transfer amount from the Collateral contract
     * has been given.
     * @param amount Amount of Base Token to deposit
     */
    function deposit(uint256 amount) external;

    /**
     * @notice Withdraws the requested amount of Base Token from the Strategy
     * to the recipient.
     * @dev Only the vault (Collateral contract) may call this function.
     *
     * This withdrawal is optimistic, returned amount might be less than
     * the amount specified.
     * @param amount Amount of Base Token to withdraw
     * @param recipient Address to receive the Base Token
     */
    function withdraw(address recipient, uint256 amount) external;

    /**
     * @notice Migrates funds from currently configured Strategy to a new
     * Strategy and replaces it.
     * @dev If a Strategy is not already set, it sets the Controller's
     * Strategy to the new value with no funds being exchanged.
     *
     * Gives infinite Base Token approval to the new strategy and sets it
     * to zero for the old one.
     *
     * Only callable by `owner()`.
     * @param newStrategy Address of the new Strategy
     */
    function migrate(IStrategy newStrategy) external;

    /**
     * @notice Sets the vault that is allowed to deposit/withdraw through this
     * StrategyController.
     * @dev Only callable by `owner()`.
     * @param newVault Address of the new vault
     */
    function setVault(address newVault) external;

    /**
     * @notice Returns the Base Token balance of this contract and the
     * `totalValue()` returned by the Strategy.
     * @return The total value of assets within the strategy
     */
    function totalValue() external view returns (uint256);

    /**
     * @notice Returns the vault that is allowed to deposit/withdraw through
     * this Strategy Controller.
     * @return The vault address
     */
    function getVault() external view returns (address);

    /**
     * @notice Returns the ERC20 asset that this Strategy Controller supports
     * handling funds with.
     * @return The Base Token address
     */
    function getBaseToken() external view returns (IERC20);

    /**
     * @return The Strategy that this Strategy Controller manages
     */
    function getStrategy() external view returns (IStrategy);
}
