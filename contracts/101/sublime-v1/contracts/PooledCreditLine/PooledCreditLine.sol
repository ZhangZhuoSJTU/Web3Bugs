// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/SafeCast.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '../Math.sol';
import '../interfaces/IPriceOracle.sol';
import '../interfaces/IYield.sol';
import '../interfaces/ISavingsAccount.sol';
import '../SavingsAccount/SavingsAccountUtil.sol';
import '../interfaces/IStrategyRegistry.sol';
import '../interfaces/ILenderPool.sol';
import '../interfaces/IVerification.sol';
import '../interfaces/IPooledCreditLine.sol';
import '../interfaces/ILimitsManager.sol';

/**
 * @title Pooled Credit Line contract with Methods related to creditLines
 * @notice Implements the functions related to Credit Line
 * @author Sublime
 **/

contract PooledCreditLine is ReentrancyGuardUpgradeable, OwnableUpgradeable, IPooledCreditLine {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    //-------------------------------- Constants start --------------------------------//

    /*
     * @notice number of seconds in an year
     */
    uint256 internal constant YEAR_IN_SECONDS = 365 days;

    /*
     * @notice Factor to multiply variables to maintain precision
     */
    uint256 public constant SCALING_FACTOR = 1e18;

    /**
     * @notice address of lender pool contract
     */
    ILenderPool public immutable LENDER_POOL;

    /**
     * @notice stores the address of savings account contract
     **/
    ISavingsAccount public immutable SAVINGS_ACCOUNT;

    /**
     * @notice stores the address of price oracle contract
     **/
    IPriceOracle public immutable PRICE_ORACLE;

    /**
     * @notice stores the address of limits manager
     **/
    ILimitsManager public immutable LIMITS_MANAGER;

    /**
     * @notice stores the address of strategy registry contract
     **/
    IStrategyRegistry public immutable STRATEGY_REGISTRY;

    /**
     * @notice address that the borrower for pooled credit line should be verified with
     **/
    IVerification public immutable VERIFICATION;

    /**
     * @notice maximum protocol fee fraction allowed, it is multiplied by SCALING_FACTOR
     */
    uint256 public immutable MAXIMUM_PROTOCOL_FEE_FRACTION;

    //-------------------------------- Constants end --------------------------------//

    //-------------------------------- Global vars starts --------------------------------//
    /**
     * @notice stores the fraction of borrowed amount charged as fee by protocol
     * @dev it is multiplied by SCALING_FACTOR
     **/
    uint256 public protocolFeeFraction;

    /**
     * @notice address where protocol fee is collected
     **/
    address public protocolFeeCollector;

    //-------------------------------- Global vars end --------------------------------//

    //-------------------------------- CreditLine state starts --------------------------------//

    /**
     * @notice counter that tracks the number of pooled credit lines created
     * @dev used to create unique identifier for pooled credit lines
     **/
    uint256 public pooledCreditLineCounter;

    /**
     * @notice stores the collateral shares in a pooled credit line per collateral strategy
     * @dev id => collateralShares
     **/
    mapping(uint256 => uint256) public depositedCollateralInShares;

    /**
     * @notice stores the variables to maintain a pooled credit line
     **/
    mapping(uint256 => PooledCreditLineVariables) public pooledCreditLineVariables;

    /**
     * @notice stores the constants related to a pooled credit line
     **/
    mapping(uint256 => PooledCreditLineConstants) public pooledCreditLineConstants;

    //-------------------------------- CreditLine State ends --------------------------------//

    //-------------------------------- Modifiers starts --------------------------------//

    /**
     * @dev checks if called by pooled credit Line Borrower
     * @param _id identifier for the pooled credit line
     **/
    modifier onlyCreditLineBorrower(uint256 _id) {
        require(pooledCreditLineConstants[_id].borrower == msg.sender, 'PCL:OCLB1');
        _;
    }

    /**
     * @dev checks if called by credit Line Lender Pool
     **/
    modifier onlyLenderPool() {
        require(address(LENDER_POOL) == msg.sender, 'PCL:OLP1');
        _;
    }

    //-------------------------------- Modifiers end --------------------------------//

    //-------------------------------- Events start --------------------------------//

    //--------------------------- Global variable update events start ---------------------------//

    /**
     * @notice emitted when fee that protocol charges for pooled credit line is updated
     * @param updatedProtocolFee updated value of protocolFeeFraction
     */
    event ProtocolFeeFractionUpdated(uint256 updatedProtocolFee);

    /**
     * @notice emitted when address which receives fee that protocol changes for pools is updated
     * @param updatedProtocolFeeCollector updated value of protocolFeeCollector
     */
    event ProtocolFeeCollectorUpdated(address indexed updatedProtocolFeeCollector);

    //--------------------------- Global variable update events end ---------------------------//

    //--------------------------- CreditLine state events start ---------------------------//

    /**
     * @notice emitted when a collateral is deposited into pooled credit line
     * @param id identifier for the pooled credit line
     * @param shares amount of shares of collateral deposited
     */
    event CollateralSharesDeposited(uint256 indexed id, uint256 shares);

    /**
     * @notice emitted when collateral is withdrawn from pooled credit line
     * @param id identifier for the pooled credit line
     * @param shares amount of shares of collateral withdrawn
     */
    event CollateralSharesWithdrawn(uint256 indexed id, uint256 shares);

    /**
     * @notice emitted when a request for new pooled credit line is placed
     * @param id identifier for the pooled credit line
     * @param borrower address of the borrower for credit line
     * @param borrowerVerifier address of the verifier with which borrower is verified
     */
    event PooledCreditLineRequested(uint256 indexed id, address indexed borrower, address indexed borrowerVerifier);

    /**
     * @notice emitted when a pooled credit line is liquidated
     * @param id identifier for the pooled credit line
     * @param shares amount of shares of collateral used for liquidation
     */
    event PooledCreditLineLiquidated(uint256 indexed id, uint256 shares);

    /**
     * @notice emitted when tokens are borrowed from pooled credit line
     * @param id identifier for the pooled credit line
     * @param borrowShares amount of shares of tokens borrowed
     */
    event BorrowedFromPooledCreditLine(uint256 indexed id, uint256 borrowShares);

    /**
     * @notice Emitted when pooled credit line is accepted
     * @param id identifier for the pooled credit line
     * @param amount total amount of tokens lent to pooled credit line
     */
    event PooledCreditLineAccepted(uint256 indexed id, uint256 amount);

    /**
     * @notice emitted when the pooled credit line is partially repaid
     * @param id identifier for the pooled credit line
     * @param repayer address of the repayer
     * @param repayAmount amount repaid
     */
    event PartialPooledCreditLineRepaid(uint256 indexed id, address indexed repayer, uint256 repayAmount);

    /**
     * @notice emitted when the pooled credit line is completely repaid
     * @param id identifier for the pooled credit line
     * @param repayer address of the repayer
     * @param repayAmount amount repaid
     */
    event CompletePooledCreditLineRepaid(uint256 indexed id, address indexed repayer, uint256 repayAmount);

    /**
     * @notice emitted when the pooled credit line is closed by the borrower
     * @param id identifier for the pooled credit line
     */
    event PooledCreditLineClosed(uint256 indexed id);

    /**
     * @notice emitted when the pooled credit line is cancelled while in REQUESTED state
     * @param id identifier for the pooled credit line
     * @param reason identifier which specifies the reason for which PCL was cancelled
     */
    event PooledCreditLineCancelled(uint256 indexed id, CancellationStatus indexed reason);

    /**
     * @notice emitted when the pooled credit line is terminated by owner
     * @param id identifier for the pooled credit line
     */
    event PooledCreditLineTerminated(uint256 indexed id);

    //--------------------------- CreditLine state events end ---------------------------//

    //-------------------------------- Events end --------------------------------//

    //-------------------------------- Global var update code start --------------------------------//

    /**
     * @notice used to update the protocol fee fraction
     * @dev can only be updated by owner
     * @param _protocolFeeFraction fraction of the borrower amount collected as protocol fee
     */
    function updateProtocolFeeFraction(uint256 _protocolFeeFraction) external onlyOwner {
        require(protocolFeeFraction != _protocolFeeFraction, 'PCL:UPFF1');
        _updateProtocolFeeFraction(_protocolFeeFraction);
    }

    function _updateProtocolFeeFraction(uint256 _protocolFeeFraction) private {
        require(_protocolFeeFraction <= MAXIMUM_PROTOCOL_FEE_FRACTION, 'PCL:IUPFF1');
        protocolFeeFraction = _protocolFeeFraction;
        emit ProtocolFeeFractionUpdated(_protocolFeeFraction);
    }

    /**
     * @notice used to update the protocol fee collector
     * @dev can only be updated by owner
     * @param _protocolFeeCollector address in which protocol fee is collected
     */
    function updateProtocolFeeCollector(address _protocolFeeCollector) external onlyOwner {
        require(protocolFeeCollector != _protocolFeeCollector, 'PCL:UPFC1');
        _updateProtocolFeeCollector(_protocolFeeCollector);
    }

    function _updateProtocolFeeCollector(address _protocolFeeCollector) private {
        require(_protocolFeeCollector != address(0), 'PCL:IUPFC1');
        protocolFeeCollector = _protocolFeeCollector;
        emit ProtocolFeeCollectorUpdated(_protocolFeeCollector);
    }

    //-------------------------------- Global var update code end --------------------------------//

    //-------------------------------- Initialize code start --------------------------------//

    /**
     * @notice constructor to initialize immutables
     * @param _lenderPool address of lenderPool contract
     * @param _priceOracle address of the priceOracle
     * @param _savingsAccount address of  the savings account contract
     * @param _strategyRegistry address of the strategy registry contract
     * @param _verification address of the verification contract
     * @param _limitsManager address of the _limitsManager contract
     * @param _maximumProtocolFeeFraction the maximum protocol fee fraction allowed
     */
    constructor(
        address _lenderPool,
        address _priceOracle,
        address _savingsAccount,
        address _strategyRegistry,
        address _verification,
        address _limitsManager,
        uint256 _maximumProtocolFeeFraction
    ) {
        require(_lenderPool != address(0), 'PCL:CON1');
        require(_priceOracle != address(0), 'PCL:CON2');
        require(_savingsAccount != address(0), 'PCL:CON3');
        require(_strategyRegistry != address(0), 'PCL:CON4');
        require(_verification != address(0), 'PCL:CON5');
        require(_limitsManager != address(0), 'PCL:CON6');
        LENDER_POOL = ILenderPool(_lenderPool);
        PRICE_ORACLE = IPriceOracle(_priceOracle);
        SAVINGS_ACCOUNT = ISavingsAccount(_savingsAccount);
        STRATEGY_REGISTRY = IStrategyRegistry(_strategyRegistry);
        VERIFICATION = IVerification(_verification);
        LIMITS_MANAGER = ILimitsManager(_limitsManager);
        MAXIMUM_PROTOCOL_FEE_FRACTION = _maximumProtocolFeeFraction;
    }

    /**
     * @notice used to initialize the contract
     * @dev can only be called once during the life cycle of the contract
     * @param _owner address of owner who can change global variables
     * @param _protocolFeeFraction fraction of the fee charged by protocol (multiplied by SCALING_FACTOR)
     * @param _protocolFeeCollector address to which protocol fee is charged to
     */
    function initialize(
        address _owner,
        uint256 _protocolFeeFraction,
        address _protocolFeeCollector
    ) external initializer {
        OwnableUpgradeable.__Ownable_init();
        OwnableUpgradeable.transferOwnership(_owner);
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        _updateProtocolFeeFraction(_protocolFeeFraction);
        _updateProtocolFeeCollector(_protocolFeeCollector);
    }

    //-------------------------------- Initialize code end --------------------------------//

    //-------------------------------- CreditLine creation code start --------------------------------//

    /**
     * @notice used to request a pooled credit line by a borrower
     * @param _request Credit line creation request
     * @return identifier for the pooled credit line
     */
    function request(Request calldata _request) external nonReentrant returns (uint256) {
        require(VERIFICATION.isUser(msg.sender, _request.borrowerVerifier), 'PCL:R1');
        require(_request.borrowAsset != _request.collateralAsset, 'PCL:R2');
        require(PRICE_ORACLE.doesFeedExist(_request.borrowAsset, _request.collateralAsset), 'PCL:R3');
        require(_request.borrowAsset != address(0) && _request.collateralAsset != address(0), 'PCL:R4');
        require(STRATEGY_REGISTRY.registry(_request.borrowAssetStrategy) != 0, 'PCL:R5');
        require(STRATEGY_REGISTRY.registry(_request.collateralAssetStrategy) != 0, 'PCL:R6');
        LIMITS_MANAGER.limitBorrowedInUSDC(_request.borrowAsset, _request.borrowLimit, _request.minBorrowAmount);
        require(LIMITS_MANAGER.isWithinLimits(_request.borrowRate, LIMITS_MANAGER.getBorrowRateLimits()), 'PCL:R7');
        // collateral ratio = 0 is a special case which is allowed
        if (_request.collateralRatio != 0) {
            require(LIMITS_MANAGER.isWithinLimits(_request.collateralRatio, LIMITS_MANAGER.getIdealCollateralRatioLimits()), 'PCL:R8');
        }
        require(LIMITS_MANAGER.isWithinLimits(_request.collectionPeriod, LIMITS_MANAGER.getCollectionPeriodLimits()), 'PCL:R9');
        require(LIMITS_MANAGER.isWithinLimits(_request.duration, LIMITS_MANAGER.getDurationLimits()), 'PCL:R10');
        require(LIMITS_MANAGER.isWithinLimits(_request.defaultGracePeriod, LIMITS_MANAGER.getDefaultGracePeriodLimits()), 'PCL:R11');
        require(LIMITS_MANAGER.isWithinLimits(_request.gracePenaltyRate, LIMITS_MANAGER.getGracePenaltyRateLimits()), 'PCL:R12');

        require(VERIFICATION.verifiers(_request.lenderVerifier), 'PCL:R13');

        uint256 _id = _createRequest(_request);

        _notifyRequest(
            _id,
            _request.lenderVerifier,
            _request.borrowAsset,
            _request.borrowAssetStrategy,
            _request.borrowLimit,
            _request.minBorrowAmount,
            _request.collectionPeriod,
            _request.areTokensTransferable
        );
        emit PooledCreditLineRequested(_id, msg.sender, _request.borrowerVerifier);
        return _id;
    }

    function _createRequest(Request calldata _request) private returns (uint256) {
        uint256 _id = ++pooledCreditLineCounter;
        pooledCreditLineVariables[_id].status = PooledCreditLineStatus.REQUESTED;

        PooledCreditLineConstants storage _clc = pooledCreditLineConstants[_id];
        _clc.borrower = msg.sender;
        _clc.borrowLimit = _request.borrowLimit;
        _clc.idealCollateralRatio = _request.collateralRatio;
        _clc.borrowRate = _request.borrowRate;
        _clc.borrowAsset = _request.borrowAsset;
        _clc.collateralAsset = _request.collateralAsset;
        _clc.collateralAssetStrategy = _request.collateralAssetStrategy;
        uint256 _endsAt = block.timestamp.add(_request.collectionPeriod).add(_request.duration);
        _clc.startsAt = block.timestamp.add(_request.collectionPeriod);
        _clc.endsAt = _endsAt;
        _clc.defaultsAt = _endsAt.add(_request.defaultGracePeriod);
        _clc.gracePenaltyRate = _request.gracePenaltyRate;
        _clc.borrowAssetStrategy = _request.borrowAssetStrategy;
        return _id;
    }

    /*
     * @notice callback method for LenderPool contract to set the PCL variables
     */
    function _notifyRequest(
        uint256 _id,
        address _lenderVerifier,
        address _borrowAsset,
        address _borrowAssetStrategy,
        uint256 _borrowLimit,
        uint256 _minBorrowedAmount,
        uint256 _collectionPeriod,
        bool _areTokensTransferable
    ) private {
        LENDER_POOL.create(
            _id,
            _lenderVerifier,
            _borrowAsset,
            _borrowAssetStrategy,
            _borrowLimit,
            _minBorrowedAmount,
            _collectionPeriod,
            _areTokensTransferable
        );
    }

    /**
     * @notice used to accept a pooled credit line
     * @dev callback from lender pool contract
     * @param _id identifier for the pooled credit line
     * @param _amount Borrow Limit
     * @param _by user who accepted the PCL
     */
    function accept(
        uint256 _id,
        uint256 _amount,
        address _by
    ) external override nonReentrant onlyLenderPool {
        require(pooledCreditLineVariables[_id].status == PooledCreditLineStatus.REQUESTED, 'PCL:A1');
        require(_by == pooledCreditLineConstants[_id].borrower, 'PCL:A2');
        pooledCreditLineVariables[_id].status = PooledCreditLineStatus.ACTIVE;
        pooledCreditLineConstants[_id].borrowLimit = SafeCast.toUint128(_amount);
        emit PooledCreditLineAccepted(_id, _amount);
    }

    //-------------------------------- CreditLine creation code end --------------------------------//

    //-------------------------------- Collateral management start --------------------------------//

    /**
     * @notice used to deposit collateral into the pooled credit line
     * @dev collateral tokens have to be approved in savingsAccount or token contract
     * @param _id identifier for the pooled credit line
     * @param _amount amount of collateral being deposited
     * @param _fromSavingsAccount if true, tokens are transferred from savingsAccount
                                  otherwise direct from collateral token contract
     */
    function depositCollateral(
        uint256 _id,
        uint256 _amount,
        bool _fromSavingsAccount
    ) external nonReentrant {
        require(_amount != 0, 'PCL:DC1');
        PooledCreditLineStatus _status = getStatusAndUpdate(_id);
        require(_status == PooledCreditLineStatus.ACTIVE || _status == PooledCreditLineStatus.EXPIRED, 'PCL:DC2');
        address _collateralAsset = pooledCreditLineConstants[_id].collateralAsset;
        address _strategy = pooledCreditLineConstants[_id].collateralAssetStrategy;
        uint256 _sharesDeposited;

        if (_fromSavingsAccount) {
            _sharesDeposited = SAVINGS_ACCOUNT.transferFrom(_collateralAsset, _strategy, msg.sender, address(this), _amount);
        } else {
            IERC20(_collateralAsset).safeTransferFrom(msg.sender, address(this), _amount);
            IERC20(_collateralAsset).safeApprove(_strategy, _amount);

            _sharesDeposited = SAVINGS_ACCOUNT.deposit(_collateralAsset, _strategy, address(this), _amount);
        }
        depositedCollateralInShares[_id] = depositedCollateralInShares[_id].add(_sharesDeposited);

        emit CollateralSharesDeposited(_id, _sharesDeposited);
    }

    /**
     * @notice used to withdraw any excess collateral
     * @dev collateral can't be withdraw if collateralRatio goes below the ideal value. Only borrower can withdraw
     * @param _id identifier for the pooled credit line
     * @param _amount amount of collateral to withdraw
     * @param _toSavingsAccount if true, tokens are transferred to savingsAccount, else to borrower address directly
     */
    function withdrawCollateral(
        uint256 _id,
        uint256 _amount,
        bool _toSavingsAccount
    ) external nonReentrant onlyCreditLineBorrower(_id) {
        uint256 _withdrawableCollateral = withdrawableCollateral(_id);
        require(_amount <= _withdrawableCollateral, 'PCL:WC1');
        require(_amount != 0, 'PCL:WC2');
        (, uint256 _amountInShares) = _transferCollateral(_id, pooledCreditLineConstants[_id].collateralAsset, _amount, _toSavingsAccount);
        emit CollateralSharesWithdrawn(_id, _amountInShares);
    }

    /**
     * @notice used to withdraw all the permissible collateral as per the current collateralRatio
     * @dev if the withdrawable collateral amount is non-zero the transaction will pass
     * @param _id identifier for the pooled credit line
     * @param _toSavingsAccount if true, tokens are transferred from savingsAccount
                                otherwise direct from collateral token contract
     */

    function withdrawAllCollateral(uint256 _id, bool _toSavingsAccount) external nonReentrant onlyCreditLineBorrower(_id) {
        uint256 _collateralWithdrawn = _withdrawAllCollateral(_id, _toSavingsAccount);
        require(_collateralWithdrawn != 0, 'PCL:WAC1');
    }

    function _withdrawAllCollateral(uint256 _id, bool _toSavingsAccount) private returns (uint256 _collateralWithdrawn) {
        uint256 _withdrawableCollateral = withdrawableCollateral(_id);
        if (_withdrawableCollateral == 0) {
            return 0;
        }
        (, uint256 _amountInShares) = _transferCollateral(
            _id,
            pooledCreditLineConstants[_id].collateralAsset,
            _withdrawableCollateral,
            _toSavingsAccount
        );
        emit CollateralSharesWithdrawn(_id, _amountInShares);
        return _withdrawableCollateral;
    }

    /**
     * @notice used to calculate the collateral that can be withdrawn
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @param _id identifier for the pooled credit line
     * @return total collateral withdrawable by borrower
     */
    function withdrawableCollateral(uint256 _id) public returns (uint256) {
        PooledCreditLineStatus _status = getStatusAndUpdate(_id);
        if (
            _status == PooledCreditLineStatus.EXPIRED ||
            _status == PooledCreditLineStatus.CANCELLED ||
            _status == PooledCreditLineStatus.REQUESTED
        ) {
            return 0;
        }

        uint256 _totalCollateral = calculateTotalCollateralTokens(_id);

        if (_status == PooledCreditLineStatus.LIQUIDATED || _status == PooledCreditLineStatus.CLOSED) {
            return _totalCollateral;
        }

        (uint256 _ratioOfPrices, uint256 _decimals) = PRICE_ORACLE.getLatestPrice(
            pooledCreditLineConstants[_id].collateralAsset,
            pooledCreditLineConstants[_id].borrowAsset
        );

        uint256 _currentDebt = calculateCurrentDebt(_id);
        uint256 _collateralRatio = pooledCreditLineConstants[_id].idealCollateralRatio;

        // _collateralNeeded is the number of collateral tokens needed to maintain the _collateralRatio
        uint256 _collateralNeeded = _currentDebt.mul(_collateralRatio).div(_ratioOfPrices).mul(10**_decimals).div(SCALING_FACTOR);

        if (_collateralNeeded >= _totalCollateral) {
            return 0;
        }
        return _totalCollateral.sub(_collateralNeeded);
    }

    /*
    * @notice this method transfers the collateral tokens to the msg.sender and reduces the depositedCollateralInShares
    *         value to maintain the amount of collateral tokens deposited in the PCL
    * @param _id the id of the pcl
    * @param _asset the collateral asset
    * @param _amountInTokens the amount to be transferred
    * @param _toSavingsAccount if the true the amount if transferred to the savings account of the msg.sender
             else the tokens are directly transferred.
    */
    function _transferCollateral(
        uint256 _id,
        address _asset,
        uint256 _amountInTokens,
        bool _toSavingsAccount
    ) private returns (uint256, uint256) {
        address _strategy = pooledCreditLineConstants[_id].collateralAssetStrategy;
        uint256 _amountInShares = IYield(_strategy).getSharesForTokens(_amountInTokens, _asset);
        uint256 _amountReceived;
        if (_amountInShares == 0) return (0, 0);

        depositedCollateralInShares[_id] = depositedCollateralInShares[_id].sub(_amountInShares, 'PCL:ITC1');

        if (_toSavingsAccount) {
            _amountReceived = SAVINGS_ACCOUNT.transferShares(_asset, _strategy, msg.sender, _amountInShares);
        } else {
            _amountReceived = SAVINGS_ACCOUNT.withdrawShares(_asset, _strategy, msg.sender, _amountInShares, false);
        }

        return (_amountReceived, _amountInShares);
    }

    /**
     * @notice used to calculate the total collateral tokens held in the pcl savings account
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @param _id identifier for the pooled credit line
     * @return _amount total collateral tokens deposited into the pooled credit line
     */
    function calculateTotalCollateralTokens(uint256 _id) public returns (uint256) {
        address _strategy = pooledCreditLineConstants[_id].collateralAssetStrategy;
        require(_strategy != address(0), 'PCL:CTCT1');
        address _collateralAsset = pooledCreditLineConstants[_id].collateralAsset;

        uint256 _collateralShares = depositedCollateralInShares[_id];
        uint256 _collateral = IYield(_strategy).getTokensForShares(_collateralShares, _collateralAsset);

        return _collateral;
    }

    /*
    * @notice this method returns the number of collateral tokens the borrower has to deposit to be able
              to borrow the given _borrowTokenAmount. the return value is calculated based on the idealCollateralRatio
    */
    function getRequiredCollateral(uint256 _id, uint256 _borrowTokenAmount) external view returns (uint256) {
        address _collateralAsset = pooledCreditLineConstants[_id].collateralAsset;
        address _borrowAsset = pooledCreditLineConstants[_id].borrowAsset;

        uint256 _collateral = _equivalentCollateral(_collateralAsset, _borrowAsset, _borrowTokenAmount);

        return _collateral.mul(pooledCreditLineConstants[_id].idealCollateralRatio).div(SCALING_FACTOR);
    }

    //-------------------------------- Collateral management end --------------------------------//

    //-------------------------------- Borrow code start --------------------------------//

    /**
     * @notice used to borrow tokens from credit line by borrower
     * @dev only borrower can call this function. Amount that can actually be borrowed is
            min(amount of borrow asset left in the pcl, amount that is borrowable based on ideal collateral ratio)
     * @param _id identifier for the pooled credit line
     * @param _amount amount of tokens to borrow
     */
    function borrow(uint256 _id, uint256 _amount) external nonReentrant onlyCreditLineBorrower(_id) {
        _borrow(_id, _amount);
    }

    function _borrow(uint256 _id, uint256 _amount) private {
        require(_amount != 0, 'PCL:IB1');
        require(block.timestamp >= pooledCreditLineConstants[_id].startsAt, 'PCL:IB2');
        // calculateBorrowableAmount is 0, hence statement reverts for all states except ACTIVE
        require(_amount <= calculateBorrowableAmount(_id), 'PCL:IB3');

        address _borrowAsset = pooledCreditLineConstants[_id].borrowAsset;

        uint256 _balanceBefore = IERC20(_borrowAsset).balanceOf(address(this));

        uint256 _sharesWithdrawn = _withdrawBorrowAmount(_borrowAsset, pooledCreditLineConstants[_id].borrowAssetStrategy, _amount);
        LENDER_POOL.borrowed(_id, _sharesWithdrawn);
        uint256 _balanceAfter = IERC20(_borrowAsset).balanceOf(address(this));

        uint256 _borrowedAmount = _balanceAfter.sub(_balanceBefore);
        _updateStateOnPrincipalChange(_id, pooledCreditLineVariables[_id].principal.add(_borrowedAmount));

        // protocol fee is collected everytime amount if borrowed
        uint256 _protocolFee = _borrowedAmount.mul(protocolFeeFraction).div(SCALING_FACTOR);
        _borrowedAmount = _borrowedAmount.sub(_protocolFee);

        IERC20(_borrowAsset).safeTransfer(protocolFeeCollector, _protocolFee);
        IERC20(_borrowAsset).safeTransfer(msg.sender, _borrowedAmount);
        emit BorrowedFromPooledCreditLine(_id, _sharesWithdrawn);
    }

    /**
     * @notice used to calculate amount that can be borrowed by the borrower
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view.
            borrowableAmount changes per block as interest changes per block.
     * @param _id identifier for the pooled credit line
     * @return amount that can be borrowed from the pooled credit line
     */
    function calculateBorrowableAmount(uint256 _id) public returns (uint256) {
        PooledCreditLineStatus _status = getStatusAndUpdate(_id);
        if (_status != PooledCreditLineStatus.ACTIVE) {
            return 0;
        }
        (uint256 _ratioOfPrices, uint256 _decimals) = PRICE_ORACLE.getLatestPrice(
            pooledCreditLineConstants[_id].collateralAsset,
            pooledCreditLineConstants[_id].borrowAsset
        );

        uint256 _totalCollateral = calculateTotalCollateralTokens(_id);

        // current debt includes the principal amount + unpaid interest
        uint256 _currentDebt = calculateCurrentDebt(_id);

        uint256 _collateralRatio = pooledCreditLineConstants[_id].idealCollateralRatio;
        uint256 _maxPossible = type(uint256).max;
        if (_collateralRatio != 0) {
            // _maxPossible is the amount of borrow tokens which can be borrowed based on the _collateralRatio
            _maxPossible = _totalCollateral.mul(_ratioOfPrices).div(_collateralRatio).mul(SCALING_FACTOR).div(10**_decimals);
        }

        uint256 _borrowLimit = pooledCreditLineConstants[_id].borrowLimit;
        uint256 _principal = pooledCreditLineVariables[_id].principal;

        // if the _maxPossible amount is less than the _currentDebt this means that current collateral ratio is less
        // then the idealCollateralRatio. This PCL can be liquidated now and the borrower has to deposit more collateral
        // to save it from liquidation
        if (_maxPossible <= _currentDebt) return 0;

        // using direct subtraction for _maxPossible because we have a check above for it being greater than _currentDebt
        return Math.min(_borrowLimit.sub(_principal), _maxPossible - _currentDebt);
    }

    function _withdrawBorrowAmount(
        address _asset,
        address _strategy,
        uint256 _amountInTokens
    ) private returns (uint256) {
        uint256 _shares = IYield(_strategy).getSharesForTokens(_amountInTokens, _asset);
        require(_shares != 0, 'PCL:IWBA1');
        SAVINGS_ACCOUNT.withdrawFrom(_asset, _strategy, address(LENDER_POOL), address(this), _amountInTokens, false);
        return _shares;
    }

    //-------------------------------- Borrow code end --------------------------------//

    //-------------------------------- Repayments code start --------------------------------//

    /**
     * @notice used to repay interest and principal to pooled credit line. Interest has to be repaid before
               repaying principal
     * @dev partial repayments possible
     * @param _id identifier for the pooled credit line
     * @param _amount amount being repaid
     */
    function repay(uint256 _id, uint256 _amount) external nonReentrant {
        require(_amount != 0, 'PCL:REP1');
        PooledCreditLineStatus currentStatus = getStatusAndUpdate(_id);
        require(currentStatus == PooledCreditLineStatus.ACTIVE || currentStatus == PooledCreditLineStatus.EXPIRED, 'PCL:REP2');

        uint256 _currentPrincipal = pooledCreditLineVariables[_id].principal;
        uint256 _totalInterestAccrued = calculateInterestAccrued(_id);
        uint256 _interestToPay = _totalInterestAccrued.sub(pooledCreditLineVariables[_id].totalInterestRepaid);
        uint256 _currentDebt = (_currentPrincipal).add(_interestToPay);

        require(_currentDebt != 0, 'PCL:REP3');

        // in case the interest to pay is 0 (expect when interest rate is 0) no repayment can happen
        // this is because it can be then possible to borrow small amounts for short period of time
        // then pay it back with 0 interest. to be safe we allow repayment when there is some _interestToPay
        // this condition also stops flash loans
        if (pooledCreditLineConstants[_id].borrowRate != 0) {
            require(_interestToPay != 0, 'PCL:REP4');
        }

        if (_amount >= _currentDebt) {
            _amount = _currentDebt;
            emit CompletePooledCreditLineRepaid(_id, msg.sender, _amount);
        } else {
            emit PartialPooledCreditLineRepaid(_id, msg.sender, _amount);
        }

        uint256 _principalPaid;
        if (_amount > _interestToPay) {
            _principalPaid = _amount.sub(_interestToPay);
            pooledCreditLineVariables[_id].principal = _currentPrincipal.sub(_principalPaid);
            pooledCreditLineVariables[_id].interestAccruedTillLastPrincipalUpdate = _totalInterestAccrued;
            pooledCreditLineVariables[_id].lastPrincipalUpdateTime = block.timestamp;
            pooledCreditLineVariables[_id].totalInterestRepaid = _totalInterestAccrued;
        } else {
            pooledCreditLineVariables[_id].totalInterestRepaid = pooledCreditLineVariables[_id].totalInterestRepaid.add(_amount);
        }

        uint256 _interestPaid = _amount.sub(_principalPaid);
        uint256 _repaidInterestShares = IYield(pooledCreditLineConstants[_id].borrowAssetStrategy).getSharesForTokens(
            _interestPaid,
            pooledCreditLineConstants[_id].borrowAsset
        );

        uint256 _repaidShares = _repay(_id, _amount);
        LENDER_POOL.repaid(_id, _repaidShares, _repaidInterestShares);

        if ((pooledCreditLineVariables[_id].principal == 0) && (currentStatus == PooledCreditLineStatus.EXPIRED)) {
            pooledCreditLineVariables[_id].status = PooledCreditLineStatus.CLOSED;
            emit PooledCreditLineClosed(_id);
        }
    }

    function _repay(uint256 _id, uint256 _amount) private returns (uint256) {
        address _strategy = pooledCreditLineConstants[_id].borrowAssetStrategy;
        address _borrowAsset = pooledCreditLineConstants[_id].borrowAsset;
        IERC20(_borrowAsset).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_borrowAsset).safeApprove(_strategy, _amount);
        uint256 _sharesReceived = SAVINGS_ACCOUNT.deposit(_borrowAsset, _strategy, address(LENDER_POOL), _amount);
        return _sharesReceived;
    }

    /**
     * @dev Used to calculate the total interest accrued in the pcl since start till now
     * @param _id identifier for the pooled credit line
     * @return total interest accrued in the pcl since start till now
     */

    function calculateInterestAccrued(uint256 _id) public view returns (uint256) {
        uint256 _lastPrincipalUpdateTime = pooledCreditLineVariables[_id].lastPrincipalUpdateTime;
        if (_lastPrincipalUpdateTime == 0) return 0;
        uint256 _timeElapsed = (block.timestamp).sub(_lastPrincipalUpdateTime);
        uint256 _endTime = pooledCreditLineConstants[_id].endsAt;
        uint256 _penaltyRate = pooledCreditLineConstants[_id].gracePenaltyRate;
        uint256 _principal = pooledCreditLineVariables[_id].principal;
        uint256 _borrowRate = pooledCreditLineConstants[_id].borrowRate;
        uint256 _penaltyInterestScaled;
        if (_lastPrincipalUpdateTime <= _endTime && block.timestamp > _endTime) {
            // this condition means that _lastPrincipalUpdateTime is older than the end time of the PCL
            // so the penalty rate is applicable only on the time from the end time till now.
            _penaltyInterestScaled = _calculateInterestScaled(_principal, _penaltyRate, block.timestamp.sub(_endTime));
        } else if (_lastPrincipalUpdateTime > _endTime) {
            // this condition means that the _lastPrincipalUpdateTime is beyond end time of the PCL
            // so the penalty interest can be applied from _lastPrincipalUpdateTime till now.
            _penaltyInterestScaled = _calculateInterestScaled(_principal, _penaltyRate, block.timestamp.sub(_lastPrincipalUpdateTime));
        }
        uint256 _interestAccruedScaled = _calculateInterestScaled(_principal, _borrowRate, _timeElapsed);
        _interestAccruedScaled = _interestAccruedScaled.add(_penaltyInterestScaled);
        // scale down interestAccured and take ceiling for the interest as it ensures that borrower can't repay frequently to skip interest
        uint256 _interestAccrued = _divAndCeil(_interestAccruedScaled, SCALING_FACTOR);
        return _interestAccrued.add(pooledCreditLineVariables[_id].interestAccruedTillLastPrincipalUpdate);
    }

    /**
     * @dev Used to calculate current debt of borrower against a pooled credit line.
     * @param _id identifier for the pooled credit line
     * @return current debt of borrower
     */
    function calculateCurrentDebt(uint256 _id) public view returns (uint256) {
        uint256 _interestAccrued = calculateInterestAccrued(_id);
        uint256 _currentDebt = (pooledCreditLineVariables[_id].principal).add(_interestAccrued).sub(
            pooledCreditLineVariables[_id].totalInterestRepaid
        );
        return _currentDebt;
    }

    //-------------------------------- Repayments code end --------------------------------//

    //-------------------------------- Liquidation code start --------------------------------//

    /**
     * @notice used to liquidate credit line in case collateral ratio goes below the threshold
     * @dev this is a callback from the LenderPool.liquidate
            the collateral is directly transferred to lenderPool for lenders to withdraw
     * @param _id identifier for the pooled credit line
     * @return collateral asset received, amount of collateral asset received
     */
    function liquidate(uint256 _id) external override nonReentrant onlyLenderPool returns (address, uint256) {
        PooledCreditLineStatus currentStatus = getStatusAndUpdate(_id);
        require(pooledCreditLineVariables[_id].principal != 0, 'PCL:L1');
        require(currentStatus == PooledCreditLineStatus.ACTIVE || currentStatus == PooledCreditLineStatus.EXPIRED, 'PCL:L2');

        address _collateralAsset = pooledCreditLineConstants[_id].collateralAsset;

        uint256 currentCollateralRatio = calculateCurrentCollateralRatio(_id);
        require(
            currentCollateralRatio < pooledCreditLineConstants[_id].idealCollateralRatio ||
                block.timestamp >= pooledCreditLineConstants[_id].defaultsAt,
            'PCL:L3'
        );
        uint256 _currentDebt = calculateCurrentDebt(_id);
        address _borrowAsset = pooledCreditLineConstants[_id].borrowAsset;
        uint256 _collateralToLiquidate = _equivalentCollateral(_collateralAsset, _borrowAsset, _currentDebt);
        uint256 _totalCollateral = calculateTotalCollateralTokens(_id);
        if (_collateralToLiquidate > _totalCollateral) {
            _collateralToLiquidate = _totalCollateral;
        }

        pooledCreditLineVariables[_id].status = PooledCreditLineStatus.LIQUIDATED;

        uint256 _collateralReceived;
        uint256 _collateralInShares;
        if (_collateralToLiquidate != 0) {
            (_collateralReceived, _collateralInShares) = _transferCollateral(_id, _collateralAsset, _collateralToLiquidate, false);
        }

        emit PooledCreditLineLiquidated(_id, _collateralInShares);

        return (_collateralAsset, _collateralReceived);
    }

    /**
     * @notice used to calculate collateral tokens equivalent to _borrowTokenAmount
     * @param _id identifier for the pooled credit line
     * @param _borrowTokenAmount amount of borrow tokens for which equivalent collateral is calculated
     * @return collateral tokens equivalent to _borrowTokenAmount
     */
    function getEquivalentCollateralTokens(uint256 _id, uint256 _borrowTokenAmount) external view returns (uint256) {
        address _collateralAsset = pooledCreditLineConstants[_id].collateralAsset;
        require(_collateralAsset != address(0), 'PCL:CTTL1');
        address _borrowAsset = pooledCreditLineConstants[_id].borrowAsset;

        return _equivalentCollateral(_collateralAsset, _borrowAsset, _borrowTokenAmount);
    }

    //-------------------------------- Liquidation code end --------------------------------//

    //-------------------------------- close/cancel code start --------------------------------//

    /**
     * @notice used to close pooled credit line. only callable by the borrower
     * @dev this will also withdraw all the collateral and transfer it to the borrower
     * @param _id identifier for the pooled credit line
     */
    function close(uint256 _id) external nonReentrant onlyCreditLineBorrower(_id) {
        PooledCreditLineStatus _status = pooledCreditLineVariables[_id].status;
        require(_status == PooledCreditLineStatus.ACTIVE || _status == PooledCreditLineStatus.EXPIRED, 'PCL:C1');
        require(pooledCreditLineVariables[_id].principal == 0, 'PCL:C2');
        pooledCreditLineVariables[_id].status = PooledCreditLineStatus.CLOSED;
        _withdrawAllCollateral(_id, false);
        emit PooledCreditLineClosed(_id);
    }

    /**
     * @notice used to cancel a pooled credit line request. only callable by the borrower
     * @dev only callable by the borrower in REQUESTED state
     * @param _id identifier for the pooled credit line
     */
    function cancelRequest(uint256 _id) external nonReentrant onlyCreditLineBorrower(_id) {
        require(pooledCreditLineVariables[_id].status == PooledCreditLineStatus.REQUESTED, 'PCL:CR1');
        require(block.timestamp < pooledCreditLineConstants[_id].startsAt, 'PCL:CR2');
        LENDER_POOL.requestCancelled(_id);
        _cancelRequest(_id, CancellationStatus.BORROWER_BEFORE_START);
    }

    /**
     * @notice Function invoked when pooled credit line cancelled because of low collection
     * @dev only LenderPool can invoke
     * @param _id identifier for the pooled credit line
     */
    function cancelRequestOnLowCollection(uint256 _id) external override nonReentrant onlyLenderPool {
        _cancelRequest(_id, CancellationStatus.LENDER_LOW_COLLECTION);
    }

    /**
     * @notice Function invoked when pooled credit line cancelled because it wasn't started even after end time
     * @dev only LenderPool can invoke
     * @param _id identifier for the pooled credit line
     */
    function cancelRequestOnRequestedStateAtEnd(uint256 _id) external override nonReentrant onlyLenderPool {
        _cancelRequest(_id, CancellationStatus.LENDER_NOT_STARTED_AT_END);
    }

    function _cancelRequest(uint256 _id, CancellationStatus _reason) private {
        delete pooledCreditLineVariables[_id];
        delete pooledCreditLineConstants[_id];
        pooledCreditLineVariables[_id].status = PooledCreditLineStatus.CANCELLED;
        emit PooledCreditLineCancelled(_id, _reason);
    }

    /**
     * @notice Function invoked when pooled credit line is terminated by admin
     * @dev only owner can invoke
     * @param _id identifier for the pooled credit line
     */
    function terminate(uint256 _id) external nonReentrant onlyOwner {
        // This function reverts in `NOT_CREATED` or `CANCELLED` state and hence can't terminate
        uint256 _allCollateral = calculateTotalCollateralTokens(_id);
        // transfers all the collateral held to the owner
        if (_allCollateral != 0) {
            _transferCollateral(_id, pooledCreditLineConstants[_id].collateralAsset, _allCollateral, false);
        }
        // callback to lender poll which transfers all the assets held in lender pool to the admin
        LENDER_POOL.terminate(_id, msg.sender);
        delete pooledCreditLineVariables[_id];
        delete pooledCreditLineConstants[_id];
        emit PooledCreditLineTerminated(_id);
    }

    //-------------------------------- close/cancel code end --------------------------------//

    //-------------------------------- Utilities code start --------------------------------//

    /**
     * @notice used to update(if required) and get the status of pooled credit line
     * @dev keeps track of status of the PCL
     * @param _id identifier for the pooled credit line
     * @return status of pooled credit line
     */
    function getStatusAndUpdate(uint256 _id) public override returns (PooledCreditLineStatus) {
        PooledCreditLineStatus currentStatus = pooledCreditLineVariables[_id].status;
        if (currentStatus == PooledCreditLineStatus.ACTIVE && pooledCreditLineConstants[_id].endsAt <= block.timestamp) {
            if (pooledCreditLineVariables[_id].principal != 0) {
                currentStatus = PooledCreditLineStatus.EXPIRED;
            } else {
                currentStatus = PooledCreditLineStatus.CLOSED;
            }
            pooledCreditLineVariables[_id].status = currentStatus;
        }
        return currentStatus;
    }

    /**
     * @notice Used to Calculate Interest Per second on given principal and Interest rate
     * @param _principal principal Amount for which interest has to be calculated.
     * @param _borrowRate It is the Interest Rate at which pooled Credit Line is approved
     * @param _timeElapsed time in seconds to calculate interest for
     * @return interest per second scaled by SCALING_FACTOR for the given parameters
     */
    function _calculateInterestScaled(
        uint256 _principal,
        uint256 _borrowRate,
        uint256 _timeElapsed
    ) private pure returns (uint256) {
        return (_principal.mul(_borrowRate).mul(_timeElapsed).div(YEAR_IN_SECONDS));
    }

    /*
     * @notice used to update the pcl variables on borrowing
     */
    function _updateStateOnPrincipalChange(uint256 _id, uint256 _updatedPrincipal) private {
        uint256 _totalInterestAccrued = calculateInterestAccrued(_id);
        pooledCreditLineVariables[_id].interestAccruedTillLastPrincipalUpdate = _totalInterestAccrued;
        pooledCreditLineVariables[_id].lastPrincipalUpdateTime = block.timestamp;
        pooledCreditLineVariables[_id].principal = _updatedPrincipal;
    }

    /**
     * @notice used to calculate the current collateral ratio
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view.
            Interest is also considered while calculating debt
     * @param _id identifier for the pooled credit line
     * @return collateral ratio multiplied by SCALING_FACTOR to retain precision
     */
    function calculateCurrentCollateralRatio(uint256 _id) public returns (uint256) {
        (uint256 _ratioOfPrices, uint256 _decimals) = PRICE_ORACLE.getLatestPrice(
            pooledCreditLineConstants[_id].collateralAsset,
            pooledCreditLineConstants[_id].borrowAsset
        );

        uint256 _currentDebt = calculateCurrentDebt(_id);
        uint256 _currentCollateralRatio = type(uint256).max;
        if (_currentDebt != 0) {
            _currentCollateralRatio = calculateTotalCollateralTokens(_id).mul(_ratioOfPrices).div(_currentDebt).mul(SCALING_FACTOR).div(
                10**_decimals
            );
        }

        return _currentCollateralRatio;
    }

    function _equivalentCollateral(
        address _collateralAsset,
        address _borrowAsset,
        uint256 _borrowTokenAmount
    ) private view returns (uint256) {
        (uint256 _ratioOfPrices, uint256 _decimals) = PRICE_ORACLE.getLatestPrice(_collateralAsset, _borrowAsset);
        uint256 _collateralTokenAmount = (_borrowTokenAmount.mul(10**_decimals).div(_ratioOfPrices));

        return _collateralTokenAmount;
    }

    function _divAndCeil(uint256 _num, uint256 _denom) private pure returns (uint256) {
        uint256 _divResult = _num.div(_denom);
        if (_divResult * _denom != _num) {
            _divResult++;
        }
        return _divResult;
    }

    //-------------------------------- Utilities code end --------------------------------//

    //-------------------------------- getters start --------------------------------//

    /**
     * @notice used to get the principal borrowed in a pooled credit line
     * @param _id identifier for the pooled credit line
     * @return Returns principal for the given pooled credit line
     */
    function getPrincipal(uint256 _id) external view override returns (uint256) {
        return pooledCreditLineVariables[_id].principal;
    }

    /**
     * @notice used to get the borrower address in a pooled credit line
     * @param _id identifier for the pooled credit line
     * @return Returns borrower address for the given pooled credit line
     */
    function getBorrowerAddress(uint256 _id) external view override returns (address) {
        return pooledCreditLineConstants[_id].borrower;
    }

    /**
     * @notice used to get the endAt time in a pooled credit line
     * @param _id identifier for the pooled credit line
     * @return Returns ends at time for the given pooled credit line
     */
    function getEndsAt(uint256 _id) external view override returns (uint256) {
        return pooledCreditLineConstants[_id].endsAt;
    }

    //-------------------------------- getters end --------------------------------//
}
