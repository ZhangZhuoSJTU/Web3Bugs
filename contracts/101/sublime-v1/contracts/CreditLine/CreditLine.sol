// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '../Math.sol';
import '../interfaces/IPriceOracle.sol';
import '../interfaces/IYield.sol';
import '../interfaces/ISavingsAccount.sol';
import '../interfaces/IStrategyRegistry.sol';
import '../interfaces/ICreditLine.sol';

/**
 * @title Credit Line contract with Methods related to creditLines
 * @notice Implements the functions related to Credit Line
 * @author Sublime
 **/

contract CreditLine is ReentrancyGuardUpgradeable, OwnableUpgradeable, ICreditline {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    //-------------------------------- Constants start --------------------------------//

    // number of seconds in an year
    uint256 internal constant YEAR_IN_SECONDS = 365 days;

    // Factor to multiply variables to maintain precision
    uint256 public constant SCALING_FACTOR = 1e18;

    // address of USDC contract
    address immutable USDC;

    /**
     * @notice stores the instance of price oracle contract
     **/
    IPriceOracle public immutable PRICE_ORACLE;

    /**
     * @notice stores the instance of savings account contract
     **/
    ISavingsAccount public immutable SAVINGS_ACCOUNT;

    /**
     * @notice stores the instance of strategy registry contract
     **/
    IStrategyRegistry public immutable STRATEGY_REGISTRY;

    //-------------------------------- Constants end --------------------------------//

    //-------------------------------- Global vars starts --------------------------------//

    /**
     * @notice stores the fraction of borrowed amount charged as fee by protocol
     * @dev it is multiplied by SCALING_FACTOR to maintain precision
     **/
    uint256 public protocolFeeFraction;

    /**
     * @notice address where protocol fee is collected
     **/
    address public protocolFeeCollector;

    /**
     * @notice stores the fraction of amount liquidated given as reward to liquidator
     * @dev it is multiplied by SCALING_FACTOR to maintain precision
     **/
    uint256 public liquidatorRewardFraction;

    //-------------------------------- Global vars ends --------------------------------//

    //-------------------------------- Variable limits starts --------------------------------//

    /*
     * @notice Used to define limits for the credit line parameters
     * @param min the minimum threshold for the parameter
     * @param max the maximum threshold for the parameter
     */
    struct Limits {
        uint256 min;
        uint256 max;
    }

    /*
     * @notice Used to set the min/max borrow limits for credit lines
     */
    Limits public borrowLimitLimits;

    /*
     * @notice Used to set the min/max collateral ratio for credit lines
     * @dev multiplied by SCALING_FACTOR to maintain precision
     */
    Limits public idealCollateralRatioLimits;

    /*
     * @notice Used to set the min/max borrow rate for credit lines
     * @dev multiplied by SCALING_FACTOR to maintain precision
     */
    Limits public borrowRateLimits;

    //-------------------------------- Variable limits ends --------------------------------//

    //-------------------------------- CreditLine state starts --------------------------------//

    /**
     * @notice Various states a credit line can be in
     */
    enum CreditLineStatus {
        NOT_CREATED,
        REQUESTED,
        ACTIVE
    }

    /**
    * @notice Struct to store all the variables for a credit line
    * @param status Represents the status of credit line
    * @param principal total principal borrowed in credit line
    * @param totalInterestRepaid total interest repaid in the credit line
    * @param lastPrincipalUpdateTime timestamp when principal was last updated. Principal is 
                updated on borrow or repay
    * @param interestAccruedTillLastPrincipalUpdate interest accrued till last time principal was updated
     */
    struct CreditLineVariables {
        CreditLineStatus status;
        uint256 principal;
        uint256 totalInterestRepaid;
        uint256 lastPrincipalUpdateTime;
        uint256 interestAccruedTillLastPrincipalUpdate;
    }

    /**
    * @notice Struct to store all the constants for a credit line
    * @dev only borrowLimit can be updated by lender
    * @param autoLiquidation if true, anyone can liquidate if collateral ratio is below threshold
    * @param requestByLender if true, lender else borrower created credit line request 
    * @param borrowLimit max amount of borrowAsset that can be borrowed in aggregate at any point
    * @param borrowRate Rate of interest multiplied by SCALING_FACTOR
    * @param idealCollateralRatio ratio of collateral to debt below which collateral is 
                                    liquidated multiplied by SCALING_FACTOR
    * @param lender address of the lender of credit line
    * @param borrower address of the borrower of credit line
    * @param borrowAsset address of asset borrowed in credit line
    * @param collateralAsset address of asset collateralized in credit line
    * @param collateralStrategy address of the strategy into which collateral is deposited
     */
    struct CreditLineConstants {
        bool autoLiquidation;
        bool requestByLender;
        uint128 borrowLimit;
        uint128 borrowRate;
        uint256 idealCollateralRatio;
        address lender;
        address borrower;
        address borrowAsset;
        address borrowAssetStrategy;
        address collateralAsset;
        address collateralStrategy;
    }

    /**
     * @notice counter that tracks the number of credit lines created
     * @dev used to create unique identifier for credit lines
     **/
    uint256 public creditLineCounter;

    /**
     * @notice stores the collateral shares in collateral strategy
     * @dev creditLineId => collateralShares
     **/
    mapping(uint256 => uint256) public collateralShareInStrategy;

    /**
     * @notice stores the variables to maintain a credit line
     **/
    mapping(uint256 => CreditLineVariables) public creditLineVariables;

    /**
     * @notice stores the constants related to a credit line
     **/
    mapping(uint256 => CreditLineConstants) public creditLineConstants;

    //-------------------------------- CreditLine State ends --------------------------------//

    //-------------------------------- Modifiers start --------------------------------//

    /**
     * @dev checks if called by credit Line Borrower
     * @param _id identifier for the credit line
     **/
    modifier onlyCreditLineBorrower(uint256 _id) {
        require(creditLineConstants[_id].borrower == msg.sender, 'CL:OCLB1');
        _;
    }

    /**
     * @dev checks if called by credit Line Lender
     * @param _id identifier for the credit line
     **/
    modifier onlyCreditLineLender(uint256 _id) {
        require(creditLineConstants[_id].lender == msg.sender, 'CL:OCLL1');
        _;
    }

    //-------------------------------- Modifiers end --------------------------------//

    //-------------------------------- Events start --------------------------------//

    //--------------------------- Limits event start ---------------------------//

    /**
     * @notice emitted when threhsolds for one of the parameters (borrowLimitLimits, idealCollateralRatioLimits, borrowRateLimits) is updated
     * @param limitType specifies the parameter whose limits are being updated
     * @param max maximum threshold value for limitType
     * @param min minimum threshold value for limitType
     */
    event LimitsUpdated(string indexed limitType, uint256 max, uint256 min);

    //--------------------------- Limits event end ---------------------------//

    //--------------------------- Global variable update events start ---------------------------//

    /**
     * @notice emitted when fee that protocol charges for credit line is updated
     * @dev updatedProtocolFee is scaled by SCALING_FACTOR
     * @param updatedProtocolFee updated value of protocolFeeFraction
     */
    event ProtocolFeeFractionUpdated(uint256 updatedProtocolFee);

    /**
     * @notice emitted when address which receives fee that protocol changes for pools is updated
     * @param updatedProtocolFeeCollector updated value of protocolFeeCollector
     */
    event ProtocolFeeCollectorUpdated(address indexed updatedProtocolFeeCollector);

    /**
     * @notice emitted when liquidatorRewardFraction is updated
     * @dev liquidatorRewardFraction is scaled by SCALING_FACTOR
     * @param liquidatorRewardFraction fraction of the liquidated amount given as reward to the liquidator
     */
    event LiquidationRewardFractionUpdated(uint256 liquidatorRewardFraction);

    //--------------------------- Global variable update events end ---------------------------//

    //--------------------------- CreditLine state events start ---------------------------//

    /**
     * @notice emitted when a collateral is deposited into credit line
     * @param id identifier for the credit line
     * @param shares amount of shares of collateral deposited
     */
    event CollateralSharesDeposited(uint256 indexed id, uint256 shares);

    /**
     * @notice emitted when collateral is withdrawn from credit line
     * @param id identifier for the credit line
     * @param shares amount of shares of collateral withdrawn
     */
    event CollateralSharesWithdrawn(uint256 indexed id, uint256 shares);

    /**
     * @notice emitted when a request for new credit line is placed
     * @param id identifier for the credit line for which request was made
     * @param lender address of the lender for credit line
     * @param borrower address of the borrower for credit line
     * @param requestByLender true if lender made request, false if borrower did
     */
    event CreditLineRequested(uint256 indexed id, address indexed lender, address indexed borrower, bool requestByLender);

    /**
     * @notice emitted when a credit line is liquidated
     * @param id identifier for the credit line which is liquidated
     * @param liquidator address of the liquidator
     */
    event CreditLineLiquidated(uint256 indexed id, address indexed liquidator);

    /**
     * @notice emitted when tokens are borrowed from credit line
     * @param id identifier for the credit line from which tokens are borrowed
     * @param borrowShares amount of shares of tokens borrowed
     */
    event BorrowedFromCreditLine(uint256 indexed id, uint256 borrowShares);

    /**
     * @notice emitted when credit line is accepted
     * @param id identifier for the credit line that was accepted
     */
    event CreditLineAccepted(uint256 indexed id);

    /**
     * @notice emitted when credit line is completely repaid and reset
     * @param id identifier for the credit line that is reset
     */
    event CreditLineReset(uint256 indexed id);

    /**
     * @notice emitted when the credit line is partially repaid
     * @param id identifier for the credit line
     * @param repayer address of the repayer
     * @param repayAmount amount repaid
     */
    event PartialCreditLineRepaid(uint256 indexed id, address indexed repayer, uint256 repayAmount);

    /**
     * @notice emitted when the credit line is completely repaid
     * @param id identifier for the credit line
     * @param repayer address of the repayer
     * @param repayAmount amount repaid
     */
    event CompleteCreditLineRepaid(uint256 indexed id, address indexed repayer, uint256 repayAmount);

    /**
     * @notice emitted when credit line is cancelled
     * @param id id of the credit line that was cancelled
     */
    event CreditLineCancelled(uint256 indexed id);

    /**
     * @notice emitted when the credit line is closed by one of the parties of credit line
     * @param id identifier for the credit line
     * @param closedByLender is true when it is closed by lender
     */
    event CreditLineClosed(uint256 indexed id, bool closedByLender);

    /**
     * @notice emitted when the borrow limit is updated for the credit line
     * @param id identifier for the credit line
     * @param updatedBorrowLimit updated value of borrow limit
     */
    event BorrowLimitUpdated(uint256 indexed id, uint128 updatedBorrowLimit);

    //--------------------------- CreditLine state events end ---------------------------//

    //-------------------------------- Events end --------------------------------//

    //-------------------------------- Limits code starts --------------------------------//

    /**
     * @notice invoked to check if credit lines parameters are within thresholds
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

    function _limitBorrowedInUSDC(address _borrowToken, uint256 _borrowLimit) private view {
        (uint256 _ratioOfPrices, uint256 _decimals) = PRICE_ORACLE.getLatestPrice(_borrowToken, USDC);
        uint256 _poolsizeInUSD = _borrowLimit.mul(_ratioOfPrices).div(10**_decimals);
        require(isWithinLimits(_poolsizeInUSD, borrowLimitLimits.min, borrowLimitLimits.max), 'CL:ILB1');
    }

    /**
     * @notice used to update the thresholds of the borrow limit of the credit line
     * @param _min updated value of the minimum threshold value of the borrow limit in lowest units of USDC
     * @param _max updated value of the maximum threshold value of the borrow limit in lowest units of USDC
     */
    function updateBorrowLimitLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'CL:UBLL1');
        require(!(borrowLimitLimits.min == _min && borrowLimitLimits.max == _max), 'CL:UBLL2');
        borrowLimitLimits = Limits(_min, _max);
        emit LimitsUpdated('borrowLimit', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the ideal collateral ratio of the credit line
     * @dev ideal collateral ratio limits are multiplied by SCALING_FACTOR
     * @param _min updated value of the minimum threshold value of the ideal collateral ratio
     * @param _max updated value of the maximum threshold value of the ideal collateral ratio
     */
    function updateIdealCollateralRatioLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'CL:UICRL1');
        require(!(idealCollateralRatioLimits.min == _min && idealCollateralRatioLimits.max == _max), 'CL:UICRL2');
        idealCollateralRatioLimits = Limits(_min, _max);
        emit LimitsUpdated('idealCollateralRatio', _min, _max);
    }

    /**
     * @notice used to update the thresholds of the borrow rate of the credit line
     * @dev borrow rate limits are multiplied by SCALING_FACTOR
     * @param _min updated value of the minimum threshold value of the borrow rate
     * @param _max updated value of the maximum threshold value of the borrow rate
     */
    function updateBorrowRateLimits(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, 'CL:UBRL1');
        require(!(borrowRateLimits.min == _min && borrowRateLimits.max == _max), 'CL:UBRL2');
        borrowRateLimits = Limits(_min, _max);
        emit LimitsUpdated('borrowRate', _min, _max);
    }

    //-------------------------------- Limits code end --------------------------------//

    //-------------------------------- Global var update code start --------------------------------//

    /**
     * @notice used to update the protocol fee fraction
     * @dev can only be updated by owner. Scaled by SCALING_FACTOR
     * @param _protocolFee fraction of the borrower amount collected as protocol fee
     */
    function updateProtocolFeeFraction(uint256 _protocolFee) external onlyOwner {
        require(protocolFeeFraction != _protocolFee, 'CL:UPFF1');
        _updateProtocolFeeFraction(_protocolFee);
    }

    function _updateProtocolFeeFraction(uint256 _protocolFee) private {
        require(_protocolFee <= SCALING_FACTOR, 'CL:IUPFF1');
        protocolFeeFraction = _protocolFee;
        emit ProtocolFeeFractionUpdated(_protocolFee);
    }

    /**
     * @notice used to update the protocol fee collector
     * @dev can only be updated by owner
     * @param _protocolFeeCollector address in which protocol fee is collected
     */
    function updateProtocolFeeCollector(address _protocolFeeCollector) external onlyOwner {
        require(protocolFeeCollector != _protocolFeeCollector, 'CL:UPFC1');
        _updateProtocolFeeCollector(_protocolFeeCollector);
    }

    function _updateProtocolFeeCollector(address _protocolFeeCollector) private {
        require(_protocolFeeCollector != address(0), 'CL:IUPFC1');
        protocolFeeCollector = _protocolFeeCollector;
        emit ProtocolFeeCollectorUpdated(_protocolFeeCollector);
    }

    /**
     * @notice used to update the liquidatorRewardFraction
     * @dev can only be updated by owner. Scaled by SCALING_FACTOR
     * @param _rewardFraction fraction of liquidated amount given to liquidator as reward
     */
    function updateLiquidatorRewardFraction(uint256 _rewardFraction) external onlyOwner {
        require(liquidatorRewardFraction != _rewardFraction, 'CL:ULRF1');
        _updateLiquidatorRewardFraction(_rewardFraction);
    }

    function _updateLiquidatorRewardFraction(uint256 _rewardFraction) private {
        require(_rewardFraction <= SCALING_FACTOR, 'CL:IULRF1');
        liquidatorRewardFraction = _rewardFraction;
        emit LiquidationRewardFractionUpdated(_rewardFraction);
    }

    //-------------------------------- Global var update code end --------------------------------//

    //-------------------------------- Initialize code start --------------------------------//

    /**
     * @notice used to initialize the immutables in contract
     * @param _usdc address of usdc contract
     */
    constructor(
        address _usdc,
        address _priceOracle,
        address _savingsAccount,
        address _strategyRegistry
    ) {
        require(_usdc != address(0), 'CL:CON1');
        USDC = _usdc;

        require(_priceOracle != address(0), 'CL:CON2');
        PRICE_ORACLE = IPriceOracle(_priceOracle);

        require(_savingsAccount != address(0), 'CL:CON3');
        SAVINGS_ACCOUNT = ISavingsAccount(_savingsAccount);

        require(_strategyRegistry != address(0), 'CL:CON4');
        STRATEGY_REGISTRY = IStrategyRegistry(_strategyRegistry);
    }

    /**
     * @notice used to initialize the contract
     * @dev can only be called once during the life cycle of the contract
     * @param _owner address of owner who can change global variables
     * @param _protocolFeeFraction fraction of the fee charged by protocol. Scaled by SCALING_FACTOR
     * @param _protocolFeeCollector address to which protocol fee is charged to
     * @param _liquidatorRewardFraction fraction of the liquidated amount given as reward to the liquidator.
                                        Scaled by SCALING_FACTOR
     */
    function initialize(
        address _owner,
        uint256 _protocolFeeFraction,
        address _protocolFeeCollector,
        uint256 _liquidatorRewardFraction
    ) external initializer {
        OwnableUpgradeable.__Ownable_init();
        OwnableUpgradeable.transferOwnership(_owner);
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        _updateProtocolFeeFraction(_protocolFeeFraction);
        _updateProtocolFeeCollector(_protocolFeeCollector);
        _updateLiquidatorRewardFraction(_liquidatorRewardFraction);
    }

    //-------------------------------- Initialize code end --------------------------------//

    //-------------------------------- CreditLine creation code start --------------------------------//

    /**
     * @notice used to request a credit line either by borrower or lender
     * @param _requestTo Address to which creditLine is requested, 
                        if borrower creates request then lender address and 
                        if lender creates then borrower address
     * @param _borrowLimit maximum borrow amount in a credit line
     * @param _borrowRate Interest Rate at which credit Line is requested. Scaled by SCALING_FACTOR
     * @param _autoLiquidation if true, anyone can liquidate loan, otherwise only lender
     * @param _collateralRatio ratio of the collateral to the debt below which credit line can be liquidated.
                                Scaled by SCALING_FACTOR
     * @param _borrowAsset address of the token to be borrowed
     * @param _collateralAsset address of the token provided as collateral
     * @param _requestAsLender if true, lender is placing request, otherwise borrower
     * @return identifier for the credit line
     */
    function request(
        address _requestTo,
        uint128 _borrowLimit,
        uint128 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio,
        address _borrowAsset,
        address _borrowAssetStrategy,
        address _collateralAsset,
        address _collateralStrategy,
        bool _requestAsLender
    ) external nonReentrant returns (uint256) {
        require(_borrowAsset != _collateralAsset, 'CL:R1');
        require(_requestTo != address(0), 'CL:R2');
        require(PRICE_ORACLE.doesFeedExist(_borrowAsset, _collateralAsset), 'CL:R3');
        _limitBorrowedInUSDC(_borrowAsset, _borrowLimit);
        require(isWithinLimits(_borrowRate, borrowRateLimits.min, borrowRateLimits.max), 'CL:R4');
        // collateral ratio = 0 is a special case which is allowed
        if (_collateralRatio != 0) {
            require(isWithinLimits(_collateralRatio, idealCollateralRatioLimits.min, idealCollateralRatioLimits.max), 'CL:R5');
        }
        require(STRATEGY_REGISTRY.registry(_borrowAssetStrategy) != 0, 'CL:R6');
        require(STRATEGY_REGISTRY.registry(_collateralStrategy) != 0, 'CL:R7');
        address _lender = _requestTo;
        address _borrower = msg.sender;
        if (_requestAsLender) {
            _lender = msg.sender;
            _borrower = _requestTo;
        }

        require(_lender != _borrower, 'CL:R8');

        uint256 _id = _createRequest(
            _lender,
            _borrower,
            _borrowLimit,
            _borrowRate,
            _autoLiquidation,
            _collateralRatio,
            _borrowAsset,
            _borrowAssetStrategy,
            _collateralAsset,
            _collateralStrategy,
            _requestAsLender
        );

        emit CreditLineRequested(_id, _lender, _borrower, _requestAsLender);
        return _id;
    }

    function _createRequest(
        address _lender,
        address _borrower,
        uint128 _borrowLimit,
        uint128 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio,
        address _borrowAsset,
        address _borrowAssetStrategy,
        address _collateralAsset,
        address _collateralStrategy,
        bool _requestByLender
    ) private returns (uint256) {
        uint256 _id = ++creditLineCounter;
        creditLineVariables[_id].status = CreditLineStatus.REQUESTED;
        creditLineConstants[_id].borrower = _borrower;
        creditLineConstants[_id].lender = _lender;
        creditLineConstants[_id].borrowLimit = _borrowLimit;
        creditLineConstants[_id].autoLiquidation = _autoLiquidation;
        creditLineConstants[_id].idealCollateralRatio = _collateralRatio;
        creditLineConstants[_id].borrowRate = _borrowRate;
        creditLineConstants[_id].borrowAsset = _borrowAsset;
        creditLineConstants[_id].borrowAssetStrategy = _borrowAssetStrategy;
        creditLineConstants[_id].collateralAsset = _collateralAsset;
        creditLineConstants[_id].collateralStrategy = _collateralStrategy;
        creditLineConstants[_id].requestByLender = _requestByLender;
        return _id;
    }

    /**
     * @notice used to accept a credit line
     * @dev if borrower places request, lender can accept and vice versa
     * @param _id identifier for the credit line
     */
    function accept(uint256 _id) external {
        require(creditLineVariables[_id].status == CreditLineStatus.REQUESTED, 'CL:A1');
        bool _requestByLender = creditLineConstants[_id].requestByLender;
        require(
            _requestByLender ? (msg.sender == creditLineConstants[_id].borrower) : (msg.sender == creditLineConstants[_id].lender),
            'CL:A2'
        );
        creditLineVariables[_id].status = CreditLineStatus.ACTIVE;
        emit CreditLineAccepted(_id);
    }

    //-------------------------------- CreditLine creation code end --------------------------------//

    //-------------------------------- Collateral management start --------------------------------//

    /**
     * @notice used to deposit collateral into the credit line
     * @dev collateral tokens have to be approved in savingsAccount or token contract
     * @param _id identifier for the credit line
     * @param _amount amount of collateral being deposited
     * @param _fromSavingsAccount if true, tokens are transferred from savingsAccount 
                                otherwise direct from collateral token contract
     */
    function depositCollateral(
        uint256 _id,
        uint256 _amount,
        bool _fromSavingsAccount
    ) external override nonReentrant {
        require(_amount != 0, 'CL:DC1');
        require(creditLineVariables[_id].status == CreditLineStatus.ACTIVE, 'CL:DC2');
        require(creditLineConstants[_id].lender != msg.sender, 'CL:DC3');

        address _collateralAsset = creditLineConstants[_id].collateralAsset;
        address _strategy = creditLineConstants[_id].collateralStrategy;
        uint256 _sharesDeposited;

        if (_fromSavingsAccount) {
            _sharesDeposited = SAVINGS_ACCOUNT.transferFrom(_collateralAsset, _strategy, msg.sender, address(this), _amount);
        } else {
            IERC20(_collateralAsset).safeTransferFrom(msg.sender, address(this), _amount);
            IERC20(_collateralAsset).safeApprove(_strategy, _amount);

            _sharesDeposited = SAVINGS_ACCOUNT.deposit(_collateralAsset, _strategy, address(this), _amount);
        }
        collateralShareInStrategy[_id] = collateralShareInStrategy[_id].add(_sharesDeposited);

        emit CollateralSharesDeposited(_id, _sharesDeposited);
    }

    /**
     * @notice used to withdraw any excess collateral
     * @dev collateral can't be withdraw if collateralRatio goes below the ideal value. Only borrower can withdraw
     * @param _id identifier for the credit line
     * @param _amount amount of collateral to withdraw
     * @param _toSavingsAccount if true, tokens are transferred from savingsAccount 
                                otherwise direct from collateral token contract
     */
    function withdrawCollateral(
        uint256 _id,
        uint256 _amount,
        bool _toSavingsAccount
    ) external nonReentrant onlyCreditLineBorrower(_id) {
        require(_amount != 0, 'CL:WC1');
        require(creditLineVariables[_id].status == CreditLineStatus.ACTIVE, 'CL:WC2');
        uint256 _currentWithdrawableCollateral = withdrawableCollateral(_id);
        require(_amount <= _currentWithdrawableCollateral, 'CL:WC3');
        uint256 _amountInShares = _transferCollateral(
            _id,
            creditLineConstants[_id].collateralAsset,
            msg.sender,
            _amount,
            _toSavingsAccount
        );
        emit CollateralSharesWithdrawn(_id, _amountInShares);
    }

    /**
     * @notice used to withdraw all the permissible collateral as per the current col ratio
     * @dev if the withdrawable collateral amount is non-zero the transaction will pass
     * @param _id identifier for the credit line
    * @param _toSavingsAccount if true, tokens are transferred from savingsAccount 
                                otherwise direct from collateral token contract
     */
    function withdrawAllCollateral(uint256 _id, bool _toSavingsAccount) external nonReentrant onlyCreditLineBorrower(_id) {
        require(creditLineVariables[_id].status == CreditLineStatus.ACTIVE, 'CL:WAC1');
        _withdrawAllCollateral(_id, msg.sender, _toSavingsAccount);
    }

    function _withdrawAllCollateral(
        uint256 _id,
        address _to,
        bool _toSavingsAccount
    ) private {
        uint256 _currentWithdrawableCollateral = withdrawableCollateral(_id);
        if (_currentWithdrawableCollateral != 0) {
            uint256 _amountInShares = _transferCollateral(
                _id,
                creditLineConstants[_id].collateralAsset,
                _to,
                _currentWithdrawableCollateral,
                _toSavingsAccount
            );
            emit CollateralSharesWithdrawn(_id, _amountInShares);
        }
    }

    /**
     * @notice used to calculate the collateral that can be withdrawn
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @param _id identifier for the credit line
     * @return total collateral withdrawable by borrower
     */
    function withdrawableCollateral(uint256 _id) public returns (uint256) {
        uint256 _ratioOfPrices;
        uint256 _decimals;
        uint256 _totalCollateralTokens;
        {
            // avoids stack too deep by restricting scope of _collateralAsset
            address _collateralAsset = creditLineConstants[_id].collateralAsset;
            _totalCollateralTokens = _calculateTotalCollateralTokens(_id, _collateralAsset);

            (_ratioOfPrices, _decimals) = PRICE_ORACLE.getLatestPrice(_collateralAsset, creditLineConstants[_id].borrowAsset);
        }
        uint256 _currentDebt = calculateCurrentDebt(_id);

        uint256 _collateralNeeded = _currentDebt
            .mul(creditLineConstants[_id].idealCollateralRatio)
            .mul(10**_decimals)
            .div(_ratioOfPrices)
            .div(SCALING_FACTOR);

        if (_collateralNeeded >= _totalCollateralTokens) return 0;

        return _totalCollateralTokens.sub(_collateralNeeded);
    }

    function _transferCollateral(
        uint256 _id,
        address _asset,
        address _to,
        uint256 _amountInTokens,
        bool _toSavingsAccount
    ) private returns (uint256) {
        address _strategy = creditLineConstants[_id].collateralStrategy;
        uint256 _amountInShares = IYield(_strategy).getSharesForTokens(_amountInTokens, _asset);
        if (_amountInShares == 0) return 0;

        collateralShareInStrategy[_id] = collateralShareInStrategy[_id].sub(_amountInShares);

        if (_toSavingsAccount) {
            SAVINGS_ACCOUNT.transferShares(_asset, _strategy, _to, _amountInShares);
        } else {
            SAVINGS_ACCOUNT.withdrawShares(_asset, _strategy, _to, _amountInShares, false);
        }

        return _amountInShares;
    }

    //-------------------------------- Collateral management end --------------------------------//

    //-------------------------------- Borrow code start --------------------------------//

    /**
     * @notice used to update the borrow limit of the creditLine
     * @dev can only be updated by lender
     * @param _id identifier for the credit line
     * @param _newBorrowLimit updated value of the borrow limit for the credit line
     */
    function updateBorrowLimit(uint256 _id, uint128 _newBorrowLimit) external nonReentrant onlyCreditLineLender(_id) {
        address _borrowAsset = creditLineConstants[_id].borrowAsset;
        _limitBorrowedInUSDC(_borrowAsset, uint256(_newBorrowLimit));
        creditLineConstants[_id].borrowLimit = _newBorrowLimit;
        emit BorrowLimitUpdated(_id, _newBorrowLimit);
    }

    /**
     * @notice used to calculate amount that can be borrowed by the borrower
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view.
            borrowableAmount changes per block as interest changes per block.
     * @param _id identifier for the credit line
     * @return amount that can be borrowed from the credit line
     */
    function calculateBorrowableAmount(uint256 _id) public returns (uint256) {
        CreditLineStatus _status = creditLineVariables[_id].status;
        require(_status == CreditLineStatus.ACTIVE, 'CL:CBA1');

        uint256 _collateralRatio = creditLineConstants[_id].idealCollateralRatio;
        uint256 _maxPossible = type(uint256).max;
        if (_collateralRatio != 0) {
            address _collateralAsset = creditLineConstants[_id].collateralAsset;
            (uint256 _ratioOfPrices, uint256 _decimals) = PRICE_ORACLE.getLatestPrice(
                _collateralAsset,
                creditLineConstants[_id].borrowAsset
            );

            uint256 _totalCollateralToken = _calculateTotalCollateralTokens(_id, _collateralAsset);
            _maxPossible = _totalCollateralToken.mul(_ratioOfPrices).div(_collateralRatio).mul(SCALING_FACTOR).div(10**_decimals);
        }

        uint256 _currentDebt = calculateCurrentDebt(_id);

        uint256 _borrowLimit = creditLineConstants[_id].borrowLimit;
        uint256 _principal = creditLineVariables[_id].principal;

        if (_maxPossible <= _currentDebt) return 0;

        return Math.min(_borrowLimit.sub(_principal), _maxPossible.sub(_currentDebt));
    }

    /**
     * @notice used to borrow tokens from credit line by borrower
     * @dev can only be called in ACTIVE stage
     * @dev only borrower can call this function. Amount that can actually be borrowed is 
            min(amount based on borrowLimit, allowance to creditLine contract, balance of lender)
     * @param _id identifier for the credit line
     * @param _amount amount of tokens to borrow
     */
    function borrow(uint256 _id, uint256 _amount) external nonReentrant onlyCreditLineBorrower(_id) {
        require(_amount != 0, 'CL:B1');
        require(_amount <= calculateBorrowableAmount(_id), 'CL:B2');
        address _borrowAsset = creditLineConstants[_id].borrowAsset;

        creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate = calculateInterestAccrued(_id);
        creditLineVariables[_id].lastPrincipalUpdateTime = block.timestamp;

        uint256 _balanceBefore = IERC20(_borrowAsset).balanceOf(address(this));
        uint256 _shares = SAVINGS_ACCOUNT.withdrawFrom(
            _borrowAsset,
            creditLineConstants[_id].borrowAssetStrategy,
            creditLineConstants[_id].lender,
            address(this),
            _amount,
            false
        );
        uint256 _balanceAfter = IERC20(_borrowAsset).balanceOf(address(this));

        uint256 _tokenDiffBalance = _balanceAfter.sub(_balanceBefore);
        creditLineVariables[_id].principal = creditLineVariables[_id].principal.add(_tokenDiffBalance);

        uint256 _protocolFee = _tokenDiffBalance.mul(protocolFeeFraction).div(SCALING_FACTOR);
        _tokenDiffBalance = _tokenDiffBalance.sub(_protocolFee);

        IERC20(_borrowAsset).safeTransfer(protocolFeeCollector, _protocolFee);
        IERC20(_borrowAsset).safeTransfer(msg.sender, _tokenDiffBalance);
        emit BorrowedFromCreditLine(_id, _shares);
    }

    //-------------------------------- Borrow code end --------------------------------//

    //-------------------------------- Repayments code start --------------------------------//

    /**
    @dev Regarding increaseAllowanceToCreditLineSince the borrower is giving money into the credit line, 
        we need to make sure that the Credit Line then has the allowance to use those funds
     */
    function _repay(uint256 _id, uint256 _amount) private {
        address _borrowAssetStrategy = creditLineConstants[_id].borrowAssetStrategy;
        address _borrowAsset = creditLineConstants[_id].borrowAsset;
        address _lender = creditLineConstants[_id].lender;
        IERC20(_borrowAsset).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_borrowAsset).safeApprove(_borrowAssetStrategy, _amount);
        SAVINGS_ACCOUNT.deposit(_borrowAsset, _borrowAssetStrategy, _lender, _amount);
    }

    /**
     * @notice used to repay interest and principal to credit line. Interest has to be repaid before repaying principal
     * @dev partial repayments possible
     * @param _id identifier for the credit line
     * @param _amount amount being repaid
     */

    function repay(uint256 _id, uint256 _amount) external override nonReentrant {
        require(_amount != 0, 'CL:REP1');
        require(creditLineVariables[_id].status == CreditLineStatus.ACTIVE, 'CL:REP2');
        require(creditLineConstants[_id].lender != msg.sender, 'CL:REP3');

        uint256 _totalInterestAccrued = calculateInterestAccrued(_id);
        uint256 _interestToPay = _totalInterestAccrued.sub(creditLineVariables[_id].totalInterestRepaid);
        uint256 _totalCurrentDebt = _interestToPay.add(creditLineVariables[_id].principal);

        if (_amount >= _totalCurrentDebt) {
            _amount = _totalCurrentDebt;
            emit CompleteCreditLineRepaid(_id, msg.sender, _amount);
        } else {
            emit PartialCreditLineRepaid(_id, msg.sender, _amount);
        }

        if (_amount > _interestToPay) {
            creditLineVariables[_id].principal = _totalCurrentDebt.sub(_amount);
            creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate = _totalInterestAccrued;
            creditLineVariables[_id].lastPrincipalUpdateTime = block.timestamp;
            creditLineVariables[_id].totalInterestRepaid = _totalInterestAccrued;
        } else {
            creditLineVariables[_id].totalInterestRepaid = creditLineVariables[_id].totalInterestRepaid.add(_amount);
        }

        _repay(_id, _amount);

        if (creditLineVariables[_id].principal == 0) {
            _resetCreditLine(_id);
        }
    }

    function _resetCreditLine(uint256 _id) private {
        creditLineVariables[_id].lastPrincipalUpdateTime = 0;
        creditLineVariables[_id].totalInterestRepaid = 0;
        creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate = 0;
        emit CreditLineReset(_id);
    }

    //-------------------------------- Repayments code end --------------------------------//

    //-------------------------------- Liquidation code start --------------------------------//

    /**
     * @notice used to liquidate credit line in case collateral ratio goes below the threshold
     * @dev if lender liquidates, then collateral is directly transferred. 
            If autoLiquidation is true, anyone can liquidate by providing enough borrow tokens
     * @param _id identifier for the credit line
     * @param _toSavingsAccount if true, shares are transferred from savingsAccount
                                otherwise tokens are  from collateral token contract
     */
    function liquidate(uint256 _id, bool _toSavingsAccount) external nonReentrant {
        uint256 _currentCollateralRatio;
        uint256 _totalCollateralTokens;
        require(creditLineVariables[_id].status == CreditLineStatus.ACTIVE, 'CL:L1');
        require(creditLineVariables[_id].principal != 0, 'CL:L2');

        address _lender = creditLineConstants[_id].lender;
        // For ideal collateral ratio = 0, Borrower can borrow tokens without depositing any collateral.
        // When liquidating a credit line with 0 creditLineConstants[_id].idealCollateralRatio,
        // the condition `_currentCollateralRatio < creditLineConstants[_id].idealCollateralRatio` will always revert.
        // This avoids the liquidation of unsecured loans even when the borrower is defaulting on the loan.
        // The if condition allows the lender to bypass the collateral ratio check in case of a defaulted unsecured loan.
        // This allows the liquidation of the defaulted unsecured loan and flagging the borrower as defaulted.
        // Third party users are NOT allowed to bypass the checks to avoid flase flagging of the borrower.
        if (creditLineConstants[_id].idealCollateralRatio != 0 || msg.sender != _lender) {
            (_currentCollateralRatio, _totalCollateralTokens) = calculateCurrentCollateralRatio(_id);
            require(_currentCollateralRatio < creditLineConstants[_id].idealCollateralRatio, 'CL:L3');
        }
        require(creditLineConstants[_id].autoLiquidation || msg.sender == _lender, 'CL:L4');

        uint256 _currentDebt = calculateCurrentDebt(_id);
        address _collateralAsset = creditLineConstants[_id].collateralAsset;
        address _borrowAsset = creditLineConstants[_id].borrowAsset;
        uint256 _collateralToLiquidate = _equivalentCollateral(_collateralAsset, _borrowAsset, _currentDebt);

        if (_collateralToLiquidate > _totalCollateralTokens) {
            _collateralToLiquidate = _totalCollateralTokens;
        }

        if (creditLineConstants[_id].autoLiquidation && _lender != msg.sender) {
            uint256 _borrowTokens = _borrowTokensToLiquidate(_borrowAsset, _collateralAsset, _collateralToLiquidate);
            IERC20(_borrowAsset).safeTransferFrom(msg.sender, _lender, _borrowTokens);
        }
        // transfering collateral for providing debt tokens to liquidator
        _transferCollateral(_id, _collateralAsset, msg.sender, _collateralToLiquidate, _toSavingsAccount);
        if (_collateralToLiquidate < _totalCollateralTokens) {
            // transfering remaining collateral to borrower
            _transferCollateral(
                _id,
                _collateralAsset,
                creditLineConstants[_id].borrower,
                _totalCollateralTokens.sub(_collateralToLiquidate),
                false
            );
        }
        delete creditLineConstants[_id];
        delete creditLineVariables[_id];
        emit CreditLineLiquidated(_id, msg.sender);
    }

    /**
     * @notice used to calculate the borrow tokens necessary for liquidator to liquidate
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @param _id identifier for the credit line
     * @return borrow tokens necessary for liquidator to liquidate
     */
    function borrowTokensToLiquidate(uint256 _id) external returns (uint256) {
        uint256 _currentDebt = calculateCurrentDebt(_id);
        address _collateralAsset = creditLineConstants[_id].collateralAsset;
        address _borrowAsset = creditLineConstants[_id].borrowAsset;
        uint256 _collateralToLiquidate = _equivalentCollateral(_collateralAsset, _borrowAsset, _currentDebt);
        uint256 _totalCollateralTokens = _calculateTotalCollateralTokens(_id, _collateralAsset);

        if (_collateralToLiquidate > _totalCollateralTokens) {
            _collateralToLiquidate = _totalCollateralTokens;
        }

        return _borrowTokensToLiquidate(creditLineConstants[_id].borrowAsset, _collateralAsset, _collateralToLiquidate);
    }

    function _borrowTokensToLiquidate(
        address _borrowAsset,
        address _collateralAsset,
        uint256 _collateralTokens
    ) private view returns (uint256) {
        (uint256 _ratioOfPrices, uint256 _decimals) = PRICE_ORACLE.getLatestPrice(_collateralAsset, _borrowAsset);
        uint256 _borrowTokens = (
            _collateralTokens.mul(uint256(SCALING_FACTOR).sub(liquidatorRewardFraction)).div(SCALING_FACTOR).mul(_ratioOfPrices).div(
                10**_decimals
            )
        );

        return _borrowTokens;
    }

    function _equivalentCollateral(
        address _collateralAsset,
        address _borrowAsset,
        uint256 _borrowTokens
    ) internal view returns (uint256) {
        (uint256 _ratioOfPrices, uint256 _decimals) = PRICE_ORACLE.getLatestPrice(_collateralAsset, _borrowAsset);
        uint256 _collateralTokens = (_borrowTokens.mul(10**_decimals).div(_ratioOfPrices));

        return _collateralTokens;
    }

    //-------------------------------- Liquidation code end --------------------------------//

    //-------------------------------- close/cancel code start --------------------------------//
    /**
     * @dev used to close credit line by borrower or lender
     * @param _id identifier for the credit line
     */
    function close(uint256 _id) external nonReentrant {
        require(creditLineVariables[_id].status == CreditLineStatus.ACTIVE, 'CL:C1');
        require(msg.sender == creditLineConstants[_id].borrower || msg.sender == creditLineConstants[_id].lender, 'CL:C2');
        require(creditLineVariables[_id].principal == 0, 'CL:C3');

        _withdrawAllCollateral(_id, creditLineConstants[_id].borrower, false);
        bool closedByLender = (msg.sender == creditLineConstants[_id].lender);

        delete creditLineConstants[_id];
        delete creditLineVariables[_id];
        emit CreditLineClosed(_id, closedByLender);
    }

    /**
     * @dev used to cancel credit line by borrower or lender
     * @param _id identifier for the credit line
     */
    function cancel(uint256 _id) external {
        require(creditLineVariables[_id].status == CreditLineStatus.REQUESTED, 'CL:CP1');
        require(msg.sender == creditLineConstants[_id].borrower || msg.sender == creditLineConstants[_id].lender, 'CL:CP2');
        delete creditLineVariables[_id];
        delete creditLineConstants[_id];
        emit CreditLineCancelled(_id);
    }

    //-------------------------------- close/cancel code end --------------------------------//

    //-------------------------------- Utilities code start --------------------------------//

    /**
     * @notice used to calculate the current collateral ratio
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view.
            Interest is also considered while calculating debt
     * @param _id identifier for the credit line
     * @return collateral ratio multiplied by SCALING_FACTOR to retain precision
     */
    function calculateCurrentCollateralRatio(uint256 _id) public returns (uint256, uint256) {
        address _collateralAsset = creditLineConstants[_id].collateralAsset;
        (uint256 _ratioOfPrices, uint256 _decimals) = PRICE_ORACLE.getLatestPrice(_collateralAsset, creditLineConstants[_id].borrowAsset);

        uint256 currentDebt = calculateCurrentDebt(_id);
        uint256 totalCollateralTokens = _calculateTotalCollateralTokens(_id, _collateralAsset);
        uint256 currentCollateralRatio = type(uint256).max;
        if (currentDebt != 0) {
            currentCollateralRatio = totalCollateralTokens.mul(_ratioOfPrices).div(10**_decimals).mul(SCALING_FACTOR).div(currentDebt);
        }

        return (currentCollateralRatio, totalCollateralTokens);
    }

    /**
     * @notice used to calculate the total collateral tokens
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @param _id identifier for the credit line
     * @return _amount total collateral tokens deposited into the credit line
     */
    function calculateTotalCollateralTokens(uint256 _id) external returns (uint256) {
        address _collateralAsset = creditLineConstants[_id].collateralAsset;
        return _calculateTotalCollateralTokens(_id, _collateralAsset);
    }

    function _calculateTotalCollateralTokens(uint256 _id, address _collateralAsset) private returns (uint256) {
        address _strategy = creditLineConstants[_id].collateralStrategy;

        uint256 _collateralShares = collateralShareInStrategy[_id];
        uint256 _collateral = IYield(_strategy).getTokensForShares(_collateralShares, _collateralAsset);

        return _collateral;
    }

    /**
     * @dev Used to Calculate Interest Per second on given principal and Interest rate
     * @param _principal principal Amount for which interest has to be calculated
     * @param _borrowRate It is the Interest Rate at which Credit Line is approved
     * @param _timeElapsed It is the time interval in seconds for which interest is calculated
     * @return interest per second for the given parameters scaled by SCALING_FACTOR
     */
    function calculateInterestScaled(
        uint256 _principal,
        uint256 _borrowRate,
        uint256 _timeElapsed
    ) public pure returns (uint256) {
        return (_principal.mul(_borrowRate).mul(_timeElapsed).div(YEAR_IN_SECONDS));
    }

    /**
     * @dev Used to calculate interest accrued since last repayment
     * @param _id identifier for the credit line
     * @return interest accrued over current borrowed amount since last repayment
     */
    function calculateInterestAccrued(uint256 _id) public view returns (uint256) {
        uint256 _lastPrincipalUpdateTime = creditLineVariables[_id].lastPrincipalUpdateTime;
        if (_lastPrincipalUpdateTime == 0) return 0;
        uint256 _timeElapsed = (block.timestamp).sub(_lastPrincipalUpdateTime);
        uint256 _interestAccruedScaled = calculateInterestScaled(
            creditLineVariables[_id].principal,
            creditLineConstants[_id].borrowRate,
            _timeElapsed
        );
        uint256 _interestAccrued = _divAndCeil(_interestAccruedScaled, SCALING_FACTOR);
        return _interestAccrued.add(creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate);
    }

    /**
     * @dev Used to calculate current debt of borrower against a credit line.
     * @param _id identifier for the credit line
     * @return current debt of borrower
     */
    function calculateCurrentDebt(uint256 _id) public view returns (uint256) {
        uint256 _interestAccrued = calculateInterestAccrued(_id);
        uint256 _currentDebt = (creditLineVariables[_id].principal).add(_interestAccrued).sub(creditLineVariables[_id].totalInterestRepaid);
        return _currentDebt;
    }

    /**
     * @dev Used to get the current status of the credit line
     * @param _id identifier for the credit line
     * @return credit line status
     */
    function getCreditLineStatus(uint256 _id) external view returns (CreditLineStatus) {
        return creditLineVariables[_id].status;
    }

    function _divAndCeil(uint256 _num, uint256 _denom) private pure returns (uint256) {
        uint256 _divResult = _num.div(_denom);
        if (_divResult * _denom != _num) {
            _divResult++;
        }
        return _divResult;
    }

    //-------------------------------- Utilities code end --------------------------------//
}
