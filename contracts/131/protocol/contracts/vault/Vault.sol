// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../interfaces/IVault.sol";
import "../../interfaces/IVaultReserve.sol";
import "../../interfaces/IController.sol";

import "../../libraries/ScaledMath.sol";
import "../../libraries/Errors.sol";
import "../../libraries/EnumerableExtensions.sol";
import "../../libraries/AddressProviderHelpers.sol";
import "../../libraries/AddressProviderKeys.sol";
import "../../libraries/UncheckedMath.sol";

import "./VaultStorage.sol";
import "../utils/Preparable.sol";
import "../utils/IPausable.sol";
import "../access/Authorization.sol";

abstract contract Vault is IVault, Authorization, VaultStorageV1, Preparable, Initializable {
    using ScaledMath for uint256;
    using UncheckedMath for uint256;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableExtensions for EnumerableSet.AddressSet;
    using EnumerableMapping for EnumerableMapping.AddressToUintMap;
    using EnumerableExtensions for EnumerableMapping.AddressToUintMap;
    using AddressProviderHelpers for IAddressProvider;

    bytes32 internal constant _STRATEGY_KEY = "Strategy";
    bytes32 internal constant _PERFORMANCE_FEE_KEY = "PerformanceFee";
    bytes32 internal constant _STRATEGIST_FEE_KEY = "StrategistFee";
    bytes32 internal constant _DEBT_LIMIT_KEY = "DebtLimit";
    bytes32 internal constant _TARGET_ALLOCATION_KEY = "TargetAllocation";
    bytes32 internal constant _RESERVE_FEE_KEY = "ReserveFee";
    bytes32 internal constant _BOUND_KEY = "Bound";

    uint256 internal constant _INITIAL_RESERVE_FEE = 0.01e18;
    uint256 internal constant _INITIAL_STRATEGIST_FEE = 0.1e18;
    uint256 internal constant _INITIAL_PERFORMANCE_FEE = 0;

    uint256 public constant MAX_PERFORMANCE_FEE = 0.5e18;
    uint256 public constant MAX_DEVIATION_BOUND = 0.5e18;
    uint256 public constant STRATEGY_DELAY = 5 days;

    IController public immutable controller;
    IAddressProvider public immutable addressProvider;
    IVaultReserve public immutable reserve;

    modifier onlyPoolOrGovernance() {
        require(
            msg.sender == pool || _roleManager().hasRole(Roles.GOVERNANCE, msg.sender),
            Error.UNAUTHORIZED_ACCESS
        );
        _;
    }

    modifier onlyPoolOrMaintenance() {
        require(
            msg.sender == pool || _roleManager().hasRole(Roles.MAINTENANCE, msg.sender),
            Error.UNAUTHORIZED_ACCESS
        );
        _;
    }

    constructor(IController _controller)
        Authorization(_controller.addressProvider().getRoleManager())
    {
        controller = _controller;
        IAddressProvider addressProvider_ = _controller.addressProvider();
        addressProvider = addressProvider_;
        reserve = IVaultReserve(addressProvider_.getVaultReserve());
    }

    function _initialize(
        address _pool,
        uint256 _debtLimit,
        uint256 _targetAllocation,
        uint256 _bound
    ) internal {
        require(_debtLimit <= ScaledMath.ONE, Error.INVALID_AMOUNT);
        require(_targetAllocation <= ScaledMath.ONE, Error.INVALID_AMOUNT);
        require(_bound <= MAX_DEVIATION_BOUND, Error.INVALID_AMOUNT);

        pool = _pool;

        _setConfig(_DEBT_LIMIT_KEY, _debtLimit);
        _setConfig(_TARGET_ALLOCATION_KEY, _targetAllocation);
        _setConfig(_BOUND_KEY, _bound);
        _setConfig(_RESERVE_FEE_KEY, _INITIAL_RESERVE_FEE);
        _setConfig(_STRATEGIST_FEE_KEY, _INITIAL_STRATEGIST_FEE);
        _setConfig(_PERFORMANCE_FEE_KEY, _INITIAL_PERFORMANCE_FEE);
    }

    /**
     * @notice Handles deposits from the liquidity pool
     */
    function deposit() external payable override onlyPoolOrMaintenance {
        // solhint-disable-previous-line ordering
        _deposit();
    }

    /**
     * @notice Withdraws specified amount of underlying from vault.
     * @dev If the specified amount exceeds idle funds, an amount of funds is withdrawn
     *      from the strategy such that it will achieve a target allocation for after the
     *      amount has been withdrawn.
     * @param amount Amount to withdraw.
     * @return `true` if successful.
     */
    function withdraw(uint256 amount) external override onlyPoolOrGovernance returns (bool) {
        IStrategy strategy = getStrategy();
        uint256 availableUnderlying_ = _availableUnderlying();

        if (availableUnderlying_ < amount) {
            if (address(strategy) == address(0)) return false;
            uint256 allocated = strategy.balance();
            uint256 requiredWithdrawal = amount.uncheckedSub(availableUnderlying_);

            if (requiredWithdrawal > allocated) return false;

            // compute withdrawal amount to sustain target allocation
            uint256 newTarget = allocated.uncheckedSub(requiredWithdrawal).scaledMul(
                getTargetAllocation()
            );
            uint256 excessAmount = allocated - newTarget;
            strategy.withdraw(excessAmount);
            currentAllocated = _computeNewAllocated(currentAllocated, excessAmount);
        } else {
            uint256 allocatedUnderlying;
            if (address(strategy) != address(0))
                allocatedUnderlying = IStrategy(strategy).balance();
            uint256 totalUnderlying = availableUnderlying_ +
                allocatedUnderlying +
                waitingForRemovalAllocated;
            uint256 totalUnderlyingAfterWithdraw = totalUnderlying.uncheckedSub(amount);
            _rebalance(totalUnderlyingAfterWithdraw, allocatedUnderlying);
        }

        _transfer(pool, amount);
        return true;
    }

    /**
     * @notice Withdraws all funds from vault and strategy and transfer them to the pool.
     */
    function withdrawAll() external override onlyPoolOrGovernance {
        _withdrawAllFromStrategy();
        _transfer(pool, _availableUnderlying());
    }

    /**
     * @notice Withdraws specified amount of underlying from reserve to vault.
     * @dev Withdraws from reserve will cause a spike in pool exchange rate.
     *  Pool deposits should be paused during this to prevent front running
     * @param amount Amount to withdraw.
     */
    function withdrawFromReserve(uint256 amount) external override onlyGovernance {
        require(amount > 0, Error.INVALID_AMOUNT);
        require(IPausable(pool).isPaused(), Error.POOL_NOT_PAUSED);
        uint256 reserveBalance_ = reserve.getBalance(address(this), getUnderlying());
        require(amount <= reserveBalance_, Error.INSUFFICIENT_BALANCE);
        reserve.withdraw(getUnderlying(), amount);
    }

    /**
     * @notice Activate the current strategy set for the vault.
     * @return `true` if strategy has been activated
     */
    function activateStrategy() external override onlyGovernance returns (bool) {
        return _activateStrategy();
    }

    /**
     * @notice Deactivates a strategy.
     * @return `true` if strategy has been deactivated
     */
    function deactivateStrategy() external override onlyGovernance returns (bool) {
        return _deactivateStrategy();
    }

    /**
     * @notice Initializes the vault's strategy.
     * @dev Bypasses the time delay, but can only be called if strategy is not set already.
     * @param strategy_ Address of the strategy.
     * @return `true` if successful.
     */
    function initializeStrategy(address strategy_) external override onlyGovernance returns (bool) {
        require(currentAddresses[_STRATEGY_KEY] == address(0), Error.ADDRESS_ALREADY_SET);
        require(strategy_ != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        _setConfig(_STRATEGY_KEY, strategy_);
        _activateStrategy();
        require(IStrategy(strategy_).strategist() != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        return true;
    }

    /**
     * @notice Prepare update of the vault's strategy (with time delay enforced).
     * @param newStrategy Address of the new strategy.
     * @return `true` if successful.
     */
    function prepareNewStrategy(address newStrategy)
        external
        override
        onlyGovernance
        returns (bool)
    {
        return _prepare(_STRATEGY_KEY, newStrategy, STRATEGY_DELAY);
    }

    /**
     * @notice Execute strategy update (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New strategy address.
     */
    function executeNewStrategy() external override returns (address) {
        _executeDeadline(_STRATEGY_KEY);
        IStrategy strategy = getStrategy();
        if (address(strategy) != address(0)) {
            _harvest();
            strategy.shutdown();
            strategy.withdrawAll();

            // there might still be some balance left if the strategy did not
            // manage to withdraw all funds (e.g. due to locking)
            uint256 remainingStrategyBalance = strategy.balance();
            if (remainingStrategyBalance > 0) {
                _strategiesWaitingForRemoval.set(address(strategy), remainingStrategyBalance);
                waitingForRemovalAllocated += remainingStrategyBalance;
            }
        }
        _deactivateStrategy();
        currentAllocated = 0;
        totalDebt = 0;
        address newStrategy = pendingAddresses[_STRATEGY_KEY];
        _setConfig(_STRATEGY_KEY, newStrategy);

        if (newStrategy != address(0)) {
            _activateStrategy();
        }

        return newStrategy;
    }

    function resetNewStrategy() external override onlyGovernance returns (bool) {
        return _resetAddressConfig(_STRATEGY_KEY);
    }

    /**
     * @notice Prepare update of performance fee (with time delay enforced).
     * @param newPerformanceFee New performance fee value.
     * @return `true` if successful.
     */
    function preparePerformanceFee(uint256 newPerformanceFee)
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(newPerformanceFee <= MAX_PERFORMANCE_FEE, Error.INVALID_AMOUNT);
        return _prepare(_PERFORMANCE_FEE_KEY, newPerformanceFee);
    }

    /**
     * @notice Execute update of performance fee (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New performance fee.
     */
    function executePerformanceFee() external override returns (uint256) {
        return _executeUInt256(_PERFORMANCE_FEE_KEY);
    }

    function resetPerformanceFee() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_PERFORMANCE_FEE_KEY);
    }

    /**
     * @notice Prepare update of strategist fee (with time delay enforced).
     * @param newStrategistFee New strategist fee value.
     * @return `true` if successful.
     */
    function prepareStrategistFee(uint256 newStrategistFee)
        external
        override
        onlyGovernance
        returns (bool)
    {
        _checkFeesInvariant(getReserveFee(), newStrategistFee);
        return _prepare(_STRATEGIST_FEE_KEY, newStrategistFee);
    }

    /**
     * @notice Execute update of strategist fee (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New strategist fee.
     */
    function executeStrategistFee() external override returns (uint256) {
        uint256 newStrategistFee = _executeUInt256(_STRATEGIST_FEE_KEY);
        _checkFeesInvariant(getReserveFee(), newStrategistFee);
        return newStrategistFee;
    }

    function resetStrategistFee() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_STRATEGIST_FEE_KEY);
    }

    /**
     * @notice Prepare update of debt limit (with time delay enforced).
     * @param newDebtLimit New debt limit.
     * @return `true` if successful.
     */
    function prepareDebtLimit(uint256 newDebtLimit)
        external
        override
        onlyGovernance
        returns (bool)
    {
        return _prepare(_DEBT_LIMIT_KEY, newDebtLimit);
    }

    /**
     * @notice Execute update of debt limit (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New debt limit.
     */
    function executeDebtLimit() external override returns (uint256) {
        uint256 debtLimit = _executeUInt256(_DEBT_LIMIT_KEY);
        uint256 debtLimitAllocated = currentAllocated.scaledMul(debtLimit);
        if (totalDebt >= debtLimitAllocated) {
            _handleExcessDebt();
        }
        return debtLimit;
    }

    function resetDebtLimit() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_DEBT_LIMIT_KEY);
    }

    /**
     * @notice Prepare update of target allocation (with time delay enforced).
     * @param newTargetAllocation New target allocation.
     * @return `true` if successful.
     */
    function prepareTargetAllocation(uint256 newTargetAllocation)
        external
        override
        onlyGovernance
        returns (bool)
    {
        return _prepare(_TARGET_ALLOCATION_KEY, newTargetAllocation);
    }

    /**
     * @notice Execute update of target allocation (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New target allocation.
     */
    function executeTargetAllocation() external override returns (uint256) {
        uint256 targetAllocation = _executeUInt256(_TARGET_ALLOCATION_KEY);
        _deposit();
        return targetAllocation;
    }

    function resetTargetAllocation() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_TARGET_ALLOCATION_KEY);
    }

    /**
     * @notice Prepare update of reserve fee (with time delay enforced).
     * @param newReserveFee New reserve fee.
     * @return `true` if successful.
     */
    function prepareReserveFee(uint256 newReserveFee)
        external
        override
        onlyGovernance
        returns (bool)
    {
        _checkFeesInvariant(newReserveFee, getStrategistFee());
        return _prepare(_RESERVE_FEE_KEY, newReserveFee);
    }

    /**
     * @notice Execute update of reserve fee (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New reserve fee.
     */
    function executeReserveFee() external override returns (uint256) {
        uint256 newReserveFee = _executeUInt256(_RESERVE_FEE_KEY);
        _checkFeesInvariant(newReserveFee, getStrategistFee());
        return newReserveFee;
    }

    function resetReserveFee() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_RESERVE_FEE_KEY);
    }

    /**
     * @notice Prepare update of deviation bound for strategy allocation (with time delay enforced).
     * @param newBound New deviation bound for target allocation.
     * @return `true` if successful.
     */
    function prepareBound(uint256 newBound) external override onlyGovernance returns (bool) {
        require(newBound <= MAX_DEVIATION_BOUND, Error.INVALID_AMOUNT);
        return _prepare(_BOUND_KEY, newBound);
    }

    /**
     * @notice Execute update of deviation bound for strategy allocation (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New deviation bound.
     */
    function executeBound() external override returns (uint256) {
        uint256 bound = _executeUInt256(_BOUND_KEY);
        _deposit();
        return bound;
    }

    function resetBound() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_BOUND_KEY);
    }

    /**
     * @notice Withdraws an amount of underlying from the strategy to the vault.
     * @param amount Amount of underlying to withdraw.
     * @return True if successful withdrawal.
     */
    function withdrawFromStrategy(uint256 amount) external override onlyGovernance returns (bool) {
        IStrategy strategy = getStrategy();
        if (address(strategy) == address(0)) return false;
        if (strategy.balance() < amount) return false;
        uint256 oldBalance = _availableUnderlying();
        strategy.withdraw(amount);
        uint256 newBalance = _availableUnderlying();
        currentAllocated -= newBalance - oldBalance;
        return true;
    }

    function withdrawFromStrategyWaitingForRemoval(address strategy)
        external
        override
        returns (uint256)
    {
        (bool exists, uint256 allocated) = _strategiesWaitingForRemoval.tryGet(strategy);
        require(exists, Error.STRATEGY_DOES_NOT_EXIST);

        IStrategy strategy_ = IStrategy(strategy);

        strategy_.harvest();
        uint256 withdrawn = strategy_.withdrawAll();

        uint256 _waitingForRemovalAllocated = waitingForRemovalAllocated;
        if (withdrawn >= _waitingForRemovalAllocated) {
            waitingForRemovalAllocated = 0;
        } else {
            waitingForRemovalAllocated = _waitingForRemovalAllocated.uncheckedSub(withdrawn);
        }

        if (withdrawn > allocated) {
            uint256 profit = withdrawn.uncheckedSub(allocated);
            uint256 strategistShare = _shareFees(profit.scaledMul(getPerformanceFee()));
            if (strategistShare > 0) {
                _payStrategist(strategistShare, strategy_.strategist());
            }
            allocated = 0;
            emit Harvest(profit, 0);
        } else {
            allocated = allocated.uncheckedSub(withdrawn);
        }

        if (strategy_.balance() == 0) {
            _strategiesWaitingForRemoval.remove(address(strategy_));
        } else {
            _strategiesWaitingForRemoval.set(address(strategy_), allocated);
        }

        return withdrawn;
    }

    function getStrategiesWaitingForRemoval() external view override returns (address[] memory) {
        return _strategiesWaitingForRemoval.keysArray();
    }

    /**
     * @notice Computes the total underlying of the vault: idle funds + allocated funds
     * @return Total amount of underlying.
     */
    function getTotalUnderlying() external view override returns (uint256) {
        if (address(getStrategy()) == address(0)) {
            return _availableUnderlying();
        }

        return _availableUnderlying() + currentAllocated + waitingForRemovalAllocated;
    }

    function getAllocatedToStrategyWaitingForRemoval(address strategy)
        external
        view
        override
        returns (uint256)
    {
        return _strategiesWaitingForRemoval.get(strategy);
    }

    /**
     * @notice Withdraws all funds from strategy to vault.
     * @dev Harvests profits before withdrawing. Deactivates strategy after withdrawing.
     * @return `true` if successful.
     */
    function withdrawAllFromStrategy() public override onlyPoolOrGovernance returns (bool) {
        return _withdrawAllFromStrategy();
    }

    /**
     * @notice Harvest profits from the vault's strategy.
     * @dev Harvesting adds profits to the vault's balance and deducts fees.
     *  No performance fees are charged on profit used to repay debt.
     * @return `true` if successful.
     */
    function harvest() public override onlyPoolOrMaintenance returns (bool) {
        return _harvest();
    }

    /**
     * @notice Returns the percentage of the performance fee that goes to the strategist.
     */
    function getStrategistFee() public view override returns (uint256) {
        return currentUInts256[_STRATEGIST_FEE_KEY];
    }

    function getStrategy() public view override returns (IStrategy) {
        return IStrategy(currentAddresses[_STRATEGY_KEY]);
    }

    /**
     * @notice Returns the percentage of the performance fee which is allocated to the vault reserve
     */
    function getReserveFee() public view override returns (uint256) {
        return currentUInts256[_RESERVE_FEE_KEY];
    }

    /**
     * @notice Returns the fee charged on a strategy's generated profits.
     * @dev The strategist is paid in LP tokens, while the remainder of the profit stays in the vault.
     *      Default performance fee is set to 5% of harvested profits.
     */
    function getPerformanceFee() public view override returns (uint256) {
        return currentUInts256[_PERFORMANCE_FEE_KEY];
    }

    /**
     * @notice Returns the allowed symmetric bound for target allocation (e.g. +- 5%)
     */
    function getBound() public view override returns (uint256) {
        return currentUInts256[_BOUND_KEY];
    }

    /**
     * @notice The target percentage of total underlying funds to be allocated towards a strategy.
     * @dev this is to reduce gas costs. Withdrawals first come from idle funds and can therefore
     *      avoid unnecessary gas costs.
     */
    function getTargetAllocation() public view override returns (uint256) {
        return currentUInts256[_TARGET_ALLOCATION_KEY];
    }

    /**
     * @notice The debt limit that the total debt of a strategy may not exceed.
     */
    function getDebtLimit() public view override returns (uint256) {
        return currentUInts256[_DEBT_LIMIT_KEY];
    }

    function getUnderlying() public view virtual override returns (address);

    function _activateStrategy() internal returns (bool) {
        IStrategy strategy = getStrategy();
        if (address(strategy) == address(0)) return false;

        strategyActive = true;
        emit StrategyActivated(address(strategy));
        _deposit();
        return true;
    }

    function _harvest() internal returns (bool) {
        IStrategy strategy = getStrategy();
        if (address(strategy) == address(0)) {
            return false;
        }

        strategy.harvest();

        uint256 strategistShare;

        uint256 allocatedUnderlying = strategy.balance();
        uint256 amountAllocated = currentAllocated;
        uint256 currentDebt = totalDebt;

        if (allocatedUnderlying > amountAllocated) {
            // we made profits
            uint256 profit = allocatedUnderlying.uncheckedSub(amountAllocated);

            if (profit > currentDebt) {
                if (currentDebt > 0) {
                    profit = profit.uncheckedSub(currentDebt);
                    currentDebt = 0;
                }
                (profit, strategistShare) = _shareProfit(profit);
            } else {
                currentDebt = currentDebt.uncheckedSub(profit);
            }
            emit Harvest(profit, 0);
        } else if (allocatedUnderlying < amountAllocated) {
            // we made a loss
            uint256 loss = amountAllocated.uncheckedSub(allocatedUnderlying);
            currentDebt += loss;

            // check debt limit and withdraw funds if exceeded
            uint256 debtLimit = getDebtLimit();
            uint256 debtLimitAllocated = amountAllocated.scaledMul(debtLimit);
            if (currentDebt > debtLimitAllocated) {
                currentDebt = _handleExcessDebt(currentDebt);
            }
            emit Harvest(0, loss);
        } else {
            // nothing to declare
            return true;
        }

        totalDebt = currentDebt;
        currentAllocated = strategy.balance();

        if (strategistShare > 0) {
            _payStrategist(strategistShare);
        }

        return true;
    }

    function _withdrawAllFromStrategy() internal returns (bool) {
        IStrategy strategy = getStrategy();
        if (address(strategy) == address(0)) return false;
        _harvest();
        strategy.withdrawAll();
        currentAllocated = 0;
        totalDebt = 0;
        _deactivateStrategy();
        return true;
    }

    function _handleExcessDebt(uint256 currentDebt) internal returns (uint256) {
        IVaultReserve reserve_ = reserve;
        uint256 underlyingReserves = reserve_.getBalance(address(this), getUnderlying());
        if (currentDebt > underlyingReserves) {
            _emergencyStop(underlyingReserves);
        } else if (reserve_.canWithdraw(address(this))) {
            reserve_.withdraw(getUnderlying(), currentDebt);
            currentDebt = 0;
            _deposit();
        }
        return currentDebt;
    }

    function _handleExcessDebt() internal {
        uint256 currentDebt = totalDebt;
        uint256 newDebt = _handleExcessDebt(currentDebt);
        if (currentDebt != newDebt) {
            totalDebt = newDebt;
        }
    }

    /**
     * @notice Invest the underlying money in the vault after a deposit from the pool is made.
     * @dev After each deposit, the vault checks whether it needs to rebalance underlying funds allocated to strategy.
     * If no strategy is set then all deposited funds will be idle.
     */
    function _deposit() internal {
        if (!strategyActive) return;

        uint256 allocatedUnderlying = getStrategy().balance();
        uint256 totalUnderlying = _availableUnderlying() +
            allocatedUnderlying +
            waitingForRemovalAllocated;

        if (totalUnderlying == 0) return;
        _rebalance(totalUnderlying, allocatedUnderlying);
    }

    function _shareProfit(uint256 profit) internal returns (uint256, uint256) {
        uint256 totalFeeAmount = profit.scaledMul(getPerformanceFee());
        if (_availableUnderlying() < totalFeeAmount) {
            getStrategy().withdraw(totalFeeAmount);
        }
        uint256 strategistShare = _shareFees(totalFeeAmount);

        return ((profit - totalFeeAmount), strategistShare);
    }

    function _shareFees(uint256 totalFeeAmount) internal returns (uint256) {
        uint256 strategistShare = totalFeeAmount.scaledMul(getStrategistFee());

        uint256 reserveShare = totalFeeAmount.scaledMul(getReserveFee());
        uint256 govShare = totalFeeAmount - strategistShare - reserveShare;

        _depositToReserve(reserveShare);
        if (govShare > 0) {
            _depositToRewardHandler(govShare);
        }
        return strategistShare;
    }

    function _emergencyStop(uint256 underlyingReserves) internal {
        // debt limit exceeded: withdraw funds from strategy
        uint256 withdrawn = getStrategy().withdrawAll();

        uint256 actualDebt = _computeNewAllocated(currentAllocated, withdrawn);

        if (reserve.canWithdraw(address(this))) {
            // check if debt can be covered with reserve funds
            if (underlyingReserves >= actualDebt) {
                reserve.withdraw(getUnderlying(), actualDebt);
            } else if (underlyingReserves > 0) {
                // debt can not be covered with reserves
                reserve.withdraw(getUnderlying(), underlyingReserves);
            }
        }

        // too much money lost, stop the strategy
        _deactivateStrategy();
    }

    /**
     * @notice Deactivates a strategy. All positions of the strategy are exited.
     * @return `true` if strategy has been deactivated
     */
    function _deactivateStrategy() internal returns (bool) {
        if (!strategyActive) return false;

        strategyActive = false;
        emit StrategyDeactivated(address(getStrategy()));
        return true;
    }

    function _payStrategist(uint256 amount) internal {
        _payStrategist(amount, getStrategy().strategist());
    }

    function _payStrategist(uint256 amount, address strategist) internal virtual;

    function _transfer(address to, uint256 amount) internal virtual;

    function _depositToReserve(uint256 amount) internal virtual;

    function _depositToRewardHandler(uint256 amount) internal virtual;

    function _availableUnderlying() internal view virtual returns (uint256);

    function _computeNewAllocated(uint256 allocated, uint256 withdrawn)
        internal
        pure
        returns (uint256)
    {
        if (allocated > withdrawn) {
            return allocated - withdrawn;
        }
        return 0;
    }

    function _checkFeesInvariant(uint256 reserveFee, uint256 strategistFee) internal pure {
        require(
            reserveFee + strategistFee <= ScaledMath.ONE,
            "sum of strategist fee and reserve fee should be below 1"
        );
    }

    function _rebalance(uint256 totalUnderlying, uint256 allocatedUnderlying)
        private
        returns (bool)
    {
        if (!strategyActive) return false;
        uint256 targetAllocation = getTargetAllocation();

        IStrategy strategy = getStrategy();
        uint256 bound = getBound();

        uint256 target = totalUnderlying.scaledMul(targetAllocation);
        uint256 upperBound = targetAllocation == 0 ? 0 : targetAllocation + bound;
        upperBound = upperBound > ScaledMath.ONE ? ScaledMath.ONE : upperBound;
        uint256 lowerBound = bound > targetAllocation ? 0 : targetAllocation - bound;
        if (allocatedUnderlying > totalUnderlying.scaledMul(upperBound)) {
            // withdraw funds from strategy
            uint256 withdrawAmount = allocatedUnderlying - target;
            strategy.withdraw(withdrawAmount);

            currentAllocated = _computeNewAllocated(currentAllocated, withdrawAmount);
        } else if (allocatedUnderlying < totalUnderlying.scaledMul(lowerBound)) {
            // allocate more funds to strategy
            uint256 depositAmount = target - allocatedUnderlying;
            _transfer(address(strategy), depositAmount);
            currentAllocated += depositAmount;
            strategy.deposit();
        }
        return true;
    }
}
