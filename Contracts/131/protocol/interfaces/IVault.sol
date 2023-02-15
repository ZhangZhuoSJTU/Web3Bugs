// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./strategies/IStrategy.sol";
import "./IPreparable.sol";

/**
 * @title Interface for a Vault
 */

interface IVault is IPreparable {
    event StrategyActivated(address indexed strategy);

    event StrategyDeactivated(address indexed strategy);

    /**
     * @dev 'netProfit' is the profit after all fees have been deducted
     */
    event Harvest(uint256 indexed netProfit, uint256 indexed loss);

    function initialize(
        address _pool,
        uint256 _debtLimit,
        uint256 _targetAllocation,
        uint256 _bound
    ) external;

    function withdrawFromStrategyWaitingForRemoval(address strategy) external returns (uint256);

    function deposit() external payable;

    function withdraw(uint256 amount) external returns (bool);

    function initializeStrategy(address strategy_) external returns (bool);

    function withdrawAll() external;

    function withdrawFromReserve(uint256 amount) external;

    function executeNewStrategy() external returns (address);

    function prepareNewStrategy(address newStrategy) external returns (bool);

    function activateStrategy() external returns (bool);

    function deactivateStrategy() external returns (bool);

    function resetNewStrategy() external returns (bool);

    function preparePerformanceFee(uint256 newPerformanceFee) external returns (bool);

    function executePerformanceFee() external returns (uint256);

    function resetPerformanceFee() external returns (bool);

    function prepareStrategistFee(uint256 newStrategistFee) external returns (bool);

    function executeStrategistFee() external returns (uint256);

    function resetStrategistFee() external returns (bool);

    function prepareDebtLimit(uint256 newDebtLimit) external returns (bool);

    function executeDebtLimit() external returns (uint256);

    function resetDebtLimit() external returns (bool);

    function prepareTargetAllocation(uint256 newTargetAllocation) external returns (bool);

    function executeTargetAllocation() external returns (uint256);

    function resetTargetAllocation() external returns (bool);

    function prepareReserveFee(uint256 newReserveFee) external returns (bool);

    function executeReserveFee() external returns (uint256);

    function resetReserveFee() external returns (bool);

    function prepareBound(uint256 newBound) external returns (bool);

    function executeBound() external returns (uint256);

    function resetBound() external returns (bool);

    function withdrawFromStrategy(uint256 amount) external returns (bool);

    function withdrawAllFromStrategy() external returns (bool);

    function harvest() external returns (bool);

    function getStrategiesWaitingForRemoval() external view returns (address[] memory);

    function getAllocatedToStrategyWaitingForRemoval(address strategy)
        external
        view
        returns (uint256);

    function getStrategy() external view returns (IStrategy);

    function getTotalUnderlying() external view returns (uint256);

    function getUnderlying() external view returns (address);

    function getStrategistFee() external view returns (uint256);

    function getReserveFee() external view returns (uint256);

    function getPerformanceFee() external view returns (uint256);

    function getBound() external view returns (uint256);

    function getTargetAllocation() external view returns (uint256);

    function getDebtLimit() external view returns (uint256);
}
