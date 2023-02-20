// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '../Proxy.sol';
import '../interfaces/IPoolFactory.sol';
import '../interfaces/IPool.sol';
import '../interfaces/IVerification.sol';
import '../interfaces/IStrategyRegistry.sol';
import '../interfaces/IRepayment.sol';
import '../interfaces/IPriceOracle.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

/**
 * @title Pool Factory contract with methods for handling different pools
 * @notice Implements the functions related to Pool (CRUD)
 * @author Sublime
 */
contract PoolFactory is Initializable, OwnableUpgradeable, IPoolFactory {
    /*
     * @notice Used to define limits for the Pool parameters
     * @param min the minimum threshold for the parameter
     * @param max the maximum threshold for the parameter
     */
    struct Limits {
        uint256 min;
        uint256 max;
    }

    /**
     * @notice function definition of the pool contract
     */
    bytes4 public poolInitFuncSelector; //  bytes4(keccak256("initialize(uint256,address,address,address,uint256,uint256,uint256,uint256,bool)"))

    /**
     * @notice address of the latest implementation of the pool logic
     */
    address public poolImpl;

    /**
     * @notice address of the contract storing the user registry
     */
    address public override userRegistry;

    /**
     * @notice address of the contract storing the strategy registry
     */
    address public strategyRegistry;

    /**
     * @notice address of the latest implementation of the extension logic
     */
    address public override extension;

    /**
     * @notice address of the latest implementation of the repayment logic
     */
    address public override repaymentImpl;

    /**
     * @notice address of the latest implementation of the pool logic
     */
    address public override priceOracle;

    /**
     * @notice address of the savings account used
     */
    address public override savingsAccount;

    /**
     * @notice the time interval for the lenders to make contributions to pool
     */
    uint256 public override collectionPeriod;

    /**
     * @notice the time interval for the borrower to withdraw the loan from pool
     */
    uint256 public override loanWithdrawalDuration;

    /**
     * @notice the time interval for the active stage of the margin call
     */
    uint256 public override marginCallDuration;

    /**
     * @notice Fraction of the requested amount for pool below which pool is cancelled
     */
    uint256 public override minBorrowFraction;

    /**
     * @notice the fraction used for calculating the liquidator reward
     */
    uint256 public override liquidatorRewardFraction;

    /**
     * @notice the fraction used for calculating the penalty when the pool is cancelled
     */
    uint256 public override poolCancelPenaltyMultiple;

    /**
     * @notice Contract Address of no yield
     */
    address public override noStrategyAddress;

    uint256 protocolFeeFraction;
    address protocolFeeCollector;

    /*
     * @notice Used to mark assets supported for borrowing
     */
    mapping(address => bool) isBorrowToken;

    /*
     * @notice Used to mark supported collateral assets
     */
    mapping(address => bool) isCollateralToken;

    /**
     * @notice Used to keep track of valid pool addresses
     */
    mapping(address => bool) public override poolRegistry;

    /*
     * @notice Used to set the min/max borrow amount for Pools
     */
    Limits poolSizeLimit;

    /*
     * @notice Used to set the min/max collateral ratio for Pools
     */
    Limits idealCollateralRatioLimit;

    /*
     * @notice Used to set the min/max borrow rates (interest rate provided by borrower) for Pools
     */
    Limits borrowRateLimit;

    /*
     * @notice used to set the min/max repayment interval for Pools
     */
    Limits repaymentIntervalLimit;

    /*
     * @notice used to set the min/max number of repayment intervals for Pools
     */
    Limits noOfRepaymentIntervalsLimit;

    /**
     * @notice functions affected by this modifier can only be invoked by the Pool
     */
    modifier onlyPool() {
        require(poolRegistry[msg.sender], 'PoolFactory::onlyPool - Only pool can destroy itself');
        _;
    }

    /**
     * @notice functions affected by this modifier can only be invoked by the borrow of the Pool
     */
    modifier onlyBorrower(address _verifier) {
        require(
            IVerification(userRegistry).isUser(msg.sender, _verifier),
            'PoolFactory::onlyBorrower - Only a valid Borrower can create Pool'
        );
        _;
    }

    /**
     * @notice returns the owner of the pool
     */
    function owner() public view override(IPoolFactory, OwnableUpgradeable) returns (address) {
        return OwnableUpgradeable.owner();
    }

    /**
     * @notice used to initialize the pool factory
     * @dev initializer can only be run once
     * @param _admin address of admin
     * @param _collectionPeriod period for which lenders can lend for pool
     * @param _loanWithdrawalDuration period for which lent tokens can be withdrawn after pool starts
     * @param _marginCallDuration duration of margin call before which collateral ratio has to be maintained
     * @param _poolInitFuncSelector function signature for initializing pool
     * @param _liquidatorRewardFraction fraction of liquidation amount which is given to liquidator as reward multiplied by 10**30
     * @param _poolCancelPenaltyMultiple multiple of borrow rate of pool as penality for cancellation of pool multiplied by 10**30
     * @param _minBorrowFraction amountCollected/amountRequested for a pool, if less than fraction by pool start time then pool can be cancelled without penality multiplied by 10**30
     * @param _protocolFeeFraction fraction of amount borrowed in pool which is collected as protocol fee
     * @param _protocolFeeCollector address where protocol fee is collected
     * @param _noStrategy address of the no strategy address
     */
    function initialize(
        address _admin,
        uint256 _collectionPeriod,
        uint256 _loanWithdrawalDuration,
        uint256 _marginCallDuration,
        bytes4 _poolInitFuncSelector,
        uint256 _liquidatorRewardFraction,
        uint256 _poolCancelPenaltyMultiple,
        uint256 _minBorrowFraction,
        uint256 _protocolFeeFraction,
        address _protocolFeeCollector,
        address _noStrategy
    ) external initializer {
        {
            OwnableUpgradeable.__Ownable_init();
            OwnableUpgradeable.transferOwnership(_admin);
        }
        _updateCollectionPeriod(_collectionPeriod);
        _updateLoanWithdrawalDuration(_loanWithdrawalDuration);
        _updateMarginCallDuration(_marginCallDuration);
        _updatepoolInitFuncSelector(_poolInitFuncSelector);
        _updateLiquidatorRewardFraction(_liquidatorRewardFraction);
        _updatePoolCancelPenaltyMultiple(_poolCancelPenaltyMultiple);
        _updateMinBorrowFraction(_minBorrowFraction);
        _updateProtocolFeeFraction(_protocolFeeFraction);
        _updateProtocolFeeCollector(_protocolFeeCollector);
        _updateNoStrategy(_noStrategy);
    }

    /**
     * @notice used to setImplementation addresses
     * @dev used to set some of the contracts pool factory interacts with. only admin can invoke
     * @param _poolImpl address of the implementation address of pool
     * @param _repaymentImpl address of the implementation address of repayments
     * @param _userRegistry address of the user registry where users are verified
     * @param _strategyRegistry address of the startegy registry where strategies are whitelisted
     * @param _priceOracle address of the price oracle
     * @param _savingsAccount address of the savings account contract
     * @param _extension address of the extension contract for pools
     */
    function setImplementations(
        address _poolImpl,
        address _repaymentImpl,
        address _userRegistry,
        address _strategyRegistry,
        address _priceOracle,
        address _savingsAccount,
        address _extension
    ) external onlyOwner {
        _updatePoolLogic(_poolImpl);
        _updateRepaymentImpl(_repaymentImpl);
        _updateSavingsAccount(_savingsAccount);
        _updatedExtension(_extension);
        _updateUserRegistry(_userRegistry);
        _updateStrategyRegistry(_strategyRegistry);
        _updatePriceoracle(_priceOracle);
    }

    /**
     * @notice invoked when a new borrow pool is created. deploys a new pool for every borrow request
     * @param _poolSize loan amount requested
     * @param _borrowToken borrow asset requested
     * @param _collateralToken collateral asset requested
     * @param _idealCollateralRatio ideal pool collateral ratio set by the borrower
     * @param _borrowRate interest rate provided by the borrower
     * @param _repaymentInterval interval between the last dates of two repayment cycles
     * @param _noOfRepaymentIntervals number of repayments to be made during the duration of the loan
     * @param _poolSavingsStrategy savings strategy selected for the pool collateral
     * @param _collateralAmount collateral amount deposited
     * @param _transferFromSavingsAccount if true, initial collateral is transferred from borrower's savings account, if false, borrower transfers initial collateral deposit from wallet
     * @param _salt random and unique initial seed
     */
    function createPool(
        uint256 _poolSize,
        uint256 _borrowRate,
        address _borrowToken,
        address _collateralToken,
        uint256 _idealCollateralRatio,
        uint256 _repaymentInterval,
        uint256 _noOfRepaymentIntervals,
        address _poolSavingsStrategy,
        uint256 _collateralAmount,
        bool _transferFromSavingsAccount,
        bytes32 _salt,
        address _verifier,
        address _lenderVerifier
    ) external payable onlyBorrower(_verifier) {
        if (_collateralToken == address(0)) {
            require(msg.value == _collateralAmount, 'PoolFactory::createPool - Ether send is different from collateral amount specified');
        }
        require(_borrowToken != _collateralToken, 'PoolFactory::createPool - cant borrow the asset put in as collateralToken');
        require(isBorrowToken[_borrowToken], 'PoolFactory::createPool - Invalid borrow token type');
        require(isCollateralToken[_collateralToken], 'PoolFactory::createPool - Invalid collateral token type');
        require(
            IPriceOracle(priceOracle).doesFeedExist(_collateralToken, _borrowToken),
            "PoolFactory::createPool - Price feed doesn't support token pair"
        );
        require(IStrategyRegistry(strategyRegistry).registry(_poolSavingsStrategy), 'PoolFactory::createPool - Invalid strategy');
        require(isWithinLimits(_poolSize, poolSizeLimit.min, poolSizeLimit.max), 'PoolFactory::createPool - PoolSize not within limits');
        require(
            isWithinLimits(_idealCollateralRatio, idealCollateralRatioLimit.min, idealCollateralRatioLimit.max),
            'PoolFactory::createPool - Collateral Ratio not within limits'
        );
        require(
            isWithinLimits(_borrowRate, borrowRateLimit.min, borrowRateLimit.max),
            'PoolFactory::createPool - Borrow rate not within limits'
        );
        require(
            isWithinLimits(_noOfRepaymentIntervals, noOfRepaymentIntervalsLimit.min, noOfRepaymentIntervalsLimit.max),
            'PoolFactory::createPool - Loan duration not within limits'
        );
        require(
            isWithinLimits(_repaymentInterval, repaymentIntervalLimit.min, repaymentIntervalLimit.max),
            'PoolFactory::createPool - Repayment interval not within limits'
        );
        _createPool(
            _poolSize,
            _borrowRate,
            _borrowToken,
            _collateralToken,
            _idealCollateralRatio,
            _repaymentInterval,
            _noOfRepaymentIntervals,
            _poolSavingsStrategy,
            _collateralAmount,
            _transferFromSavingsAccount,
            _salt,
            _lenderVerifier
        );
    }

    // @dev These functions are used to avoid stack too deep
    function _createPool(
        uint256 _poolSize,
        uint256 _borrowRate,
        address _borrowToken,
        address _collateralToken,
        uint256 _idealCollateralRatio,
        uint256 _repaymentInterval,
        uint256 _noOfRepaymentIntervals,
        address _poolSavingsStrategy,
        uint256 _collateralAmount,
        bool _transferFromSavingsAccount,
        bytes32 _salt,
        address _lenderVerifier
    ) internal {
        bytes memory data = _encodePoolInitCall(
            _poolSize,
            _borrowRate,
            _borrowToken,
            _collateralToken,
            _idealCollateralRatio,
            _repaymentInterval,
            _noOfRepaymentIntervals,
            _poolSavingsStrategy,
            _collateralAmount,
            _transferFromSavingsAccount,
            _lenderVerifier
        );
        bytes32 salt = keccak256(abi.encodePacked(_salt, msg.sender));
        bytes memory bytecode = abi.encodePacked(type(SublimeProxy).creationCode, abi.encode(poolImpl, address(0x01), data));
        uint256 amount = _collateralToken == address(0) ? _collateralAmount : 0;

        address pool = _deploy(amount, salt, bytecode);

        poolRegistry[pool] = true;
        emit PoolCreated(pool, msg.sender);
    }

    // @dev These functions are used to avoid stack too deep
    function _encodePoolInitCall(
        uint256 _poolSize,
        uint256 _borrowRate,
        address _borrowToken,
        address _collateralToken,
        uint256 _idealCollateralRatio,
        uint256 _repaymentInterval,
        uint256 _noOfRepaymentIntervals,
        address _poolSavingsStrategy,
        uint256 _collateralAmount,
        bool _transferFromSavingsAccount,
        address _lenderVerifier
    ) internal view returns (bytes memory data) {
        data = abi.encodeWithSelector(
            poolInitFuncSelector,
            _poolSize,
            _borrowRate,
            msg.sender,
            _borrowToken,
            _collateralToken,
            _idealCollateralRatio,
            _repaymentInterval,
            _noOfRepaymentIntervals,
            _poolSavingsStrategy,
            _collateralAmount,
            _transferFromSavingsAccount,
            _lenderVerifier,
            loanWithdrawalDuration,
            collectionPeriod
        );
    }

    /**
     * @dev Deploys a contract using `CREATE2`. The address where the contract
     * will be deployed can be known in advance via {computeAddress}.
     *
     * The bytecode for a contract can be obtained from Solidity with
     * `type(contractName).creationCode`.
     *
     * Requirements:
     *
     * - `bytecode` must not be empty.
     * - `salt` must have not been used for `bytecode` already.
     * - the factory must have a balance of at least `amount`.
     * - if `amount` is non-zero, `bytecode` must have a `payable` constructor.
     */
    function _deploy(
        uint256 amount,
        bytes32 salt,
        bytes memory bytecode
    ) internal returns (address addr) {
        require(bytecode.length != 0, 'Create2: bytecode length is zero');
        // solhint-disable-next-line no-inline-assembly
        assembly {
            addr := create2(amount, add(bytecode, 0x20), mload(bytecode), salt)
        }
        require(addr != address(0), 'Create2: Failed on deploy');
    }

    /**
     * @notice invoked to check if pool parameters are within thresholds
     * @param _value supplied value of the parameter
     * @param _min minimum threshold of the parameter
     * @param _max maximum threshold of the parameter
     */
    function isWithinLimits(
        uint256 _value,
        uint256 _min,
        uint256 _max
    ) internal pure returns (bool) {
        if (_min != 0 && _max != 0) {
            return (_value >= _min && _value <= _max);
        } else if (_min != 0) {
            return (_value >= _min);
        } else if (_max != 0) {
            return (_value <= _max);
        } else {
            return true;
        }
    }

    /**
     * @notice used to update the list of supported borrow tokens
     * @param _borrowToken address of the borrow asset
     * @param _isSupported true if _borrowToken is a valid borrow asset, false if _borrowToken is an invalid borrow asset
     */
    function updateSupportedBorrowTokens(address _borrowToken, bool _isSupported) external onlyOwner {
        _updateSupportedBorrowTokens(_borrowToken, _isSupported);
    }

    function _updateSupportedBorrowTokens(address _borrowToken, bool _isSupported) internal {
        isBorrowToken[_borrowToken] = _isSupported;
        emit BorrowTokenUpdated(_borrowToken, _isSupported);
    }

    /**
     * @notice used to update the list of supported Collateral tokens
     * @param _collateralToken address of the Collateral asset
     * @param _isSupported true if _collateralToken is a valid Collateral asset, false if _collateralToken is an invalid Collateral asset
     */
    function updateSupportedCollateralTokens(address _collateralToken, bool _isSupported) external onlyOwner {
        _updateSupportedCollateralTokens(_collateralToken, _isSupported);
    }

    function _updateSupportedCollateralTokens(address _collateralToken, bool _isSupported) internal {
        isCollateralToken[_collateralToken] = _isSupported;
        emit CollateralTokenUpdated(_collateralToken, _isSupported);
    }

    /**
     * @notice used to update the pointer to Initializer function of the proxy pool contract
     * @param _functionId updated function definition of the proxy pool contract
     */
    function updatepoolInitFuncSelector(bytes4 _functionId) external onlyOwner {
        _updatepoolInitFuncSelector(_functionId);
    }

    function _updatepoolInitFuncSelector(bytes4 _functionId) internal {
        poolInitFuncSelector = _functionId;
        emit PoolInitSelectorUpdated(_functionId);
    }

    /**
     * @notice used to update the Pool.sol logic
     * @param _poolLogic the address of the new Pool logic contract
     */
    function updatePoolLogic(address _poolLogic) external onlyOwner {
        _updatePoolLogic(_poolLogic);
    }

    function _updatePoolLogic(address _poolLogic) internal {
        poolImpl = _poolLogic;
        emit PoolLogicUpdated(_poolLogic);
    }

    /**
     * @notice used to update the user registry
     * @param _userRegistry address of the contract storing the user registry
     */
    function updateUserRegistry(address _userRegistry) external onlyOwner {
        _updateUserRegistry(_userRegistry);
    }

    function _updateUserRegistry(address _userRegistry) internal {
        userRegistry = _userRegistry;
        emit UserRegistryUpdated(_userRegistry);
    }

    /**
     * @notice used to update the strategy registry
     * @param _strategyRegistry address of the contract storing the strategy registry
     */
    function updateStrategyRegistry(address _strategyRegistry) external onlyOwner {
        _updateStrategyRegistry(_strategyRegistry);
    }

    function _updateStrategyRegistry(address _strategyRegistry) internal {
        strategyRegistry = _strategyRegistry;
        emit StrategyRegistryUpdated(_strategyRegistry);
    }

    /**
     * @notice used to update the implementation of the repayment logic
     * @param _repaymentImpl address of the updated repayment.sol contract
     */
    function updateRepaymentImpl(address _repaymentImpl) external onlyOwner {
        _updateRepaymentImpl(_repaymentImpl);
    }

    function _updateRepaymentImpl(address _repaymentImpl) internal {
        repaymentImpl = _repaymentImpl;
        emit RepaymentImplUpdated(_repaymentImpl);
    }

    /**
     * @notice used to update contract address of nostrategy contract
     * @param _noStrategy address of the updated noYield.sol contract
     */
    function updateNoStrategy(address _noStrategy) external onlyOwner {
        _updateNoStrategy(_noStrategy);
    }

    function _updateNoStrategy(address _noStrategy) internal {
        noStrategyAddress = _noStrategy;
        emit NoStrategyUpdated(_noStrategy);
    }

    /**
     * @notice used to update the implementation of the price oracle logic
     * @param _priceOracle address of the updated price oracle contract
     */
    function updatePriceoracle(address _priceOracle) external onlyOwner {
        _updatePriceoracle(_priceOracle);
    }

    function _updatePriceoracle(address _priceOracle) internal {
        priceOracle = _priceOracle;
        emit PriceOracleUpdated(_priceOracle);
    }

    /**
     * @notice used to update the extensions contract
     * @param _extension address of the updated extensions contract
     */
    function updatedExtension(address _extension) external onlyOwner {
        _updatedExtension(_extension);
    }

    function _updatedExtension(address _extension) internal {
        extension = _extension;
        emit ExtensionImplUpdated(_extension);
    }

    /**
     * @notice used to update the savings account contract
     * @param _savingsAccount address of the updated savings account contract
     */
    function updateSavingsAccount(address _savingsAccount) external onlyOwner {
        _updateSavingsAccount(_savingsAccount);
    }

    function _updateSavingsAccount(address _savingsAccount) internal {
        savingsAccount = _savingsAccount;
        emit SavingsAccountUpdated(_savingsAccount);
    }

    /**
     * @notice used to update the collection period of the Pool
     * @param _collectionPeriod updated value of the collection period
     */
    function updateCollectionPeriod(uint256 _collectionPeriod) external onlyOwner {
        _updateCollectionPeriod(_collectionPeriod);
    }

    function _updateCollectionPeriod(uint256 _collectionPeriod) internal {
        collectionPeriod = _collectionPeriod;
        emit CollectionPeriodUpdated(_collectionPeriod);
    }

    /**
     * @notice used to update the loan withdrawal duration by owner
     * @param _loanWithdrawalDuration updated value of loanWithdrawalDuration
     */
    function updateLoanWithdrawalDuration(uint256 _loanWithdrawalDuration) external onlyOwner {
        _updateLoanWithdrawalDuration(_loanWithdrawalDuration);
    }

    function _updateLoanWithdrawalDuration(uint256 _loanWithdrawalDuration) internal {
        loanWithdrawalDuration = _loanWithdrawalDuration;
        emit LoanWithdrawalDurationUpdated(_loanWithdrawalDuration);
    }

    /**
     * @notice used to update the active stage of the margin call of the Pool
     * @param _marginCallDuration updated value of the margin call duration
     */
    function updateMarginCallDuration(uint256 _marginCallDuration) external onlyOwner {
        _updateMarginCallDuration(_marginCallDuration);
    }

    function _updateMarginCallDuration(uint256 _marginCallDuration) internal {
        marginCallDuration = _marginCallDuration;
        emit MarginCallDurationUpdated(_marginCallDuration);
    }

    /**
     * @notice used to update the min borrow fraction by owner
     * @param _minBorrowFraction updated value of min borrow fraction multiplied by 10**30
     */
    function updateMinBorrowFraction(uint256 _minBorrowFraction) external onlyOwner {
        _updateMinBorrowFraction(_minBorrowFraction);
    }

    function _updateMinBorrowFraction(uint256 _minBorrowFraction) internal {
        minBorrowFraction = _minBorrowFraction;
        emit MinBorrowFractionUpdated(_minBorrowFraction);
    }

    /**
     * @notice used to update the reward fraction for liquidation of the Pool
     * @param _liquidatorRewardFraction updated value of the reward fraction for liquidation multiplied by 10**30
     */
    function updateLiquidatorRewardFraction(uint256 _liquidatorRewardFraction) external onlyOwner {
        _updateLiquidatorRewardFraction(_liquidatorRewardFraction);
    }

    function _updateLiquidatorRewardFraction(uint256 _liquidatorRewardFraction) internal {
        liquidatorRewardFraction = _liquidatorRewardFraction;
        emit LiquidatorRewardFractionUpdated(_liquidatorRewardFraction);
    }

    /**
     * @notice used to update the pool cancel penalty multiple
     * @param _poolCancelPenaltyMultiple updated value of the pool cancel penalty multiple multiplied by 10**30
     */
    function updatePoolCancelPenaltyMultiple(uint256 _poolCancelPenaltyMultiple) external onlyOwner {
        _updatePoolCancelPenaltyMultiple(_poolCancelPenaltyMultiple);
    }

    function _updatePoolCancelPenaltyMultiple(uint256 _poolCancelPenaltyMultiple) internal {
        poolCancelPenaltyMultiple = _poolCancelPenaltyMultiple;
        emit PoolCancelPenaltyMultipleUpdated(_poolCancelPenaltyMultiple);
    }

    /**
     * @notice used to update the fraction of borrowed amount charged as protocol fee
     * @param _protocolFee updated value of protocol fee fraction multiplied by 10**30
     */
    function updateProtocolFeeFraction(uint256 _protocolFee) external onlyOwner {
        _updateProtocolFeeFraction(_protocolFee);
    }

    function _updateProtocolFeeFraction(uint256 _protocolFee) internal {
        protocolFeeFraction = _protocolFee;
        emit ProtocolFeeFractionUpdated(_protocolFee);
    }

    /**
     * @notice used to update the address in which protocol fee is collected
     * @param _protocolFeeCollector updated address of protocol fee collector
     */
    function updateProtocolFeeCollector(address _protocolFeeCollector) external onlyOwner {
        _updateProtocolFeeCollector(_protocolFeeCollector);
    }

    function _updateProtocolFeeCollector(address _protocolFeeCollector) internal {
        protocolFeeCollector = _protocolFeeCollector;
        emit ProtocolFeeCollectorUpdated(_protocolFeeCollector);
    }

    /**
     * @notice used to update the thresholds of the pool size of the Pool
     * @param _min updated value of the minimum threshold value of the pool size
     * @param _max updated value of the maximum threshold value of the pool size
     */
    function updatePoolSizeLimit(uint256 _min, uint256 _max) external onlyOwner {
        poolSizeLimit = Limits(_min, _max);
        emit LimitsUpdated('PoolSize', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the collateral ratio of the Pool
     * @param _min updated value of the minimum threshold value of the collateral ratio
     * @param _max updated value of the maximum threshold value of the collateral ratio
     */
    function updateidealCollateralRatioLimit(uint256 _min, uint256 _max) external onlyOwner {
        idealCollateralRatioLimit = Limits(_min, _max);
        emit LimitsUpdated('CollateralRatio', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the borrow rate of the Pool
     * @param _min updated value of the minimum threshold value of the borrow rate
     * @param _max updated value of the maximum threshold value of the borrow rate
     */
    function updateBorrowRateLimit(uint256 _min, uint256 _max) external onlyOwner {
        borrowRateLimit = Limits(_min, _max);
        emit LimitsUpdated('BorrowRate', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the repayment interval of the Pool
     * @param _min updated value of the minimum threshold value of the repayment interval
     * @param _max updated value of the maximum threshold value of the repayment interval
     */
    function updateRepaymentIntervalLimit(uint256 _min, uint256 _max) external onlyOwner {
        repaymentIntervalLimit = Limits(_min, _max);
        emit LimitsUpdated('RepaymentInterval', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the number of repayment intervals of the Pool
     * @param _min updated value of the minimum threshold value of the number of repayment intervals
     * @param _max updated value of the maximum threshold value of the number of repayment intervals
     */
    function updateNoOfRepaymentIntervalsLimit(uint256 _min, uint256 _max) external onlyOwner {
        noOfRepaymentIntervalsLimit = Limits(_min, _max);
        emit LimitsUpdated('NoOfRepaymentIntervals', _min, _max);
    }

    /**
     * @notice used to query protocol fee fraction and address of the collector
     * @return protocolFee Fraction multiplied by 10**30
     * @return address of protocol fee collector
     */
    function getProtocolFeeData() external view override returns (uint256, address) {
        return (protocolFeeFraction, protocolFeeCollector);
    }
}
