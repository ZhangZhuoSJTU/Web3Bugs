// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface IPoolFactory {
    /**
     * @notice emitted when a Pool is created
     * @param pool the address of the Pool
     * @param borrower the address of the borrower who created the pool
     */
    event PoolCreated(address indexed pool, address indexed borrower);

    /**
     * @notice emitted when the init function definition Pool.sol logic is updated
     * @param updatedSelector the new init function definition for the Pool logic contract
     */
    event PoolInitSelectorUpdated(bytes4 updatedSelector);

    /**
     * @notice emitted when the Pool.sol logic is updated
     * @param updatedPoolLogic the address of the new Pool logic contract
     */
    event PoolLogicUpdated(address indexed updatedPoolLogic);

    /**
     * @notice emitted when the user registry is updated
     * @param updatedBorrowerRegistry address of the contract storing the user registry
     */
    event UserRegistryUpdated(address indexed updatedBorrowerRegistry);

    /**
     * @notice emitted when the strategy registry is updated
     * @param updatedStrategyRegistry address of the contract storing the updated strategy registry
     */
    event StrategyRegistryUpdated(address indexed updatedStrategyRegistry);

    /**
     * @notice emitted when the Repayments.sol logic is updated
     * @param updatedRepaymentImpl the address of the new implementation of the Repayments logic
     */
    event RepaymentImplUpdated(address indexed updatedRepaymentImpl);

    /**
     * @notice emitted when the PriceOracle.sol is updated
     * @param updatedPriceOracle address of the new implementation of the PriceOracle
     */
    event PriceOracleUpdated(address indexed updatedPriceOracle);

    /**
     * @notice emitted when the Extension.sol is updated
     * @param updatedExtension address of the new implementation of the Extension
     */
    event ExtensionImplUpdated(address indexed updatedExtension);

    /**
     * @notice emitted when the SavingsAccount.sol is updated
     * @param savingsAccount address of the new implementation of the SavingsAccount
     */
    event SavingsAccountUpdated(address indexed savingsAccount);

    /**
     * @notice emitted when the collection period parameter for Pools is updated
     * @param updatedCollectionPeriod the new value of the collection period for Pools
     */
    event CollectionPeriodUpdated(uint256 updatedCollectionPeriod);

    /**
     * @notice emitted when the loan withdrawal parameter for Pools is updated
     * @param updatedLoanWithdrawalDuration the new value of the loan withdrawal period for Pools
     */
    event LoanWithdrawalDurationUpdated(uint256 updatedLoanWithdrawalDuration);

    /**
     * @notice emitted when the marginCallDuration variable is updated
     * @param updatedMarginCallDuration Duration (in seconds) for which a margin call is active
     */
    event MarginCallDurationUpdated(uint256 updatedMarginCallDuration);

    /**
     * @notice emitted when miBorrowFraction variable is updated
     * @param updatedMinBorrowFraction Updated value of miBorrowFraction
     */
    event MinBorrowFractionUpdated(uint256 updatedMinBorrowFraction);

    /**
     * @notice emitted when liquidatorRewardFraction variable is updated
     * @param updatedLiquidatorRewardFraction updated value of liquidatorRewardFraction
     */
    event LiquidatorRewardFractionUpdated(uint256 updatedLiquidatorRewardFraction);

    /**
     * @notice emitted when poolCancelPenaltyMultiple variable is updated
     * @param updatedPoolCancelPenaltyMultiple updated value of poolCancelPenaltyMultiple
     */
    event PoolCancelPenaltyMultipleUpdated(uint256 updatedPoolCancelPenaltyMultiple);

    /**
     * @notice emitted when fee that protocol changes for pools is updated
     * @param updatedProtocolFee updated value of protocolFeeFraction
     */
    event ProtocolFeeFractionUpdated(uint256 updatedProtocolFee);

    /**
     * @notice emitted when address which receives fee that protocol changes for pools is updated
     * @param updatedProtocolFeeCollector updated value of protocolFeeCollector
     */
    event ProtocolFeeCollectorUpdated(address updatedProtocolFeeCollector);

    /**
     * @notice emitted when threhsolds for one of the parameters (poolSizeLimit, collateralRatioLimit, borrowRateLimit, repaymentIntervalLimit, noOfRepaymentIntervalsLimit) is updated
     * @param limitType specifies the parameter whose limits are being updated
     * @param max maximum threshold value for limitType
     * @param min minimum threshold value for limitType
     */
    event LimitsUpdated(string indexed limitType, uint256 max, uint256 min);

    /**
     * @notice emitted when the list of supported borrow assets is updated
     * @param borrowToken address of the borrow asset
     * @param isSupported true if borrowToken is a valid borrow asset, false if borrowToken is an invalid borrow asset
     */
    event BorrowTokenUpdated(address indexed borrowToken, bool isSupported);

    /**
     * @notice emitted when the list of supported collateral assets is updated
     * @param collateralToken address of the collateral asset
     * @param isSupported true if collateralToken is a valid collateral asset, false if collateralToken is an invalid collateral asset
     */
    event CollateralTokenUpdated(address indexed collateralToken, bool isSupported);

    /**
     * @notice emitted when no strategy address in the pool is updated
     * @param noStrategy address of noYield contract
     */
    event NoStrategyUpdated(address noStrategy);

    function savingsAccount() external view returns (address);

    function owner() external view returns (address);

    function poolRegistry(address pool) external view returns (bool);

    function priceOracle() external view returns (address);

    function extension() external view returns (address);

    function repaymentImpl() external view returns (address);

    function userRegistry() external view returns (address);

    function collectionPeriod() external view returns (uint256);

    function loanWithdrawalDuration() external view returns (uint256);

    function marginCallDuration() external view returns (uint256);

    function minBorrowFraction() external view returns (uint256);

    function liquidatorRewardFraction() external view returns (uint256);

    function poolCancelPenaltyMultiple() external view returns (uint256);

    function getProtocolFeeData() external view returns (uint256, address);

    function noStrategyAddress() external view returns (address);
}
