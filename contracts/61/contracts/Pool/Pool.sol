// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol';
import '../interfaces/IPoolFactory.sol';
import '../interfaces/IPriceOracle.sol';
import '../interfaces/IYield.sol';
import '../interfaces/IRepayment.sol';
import '../interfaces/ISavingsAccount.sol';
import '../SavingsAccount/SavingsAccountUtil.sol';
import '../interfaces/IPool.sol';
import '../interfaces/IExtension.sol';
import '../interfaces/IVerification.sol';

/**
 * @title Pool contract with Methods related to Pool
 * @notice Implements the functions related to Pool
 * @author Sublime
 */
contract Pool is Initializable, ERC20PausableUpgradeable, IPool, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    enum LoanStatus {
        COLLECTION, //denotes collection period
        ACTIVE, // denotes the active loan
        CLOSED, // Loan is repaid and closed
        CANCELLED, // Cancelled by borrower
        DEFAULTED, // Repayment defaulted by  borrower
        TERMINATED // Pool terminated by admin
    }

    address poolFactory;

    struct LendingDetails {
        uint256 effectiveInterestWithdrawn;
        uint256 marginCallEndTime;
        uint256 extraLiquidityShares;
    }

    // Pool constants
    struct PoolConstants {
        address borrower;
        uint256 borrowAmountRequested;
        uint256 loanStartTime;
        uint256 loanWithdrawalDeadline;
        address borrowAsset;
        uint256 idealCollateralRatio;
        uint256 borrowRate;
        uint256 noOfRepaymentIntervals;
        uint256 repaymentInterval;
        address collateralAsset;
        address poolSavingsStrategy; // invest contract
        address lenderVerifier;
    }

    struct PoolVariables {
        uint256 baseLiquidityShares;
        uint256 extraLiquidityShares;
        LoanStatus loanStatus;
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

    /**
     * @notice checks if the _user is pool's valid borrower
     * @param _user address of the borrower
     */
    modifier onlyBorrower(address _user) {
        require(_user == poolConstants.borrower, 'OB1');
        _;
    }

    /**
     * @notice checks if the _lender is pool's valid lender
     * @param _lender address of the lender
     */
    modifier isLender(address _lender) {
        require(balanceOf(_lender) != 0, 'IL1');
        _;
    }

    /**
     * @notice checks if the msg.sender is pool's valid owner
     */
    modifier onlyOwner() {
        require(msg.sender == IPoolFactory(poolFactory).owner(), 'OO1');
        _;
    }

    /**
     * @notice checks if the msg.sender is pool's latest repayment implementation
     */
    modifier onlyRepaymentImpl() {
        require(msg.sender == IPoolFactory(poolFactory).repaymentImpl(), 'OR1');
        _;
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
        uint256 _repaymentInterval,
        uint256 _noOfRepaymentIntervals,
        address _poolSavingsStrategy,
        uint256 _collateralAmount,
        bool _transferFromSavingsAccount,
        address _lenderVerifier,
        uint256 _loanWithdrawalDuration,
        uint256 _collectionPeriod
    ) external payable initializer {
        poolFactory = msg.sender;
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

        poolConstants.loanStartTime = block.timestamp.add(_collectionPeriod);
        poolConstants.loanWithdrawalDeadline = block.timestamp.add(_collectionPeriod).add(_loanWithdrawalDuration);
        __ERC20_init('Pool Tokens', 'PT');
        try ERC20Upgradeable(_borrowAsset).decimals() returns(uint8 _decimals) {
            _setupDecimals(_decimals);
        } catch(bytes memory) {}
    }

    /**
     * @notice add collateral to a pool
     * @param _amount amount of collateral to be deposited denominated in collateral asset
     * @param _transferFromSavingsAccount if true, collateral is transferred from msg.sender's savings account, if false, it is transferred from their wallet
     */
    function depositCollateral(uint256 _amount, bool _transferFromSavingsAccount) external payable override {
        require(_amount != 0, 'DC1');
        require(balanceOf(msg.sender) == 0, 'DC2');
        _depositCollateral(msg.sender, _amount, _transferFromSavingsAccount);
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
    ) internal {
        uint256 _equivalentCollateral = getEquivalentTokens(
            poolConstants.borrowAsset,
            poolConstants.collateralAsset,
            poolConstants.borrowAmountRequested
        );
        require(_amount >= poolConstants.idealCollateralRatio.mul(_equivalentCollateral).div(1e30), 'ID1');
        _depositCollateral(_borrower, _amount, _transferFromSavingsAccount);
    }

    /**
     * @notice internal function used to deposit collateral from _borrower to pool
     * @param _depositor address transferring the collateral
     * @param _amount amount of collateral to be transferred denominated in collateral asset
     * @param _transferFromSavingsAccount if true, collateral is transferred from _sender's savings account, if false, it is transferred from _sender's wallet
     */
    function _depositCollateral(
        address _depositor,
        uint256 _amount,
        bool _transferFromSavingsAccount
    ) internal nonReentrant {
        uint256 _sharesReceived = _deposit(
            _transferFromSavingsAccount,
            true,
            poolConstants.collateralAsset,
            _amount,
            poolConstants.poolSavingsStrategy,
            _depositor,
            address(this)
        );
        poolVariables.baseLiquidityShares = poolVariables.baseLiquidityShares.add(_sharesReceived);
        emit CollateralAdded(_depositor, _amount, _sharesReceived);
    }

    /**
     * @notice internal function used to get amount of collateral deposited to the pool
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
        bool _fromSavingsAccount,
        bool _toSavingsAccount,
        address _asset,
        uint256 _amount,
        address _poolSavingsStrategy,
        address _depositFrom,
        address _depositTo
    ) internal returns (uint256 _sharesReceived) {
        if (_fromSavingsAccount) {
            _sharesReceived = SavingsAccountUtil.depositFromSavingsAccount(
                ISavingsAccount(IPoolFactory(poolFactory).savingsAccount()),
                _depositFrom,
                _depositTo,
                _amount,
                _asset,
                _poolSavingsStrategy,
                true,
                _toSavingsAccount
            );
        } else {
            _sharesReceived = SavingsAccountUtil.directDeposit(
                ISavingsAccount(IPoolFactory(poolFactory).savingsAccount()),
                _depositFrom,
                _depositTo,
                _amount,
                _asset,
                _toSavingsAccount,
                _poolSavingsStrategy
            );
        }
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
    ) external payable override nonReentrant {
        require(poolVariables.loanStatus == LoanStatus.ACTIVE, 'ACMC1');
        require(balanceOf(msg.sender) == 0, 'ACMC2');
        require(getMarginCallEndTime(_lender) >= block.timestamp, 'ACMC3');

        require(_amount != 0, 'ACMC4');

        uint256 _sharesReceived = _deposit(
            _transferFromSavingsAccount,
            true,
            poolConstants.collateralAsset,
            _amount,
            poolConstants.poolSavingsStrategy,
            msg.sender,
            address(this)
        );

        poolVariables.extraLiquidityShares = poolVariables.extraLiquidityShares.add(_sharesReceived);

        lenders[_lender].extraLiquidityShares = lenders[_lender].extraLiquidityShares.add(_sharesReceived);

        if (getCurrentCollateralRatio(_lender) >= poolConstants.idealCollateralRatio) {
            delete lenders[_lender].marginCallEndTime;
        }

        emit MarginCallCollateralAdded(msg.sender, _lender, _amount, _sharesReceived);
    }

    /**
     * @notice used by the borrower to withdraw tokens from the pool when loan is active
     */
    function withdrawBorrowedAmount() external override onlyBorrower(msg.sender) nonReentrant {
        LoanStatus _poolStatus = poolVariables.loanStatus;
        uint256 _tokensLent = totalSupply();
        require(
            _poolStatus == LoanStatus.COLLECTION &&
                poolConstants.loanStartTime < block.timestamp &&
                block.timestamp < poolConstants.loanWithdrawalDeadline,
            'WBA1'
        );
        IPoolFactory _poolFactory = IPoolFactory(poolFactory);
        require(_tokensLent >= _poolFactory.minBorrowFraction().mul(poolConstants.borrowAmountRequested).div(10**30), 'WBA2');

        poolVariables.loanStatus = LoanStatus.ACTIVE;
        uint256 _currentCollateralRatio = getCurrentCollateralRatio();
        require(_currentCollateralRatio >= poolConstants.idealCollateralRatio, 'WBA3');

        uint256 _noOfRepaymentIntervals = poolConstants.noOfRepaymentIntervals;
        uint256 _repaymentInterval = poolConstants.repaymentInterval;
        IRepayment(_poolFactory.repaymentImpl()).initializeRepayment(
            _noOfRepaymentIntervals,
            _repaymentInterval,
            poolConstants.borrowRate,
            poolConstants.loanStartTime,
            poolConstants.borrowAsset
        );
        IExtension(_poolFactory.extension()).initializePoolExtension(_repaymentInterval);

        address _borrowAsset = poolConstants.borrowAsset;
        (uint256 _protocolFeeFraction, address _collector) = _poolFactory.getProtocolFeeData();
        uint256 _protocolFee = _tokensLent.mul(_protocolFeeFraction).div(10**30);
        delete poolConstants.loanWithdrawalDeadline;

        uint256 _feeAdjustedWithdrawalAmount = _tokensLent.sub(_protocolFee);

        SavingsAccountUtil.transferTokens(_borrowAsset, _protocolFee, address(this), _collector);
        SavingsAccountUtil.transferTokens(_borrowAsset, _feeAdjustedWithdrawalAmount, address(this), msg.sender);

        emit AmountBorrowed(_feeAdjustedWithdrawalAmount, _protocolFee);
    }

    /**
     * @notice internal function used to withdraw all collateral tokens from the pool (minus penalty)
     * @param _receiver address which receives all the collateral tokens
     * @param _penalty amount of penalty incurred by the borrower when pool is cancelled
     */
    function _withdrawAllCollateral(address _receiver, uint256 _penalty) internal {
        address _poolSavingsStrategy = poolConstants.poolSavingsStrategy;
        address _collateralAsset = poolConstants.collateralAsset;
        uint256 _collateralShares = 0;
        if (poolVariables.baseLiquidityShares.add(poolVariables.extraLiquidityShares) > _penalty) {
            _collateralShares = poolVariables.baseLiquidityShares.add(poolVariables.extraLiquidityShares).sub(_penalty);
        }
        // uint256 _collateralTokens = _collateralShares;
        uint256 _collateralTokens = IYield(_poolSavingsStrategy).getTokensForShares(_collateralShares, _collateralAsset);

        poolVariables.baseLiquidityShares = _penalty;
        delete poolVariables.extraLiquidityShares;

        uint256 _sharesReceived;
        if (_collateralShares != 0) {
            ISavingsAccount _savingsAccount = ISavingsAccount(IPoolFactory(poolFactory).savingsAccount());
            _sharesReceived = SavingsAccountUtil.savingsAccountTransfer(
                _savingsAccount,
                address(this),
                _receiver,
                _collateralTokens,
                _collateralAsset,
                _poolSavingsStrategy
            );
        }
        emit CollateralWithdrawn(_receiver, _sharesReceived);
    }

    /**
     * @notice used by lender to supply liquidity to a borrow pool
     * @param _lender address of the lender
     * @param _amount amount of liquidity supplied by the _lender
     * @param _strategy address of strategy from which tokens are lent if done from savings account, 
     *                  in case of direct deposits, zeroAddress should be used
     */
    function lend(
        address _lender,
        uint256 _amount,
        address _strategy
    ) external payable nonReentrant {
        address _lenderVerifier = poolConstants.lenderVerifier;
        address _borrower = poolConstants.borrower;
        require(_lender != _borrower && _borrower != msg.sender, 'L1');
        if (_lenderVerifier != address(0)) {
            require(IVerification(IPoolFactory(poolFactory).userRegistry()).isUser(_lender, _lenderVerifier), 'L2');
        }
        require(poolVariables.loanStatus == LoanStatus.COLLECTION && block.timestamp < poolConstants.loanStartTime, 'L3');
        uint256 _borrowAmountNeeded = poolConstants.borrowAmountRequested;
        uint256 _lentAmount = totalSupply();
        if (_amount.add(_lentAmount) > _borrowAmountNeeded) {
            _amount = _borrowAmountNeeded.sub(_lentAmount);
        }

        address _borrowToken = poolConstants.borrowAsset;
        bool _fromSavingsAccount;
        if(_strategy != address(0)) {
            _fromSavingsAccount = true;
        }
        _deposit(
            _fromSavingsAccount,
            false,
            _borrowToken,
            _amount,
            _strategy,
            msg.sender,
            address(this)
        );
        _mint(_lender, _amount);
        emit LiquiditySupplied(_amount, _lender);
    }

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
            require(!paused(), 'TT1');
        }
        require(_to != poolConstants.borrower, 'TT2');

        if (_from == address(0) || _to == address(0)) {
            return;
        }
        IPoolFactory _poolFactory = IPoolFactory(poolFactory);
        address _lenderVerifier = poolConstants.lenderVerifier;
        if (_lenderVerifier != address(0)) {
            require(IVerification(_poolFactory.userRegistry()).isUser(_to, _lenderVerifier), 'TT5');
        }
        require(getMarginCallEndTime(_from) == 0, 'TT3');
        require(getMarginCallEndTime(_to) == 0, 'TT4');

        //Withdraw repayments for user

        //We enforce pending interest withdrawals before the transfers
        
        //effectiveInterestWithdrawn stores the interest we assume addresses have withdrawn to simplify future interest withdrawals.
        // For eg, if _from has 100 pool tokens, _to has 50 pool tokens, and _amount is 50, the effectiveInterestWithdrawn for 
        // _from is done using 50 pool tokens, since future interest repayment withdrawals are done with respect to 50 tokens for _from
        // Similarly, we use 100 for _to's effectiveInterestWithdrawn calculation since their future interest withdrawals are calculated
        // based on 100 pool tokens. Refer calculateRepaymentWithdrawable()
        _withdrawRepayment(_from);
        _withdrawRepayment(_to);
        uint256 _totalRepaidAmount = IRepayment(IPoolFactory(poolFactory).repaymentImpl()).getTotalRepaidAmount(address(this));
        uint256 _totalSupply = totalSupply();
        uint256 _fromBalance = balanceOf(_from);
        uint256 _toBalance = balanceOf(_to);
        lenders[_from].effectiveInterestWithdrawn = (_fromBalance.sub(_amount)).mul(_totalRepaidAmount).div(_totalSupply);
        lenders[_to].effectiveInterestWithdrawn = (_toBalance.add(_amount)).mul(_totalRepaidAmount).div(_totalSupply);

        IExtension(_poolFactory.extension()).removeVotes(_from, _to, _amount);

        //transfer extra liquidity shares
        uint256 _liquidityShare = lenders[_from].extraLiquidityShares;
        if (_liquidityShare == 0) return;

        uint256 toTransfer = _liquidityShare;
        if (_amount != _fromBalance) {
            toTransfer = (_amount.mul(_liquidityShare)).div(_fromBalance);
        }

        lenders[_from].extraLiquidityShares = lenders[_from].extraLiquidityShares.sub(toTransfer);
        lenders[_to].extraLiquidityShares = lenders[_to].extraLiquidityShares.add(toTransfer);
    }

    function _calculatePenaltyTime(uint256 _loanStartTime, uint256 _loanWithdrawalDeadline) internal view returns (uint256) {
        uint256 _penaltyTime = poolConstants.repaymentInterval;
        if (block.timestamp > _loanStartTime) {
            uint256 _penaltyEndTime = block.timestamp;
            if (block.timestamp > _loanWithdrawalDeadline) {
                _penaltyEndTime = _loanWithdrawalDeadline;
            }
            _penaltyTime = _penaltyTime.add(_penaltyEndTime.sub(_loanStartTime));
        }
        return _penaltyTime;
    }

    /**
     * @notice used to cancel pool when the minimum borrow amount is not met
     */
    function cancelPool() external {
        LoanStatus _poolStatus = poolVariables.loanStatus;
        require(_poolStatus == LoanStatus.COLLECTION, 'CP1');
        uint256 _loanStartTime = poolConstants.loanStartTime;
        IPoolFactory _poolFactory = IPoolFactory(poolFactory);

        if (
            _loanStartTime < block.timestamp &&
            totalSupply() < _poolFactory.minBorrowFraction().mul(poolConstants.borrowAmountRequested).div(10**30)
        ) {
            return _cancelPool(0);
        }

        uint256 _loanWithdrawalDeadline = poolConstants.loanWithdrawalDeadline;

        if (_loanWithdrawalDeadline > block.timestamp) {
            require(msg.sender == poolConstants.borrower, 'CP2');
        }
        // note: extra liquidity shares are not applicable as the loan never reaches active state
        uint256 _collateralLiquidityShare = poolVariables.baseLiquidityShares;
        uint256 _penaltyTime = _calculatePenaltyTime(_loanStartTime, _loanWithdrawalDeadline);
        uint256 _cancelPenaltyMultiple = _poolFactory.poolCancelPenaltyMultiple();
        uint256 penalty = _cancelPenaltyMultiple
            .mul(poolConstants.borrowRate)
            .div(10**30)
            .mul(_collateralLiquidityShare)
            .div(10**30)
            .mul(_penaltyTime)
            .div(365 days);
        _cancelPool(penalty);
    }

    /**
     * @notice internal function to cancel borrow pool
     * @param _penalty amount to be paid as penalty to cancel pool
     */
    function _cancelPool(uint256 _penalty) internal {
        poolVariables.loanStatus = LoanStatus.CANCELLED;
        _withdrawAllCollateral(poolConstants.borrower, _penalty);
        _pause();
        emit PoolCancelled();
    }

    /**
     * @notice used to liquidate the penalty amount when pool is calcelled
     * @dev _receiveLiquidityShares doesn't matter when _toSavingsAccount is true
     * @param _toSavingsAccount if true, liquidity transfered to lender's savings account. If false, liquidity transfered to lender's wallet
     * @param _receiveLiquidityShare if true, equivalent liquidity tokens are withdrawn. If false, assets are withdrawn
     */
    function liquidateCancelPenalty(bool _toSavingsAccount, bool _receiveLiquidityShare) external nonReentrant {
        require(poolVariables.loanStatus == LoanStatus.CANCELLED, 'LCP1');
        require(poolVariables.penaltyLiquidityAmount == 0, 'LCP2');
        IPoolFactory _poolFactory = IPoolFactory(poolFactory);
        address _poolSavingsStrategy = poolConstants.poolSavingsStrategy;
        address _collateralAsset = poolConstants.collateralAsset;
        // note: extra liquidity shares are not applicable as the loan never reaches active state
        uint256 _collateralTokens = poolVariables.baseLiquidityShares;
        _collateralTokens = IYield(_poolSavingsStrategy).getTokensForShares(_collateralTokens, _collateralAsset);

        uint256 _liquidationTokens = correspondingBorrowTokens(
            _collateralTokens,
            _poolFactory.priceOracle(),
            _poolFactory.liquidatorRewardFraction()
        );
        poolVariables.penaltyLiquidityAmount = _liquidationTokens;
        SavingsAccountUtil.transferTokens(poolConstants.borrowAsset, _liquidationTokens, msg.sender, address(this));
        _withdraw(
            _toSavingsAccount,
            _receiveLiquidityShare,
            poolConstants.collateralAsset,
            poolConstants.poolSavingsStrategy,
            _collateralTokens
        );
    }

    /**
     * @notice used to terminate the pool
     * @dev kill switch for owner to terminate the pool
     */
    function terminatePool() external onlyOwner {
        _withdrawAllCollateral(msg.sender, 0);
        _pause();
        poolVariables.loanStatus = LoanStatus.TERMINATED;
        IExtension(IPoolFactory(poolFactory).extension()).closePoolExtension();
        emit PoolTerminated();
    }

    /**
     * @notice called to close the loan after repayment of principal
     */
    function closeLoan() external payable override nonReentrant onlyRepaymentImpl {
        require(poolVariables.loanStatus == LoanStatus.ACTIVE, 'CL1');

        poolVariables.loanStatus = LoanStatus.CLOSED;

        IExtension(IPoolFactory(poolFactory).extension()).closePoolExtension();
        _withdrawAllCollateral(poolConstants.borrower, 0);
        _pause();

        emit PoolClosed();
    }

    /**
     * @notice used to return total remaining repayments along with provided liquidity to the lender
     * @dev burns all shares and returns total remaining repayments along with provided liquidity
     */
    function withdrawLiquidity() external isLender(msg.sender) nonReentrant {
        LoanStatus _loanStatus = poolVariables.loanStatus;

        require(
            _loanStatus == LoanStatus.CLOSED ||
                _loanStatus == LoanStatus.CANCELLED ||
                _loanStatus == LoanStatus.DEFAULTED ||
                _loanStatus == LoanStatus.TERMINATED,
            'WL1'
        );

        //gets amount through liquidity shares
        uint256 _actualBalance = balanceOf(msg.sender);
        uint256 _toTransfer = _actualBalance;

        if (_loanStatus == LoanStatus.DEFAULTED || _loanStatus == LoanStatus.TERMINATED) {
            uint256 _totalAsset;
            if (poolConstants.borrowAsset != address(0)) {
                _totalAsset = IERC20(poolConstants.borrowAsset).balanceOf(address(this));
            } else {
                _totalAsset = address(this).balance;
            }
            //assuming their will be no tokens in pool in any case except liquidation (to be checked) or we should store the amount in liquidate()
            _toTransfer = _toTransfer.mul(_totalAsset).div(totalSupply());
        }

        if (_loanStatus == LoanStatus.CANCELLED) {
            _toTransfer = _toTransfer.add(_toTransfer.mul(poolVariables.penaltyLiquidityAmount).div(totalSupply()));
        }

        if (_loanStatus == LoanStatus.CLOSED) {
            //transfer repayment
            _withdrawRepayment(msg.sender);
        }
        //to add transfer if not included in above (can be transferred with liquidity)
        _burn(msg.sender, _actualBalance);

        //transfer liquidity provided
        SavingsAccountUtil.transferTokens(poolConstants.borrowAsset, _toTransfer, address(this), msg.sender);

        emit LiquidityWithdrawn(_toTransfer, msg.sender);
    }

    /**
     * @notice function is executed by lender to exercise margin call
     * @dev It will revert in case collateral ratio is not below expected value
     * or the lender has already called it.
     */

    function requestMarginCall() external isLender(msg.sender) {
        require(poolVariables.loanStatus == LoanStatus.ACTIVE, 'RMC1');

        IPoolFactory _poolFactory = IPoolFactory(poolFactory);
        require(getMarginCallEndTime(msg.sender) == 0, 'RMC2');
        require(poolConstants.idealCollateralRatio > getCurrentCollateralRatio(msg.sender), 'RMC3');

        lenders[msg.sender].marginCallEndTime = block.timestamp.add(_poolFactory.marginCallDuration());

        emit MarginCalled(msg.sender);
    }

    /**
     * @notice used to get the interest accrued till current time in the current loan duration
     * @return ineterest accrued till current time
     */
    function interestToPay() public view returns (uint256) {
        IPoolFactory _poolFactory = IPoolFactory(poolFactory);
        (uint256 _loanDurationCovered, uint256 _interestPerSecond) = IRepayment(_poolFactory.repaymentImpl()).getInterestCalculationVars(
            address(this)
        );
        uint256 _currentBlockTime = block.timestamp.mul(10**30);
        uint256 _loanDurationTillNow = _currentBlockTime.sub(poolConstants.loanStartTime.mul(10**30));
        if (_loanDurationTillNow <= _loanDurationCovered) {
            return 0;
        }
        uint256 _interestAccrued = _interestPerSecond.mul(_loanDurationTillNow.sub(_loanDurationCovered)).div(10**60);

        return _interestAccrued;
    }

    /**
     * @notice used to calculate the collateral ratio
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @param _balance the principal amount lent
     * @param _liquidityShares amount of collateral tokens available
     * @return _ratio the collateral ratio
     */
    function calculateCollateralRatio(uint256 _balance, uint256 _liquidityShares) public returns (uint256 _ratio) {
        uint256 _interest = interestToPay().mul(_balance).div(totalSupply());
        address _collateralAsset = poolConstants.collateralAsset;
        address _strategy = poolConstants.poolSavingsStrategy;
        uint256 _currentCollateralTokens = IYield(_strategy).getTokensForShares(_liquidityShares, _collateralAsset);

        uint256 _equivalentCollateral = getEquivalentTokens(_collateralAsset, poolConstants.borrowAsset, _currentCollateralTokens);
        _ratio = _equivalentCollateral.mul(10**30).div(_balance.add(_interest));
    }

    /**
     * @notice used to get the current collateral ratio of the borrow pool
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @return _ratio the current collateral ratio of the borrow pool
     */
    function getCurrentCollateralRatio() public returns (uint256 _ratio) {
        uint256 _liquidityShares = poolVariables.baseLiquidityShares.add(poolVariables.extraLiquidityShares);

        _ratio = calculateCollateralRatio(totalSupply(), _liquidityShares);
    }

    /**
     * @notice used to get the current collateral ratio of a lender
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @return _ratio the current collateral ratio of the lender
     */
    function getCurrentCollateralRatio(address _lender) public returns (uint256 _ratio) {
        uint256 _balanceOfLender = balanceOf(_lender);
        uint256 _liquidityShares = (poolVariables.baseLiquidityShares.mul(_balanceOfLender).div(totalSupply())).add(
            lenders[_lender].extraLiquidityShares
        );

        return (calculateCollateralRatio(_balanceOfLender, _liquidityShares));
    }

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
    ) external payable nonReentrant {
        LoanStatus _currentPoolStatus = poolVariables.loanStatus;
        IPoolFactory _poolFactory = IPoolFactory(poolFactory);
        require(_currentPoolStatus == LoanStatus.ACTIVE, 'LP1');
        require(IRepayment(_poolFactory.repaymentImpl()).didBorrowerDefault(address(this)), 'LP2');
        poolVariables.loanStatus = LoanStatus.DEFAULTED;

        address _collateralAsset = poolConstants.collateralAsset;
        address _borrowAsset = poolConstants.borrowAsset;
        uint256 _collateralLiquidityShare = poolVariables.baseLiquidityShares.add(poolVariables.extraLiquidityShares);
        address _poolSavingsStrategy = poolConstants.poolSavingsStrategy;

        uint256 _collateralTokens = _collateralLiquidityShare;
        _collateralTokens = IYield(_poolSavingsStrategy).getTokensForShares(_collateralLiquidityShare, _collateralAsset);

        uint256 _poolBorrowTokens = correspondingBorrowTokens(
            _collateralTokens,
            _poolFactory.priceOracle(),
            _poolFactory.liquidatorRewardFraction()
        );
        delete poolVariables.extraLiquidityShares;
        delete poolVariables.baseLiquidityShares;

        _deposit(_fromSavingsAccount, false, _borrowAsset, _poolBorrowTokens, _poolFactory.noStrategyAddress(), msg.sender, address(this));
        _withdraw(_toSavingsAccount, _recieveLiquidityShare, _collateralAsset, _poolSavingsStrategy, _collateralTokens);
        emit PoolLiquidated(msg.sender);
    }

    /**
     * @notice internal function used to withdraw tokens
     * @param _toSavingsAccount if true, liquidity transfered to receiver's savings account. If false, liquidity transfered to receiver's wallet
     * @param _recieveLiquidityShare if true, equivalent liquidity tokens are withdrawn. If false, assets are withdrawn
     * @param _asset address of the asset to be withdrawn
     * @param _poolSavingsStrategy address of the saving strategy used for collateral deposit
     * @param _amountInTokens amount of tokens to be withdrawn from the pool
     * @return amount of equivalent shares from given asset
     */
    function _withdraw(
        bool _toSavingsAccount,
        bool _recieveLiquidityShare,
        address _asset,
        address _poolSavingsStrategy,
        uint256 _amountInTokens
    ) internal returns (uint256) {
        ISavingsAccount _savingsAccount = ISavingsAccount(IPoolFactory(poolFactory).savingsAccount());
        return
            SavingsAccountUtil.depositFromSavingsAccount(
                _savingsAccount,
                address(this),
                msg.sender,
                _amountInTokens,
                _asset,
                _poolSavingsStrategy,
                _recieveLiquidityShare,
                _toSavingsAccount
            );
    }

    /**
     * @notice used to ensure if a lender can be liquidated
     * @param _lender address of the lender to be liquidated
     */
    function _canLenderBeLiquidated(address _lender) internal {
        require((poolVariables.loanStatus == LoanStatus.ACTIVE) && (block.timestamp > poolConstants.loanWithdrawalDeadline), 'CLBL1');
        uint256 _marginCallEndTime = lenders[_lender].marginCallEndTime;
        require(getMarginCallEndTime(_lender) != 0, 'CLBL2');
        require(_marginCallEndTime < block.timestamp, 'CLBL3');

        require(poolConstants.idealCollateralRatio > getCurrentCollateralRatio(_lender), 'CLBL4');
        require(balanceOf(_lender) != 0, 'CLBL5');
    }

    /**
     * @notice used to add extra liquidity shares to lender's share
     * @param _lender address of the lender to be liquidated
     * @return _lenderCollateralLPShare share of the lender in collateral tokens
     * @return _lenderBalance balance of lender in pool tokens
     */
    function _updateLenderSharesDuringLiquidation(address _lender)
        internal
        returns (uint256 _lenderCollateralLPShare, uint256 _lenderBalance)
    {
        uint256 _poolBaseLPShares = poolVariables.baseLiquidityShares;
        _lenderBalance = balanceOf(_lender);

        uint256 _lenderBaseLPShares = (_poolBaseLPShares.mul(_lenderBalance)).div(totalSupply());
        uint256 _lenderExtraLPShares = lenders[_lender].extraLiquidityShares;
        poolVariables.baseLiquidityShares = _poolBaseLPShares.sub(_lenderBaseLPShares);
        poolVariables.extraLiquidityShares = poolVariables.extraLiquidityShares.sub(_lenderExtraLPShares);

        _lenderCollateralLPShare = _lenderBaseLPShares.add(_lenderExtraLPShares);
    }

    /**
     * @notice internal function to liquidate lender of the borrow pool
     * @param _fromSavingsAccount if true, collateral is transferred from lender's savings account, if false, it is transferred from lender's wallet
     * @param _lender address of the lender to be liquidated
     * @param _lenderCollateralTokens share of the lender in collateral tokens
     */
    function _liquidateForLender(
        bool _fromSavingsAccount,
        address _lender,
        uint256 _lenderCollateralTokens
    ) internal {
        address _poolSavingsStrategy = poolConstants.poolSavingsStrategy;

        IPoolFactory _poolFactory = IPoolFactory(poolFactory);
        uint256 _lenderLiquidationTokens = correspondingBorrowTokens(
            _lenderCollateralTokens,
            _poolFactory.priceOracle(),
            _poolFactory.liquidatorRewardFraction()
        );

        address _borrowAsset = poolConstants.borrowAsset;
        _deposit(_fromSavingsAccount, false, _borrowAsset, _lenderLiquidationTokens, _poolSavingsStrategy, msg.sender, _lender);
        _withdrawRepayment(_lender);
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
    ) external payable nonReentrant {
        _canLenderBeLiquidated(_lender);

        address _poolSavingsStrategy = poolConstants.poolSavingsStrategy;
        (uint256 _lenderCollateralLPShare, uint256 _lenderBalance) = _updateLenderSharesDuringLiquidation(_lender);

        uint256 _lenderCollateralTokens = _lenderCollateralLPShare;
        _lenderCollateralTokens = IYield(_poolSavingsStrategy).getTokensForShares(_lenderCollateralLPShare, poolConstants.collateralAsset);

        _liquidateForLender(_fromSavingsAccount, _lender, _lenderCollateralTokens);

        uint256 _amountReceived = _withdraw(
            _toSavingsAccount,
            _recieveLiquidityShare,
            poolConstants.collateralAsset,
            _poolSavingsStrategy,
            _lenderCollateralTokens
        );
        _burn(_lender, _lenderBalance);
        delete lenders[_lender];
        emit LenderLiquidated(msg.sender, _lender, _amountReceived);
    }

    /**
     * @notice used to get corresponding borrow tokens for given collateral tokens
     * @param _totalCollateralTokens amount of collateral tokens
     * @param _priceOracle address of the pool
     * @param _fraction Incentivizing fraction for the liquidator
     * @return corresponding borrow tokens for collateral tokens
     */
    function correspondingBorrowTokens(
        uint256 _totalCollateralTokens,
        address _priceOracle,
        uint256 _fraction
    ) public view returns (uint256) {
        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(_priceOracle).getLatestPrice(
            poolConstants.collateralAsset,
            poolConstants.borrowAsset
        );
        return _totalCollateralTokens.mul(_ratioOfPrices).div(10**_decimals).mul(uint256(10**30).sub(_fraction)).div(10**30);
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

    /**
     * @notice used to get the current repayment period for the borrow pool
     * @return current repayment period
     */
    function calculateCurrentPeriod() external view returns (uint256) {
        uint256 _currentPeriod = (block.timestamp.sub(poolConstants.loanStartTime, '34')).div(poolConstants.repaymentInterval);
        return _currentPeriod;
    }

    /**
     * @notice internal function used to get the withdrawable amount for a _lender
     * @param _lender address of the _lender
     * @return amount of withdrawable token from the borrow pool
     */
    function calculateRepaymentWithdrawable(address _lender) public view returns (uint256) {
        uint256 _totalRepaidAmount = IRepayment(IPoolFactory(poolFactory).repaymentImpl()).getTotalRepaidAmount(address(this));

        uint256 _amountWithdrawable = (balanceOf(_lender).mul(_totalRepaidAmount).div(totalSupply())).sub(
            lenders[_lender].effectiveInterestWithdrawn
        );

        return _amountWithdrawable;
    }

    /**
     * @notice used to get the withdrawable amount of borrow token for a lender
     */
    function withdrawRepayment() external isLender(msg.sender) nonReentrant {
        _withdrawRepayment(msg.sender);
    }

    /**
     * @notice internal function used to withdraw borrow asset from the pool by _lender
     * @param _lender address of the _lender
     */
    function _withdrawRepayment(address _lender) internal {
        uint256 _amountToWithdraw = calculateRepaymentWithdrawable(_lender);

        if (_amountToWithdraw == 0) {
            return;
        }
        lenders[_lender].effectiveInterestWithdrawn = lenders[_lender].effectiveInterestWithdrawn.add(_amountToWithdraw);

        SavingsAccountUtil.transferTokens(poolConstants.borrowAsset, _amountToWithdraw, address(this), _lender);
    }

    /**
     * @notice used to get the end time for a margin call
     * @param _lender address of the lender who has requested a margin call
     * @return the time at which the margin call ends
     */
    function getMarginCallEndTime(address _lender) public view override returns (uint256) {
        uint256 _marginCallDuration = IPoolFactory(poolFactory).marginCallDuration();
        uint256 _marginCallEndTime = lenders[_lender].marginCallEndTime;

        if (block.timestamp > _marginCallEndTime.add(_marginCallDuration.mul(2))) {
            _marginCallEndTime = 0;
        }
        return _marginCallEndTime;
    }

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
     * @notice used to receive ethers from savings accounts
     */
    receive() external payable {}

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
        (uint256 _price, uint256 _decimals) = IPriceOracle(IPoolFactory(poolFactory).priceOracle()).getLatestPrice(_source, _target);
        return _amount.mul(_price).div(10**_decimals);
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
}
