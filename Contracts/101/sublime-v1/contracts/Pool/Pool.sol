// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol';
import '../interfaces/IPoolFactory.sol';
import '../interfaces/IPriceOracle.sol';
import '../interfaces/IYield.sol';
import '../interfaces/IRepayment.sol';
import '../interfaces/ISavingsAccount.sol';
import '../SavingsAccount/SavingsAccountUtil.sol';
import '../interfaces/IPool.sol';
import '../interfaces/IVerification.sol';

/**
 * @title Pool contract with Methods related to Pool
 * @notice Implements the functions related to Pool
 * @author Sublime
 */
contract Pool is Initializable, ReentrancyGuardUpgradeable, ERC20PausableUpgradeable, IPool {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    //-------------------------------- Constants start --------------------------------//

    // Address of the price oracle contract
    IPriceOracle immutable PRICE_ORACLE;
    // Address of the savings account contract
    ISavingsAccount immutable SAVINGS_ACCOUNT;
    // address of the repayments contract
    IRepayment immutable REPAYMENT;
    // address of the pool factory contract
    IPoolFactory immutable POOL_FACTORY;
    // Factor to multiply variables to maintain precision
    uint256 constant SCALING_FACTOR = 1e18;

    //-------------------------------- Constants end --------------------------------//

    //-------------------------------- Pool state start --------------------------------//

    /**
     * @notice Struct that is used to store lending details of a lender
     * @param marginCallEndTime timestamp at which margin call raised by lender ends
     * @param effectiveInterestWithdrawn interest withdrawn adjusted for the balance of lender
     * @param extraLiquidityShares shares of collateral that are added by borrower in response to lender margin call
     */
    struct LendingDetails {
        uint256 marginCallEndTime;
        uint256 effectiveInterestWithdrawn;
        uint256 extraLiquidityShares;
    }

    /**
     * @notice Struct that is used to store constants related to a pool
     * @param loanStartTime timestamp at which loan starts
     * @param loanWithdrawalDeadline timestamp by which borrower should withdraw the lent amount
     * @param noOfRepaymentIntervals number of intervals in which repayments are done
     * @param repaymentInterval length of interval to make each repayment
     * @param borrower address of the borrower of credit line
     * @param collateralAsset address of the asset used as collateral in pool
     * @param borrowAsset address of the asset used as borrow asset in pool
     * @param poolSavingsStrategy address of strategy in which collateral is deposited
     * @param lenderVerifier address of verifier for the lender
     * @param borrowRate interest rate scaled by SCALING_FACTOR for the loan
     * @param idealCollateralRatio collateral ratio scaled by SCALING_FACTOR below which pool can be liquidated
     * @param borrowAmountRequested the amount of borrow asset requested by the borrower
     */
    struct PoolConstants {
        uint64 loanStartTime;
        uint64 loanWithdrawalDeadline;
        uint64 noOfRepaymentIntervals;
        uint64 repaymentInterval;
        address borrower;
        address collateralAsset;
        address borrowAsset;
        address poolSavingsStrategy; // invest contract
        address lenderVerifier;
        uint256 borrowRate;
        uint256 idealCollateralRatio;
        uint256 borrowAmountRequested;
    }

    /**
     * @notice Struct that is used to store variables related to a pool
     * @param loanStatus status of the pool
     * @param baseLiquidityShares total shares received by depositing collateral into strategy excluding collateral on margin calls
     * @param extraLiquidityShares total shares received by depositing collateral as part of margin calls
     * @param penaltyLiquidityAmount Tokens received on liquidation of cancel penalty
     */
    struct PoolVariables {
        LoanStatus loanStatus;
        uint256 baseLiquidityShares;
        uint256 extraLiquidityShares;
        uint256 penaltyLiquidityAmount;
    }

    /**
     * @notice used to keep track of lenders' details
     */
    mapping(address => LendingDetails) public lenders;

    /**
     * @notice object of type PoolConstants
     */
    PoolConstants public poolConstants;

    /**
     * @notice object of type PoolVariables
     */
    PoolVariables public poolVariables;

    //-------------------------------- Pool state end --------------------------------//

    //-------------------------------- Modifiers start --------------------------------//

    /**
     * @notice checks if the msg.sender is pool's valid borrower
     */
    modifier onlyBorrower() {
        require(msg.sender == poolConstants.borrower, 'P:OB1');
        _;
    }

    /**
     * @notice checks if the msg.sender is pool's valid lender
     */
    modifier isLender() {
        require(balanceOf(msg.sender) != 0, 'P:IL1');
        _;
    }

    /**
     * @notice checks if the msg.sender is pool's valid owner
     */
    modifier onlyOwner() {
        require(msg.sender == POOL_FACTORY.owner(), 'P:OO1');
        _;
    }

    /**
     * @notice checks if the msg.sender is pool's latest repayment implementation
     */
    modifier onlyRepaymentImpl() {
        require(msg.sender == address(REPAYMENT), 'P:OR1');
        _;
    }

    //-------------------------------- Modifiers end --------------------------------//

    //-------------------------------- Initializers start --------------------------------//

    constructor(
        address _priceOracle,
        address _savingsAccount,
        address _repaymentImpl,
        address _poolFactory
    ) {
        require(_priceOracle != address(0), 'P:C1');
        require(_savingsAccount != address(0), 'P:C2');
        require(_repaymentImpl != address(0), 'P:C3');
        require(_poolFactory != address(0), 'P:C4');

        PRICE_ORACLE = IPriceOracle(_priceOracle);
        SAVINGS_ACCOUNT = ISavingsAccount(_savingsAccount);
        REPAYMENT = IRepayment(_repaymentImpl);
        POOL_FACTORY = IPoolFactory(_poolFactory);
    }

    /**
     * @notice initializing the pool and adding initial collateral
     * @param _borrowAmountRequested the amount of borrow asset requested by the borrower
     * @param _borrower address of the borrower
     * @param _borrowAsset address of the borrow asset
     * @param _collateralAsset address of the collateral asset
     * @param _idealCollateralRatio the ideal collateral ratio of the pool
     * @param _borrowRate the borrow rate as specified by borrower
     * @param _repaymentInterval the interval between to repayments
     * @param _noOfRepaymentIntervals number of repayments to be done by borrower
     * @param _poolSavingsStrategy address of the savings strategy preferred
     * @param _collateralAmount amount of collateral to be deposited by the borrower
     * @param _transferFromSavingsAccount if true, collateral is transferred from msg.sender's savings account, if false, it is transferred from their wallet
     * @param _loanWithdrawalDuration time interval for the borrower to withdraw the lent amount in borrow asset
     * @param _collectionPeriod time interval where lender lend into the borrow pool
     */
    function initialize(
        uint256 _borrowAmountRequested,
        uint256 _borrowRate,
        address _borrower,
        address _borrowAsset,
        address _collateralAsset,
        uint256 _idealCollateralRatio,
        uint64 _repaymentInterval,
        uint64 _noOfRepaymentIntervals,
        address _poolSavingsStrategy,
        uint256 _collateralAmount,
        bool _transferFromSavingsAccount,
        address _lenderVerifier,
        uint256 _loanWithdrawalDuration,
        uint256 _collectionPeriod
    ) external override initializer nonReentrant {
        require(msg.sender == address(POOL_FACTORY), 'P:I1');
        poolConstants.borrowAsset = _borrowAsset;
        poolConstants.idealCollateralRatio = _idealCollateralRatio;
        poolConstants.collateralAsset = _collateralAsset;
        poolConstants.poolSavingsStrategy = _poolSavingsStrategy;
        poolConstants.borrowAmountRequested = _borrowAmountRequested;
        _initialDeposit(_borrower, _collateralAmount, _transferFromSavingsAccount);
        poolConstants.borrower = _borrower;
        poolConstants.borrowRate = _borrowRate;
        poolConstants.noOfRepaymentIntervals = _noOfRepaymentIntervals;
        poolConstants.repaymentInterval = _repaymentInterval;
        poolConstants.lenderVerifier = _lenderVerifier;

        poolConstants.loanStartTime = uint64(block.timestamp.add(_collectionPeriod));
        poolConstants.loanWithdrawalDeadline = uint64(block.timestamp.add(_collectionPeriod).add(_loanWithdrawalDuration));
        __ReentrancyGuard_init();
        __ERC20_init('Pool Tokens', 'PT');
        _setupDecimals(ERC20Upgradeable(_borrowAsset).decimals());
    }

    /**
     * @notice called when borrow pool is initialized to make initial collateral deposit
     * @param _borrower address of the borrower
     * @param _amount amount of collateral getting deposited denominated in collateral asset
     * @param _transferFromSavingsAccount if true, collateral is transferred from msg.sender's savings account, if false, it is transferred from their wallet
     */
    function _initialDeposit(
        address _borrower,
        uint256 _amount,
        bool _transferFromSavingsAccount
    ) private {
        uint256 _equivalentCollateral = getEquivalentTokens(
            poolConstants.borrowAsset,
            poolConstants.collateralAsset,
            poolConstants.borrowAmountRequested
        );
        require(_amount >= poolConstants.idealCollateralRatio.mul(_equivalentCollateral).div(SCALING_FACTOR), 'P:ID1');
        _depositCollateral(_borrower, _amount, _transferFromSavingsAccount);
    }

    //-------------------------------- Initializers end --------------------------------//

    //-------------------------------- Collateral management start --------------------------------//

    /**
     * @notice add collateral to a pool
     * @param _amount amount of collateral to be deposited denominated in collateral asset
     * @param _transferFromSavingsAccount if true, collateral is transferred from msg.sender's savings account, if false, it is transferred from their wallet
     */

    function depositCollateral(uint256 _amount, bool _transferFromSavingsAccount) external override nonReentrant {
        require(_amount != 0, 'P:DC1');
        require(balanceOf(msg.sender) == 0, 'P:DC2');
        _depositCollateral(msg.sender, _amount, _transferFromSavingsAccount);
    }

    /**
     * @notice private function used to withdraw all collateral tokens from the pool (minus penalty)
     * @param _receiver address which receives all the collateral tokens
     * @param _penalty amount of penalty incurred by the borrower when pool is cancelled
     */
    function _withdrawAllCollateral(address _receiver, uint256 _penalty) private {
        address _poolSavingsStrategy = poolConstants.poolSavingsStrategy;
        address _collateralAsset = poolConstants.collateralAsset;
        uint256 _collateralShares;
        if (poolVariables.baseLiquidityShares.add(poolVariables.extraLiquidityShares) > _penalty) {
            _collateralShares = poolVariables.baseLiquidityShares.add(poolVariables.extraLiquidityShares).sub(_penalty);
        }

        poolVariables.baseLiquidityShares = _penalty;
        delete poolVariables.extraLiquidityShares;

        uint256 _sharesReceived;
        if (_collateralShares != 0) {
            _sharesReceived = SavingsAccountUtil.savingsAccountTransferShares(
                SAVINGS_ACCOUNT,
                _collateralAsset,
                _poolSavingsStrategy,
                address(this),
                _receiver,
                _collateralShares
            );
        }
        emit CollateralWithdrawn(_receiver, _sharesReceived);
    }

    /**
     * @notice private function used to deposit collateral from _borrower to pool
     * @param _depositor address transferring the collateral
     * @param _amount amount of collateral to be transferred denominated in collateral asset
     * @param _transferFromSavingsAccount if true, collateral is transferred from _sender's savings account, if false, it is transferred from _sender's wallet
     */
    function _depositCollateral(
        address _depositor,
        uint256 _amount,
        bool _transferFromSavingsAccount
    ) private {
        LoanStatus _loanStatus = poolVariables.loanStatus;
        require(_loanStatus == LoanStatus.ACTIVE || _loanStatus == LoanStatus.COLLECTION, 'P:IDC1');
        uint256 _sharesReceived = _deposit(
            poolConstants.collateralAsset,
            poolConstants.poolSavingsStrategy,
            _depositor,
            address(this),
            _amount,
            _transferFromSavingsAccount,
            true
        );
        poolVariables.baseLiquidityShares = poolVariables.baseLiquidityShares.add(_sharesReceived);
        emit CollateralAdded(_depositor, _amount, _sharesReceived);
    }

    /**
     * @notice used to add extra collateral deposit during margin calls
     * @param _lender the address of the _lender who has requested for margin call
     * @param _amount amount of tokens requested for the margin call
     * @param _transferFromSavingsAccount if true, collateral is transferred from borrower's savings account, if false, it is transferred from borrower's wallet
     */
    function addCollateralInMarginCall(
        address _lender,
        uint256 _amount,
        bool _transferFromSavingsAccount
    ) external override nonReentrant {
        require(poolVariables.loanStatus == LoanStatus.ACTIVE, 'P:ACMC1');
        require(balanceOf(msg.sender) == 0, 'P:ACMC2');
        require(getMarginCallEndTime(_lender) >= block.timestamp, 'P:ACMC3');

        require(_amount != 0, 'P:ACMC4');

        uint256 _sharesReceived = _deposit(
            poolConstants.collateralAsset,
            poolConstants.poolSavingsStrategy,
            msg.sender,
            address(this),
            _amount,
            _transferFromSavingsAccount,
            true
        );

        poolVariables.extraLiquidityShares = poolVariables.extraLiquidityShares.add(_sharesReceived);

        lenders[_lender].extraLiquidityShares = lenders[_lender].extraLiquidityShares.add(_sharesReceived);

        if (getCurrentCollateralRatio(_lender) >= poolConstants.idealCollateralRatio) {
            delete lenders[_lender].marginCallEndTime;
        }

        emit MarginCallCollateralAdded(msg.sender, _lender, _amount, _sharesReceived);
    }

    //-------------------------------- Collateral management end --------------------------------//

    //-------------------------------- Lend code start --------------------------------//

    /**
     * @notice used by lender to supply liquidity to a borrow pool
     * @param _lender Address of lender on behalf of whom tokens are lent
     * @param _amount Amount of tokens lent
     * @param _strategy address of strategy from which tokens are lent if done from savings account,
     * @param _fromSavingsAccount in case of direct deposits it is false
     */
    function lend(
        address _lender,
        uint256 _amount,
        address _strategy,
        bool _fromSavingsAccount
    ) external override nonReentrant {
        address _lenderVerifier = poolConstants.lenderVerifier;
        address _borrower = poolConstants.borrower;
        require(_lender != _borrower && _borrower != msg.sender, 'P:L1');
        if (_lenderVerifier != address(0)) {
            require(IVerification(POOL_FACTORY.userRegistry()).isUser(_lender, _lenderVerifier), 'P:L2');
        }
        require(poolVariables.loanStatus == LoanStatus.COLLECTION && block.timestamp < poolConstants.loanStartTime, 'P:L3');
        uint256 _borrowAmountNeeded = poolConstants.borrowAmountRequested;
        uint256 _lentAmount = totalSupply();
        if (_amount.add(_lentAmount) > _borrowAmountNeeded) {
            _amount = _borrowAmountNeeded.sub(_lentAmount);
        }

        address _borrowToken = poolConstants.borrowAsset;

        _deposit(_borrowToken, _strategy, msg.sender, address(this), _amount, _fromSavingsAccount, false);
        _mint(_lender, _amount);
        emit LiquiditySupplied(_amount, _lender);
    }

    //-------------------------------- Lend code end --------------------------------//

    //-------------------------------- Borrow code start --------------------------------//

    /**
     * @notice used by the borrower to withdraw tokens from the pool when loan is active
     */
    function withdrawBorrowedAmount() external override onlyBorrower nonReentrant {
        LoanStatus _poolStatus = poolVariables.loanStatus;
        require(
            _poolStatus == LoanStatus.COLLECTION &&
                poolConstants.loanStartTime <= block.timestamp &&
                block.timestamp <= poolConstants.loanWithdrawalDeadline,
            'P:WBA1'
        );
        uint256 _tokensLent = totalSupply();
        require(_tokensLent >= POOL_FACTORY.minBorrowFraction().mul(poolConstants.borrowAmountRequested).div(SCALING_FACTOR), 'P:WBA2');

        poolVariables.loanStatus = LoanStatus.ACTIVE;
        uint256 _currentCollateralRatio = getCurrentCollateralRatio();
        require(_currentCollateralRatio >= poolConstants.idealCollateralRatio, 'P:WBA3');

        uint64 _noOfRepaymentIntervals = poolConstants.noOfRepaymentIntervals;
        uint256 _repaymentInterval = poolConstants.repaymentInterval;
        address _borrowAsset = poolConstants.borrowAsset;

        REPAYMENT.initializeRepayment(
            _noOfRepaymentIntervals,
            _repaymentInterval,
            poolConstants.borrowRate,
            poolConstants.loanStartTime,
            _borrowAsset
        );

        (uint256 _protocolFeeFraction, address _collector) = POOL_FACTORY.getProtocolFeeData();
        uint256 _protocolFee = _tokensLent.mul(_protocolFeeFraction).div(SCALING_FACTOR);
        delete poolConstants.loanWithdrawalDeadline;

        uint256 _feeAdjustedWithdrawalAmount = _tokensLent.sub(_protocolFee);

        if (_protocolFee != 0) {
            SavingsAccountUtil.transferTokens(_borrowAsset, address(this), _collector, _protocolFee);
        }
        SavingsAccountUtil.transferTokens(_borrowAsset, address(this), msg.sender, _feeAdjustedWithdrawalAmount);

        emit AmountBorrowed(_feeAdjustedWithdrawalAmount, _protocolFee);
    }

    //-------------------------------- Borrow code end --------------------------------/

    //-------------------------------- Margin call code start --------------------------------/

    /**
     * @notice function is executed by lender to exercise margin call
     * @dev It will revert in case collateral ratio is not below expected value
     * or the lender has already called it.
     */
    function requestMarginCall() external nonReentrant isLender {
        require(poolVariables.loanStatus == LoanStatus.ACTIVE, 'P:RMC1');

        require(getMarginCallEndTime(msg.sender) == 0, 'P:RMC2');
        require(poolConstants.idealCollateralRatio > getCurrentCollateralRatio(msg.sender), 'P:RMC3');

        lenders[msg.sender].marginCallEndTime = block.timestamp.add(POOL_FACTORY.marginCallDuration());

        emit MarginCalled(msg.sender);
    }

    /**
     * @notice used to liquidate lender and burn lender's shares
     * @param _lender address of the lender to be liquidated
     * @param _fromSavingsAccount if true, collateral is transferred from lender's savings account, if false, it is transferred from lender's wallet
     * @param _toSavingsAccount if true, liquidity transfered to receiver's savings account. If false, liquidity transfered to receiver's wallet
     * @param _recieveLiquidityShare if true, equivalent liquidity tokens are withdrawn. If false, assets are withdrawn
     */
    function liquidateForLender(
        address _lender,
        bool _fromSavingsAccount,
        bool _toSavingsAccount,
        bool _recieveLiquidityShare
    ) external nonReentrant {
        _canLenderBeLiquidated(_lender);
        address _poolSavingsStrategy = poolConstants.poolSavingsStrategy;
        (uint256 _lenderCollateralLPShare, uint256 _lenderBalance) = _updateLenderSharesDuringLiquidation(_lender);

        address _collateralAsset = poolConstants.collateralAsset;
        uint256 _lenderCollateralTokens = IYield(_poolSavingsStrategy).getTokensForShares(_lenderCollateralLPShare, _collateralAsset);

        uint256 _debtOwedToLender = interestToPay().mul(_lenderBalance).div(totalSupply()).add(_lenderBalance);
        address _borrowAsset = poolConstants.borrowAsset;
        uint256 _collateralToLiquidate = getEquivalentTokens(_borrowAsset, _collateralAsset, _debtOwedToLender);
        if (_collateralToLiquidate > _lenderCollateralTokens) {
            _collateralToLiquidate = _lenderCollateralTokens;
        }
        _liquidateForLender(_lender, _collateralToLiquidate, _borrowAsset, _fromSavingsAccount);

        uint256 _amountReceived = _withdraw(
            poolConstants.collateralAsset,
            msg.sender,
            _poolSavingsStrategy,
            _lenderCollateralTokens,
            _toSavingsAccount,
            _recieveLiquidityShare
        );
        if (_collateralToLiquidate != _lenderCollateralTokens) {
            address _borrower = poolConstants.borrower;
            _withdraw(
                poolConstants.collateralAsset,
                poolConstants.borrower,
                _poolSavingsStrategy,
                _lenderCollateralTokens.sub(_collateralToLiquidate),
                false,
                false
            );
            emit CollateralWithdrawn(_borrower, _lenderCollateralTokens.sub(_collateralToLiquidate));
        }
        _burn(_lender, _lenderBalance);
        delete lenders[_lender];
        emit LenderLiquidated(msg.sender, _lender, _amountReceived);
    }

    /**
     * @notice private function to liquidate lender of the borrow pool
     * @param _lender address of the lender to be liquidated
     * @param _lenderCollateralTokens share of the lender in collateral tokens
     * @param _fromSavingsAccount if true, collateral is transferred from lender's savings account, if false, it is transferred from lender's wallet
     */
    function _liquidateForLender(
        address _lender,
        uint256 _lenderCollateralTokens,
        address _borrowAsset,
        bool _fromSavingsAccount
    ) private {
        address _poolSavingsStrategy = poolConstants.poolSavingsStrategy;

        uint256 _lenderLiquidationTokens = correspondingBorrowTokens(_lenderCollateralTokens, POOL_FACTORY.liquidatorRewardFraction());

        _deposit(_borrowAsset, _poolSavingsStrategy, msg.sender, _lender, _lenderLiquidationTokens, _fromSavingsAccount, false);
        _withdrawRepayment(_lender);
    }

    /**
     * @notice used to ensure if a lender can be liquidated
     * @param _lender address of the lender to be liquidated
     */
    function _canLenderBeLiquidated(address _lender) private {
        require(poolVariables.loanStatus == LoanStatus.ACTIVE, 'P:ICLBL1');
        uint256 _marginCallEndTime = lenders[_lender].marginCallEndTime;
        require(getMarginCallEndTime(_lender) != 0, 'P:ICLBL2');
        require(_marginCallEndTime < block.timestamp, 'P:ICLBL3');

        require(poolConstants.idealCollateralRatio > getCurrentCollateralRatio(_lender), 'P:ICLBL4');
        require(balanceOf(_lender) != 0, 'P:ICLBL5');
    }

    /**
     * @notice used to add extra liquidity shares to lender's share
     * @param _lender address of the lender to be liquidated
     * @return _lenderCollateralLPShare share of the lender in collateral tokens
     * @return _lenderBalance balance of lender in pool tokens
     */
    function _updateLenderSharesDuringLiquidation(address _lender) private returns (uint256, uint256) {
        uint256 _poolBaseLPShares = poolVariables.baseLiquidityShares;
        uint256 _lenderBalance = balanceOf(_lender);

        uint256 _lenderBaseLPShares = (_poolBaseLPShares.mul(_lenderBalance)).div(totalSupply());
        uint256 _lenderExtraLPShares = lenders[_lender].extraLiquidityShares;
        poolVariables.baseLiquidityShares = _poolBaseLPShares.sub(_lenderBaseLPShares);
        poolVariables.extraLiquidityShares = poolVariables.extraLiquidityShares.sub(_lenderExtraLPShares);

        uint256 _lenderCollateralLPShare = _lenderBaseLPShares.add(_lenderExtraLPShares);
        return (_lenderCollateralLPShare, _lenderBalance);
    }

    /**
     * @notice used to get the end time for a margin call
     * @param _lender address of the lender who has requested a margin call
     * @return the time at which the margin call ends
     */
    function getMarginCallEndTime(address _lender) public view override returns (uint256) {
        uint256 _marginCallDuration = POOL_FACTORY.marginCallDuration();
        uint256 _marginCallEndTime = lenders[_lender].marginCallEndTime;

        if (block.timestamp > _marginCallEndTime.add(_marginCallDuration.mul(2))) {
            _marginCallEndTime = 0;
        }
        return _marginCallEndTime;
    }

    //-------------------------------- Margin call code end --------------------------------/

    //-------------------------------- Liquidation code start --------------------------------/

    /**
     * @notice used to liquidate the pool if the borrower has defaulted
     * @param _fromSavingsAccount if true, collateral is transferred from sender's savings account, if false, it is transferred from sender's wallet
     * @param _toSavingsAccount if true, liquidity transfered to sender's savings account. If false, liquidity transfered to sender's wallet
     * @param _recieveLiquidityShare if true, equivalent liquidity tokens are withdrawn. If false, assets are withdrawn
     */
    function liquidatePool(
        bool _fromSavingsAccount,
        bool _toSavingsAccount,
        bool _recieveLiquidityShare
    ) external nonReentrant {
        require(poolVariables.loanStatus == LoanStatus.ACTIVE, 'P:LP1');
        require(REPAYMENT.didBorrowerDefault(address(this)), 'P:LP2');
        poolVariables.loanStatus = LoanStatus.DEFAULTED;

        address _collateralAsset = poolConstants.collateralAsset;
        address _borrowAsset = poolConstants.borrowAsset;
        address _poolSavingsStrategy = poolConstants.poolSavingsStrategy;

        uint256 _collateralTokens;
        uint256 _collateralToLiquidate;
        {
            uint256 _collateralLiquidityShare = poolVariables.baseLiquidityShares.add(poolVariables.extraLiquidityShares);
            _collateralTokens = IYield(_poolSavingsStrategy).getTokensForShares(_collateralLiquidityShare, _collateralAsset);

            uint256 _currentDebt = totalSupply().add(interestToPay());
            _collateralToLiquidate = getEquivalentTokens(_borrowAsset, _collateralAsset, _currentDebt);
        }

        if (_collateralToLiquidate > _collateralTokens) {
            _collateralToLiquidate = _collateralTokens;
        }

        uint256 _poolBorrowTokens = correspondingBorrowTokens(_collateralToLiquidate, POOL_FACTORY.liquidatorRewardFraction());
        delete poolVariables.extraLiquidityShares;
        delete poolVariables.baseLiquidityShares;

        _deposit(_borrowAsset, POOL_FACTORY.noStrategyAddress(), msg.sender, address(this), _poolBorrowTokens, _fromSavingsAccount, false);
        _withdraw(_collateralAsset, msg.sender, _poolSavingsStrategy, _collateralToLiquidate, _toSavingsAccount, _recieveLiquidityShare);
        if (_collateralToLiquidate != _collateralTokens) {
            address _borrower = poolConstants.borrower;
            _withdraw(_collateralAsset, _borrower, _poolSavingsStrategy, _collateralTokens.sub(_collateralToLiquidate), false, false);
            emit CollateralWithdrawn(_borrower, _collateralTokens.sub(_collateralToLiquidate));
        }
        emit PoolLiquidated(msg.sender);
    }

    //-------------------------------- Liquidation code end --------------------------------/

    //-------------------------------- cancel code start --------------------------------/

    /**
     * @notice used to cancel pool when the minimum borrow amount is not met
     */
    function cancelPool() external nonReentrant {
        LoanStatus _poolStatus = poolVariables.loanStatus;
        require(_poolStatus == LoanStatus.COLLECTION, 'P:CP1');
        uint256 _loanStartTime = poolConstants.loanStartTime;

        if (
            _loanStartTime < block.timestamp &&
            totalSupply() < POOL_FACTORY.minBorrowFraction().mul(poolConstants.borrowAmountRequested).div(SCALING_FACTOR)
        ) {
            return _cancelPool(0);
        }

        uint256 _loanWithdrawalDeadline = uint256(poolConstants.loanWithdrawalDeadline);

        if (_loanWithdrawalDeadline > block.timestamp) {
            require(msg.sender == poolConstants.borrower, 'P:CP2');
        }
        // note: extra liquidity shares are not applicable as the loan never reaches active state
        uint256 _collateralLiquidityShare = poolVariables.baseLiquidityShares;
        uint256 _penaltyTime = _calculatePenaltyTime(_loanStartTime, _loanWithdrawalDeadline);
        uint256 _cancelPenaltyMultiple = POOL_FACTORY.poolCancelPenaltyMultiple();
        uint256 penalty = _cancelPenaltyMultiple
            .mul(poolConstants.borrowRate)
            .div(SCALING_FACTOR)
            .mul(_collateralLiquidityShare)
            .mul(_penaltyTime)
            .div(SCALING_FACTOR)
            .div(365 days);
        _cancelPool(penalty);
    }

    /**
     * @notice function to cancel borrow pool
     * @param _penalty amount to be paid as penalty to cancel pool
     */
    function _cancelPool(uint256 _penalty) private {
        poolVariables.loanStatus = LoanStatus.CANCELLED;
        _withdrawAllCollateral(poolConstants.borrower, _penalty);
        _pause();
        emit PoolCancelled();
    }

    /**
     * @notice used to liquidate the penalty amount when pool is cancelled
     * @dev _receiveLiquidityShares doesn't matter when _toSavingsAccount is true
     * @param _toSavingsAccount if true, liquidity transfered to lender's savings account. If false, liquidity transfered to lender's wallet
     * @param _receiveLiquidityShare if true, equivalent liquidity tokens are withdrawn. If false, assets are withdrawn
     */
    function liquidateCancelPenalty(bool _toSavingsAccount, bool _receiveLiquidityShare) external nonReentrant {
        require(poolVariables.loanStatus == LoanStatus.CANCELLED, 'P:LCP1');
        require(poolVariables.penaltyLiquidityAmount == 0, 'P:LCP2');
        address _poolSavingsStrategy = poolConstants.poolSavingsStrategy;
        address _collateralAsset = poolConstants.collateralAsset;
        // note: extra liquidity shares are not applicable as the loan never reaches active state
        uint256 _collateralTokens = IYield(_poolSavingsStrategy).getTokensForShares(poolVariables.baseLiquidityShares, _collateralAsset);

        uint256 _liquidationTokens = correspondingBorrowTokens(_collateralTokens, POOL_FACTORY.liquidatorRewardFraction());
        poolVariables.penaltyLiquidityAmount = _liquidationTokens;
        SavingsAccountUtil.transferTokens(poolConstants.borrowAsset, msg.sender, address(this), _liquidationTokens);
        _withdraw(
            poolConstants.collateralAsset,
            msg.sender,
            poolConstants.poolSavingsStrategy,
            _collateralTokens,
            _toSavingsAccount,
            _receiveLiquidityShare
        );
    }

    function _calculatePenaltyTime(uint256 _loanStartTime, uint256 _loanWithdrawalDeadline) private view returns (uint256) {
        uint256 _penaltyTime = uint256(poolConstants.repaymentInterval);
        if (block.timestamp > _loanStartTime) {
            uint256 _penaltyEndTime = block.timestamp;
            if (block.timestamp > _loanWithdrawalDeadline) {
                _penaltyEndTime = _loanWithdrawalDeadline;
            }
            _penaltyTime = _penaltyTime.add(_penaltyEndTime.sub(_loanStartTime));
        }
        return _penaltyTime;
    }

    //-------------------------------- cancel code end --------------------------------/

    //-------------------------------- Lender withdrawals start --------------------------------/

    /**
     * @notice used to return total remaining repayments along with provided liquidity to the lender
     * @dev burns all shares and returns total remaining repayments along with provided liquidity
     */
    function withdrawLiquidity() external isLender nonReentrant {
        LoanStatus _loanStatus = poolVariables.loanStatus;

        require(
            _loanStatus == LoanStatus.CLOSED ||
                _loanStatus == LoanStatus.CANCELLED ||
                _loanStatus == LoanStatus.DEFAULTED ||
                _loanStatus == LoanStatus.TERMINATED,
            'P:WL1'
        );

        //gets amount through liquidity shares
        uint256 _actualBalance = balanceOf(msg.sender);
        uint256 _toTransfer = _actualBalance;

        if (_loanStatus == LoanStatus.DEFAULTED || _loanStatus == LoanStatus.TERMINATED) {
            uint256 _totalAsset;
            _totalAsset = IERC20(poolConstants.borrowAsset).balanceOf(address(this));
            //assuming their will be no tokens in pool in any case except liquidation (to be checked) or we should store the amount in liquidate()
            _toTransfer = _toTransfer.mul(_totalAsset).div(totalSupply());
        } else if (_loanStatus == LoanStatus.CANCELLED) {
            uint256 _penaltyShare = _toTransfer.mul(poolVariables.penaltyLiquidityAmount).div(totalSupply());
            _toTransfer = _toTransfer.add(_penaltyShare);
            poolVariables.penaltyLiquidityAmount = poolVariables.penaltyLiquidityAmount.sub(_penaltyShare);
        } else if (_loanStatus == LoanStatus.CLOSED) {
            //transfer repayment
            _withdrawRepayment(msg.sender);
        }
        //to add transfer if not included in above (can be transferred with liquidity)
        _burn(msg.sender, _actualBalance);

        //transfer liquidity provided
        SavingsAccountUtil.transferTokens(poolConstants.borrowAsset, address(this), msg.sender, _toTransfer);

        emit LiquidityWithdrawn(_toTransfer, msg.sender);
    }

    /**
     * @notice used to get the withdrawable amount of borrow token for a lender
     */
    function withdrawRepayment() external isLender nonReentrant {
        _withdrawRepayment(msg.sender);
    }

    /**
     * @notice private function used to withdraw borrow asset from the pool by _lender
     * @param _lender address of the _lender
     */
    function _withdrawRepayment(address _lender) private {
        uint256 _amountToWithdraw = calculateRepaymentWithdrawable(_lender);

        if (_amountToWithdraw == 0) return;

        lenders[_lender].effectiveInterestWithdrawn = lenders[_lender].effectiveInterestWithdrawn.add(_amountToWithdraw);

        SavingsAccountUtil.transferTokens(poolConstants.borrowAsset, address(this), _lender, _amountToWithdraw);
    }

    /**
     * @notice public function used to get the withdrawable amount for a _lender
     * @param _lender address of the _lender
     * @return amount of withdrawable token from the borrow pool
     */
    function calculateRepaymentWithdrawable(address _lender) public view returns (uint256) {
        uint256 _totalRepaidAmount = REPAYMENT.getTotalRepaidAmount(address(this));

        uint256 _amountWithdrawable = (balanceOf(_lender).mul(_totalRepaidAmount).div(totalSupply())).sub(
            lenders[_lender].effectiveInterestWithdrawn
        );

        return _amountWithdrawable;
    }

    //-------------------------------- Lender withdrawals end --------------------------------/

    //-------------------------------- Pool end start --------------------------------/

    /**
     * @notice called to close the loan after repayment of principal
     */
    function closeLoan() external override nonReentrant onlyRepaymentImpl {
        require(poolVariables.loanStatus == LoanStatus.ACTIVE, 'P:CL1');

        poolVariables.loanStatus = LoanStatus.CLOSED;

        _withdrawAllCollateral(poolConstants.borrower, 0);
        _pause();

        emit PoolClosed();
    }

    /**
     * @notice used to terminate the pool
     * @dev kill switch for owner to terminate the pool
     */
    function terminatePool() external nonReentrant onlyOwner {
        _withdrawAllCollateral(msg.sender, 0);
        _pause();
        poolVariables.loanStatus = LoanStatus.TERMINATED;
        emit PoolTerminated();
    }

    //-------------------------------- Pool end end --------------------------------/

    //-------------------------------- Token transfer start --------------------------------/

    /**
     * @notice used to transfer borrow pool tokens among lenders
     * @param _from address of the lender who sends the borrow pool tokens
     * @param _to addres of the lender who receives the borrow pool tokens
     * @param _amount amount of borrow pool tokens transfered
     */
    function _beforeTokenTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) internal override {
        if (_to != address(0)) {
            require(!paused(), 'P:ITT1');
        }
        require(_from != _to, 'P:ITT6');
        require(_to != poolConstants.borrower, 'P:ITT2');

        if (_from == address(0)) {
            return;
        }
        _settleOnTokenTransfer(_from, _to, _amount);
    }

    /**
     * @notice used to settle borrow pool token balances among lenders
     * @param _from address of the lender who sends the borrow pool tokens
     * @param _to addres of the lender who receives the borrow pool tokens
     * @param _amount amount of borrow pool tokens transfered
     */
    function _settleOnTokenTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) private nonReentrant {
        address _lenderVerifier = poolConstants.lenderVerifier;

        if (_lenderVerifier != address(0) && _to != address(0)) {
            require(IVerification(POOL_FACTORY.userRegistry()).isUser(_to, _lenderVerifier), 'P:ITT5');
        }

        if (_to != address(0)) {
            require(getMarginCallEndTime(_from) == 0, 'P:ITT3');
            require(getMarginCallEndTime(_to) == 0, 'P:ITT4');
        }

        //Withdraw repayments for user

        //We enforce pending interest withdrawals before the transfers

        _withdrawRepayment(_from);
        if (_to != address(0)) {
            _withdrawRepayment(_to);
        }
        uint256 _totalRepaidAmount = REPAYMENT.getTotalRepaidAmount(address(this));
        uint256 _totalSupply = totalSupply();
        uint256 _fromBalance = balanceOf(_from);
        //effectiveInterestWithdrawn stores the interest we assume addresses have withdrawn to simplify future interest withdrawals.
        // For eg, if _from has 100 pool tokens, _to has 50 pool tokens, and _amount is 50, the effectiveInterestWithdrawn for
        // _from is done using 50 pool tokens, since future interest repayment withdrawals are done with respect to 50 tokens for _from
        // Similarly, we use 100 for _to's effectiveInterestWithdrawn calculation since their future interest withdrawals are calculated
        // based on 100 pool tokens. Refer calculateRepaymentWithdrawable()
        lenders[_from].effectiveInterestWithdrawn = (_fromBalance.sub(_amount)).mul(_totalRepaidAmount).div(_totalSupply);
        if (_to != address(0)) {
            uint256 _toBalance = balanceOf(_to);
            lenders[_to].effectiveInterestWithdrawn = (_toBalance.add(_amount)).mul(_totalRepaidAmount).div(_totalSupply);
        }

        //transfer extra liquidity shares
        uint256 _liquidityShare = lenders[_from].extraLiquidityShares;
        if (_liquidityShare == 0) return;

        uint256 toTransfer = _liquidityShare;
        if (_amount != _fromBalance) {
            toTransfer = (_amount.mul(_liquidityShare)).div(_fromBalance);
        }

        lenders[_from].extraLiquidityShares = lenders[_from].extraLiquidityShares.sub(toTransfer);
        if (_to != address(0)) {
            lenders[_to].extraLiquidityShares = lenders[_to].extraLiquidityShares.add(toTransfer);
        }
    }

    //-------------------------------- Token transfer end --------------------------------/

    //-------------------------------- Utils start --------------------------------/

    //-------------------------------- Interest utils start --------------------------------/

    /**
     * @notice used to get the interest accrued till current time in the current loan duration
     * @return interest accrued till current time
     */
    function interestToPay() public view returns (uint256) {
        (uint256 _loanDurationCoveredScaled, uint256 _interestPerSecondScaled) = REPAYMENT.getInterestCalculationVars(address(this));
        uint256 _loanDurationTillNowScaled = (block.timestamp.sub(uint256(poolConstants.loanStartTime))).mul(SCALING_FACTOR);

        if (_loanDurationTillNowScaled <= _loanDurationCoveredScaled) {
            return 0;
        }
        uint256 _interestAccrued = _interestPerSecondScaled.mul(_loanDurationTillNowScaled.sub(_loanDurationCoveredScaled)).div(
            SCALING_FACTOR**2
        );

        return _interestAccrued;
    }

    /**
     * @notice used to get the interest per second on the principal amount
     * @param _principal amount of principal lent
     * @return interest accrued on the principal in a second
     */
    function interestPerSecond(uint256 _principal) public view returns (uint256) {
        uint256 _interest = ((_principal).mul(poolConstants.borrowRate)).div(365 days);
        return _interest;
    }

    /**
     * @notice used to get the interest per period on the principal amount
     * @param _balance amount of principal lent
     * @return interest accrued on the principal in a period
     */
    function interestPerPeriod(uint256 _balance) external view returns (uint256) {
        return (interestPerSecond(_balance).mul(poolConstants.repaymentInterval));
    }

    //-------------------------------- Interest utils end --------------------------------/

    //-------------------------------- CollateralRatio utils start --------------------------------/

    /**
     * @notice used to calculate the collateral ratio
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @param _balance the principal amount lent
     * @param _liquidityShares amount of collateral tokens available
     * @return _ratio the collateral ratio
     */
    function calculateCollateralRatio(uint256 _balance, uint256 _liquidityShares) public returns (uint256) {
        uint256 _interest = interestToPay().mul(_balance).div(totalSupply());
        address _collateralAsset = poolConstants.collateralAsset;
        uint256 _currentCollateralTokens = IYield(poolConstants.poolSavingsStrategy).getTokensForShares(_liquidityShares, _collateralAsset);

        uint256 _equivalentCollateral = getEquivalentTokens(_collateralAsset, poolConstants.borrowAsset, _currentCollateralTokens);

        return _equivalentCollateral.mul(SCALING_FACTOR).div(_balance.add(_interest));
    }

    /**
     * @notice used to get the current collateral ratio of the borrow pool
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @return _ratio the current collateral ratio of the borrow pool
     */
    function getCurrentCollateralRatio() public returns (uint256) {
        uint256 _liquidityShares = poolVariables.baseLiquidityShares.add(poolVariables.extraLiquidityShares);

        return (calculateCollateralRatio(totalSupply(), _liquidityShares));
    }

    /**
     * @notice used to get the current collateral ratio of a lender
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @return _ratio the current collateral ratio of the lender
     */
    function getCurrentCollateralRatio(address _lender) public returns (uint256) {
        uint256 _balanceOfLender = balanceOf(_lender);
        uint256 _liquidityShares = (poolVariables.baseLiquidityShares.mul(_balanceOfLender).div(totalSupply())).add(
            lenders[_lender].extraLiquidityShares
        );

        return (calculateCollateralRatio(_balanceOfLender, _liquidityShares));
    }

    //-------------------------------- CollateralRatio utils end --------------------------------/

    //-------------------------------- Token transfer utils end --------------------------------/

    /**
     * @notice private function used to get amount of collateral deposited to the pool
     * @param _fromSavingsAccount if true, collateral is transferred from _sender's savings account, if false, it is transferred from _sender's wallet
     * @param _toSavingsAccount if true, collateral is transferred to pool's savings account, if false, it is withdrawn from _sender's savings account
     * @param _asset address of the asset to be deposited
     * @param _amount amount of tokens to be deposited in the pool
     * @param _poolSavingsStrategy address of the saving strategy used for collateral deposit
     * @param _depositFrom address which makes the deposit
     * @param _depositTo address to which the tokens are deposited
     * @return _sharesReceived number of equivalent shares for given _asset
     */
    function _deposit(
        address _asset,
        address _poolSavingsStrategy,
        address _depositFrom,
        address _depositTo,
        uint256 _amount,
        bool _fromSavingsAccount,
        bool _toSavingsAccount
    ) private returns (uint256) {
        uint256 _sharesReceived;
        if (_fromSavingsAccount) {
            _sharesReceived = SavingsAccountUtil.depositFromSavingsAccount(
                SAVINGS_ACCOUNT,
                _asset,
                _poolSavingsStrategy,
                _depositFrom,
                _depositTo,
                _amount,
                false, // this means tokens are never withdrawn as shares but always as the based tokens
                _toSavingsAccount
            );
        } else {
            _sharesReceived = SavingsAccountUtil.directDeposit(
                SAVINGS_ACCOUNT,
                _asset,
                _poolSavingsStrategy,
                _depositFrom,
                _depositTo,
                _amount,
                _toSavingsAccount
            );
        }
        return _sharesReceived;
    }

    /**
     * @notice private function used to withdraw tokens
     * @param _asset address of the asset to be withdrawn
     * @param _to address to which tokens are withdrawn
     * @param _poolSavingsStrategy address of the saving strategy used for collateral deposit
     * @param _amountInTokens amount of tokens to be withdrawn from the pool
     * @param _toSavingsAccount if true, liquidity transfered to receiver's savings account. If false, liquidity transfered to receiver's wallet
     * @param _recieveLiquidityShare if true, equivalent liquidity tokens are withdrawn. If false, assets are withdrawn
     * @return amount of equivalent shares from given asset
     */
    function _withdraw(
        address _asset,
        address _to,
        address _poolSavingsStrategy,
        uint256 _amountInTokens,
        bool _toSavingsAccount,
        bool _recieveLiquidityShare
    ) private returns (uint256) {
        return
            SavingsAccountUtil.depositFromSavingsAccount(
                SAVINGS_ACCOUNT,
                _asset,
                _poolSavingsStrategy,
                address(this),
                _to,
                _amountInTokens,
                _recieveLiquidityShare,
                _toSavingsAccount
            );
    }

    //-------------------------------- Token transfer utils end --------------------------------/

    //-------------------------------- Token comparision utils start --------------------------------/

    /**
     * @notice used to get corresponding borrow tokens for given collateral tokens
     * @param _totalCollateralTokens amount of collateral tokens
     * @param _fraction Incentivizing fraction for the liquidator
     * @return corresponding borrow tokens for collateral tokens
     */
    function correspondingBorrowTokens(uint256 _totalCollateralTokens, uint256 _fraction) public view returns (uint256) {
        (uint256 _ratioOfPrices, uint256 _decimals) = PRICE_ORACLE.getLatestPrice(poolConstants.collateralAsset, poolConstants.borrowAsset);
        return
            _totalCollateralTokens.mul(_ratioOfPrices).div(10**_decimals).mul(uint256(SCALING_FACTOR).sub(_fraction)).div(SCALING_FACTOR);
    }

    /**
     * @notice used to get the equivalent amount of tokens from source to target tokens
     * @param _source address of the tokens to be converted
     * @param _target address of target conversion token
     * @param _amount amount of tokens to be converted
     * @return the equivalent amount of target tokens for given source tokens
     */
    function getEquivalentTokens(
        address _source,
        address _target,
        uint256 _amount
    ) public view returns (uint256) {
        (uint256 _price, uint256 _decimals) = PRICE_ORACLE.getLatestPrice(_source, _target);
        return _amount.mul(_price).div(10**_decimals);
    }

    //-------------------------------- Token comparision utils end --------------------------------/

    /**
     * @notice used to get the current repayment period for the borrow pool
     * @return current repayment period
     */
    function calculateCurrentPeriod() external view returns (uint256) {
        uint256 _currentPeriod = (block.timestamp.sub(poolConstants.loanStartTime, 'P:CCP1')).div(poolConstants.repaymentInterval);
        return _currentPeriod;
    }

    //-------------------------------- State getter utils start --------------------------------/

    /**
     * @notice used to get the balance details of a _lender
     * @param _lender address of the _lender
     * @return amount of pool tokens available with the _lender
     * @return amount of pool tokens available in the pool
     */
    function getBalanceDetails(address _lender) external view override returns (uint256, uint256) {
        return (balanceOf(_lender), totalSupply());
    }

    /**
     * @notice used to get the loan status of the borrow pool
     * @return integer respresenting loan status
     */
    function getLoanStatus() external view override returns (uint256) {
        return uint256(poolVariables.loanStatus);
    }

    /**
     * @notice used to get the address of the borrower of the pool
     * @return address of the borrower
     */
    function borrower() external view override returns (address) {
        return poolConstants.borrower;
    }

    /**
     * @notice used to total supply of pool tokens for the pool
     * @return total supply of pool tokens
     */
    function totalSupply() public view override(ERC20Upgradeable, IPool) returns (uint256) {
        return ERC20Upgradeable.totalSupply();
    }

    //-------------------------------- State getter utils end --------------------------------/

    //-------------------------------- Utils end --------------------------------/
}
