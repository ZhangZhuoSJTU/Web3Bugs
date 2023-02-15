// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "../interfaces/IStrategyController.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @notice Strategy that deploys Base Token to earn yield denominated in Base
 * Token.
 * @dev `owner()` can call emergency functions and setters, only controller
 * can call deposit/withdraw.
 */
interface IStrategy {
    /**
     * @notice Deposits `amount` Base Token into the strategy.
     * @dev Assumes the StrategyController has given infinite spend approval
     * to the strategy.
     * @param amount Amount of Base Token to deposit
     */
    function deposit(uint256 amount) external;

    /**
     * @notice Withdraws `amount` Base Token from the strategy to `recipient`.
     * @dev This withdrawal is optimistic, returned amount might be less than
     * the amount specified.
     * @param recipient Address to receive the Base Token
     * @param amount Amount of Base Token to withdraw
     */
    function withdraw(address recipient, uint256 amount) external;

    /**
     * @notice Returns the Base Token balance of this contract and
     * the estimated value of deployed assets.
     * @return Total value of assets within the strategy
     */
    function totalValue() external view returns (uint256);

    /**
     * @notice Returns the Strategy Controller that intermediates interactions
     * between a vault and this strategy.
     * @dev Functions with the `onlyController` modifier can only be called by
     * this Strategy Controller.
     * @return The Strategy Controller address
     */
    function getController() external view returns (IStrategyController);

    /**
     * @notice The ERC20 asset that this strategy utilizes to earn yield and
     * return profits with.
     * @return The Base Token address
     */
    function getBaseToken() external view returns (IERC20);
}
