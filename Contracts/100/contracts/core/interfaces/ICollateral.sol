// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "./IHook.sol";
import "./IStrategyController.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/**
 * @notice Used for minting and redeeming prePO Collateral tokens. A
 * Collateral token is a share of a yield-bearing vault, its Base Token value
 * varying based on the current value of the vault's assets.
 */
interface ICollateral is IERC20Upgradeable {
    /**
     * @notice Used to keep track of whether or not a user has initiated a
     * withdrawal in a block prior to calling withdraw().
     * @member amount The requested amount of Collateral to withdraw.
     * @member blockNumber The block in which the request was made.
     */
    struct WithdrawalRequest {
        uint256 amount;
        uint256 blockNumber;
    }

    /// @dev Emitted via `setDepositsAllowed()`.
    /// @param allowed Whether deposits are allowed
    event DepositsAllowedChanged(bool allowed);

    /// @dev Emitted via `setWithdrawalsAllowed()`.
    /// @param allowed Whether withdrawals are allowed
    event WithdrawalsAllowedChanged(bool allowed);

    /// @dev Emitted via `setStrategyController()`.
    /// @param controller The address of the new Strategy Controller
    event StrategyControllerChanged(address controller);

    /// @dev Emitted via `setMintingFee()`.
    /// @param fee The new fee
    event MintingFeeChanged(uint256 fee);

    /// @dev Emitted via `setRedemptionFee()`.
    /// @param fee The new fee
    event RedemptionFeeChanged(uint256 fee);

    /// @dev Emitted via `setDelayedWithdrawal()`.
    /// @param enabled Whether or not delayed withdrawals are enabled
    event DelayedWithdrawalChanged(bool enabled);

    /// @dev Emitted via `setDelayedWithdrawalExpiry()`.
    /// @param expiry The new expiry
    event DelayedWithdrawalExpiryChanged(uint256 expiry);

    /// @dev Emitted via `setDepositHook()`.
    /// @param hook The new deposit hook
    event DepositHookChanged(address hook);

    /// @dev Emitted via `setWithdrawalHook()`.
    /// @param hook The new withdraw hook
    event WithdrawHookChanged(address hook);

    /**
     * @notice Mints Collateral tokens for `amount` Base Token.
     * @dev Assumes approval has been given by the user for the
     * Collateral contract to spend their funds.
     * @param amount The amount of Base Token to deposit
     * @return The amount of Collateral minted
     */
    function deposit(uint256 amount) external returns (uint256);

    /**
     * @notice Creates a request to allow a withdrawal for `amount` Collateral
     * in a later block.
     * @dev The user's balance must be >= the amount requested to
     * initiate a withdrawal. If this function is called when there is already
     * an existing withdrawal request, the existing request is overwritten
     * with the new `amount` and current block number.
     * @param amount The amount of Collateral to withdraw
     */
    function initiateWithdrawal(uint256 amount) external;

    /**
     * @notice Resets the existing withdrawal request on record for the caller.
     * @dev This call will not revert if a user doesn't have an existing
     * request and will simply reset the user's already empty request record.
     */
    function uninitiateWithdrawal() external;

    /**
     * @notice Burns `amount` Collateral tokens in exchange for Base Token.
     * @dev If `delayedWithdrawalExpiry` is non-zero, a withdrawal request
     * must be initiated in a prior block no more than
     * `delayedWithdrawalExpiry` blocks before. The amount specified in the
     * request must match the amount being withdrawn.
     * @param amount The amount of Collateral to burn
     * @return Amount of Base Token withdrawn
     */
    function withdraw(uint256 amount) external returns (uint256);

    /**
     * @notice Sets whether deposits to the Collateral vault are allowed.
     * @dev Only callable by `owner()`.
     * @param allowed Whether deposits are allowed
     */
    function setDepositsAllowed(bool allowed) external;

    /**
     * @notice Sets whether withdrawals from the Collateral vault are allowed.
     * @dev Only callable by `owner()`.
     * @param allowed Whether withdrawals are allowed
     */
    function setWithdrawalsAllowed(bool allowed) external;

    /**
     * @notice Sets the contract that controls which strategy funds are sent
     * to.
     * @dev Only callable by `owner()`.
     * @param newController Address of a contract implementing `IStrategyController`
     */
    function setStrategyController(IStrategyController newController) external;

    /**
     * @notice Sets the number of blocks to pass before expiring a withdrawal
     * request.
     * @dev If this is set to zero, withdrawal requests are ignored.
     *
     * Only callable by `owner()`.
     * @param expiry Blocks before expiring a withdrawal request
     */
    function setDelayedWithdrawalExpiry(uint256 expiry) external;

    /**
     * @notice Sets the fee for minting Collateral, must be a 4 decimal place
     * percentage value e.g. 4.9999% = 49999.
     * @dev Only callable by `owner()`.
     * @param newMintingFee The new fee for minting Collateral
     */
    function setMintingFee(uint256 newMintingFee) external;

    /**
     * @notice Sets the fee for redeeming Collateral, must be a 4 decimal place
     * percentage value e.g. 4.9999% = 49999.
     * @dev Only callable by `owner()`.
     * @param newRedemptionFee The new fee for redeeming Collateral
     */
    function setRedemptionFee(uint256 newRedemptionFee) external;

    /**
     * @notice Sets the contract implementing `IHook` that will be called
     * during the `deposit()` function.
     * @dev Only callable by `owner()`.
     * @param newDepositHook Address of a contract implementing `IHook`
     */
    function setDepositHook(IHook newDepositHook) external;

    /**
     * @notice Sets the contract implementing `IHook` that will be called
     * during the `withdraw()` function.
     * @dev Only callable by `owner()`.
     * @param newWithdrawHook Address of a contract implementing `IHook`
     */
    function setWithdrawHook(IHook newWithdrawHook) external;

    /// @return Whether deposits are allowed
    function getDepositsAllowed() external view returns (bool);

    /// @return Whether withdrawals are allowed
    function getWithdrawalsAllowed() external view returns (bool);

    /// @return Address where fees are sent to
    function getTreasury() external view returns (address);

    /**
     * @return Fee for minting Collateral
     * @dev Fee has four decimals places of percentage value precision
     * e.g. 4.9999% = 49999.
     */
    function getMintingFee() external view returns (uint256);

    /**
     * @return Fee for redeeming Collateral
     * @dev Fee has four decimals places of percentage value precision
     * e.g. 4.9999% = 49999.
     */
    function getRedemptionFee() external view returns (uint256);

    /**
     * @notice This asset will be required for minting Collateral, and
     * returned when redeeming Collateral.
     * @return The ERC20 token backing Collateral shares
     */
    function getBaseToken() external view returns (IERC20Upgradeable);

    /**
     * @notice The Strategy Controller intermediates any interactions between
     * this vault and a yield-earning strategy.
     * @return The current Strategy Controller
     */
    function getStrategyController()
        external
        view
        returns (IStrategyController);

    /**
     * @return Blocks that can pass before a withdrawal request expires
     */
    function getDelayedWithdrawalExpiry() external view returns (uint256);

    /// @return The withdrawal request on record for `account`
    function getWithdrawalRequest(address account)
        external
        view
        returns (WithdrawalRequest memory);

    /**
     * @return The `IHook` that runs during the `deposit()` function
     */
    function getDepositHook() external view returns (IHook);

    /**
     * @return The `IHook` that runs during the `withdraw()` function
     */
    function getWithdrawHook() external view returns (IHook);

    /**
     * @notice Gets the amount of Base Token received for redeeming `shares`
     * Collateral.
     * @param shares Amount of shares that would be redeemed
     * @return Amount of Base Token received
     */
    function getAmountForShares(uint256 shares)
        external
        view
        returns (uint256);

    /// @param amount Amount of Base Token that would be deposited
    /// @return Shares received for depositing `amount` Base Token
    function getSharesForAmount(uint256 amount)
        external
        view
        returns (uint256);

    /**
     * @notice Returns the sum of the contract's latent Base Token balance and
     * the estimated Base Token value of the strategy's assets.
     * @dev This call relies on the `totalValue()` returned by the
     * Strategy Controller. The Collateral vault trusts the Strategy Controller
     * to relay an accurate value of the Strategy's assets.
     * @return Total assets denominated in Base Token
     */
    function totalAssets() external view returns (uint256);

    /**
     * @notice Returns the denominator for calculating fees from 4 decimal
     * place percentage values e.g. 4.9999% = 49999.
     * @return Denominator
     */
    function getFeeDenominator() external pure returns (uint256);

    /**
     * @notice Returns the fee limit of 5% represented as 4 decimal place
     * percentage value e.g. 4.9999% = 49999.
     * @return Fee limit
     */
    function getFeeLimit() external pure returns (uint256);
}
