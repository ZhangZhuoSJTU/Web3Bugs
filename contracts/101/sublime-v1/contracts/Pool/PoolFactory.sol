// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '../interfaces/IPoolFactory.sol';
import '../interfaces/IPool.sol';
import '../interfaces/IVerification.sol';
import '../interfaces/IStrategyRegistry.sol';
import '../interfaces/IPriceOracle.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import './MinimumBeaconProxy2.sol';

/**
 * @title Pool Factory contract with methods for handling different pools
 * @notice Implements the functions related to Pool (CRUD)
 * @author Sublime
 */
contract PoolFactory is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable, IPoolFactory {
    using SafeMath for uint256;

    //-------------------------------- Constants start --------------------------------/

    // Factor to multiply variables to maintain precision
    uint256 constant SCALING_FACTOR = 1e18;

    /**
     * @notice address of the usdc token contract
     */
    address public immutable usdcAsset;

    //-------------------------------- Constants end --------------------------------/

    //-------------------------------- Component addresses start --------------------------------/

    /**
     * @notice address of the contract storing the user registry
     */
    address public override userRegistry;

    /**
     * @notice address of the contract storing the strategy registry
     */
    address public strategyRegistry;
    /**
     * @notice address of the latest implementation of the repayment logic
     */
    address public override repaymentImpl;

    /**
     * @notice address of the latest implementation of the price oracle logic
     */
    address public override priceOracle;

    /**
     * @notice address of the savings account used
     */
    address public override savingsAccount;

    /**
     * @notice Contract Address of no yield
     */
    address public override noStrategyAddress;

    /**
     * @notice Address of the beacon for pool contract logic
     */
    address public beacon;

    //-------------------------------- Component addresses end --------------------------------/

    //-------------------------------- Protocol vars start --------------------------------/

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
     * @notice Fraction of borrowed amount that is deducted as protocol fee (scaled by SCALING_FACTOR)
     */
    uint256 public protocolFeeFraction;

    /**
     * @notice address to which protocol fee is transfered
     */
    address public protocolFeeCollector;

    //-------------------------------- Protocol vars end --------------------------------/

    //-------------------------------- State vars start --------------------------------/
    /*
     * @notice Used to mark assets supported for borrowing
     */
    mapping(address => uint256) public isBorrowToken;

    /*
     * @notice Used to mark supported collateral assets
     */
    mapping(address => uint256) public isCollateralToken;

    /**
     * @notice Used to keep track of valid pool addresses
     */
    mapping(address => uint256) public override poolRegistry;

    //-------------------------------- State vars end --------------------------------/

    //-------------------------------- Limits start --------------------------------/

    /*
     * @notice Used to define limits for the Pool parameters
     * @param min the minimum threshold for the parameter
     * @param max the maximum threshold for the parameter
     */
    struct Limits {
        uint256 min;
        uint256 max;
    }

    /*
     * @notice Used to set the min/max borrow amount for Pools
     */
    Limits public poolSizeLimit;

    /*
     * @notice Used to set the min/max collateral ratio for Pools
     */
    Limits public idealCollateralRatioLimit;

    /*
     * @notice Used to set the min/max borrow rates (interest rate provided by borrower) for Pools
     */
    Limits public borrowRateLimit;

    /*
     * @notice used to set the min/max repayment interval for Pools
     */
    Limits public repaymentIntervalLimit;

    /*
     * @notice used to set the min/max number of repayment intervals for Pools
     */
    Limits public noOfRepaymentIntervalsLimit;

    //-------------------------------- Limits end --------------------------------/

    //-------------------------------- Modifiers start --------------------------------/

    /**
     * @notice functions affected by this modifier can only be invoked by the Pool
     */
    modifier onlyPool() {
        require(poolRegistry[msg.sender] != 0, 'PF:OP1');
        _;
    }

    /**
     * @notice functions affected by this modifier can only be invoked by the borrow of the Pool
     */
    modifier onlyVerifiedUser(address _verifier) {
        require(IVerification(userRegistry).isUser(msg.sender, _verifier), 'PF:OB1');
        _;
    }

    //-------------------------------- Modifiers start --------------------------------/

    //-------------------------------- Init start --------------------------------/

    constructor(address _usdcAsset) {
        require(_usdcAsset != address(0), 'PF:C1');
        usdcAsset = _usdcAsset;
    }

    /**
     * @notice used to initialize the pool factory
     * @dev initializer can only be run once
     * @param _admin address of admin
     * @param _collectionPeriod period for which lenders can lend for pool
     * @param _loanWithdrawalDuration period for which lent tokens can be withdrawn after pool starts
     * @param _marginCallDuration duration of margin call before which collateral ratio has to be maintained
     * @param _liquidatorRewardFraction fraction of liquidation amount which is given to liquidator as reward multiplied by SCALING_FACTOR(10**18)
     * @param _poolCancelPenaltyMultiple multiple of borrow rate of pool as penality for cancellation of pool multiplied by SCALING_FACTOR(10**18)
     * @param _minBorrowFraction amountCollected/amountRequested for a pool, if less than fraction by pool start time then pool can be cancelled without penality multiplied by SCALING_FACTOR(10**18)
     * @param _protocolFeeFraction fraction of amount borrowed in pool which is collected as protocol fee
     * @param _protocolFeeCollector address where protocol fee is collected
     * @param _noStrategy address of the no strategy address
     */
    function initialize(
        address _admin,
        uint256 _collectionPeriod,
        uint256 _loanWithdrawalDuration,
        uint256 _marginCallDuration,
        uint256 _liquidatorRewardFraction,
        uint256 _poolCancelPenaltyMultiple,
        uint256 _minBorrowFraction,
        uint256 _protocolFeeFraction,
        address _protocolFeeCollector,
        address _noStrategy,
        address _beacon
    ) external initializer {
        {
            OwnableUpgradeable.__Ownable_init();
            OwnableUpgradeable.transferOwnership(_admin);
        }
        _updateCollectionPeriod(_collectionPeriod);
        _updateLoanWithdrawalDuration(_loanWithdrawalDuration);
        _updateMarginCallDuration(_marginCallDuration);
        _updateLiquidatorRewardFraction(_liquidatorRewardFraction);
        _updatePoolCancelPenaltyMultiple(_poolCancelPenaltyMultiple);
        _updateMinBorrowFraction(_minBorrowFraction);
        _updateProtocolFeeFraction(_protocolFeeFraction);
        _updateProtocolFeeCollector(_protocolFeeCollector);
        _updateNoStrategy(_noStrategy);
        beacon = _beacon;
        __ReentrancyGuard_init();
    }

    /**
     * @notice used to setImplementation addresses
     * @dev used to set some of the contracts pool factory interacts with. only admin can invoke
     * @param _repaymentImpl address of the implementation address of repayments
     * @param _userRegistry address of the user registry where users are verified
     * @param _strategyRegistry address of the startegy registry where strategies are whitelisted
     * @param _priceOracle address of the price oracle
     * @param _savingsAccount address of the savings account contract
     */
    function setImplementations(
        address _repaymentImpl,
        address _userRegistry,
        address _strategyRegistry,
        address _priceOracle,
        address _savingsAccount
    ) external onlyOwner {
        _updateRepaymentImpl(_repaymentImpl);
        _updateSavingsAccount(_savingsAccount);
        _updateUserRegistry(_userRegistry);
        _updateStrategyRegistry(_strategyRegistry);
        _updatePriceoracle(_priceOracle);
    }

    //-------------------------------- Init end --------------------------------/

    //-------------------------------- Create pool start --------------------------------/

    /**
     * @notice invoked when a new borrow pool is created. deploys a new pool for every borrow request
     * @param _poolSize loan amount requested
     * @param _borrowRate interest rate provided by the borrower
     * @param _borrowToken borrow asset requested
     * @param _collateralToken collateral asset requested
     * @param _idealCollateralRatio ideal pool collateral ratio set by the borrower
     * @param _repaymentInterval interval between the last dates of two repayment cycles
     * @param _noOfRepaymentIntervals number of repayments to be made during the duration of the loan
     * @param _poolSavingsStrategy savings strategy selected for the pool collateral
     * @param _collateralAmount collateral amount deposited
     * @param _transferFromSavingsAccount if true, initial collateral is transferred from borrower's savings account, if false, borrower transfers initial collateral deposit from wallet
     * @param _salt random and unique initial seed
     * @param _borrowerVerifier verifier with which borrower needs to be verified
     * @param _lenderVerifier verifier with which lender needs to be verified
     */
    function createPool(
        uint256 _poolSize,
        uint256 _borrowRate,
        address _borrowToken,
        address _collateralToken,
        uint256 _idealCollateralRatio,
        uint64 _repaymentInterval,
        uint64 _noOfRepaymentIntervals,
        address _poolSavingsStrategy,
        uint256 _collateralAmount,
        bool _transferFromSavingsAccount,
        bytes32 _salt,
        address _borrowerVerifier,
        address _lenderVerifier
    ) external onlyVerifiedUser(_borrowerVerifier) nonReentrant {
        require(_borrowToken != _collateralToken, 'PF:CP1');
        require(isBorrowToken[_borrowToken] != 0, 'PF:CP2');
        require(isCollateralToken[_collateralToken] != 0, 'PF:CP3');
        require(IPriceOracle(priceOracle).doesFeedExist(_collateralToken, _borrowToken), 'PF:CP4');
        require(IStrategyRegistry(strategyRegistry).registry(_poolSavingsStrategy) != 0, 'PF:CP5');
        _limitPoolSizeInUSD(_borrowToken, _poolSize);

        require(isWithinLimits(_idealCollateralRatio, idealCollateralRatioLimit.min, idealCollateralRatioLimit.max), 'PF:CP6');
        require(isWithinLimits(_borrowRate, borrowRateLimit.min, borrowRateLimit.max), 'PF:CP7');
        require(isWithinLimits(_noOfRepaymentIntervals, noOfRepaymentIntervalsLimit.min, noOfRepaymentIntervalsLimit.max), 'PF:CP8');
        require(isWithinLimits(_repaymentInterval, repaymentIntervalLimit.min, repaymentIntervalLimit.max), 'PF:CP9');
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
        uint64 _repaymentInterval,
        uint64 _noOfRepaymentIntervals,
        address _poolSavingsStrategy,
        uint256 _collateralAmount,
        bool _transferFromSavingsAccount,
        bytes32 _salt,
        address _lenderVerifier
    ) private {
        _salt = keccak256(abi.encode(msg.sender, _salt));
        address addr = _create(_salt);
        _initPool(
            addr,
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
        poolRegistry[addr] = 1;
        emit PoolCreated(addr, msg.sender);
    }

    function _create(bytes32 _salt) private returns (address) {
        address addr;
        bytes memory beaconProxyByteCode = abi.encodePacked(type(MinimumBeaconProxy).creationCode, abi.encode(beacon));

        assembly {
            addr := create2(callvalue(), add(beaconProxyByteCode, 0x20), mload(beaconProxyByteCode), _salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        return addr;
    }

    function _initPool(
        address _pool,
        uint256 _poolSize,
        uint256 _borrowRate,
        address _borrowToken,
        address _collateralToken,
        uint256 _idealCollateralRatio,
        uint64 _repaymentInterval,
        uint64 _noOfRepaymentIntervals,
        address _poolSavingsStrategy,
        uint256 _collateralAmount,
        bool _transferFromSavingsAccount,
        address _lenderVerifier
    ) private {
        IPool pool = IPool(_pool);
        pool.initialize(
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

    //-------------------------------- Create pool end --------------------------------/

    //-------------------------------- Limits checks start --------------------------------/

    function _limitPoolSizeInUSD(address _borrowToken, uint256 _poolsize) private view {
        (uint256 RatioOfPrices, uint256 decimals) = IPriceOracle(priceOracle).getLatestPrice(_borrowToken, usdcAsset);
        uint256 _poolsizeInUSD = _poolsize.mul(RatioOfPrices).div(10**decimals);
        require(isWithinLimits(_poolsizeInUSD, poolSizeLimit.min, poolSizeLimit.max), 'PF:ILPU1');
    }

    /**
     * @notice invoked to check if pool parameters are within thresholds
     * @dev min or max = 0 is considered as no limit set
     * @param _value supplied value of the parameter
     * @param _min minimum threshold of the parameter
     * @param _max maximum threshold of the parameter
     */
    function isWithinLimits(
        uint256 _value,
        uint256 _min,
        uint256 _max
    ) private pure returns (bool) {
        return (_value >= _min && _value <= _max);
    }

    //-------------------------------- Limits checks end --------------------------------/

    //-------------------------------- Limits setters start --------------------------------/

    /**
     * @notice used to update the thresholds of the pool size of the Pool
     * @dev pool size limits are in lowest units of USDC value
     * @param _min updated value of the minimum threshold value of the pool size
     * @param _max updated value of the maximum threshold value of the pool size
     */
    function updatePoolSizeLimit(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'PF:UPSL1');
        require(!(poolSizeLimit.min == _min && poolSizeLimit.max == _max), 'PF:UPSL2');
        poolSizeLimit = Limits(_min, _max);
        emit LimitsUpdated('PoolSize', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the collateral ratio of the Pool
     * @param _min updated value of the minimum threshold value of the collateral ratio
     * @param _max updated value of the maximum threshold value of the collateral ratio
     */
    function updateidealCollateralRatioLimit(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'PF:UICRL1');
        require(!(idealCollateralRatioLimit.min == _min && idealCollateralRatioLimit.max == _max), 'PF:UICRL2');
        idealCollateralRatioLimit = Limits(_min, _max);
        emit LimitsUpdated('CollateralRatio', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the borrow rate of the Pool
     * @param _min updated value of the minimum threshold value of the borrow rate
     * @param _max updated value of the maximum threshold value of the borrow rate
     */
    function updateBorrowRateLimit(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'PF:UBRL1');
        require(!(borrowRateLimit.min == _min && borrowRateLimit.max == _max), 'PF:UBRL2');
        borrowRateLimit = Limits(_min, _max);
        emit LimitsUpdated('BorrowRate', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the repayment interval of the Pool
     * @param _min updated value of the minimum threshold value of the repayment interval
     * @param _max updated value of the maximum threshold value of the repayment interval
     */
    function updateRepaymentIntervalLimit(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'PF:URIL1');
        require(!(repaymentIntervalLimit.min == _min && repaymentIntervalLimit.max == _max), 'PF:URIL2');
        repaymentIntervalLimit = Limits(_min, _max);
        emit LimitsUpdated('RepaymentInterval', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the number of repayment intervals of the Pool
     * @param _min updated value of the minimum threshold value of the number of repayment intervals
     * @param _max updated value of the maximum threshold value of the number of repayment intervals
     */
    function updateNoOfRepaymentIntervalsLimit(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'PF:UNRIL1');
        require(!(noOfRepaymentIntervalsLimit.min == _min && noOfRepaymentIntervalsLimit.max == _max), 'PF:UNRIL2');
        noOfRepaymentIntervalsLimit = Limits(_min, _max);
        emit LimitsUpdated('NoOfRepaymentIntervals', _min, _max);
    }

    //-------------------------------- Limits setters end --------------------------------/

    //-------------------------------- Global var setters start --------------------------------/

    /**
     * @notice used to update the list of supported borrow tokens
     * @param _borrowToken address of the borrow asset
     * @param _isSupported true if _borrowToken is a valid borrow asset, false if _borrowToken is an invalid borrow asset
     */
    function updateSupportedBorrowTokens(address _borrowToken, bool _isSupported) external onlyOwner {
        _updateSupportedBorrowTokens(_borrowToken, _isSupported);
    }

    function _updateSupportedBorrowTokens(address _borrowToken, bool _isSupported) private {
        if (_isSupported) {
            isBorrowToken[_borrowToken] = 1;
        } else {
            delete isBorrowToken[_borrowToken];
        }
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

    function _updateSupportedCollateralTokens(address _collateralToken, bool _isSupported) private {
        if (_isSupported) {
            isCollateralToken[_collateralToken] = 1;
        } else {
            delete isCollateralToken[_collateralToken];
        }
        emit CollateralTokenUpdated(_collateralToken, _isSupported);
    }

    /**
     * @notice used to update the user registry
     * @param _userRegistry address of the contract storing the user registry
     */
    function updateUserRegistry(address _userRegistry) external onlyOwner {
        require(userRegistry != _userRegistry, 'PF:UUR1');
        _updateUserRegistry(_userRegistry);
    }

    function _updateUserRegistry(address _userRegistry) private {
        require(_userRegistry != address(0), 'PF:IUUR1');
        userRegistry = _userRegistry;
        emit UserRegistryUpdated(_userRegistry);
    }

    /**
     * @notice used to update the strategy registry
     * @param _strategyRegistry address of the contract storing the strategy registry
     */
    function updateStrategyRegistry(address _strategyRegistry) external onlyOwner {
        require(strategyRegistry != _strategyRegistry, 'PF:USR1');
        _updateStrategyRegistry(_strategyRegistry);
    }

    function _updateStrategyRegistry(address _strategyRegistry) private {
        require(_strategyRegistry != address(0), 'PF:IUSR1');
        strategyRegistry = _strategyRegistry;
        emit StrategyRegistryUpdated(_strategyRegistry);
    }

    /**
     * @notice used to update the implementation of the repayment logic
     * @param _repaymentImpl address of the updated repayment.sol contract
     */
    function updateRepaymentImpl(address _repaymentImpl) external onlyOwner {
        require(repaymentImpl == _repaymentImpl, 'PF:URI1');
        _updateRepaymentImpl(_repaymentImpl);
    }

    function _updateRepaymentImpl(address _repaymentImpl) private {
        require(_repaymentImpl != address(0), 'PF:IURI1');
        repaymentImpl = _repaymentImpl;
        emit RepaymentImplUpdated(_repaymentImpl);
    }

    /**
     * @notice used to update contract address of nostrategy contract
     * @param _noStrategy address of the updated noYield.sol contract
     */
    function updateNoStrategy(address _noStrategy) external onlyOwner {
        require(noStrategyAddress != _noStrategy, 'PF:UNS1');
        _updateNoStrategy(_noStrategy);
    }

    function _updateNoStrategy(address _noStrategy) private {
        require(_noStrategy != address(0), 'PF:IUNS1');
        noStrategyAddress = _noStrategy;
        emit NoStrategyUpdated(_noStrategy);
    }

    /**
     * @notice used to update the implementation of the price oracle logic
     * @param _priceOracle address of the updated price oracle contract
     */
    function updatePriceoracle(address _priceOracle) external onlyOwner {
        require(priceOracle != _priceOracle, 'PF:UPO1');
        _updatePriceoracle(_priceOracle);
    }

    function _updatePriceoracle(address _priceOracle) private {
        require(_priceOracle != address(0), 'PF:IUPO1');
        priceOracle = _priceOracle;
        emit PriceOracleUpdated(_priceOracle);
    }

    /**
     * @notice used to update the savings account contract
     * @param _savingsAccount address of the updated savings account contract
     */
    function updateSavingsAccount(address _savingsAccount) external onlyOwner {
        require(savingsAccount != _savingsAccount, 'PF:USA1');
        _updateSavingsAccount(_savingsAccount);
    }

    function _updateSavingsAccount(address _savingsAccount) private {
        require(_savingsAccount != address(0), 'PF:IUSA1');
        savingsAccount = _savingsAccount;
        emit SavingsAccountUpdated(_savingsAccount);
    }

    /**
     * @notice used to update the collection period of the Pool
     * @param _collectionPeriod updated value of the collection period
     */
    function updateCollectionPeriod(uint256 _collectionPeriod) external onlyOwner {
        require(collectionPeriod != _collectionPeriod, 'PF:UCP1');
        _updateCollectionPeriod(_collectionPeriod);
    }

    function _updateCollectionPeriod(uint256 _collectionPeriod) private {
        require(_collectionPeriod != 0, 'PF:IUCP1');
        collectionPeriod = _collectionPeriod;
        emit CollectionPeriodUpdated(_collectionPeriod);
    }

    /**
     * @notice used to update the loan withdrawal duration by owner
     * @param _loanWithdrawalDuration updated value of loanWithdrawalDuration
     */
    function updateLoanWithdrawalDuration(uint256 _loanWithdrawalDuration) external onlyOwner {
        require(loanWithdrawalDuration != _loanWithdrawalDuration, 'PF:ULWD1');
        _updateLoanWithdrawalDuration(_loanWithdrawalDuration);
    }

    function _updateLoanWithdrawalDuration(uint256 _loanWithdrawalDuration) private {
        require(_loanWithdrawalDuration != 0, 'PF:IULWD1');
        loanWithdrawalDuration = _loanWithdrawalDuration;
        emit LoanWithdrawalDurationUpdated(_loanWithdrawalDuration);
    }

    /**
     * @notice used to update the active stage of the margin call of the Pool
     * @param _marginCallDuration updated value of the margin call duration
     */
    function updateMarginCallDuration(uint256 _marginCallDuration) external onlyOwner {
        require(marginCallDuration != _marginCallDuration, 'PF:UMCD1');
        _updateMarginCallDuration(_marginCallDuration);
    }

    function _updateMarginCallDuration(uint256 _marginCallDuration) private {
        require(_marginCallDuration != 0, 'PF:IUMCD1');
        marginCallDuration = _marginCallDuration;
        emit MarginCallDurationUpdated(_marginCallDuration);
    }

    /**
     * @notice used to update the min borrow fraction by owner
     * @param _minBorrowFraction updated value of min borrow fraction multiplied by SCALING_FACTOR(10**18)
     */
    function updateMinBorrowFraction(uint256 _minBorrowFraction) external onlyOwner {
        require(minBorrowFraction != _minBorrowFraction, 'PF:UMBF1');
        _updateMinBorrowFraction(_minBorrowFraction);
    }

    function _updateMinBorrowFraction(uint256 _minBorrowFraction) private {
        require(_minBorrowFraction <= SCALING_FACTOR, 'PF:IUMBF1');
        minBorrowFraction = _minBorrowFraction;
        emit MinBorrowFractionUpdated(_minBorrowFraction);
    }

    /**
     * @notice used to update the reward fraction for liquidation of the Pool
     * @param _liquidatorRewardFraction updated value of the reward fraction for liquidation multiplied by SCALING_FACTOR(10**18)
     */
    function updateLiquidatorRewardFraction(uint256 _liquidatorRewardFraction) external onlyOwner {
        require(liquidatorRewardFraction != _liquidatorRewardFraction, 'PF:ULRF1');
        _updateLiquidatorRewardFraction(_liquidatorRewardFraction);
    }

    function _updateLiquidatorRewardFraction(uint256 _liquidatorRewardFraction) private {
        require(_liquidatorRewardFraction <= SCALING_FACTOR, 'PF:IULRF1');
        liquidatorRewardFraction = _liquidatorRewardFraction;
        emit LiquidatorRewardFractionUpdated(_liquidatorRewardFraction);
    }

    /**
     * @notice used to update the pool cancel penalty multiple
     * @param _poolCancelPenaltyMultiple updated value of the pool cancel penalty multiple multiplied by SCALING_FACTOR(10**18)
     */
    function updatePoolCancelPenaltyMultiple(uint256 _poolCancelPenaltyMultiple) external onlyOwner {
        require(poolCancelPenaltyMultiple != _poolCancelPenaltyMultiple, 'PF:UPCPM1');
        _updatePoolCancelPenaltyMultiple(_poolCancelPenaltyMultiple);
    }

    function _updatePoolCancelPenaltyMultiple(uint256 _poolCancelPenaltyMultiple) private {
        poolCancelPenaltyMultiple = _poolCancelPenaltyMultiple;
        emit PoolCancelPenaltyMultipleUpdated(_poolCancelPenaltyMultiple);
    }

    /**
     * @notice used to update the fraction of borrowed amount charged as protocol fee
     * @param _protocolFee updated value of protocol fee fraction multiplied by SCALING_FACTOR(10**18)
     */
    function updateProtocolFeeFraction(uint256 _protocolFee) external onlyOwner {
        require(protocolFeeFraction != _protocolFee, 'PF:UPFF1');
        _updateProtocolFeeFraction(_protocolFee);
    }

    function _updateProtocolFeeFraction(uint256 _protocolFee) private {
        require(_protocolFee <= SCALING_FACTOR, 'PF:IUPFF1');
        protocolFeeFraction = _protocolFee;
        emit ProtocolFeeFractionUpdated(_protocolFee);
    }

    /**
     * @notice used to update the address in which protocol fee is collected
     * @param _protocolFeeCollector updated address of protocol fee collector
     */
    function updateProtocolFeeCollector(address _protocolFeeCollector) external onlyOwner {
        require(protocolFeeCollector != _protocolFeeCollector, 'PF:UPFC1');
        _updateProtocolFeeCollector(_protocolFeeCollector);
    }

    function _updateProtocolFeeCollector(address _protocolFeeCollector) private {
        require(_protocolFeeCollector != address(0), 'PF:IUPFC1');
        protocolFeeCollector = _protocolFeeCollector;
        emit ProtocolFeeCollectorUpdated(_protocolFeeCollector);
    }

    //-------------------------------- Global var setters start --------------------------------/

    //-------------------------------- getters start --------------------------------/

    /**
     * @notice used to query protocol fee fraction and address of the collector
     * @return protocolFee Fraction multiplied by SCALING_FACTOR(10**18)
     * @return address of protocol fee collector
     */
    function getProtocolFeeData() external view override returns (uint256, address) {
        return (protocolFeeFraction, protocolFeeCollector);
    }

    /**
     * @notice returns the owner of the pool
     */
    function owner() public view override(IPoolFactory, OwnableUpgradeable) returns (address) {
        return OwnableUpgradeable.owner();
    }

    function preComputeAddress(address creator, bytes32 salt) external view returns (address predicted) {
        salt = keccak256(abi.encode(creator, salt));

        bytes memory beaconProxyByteCode = abi.encodePacked(type(MinimumBeaconProxy).creationCode, abi.encode(beacon));

        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(beaconProxyByteCode)));

        return address(uint160(uint256(hash)));
    }

    //-------------------------------- getters start --------------------------------/
}
