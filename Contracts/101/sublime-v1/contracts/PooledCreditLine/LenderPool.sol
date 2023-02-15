// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '../interfaces/ISavingsAccount.sol';
import '../interfaces/IYield.sol';
import '../interfaces/ILenderPool.sol';
import '../interfaces/IVerification.sol';
import '../interfaces/IPooledCreditLine.sol';
import '../interfaces/IPooledCreditLineEnums.sol';

/**
 * @title Contract that deals with pooling of capital from lenders
 * @notice Implements the functions related to lender pooling
 * @author Sublime
 **/

contract LenderPool is ERC1155Upgradeable, ReentrancyGuardUpgradeable, IPooledCreditLineEnums, ILenderPool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    //-------------------------------- Constants start --------------------------------//

    /**
     * @notice address of savings account
     */
    ISavingsAccount public immutable SAVINGS_ACCOUNT;
    /**
     * @notice address of pooled credit line
     */
    IPooledCreditLine public immutable POOLED_CREDIT_LINE;
    /**
     * @notice address of verification module
     */
    IVerification public immutable VERIFICATION;
    /*
     * @notice Factor with which certain variables/constants are multiplied to maintain precision
     */
    uint256 constant SCALING_FACTOR = 1e18;

    //-------------------------------- Constants end --------------------------------//

    //-------------------------------- State variables start --------------------------------//

    /**
     * @notice Struct that stores the interest withdrawn by the lender of a specific credit line
     * @param borrowerInterestSharesWithdrawn interest paid by borrower in shares, withdrawn by lender
     * @param yieldInterestWithdrawnShares interest from yield strategy withdrawn by lender
     */
    struct LenderInfo {
        uint256 borrowerInterestSharesWithdrawn;
        uint256 yieldInterestWithdrawnShares;
    }

    /**
     * @notice Struct that stores the constants of a pooled credit line
     * @param startTime Timestamp at which pooled credit line starts
     * @param borrowAsset address of token that is being lent by lenders & borrowed by borrower
     * @param collateralAsset address of token that is used as collateral deposited by the borrower
     * @param borrowLimit max tokens that was requested by borrower
     * @param minBorrowAmount min tokens that was requested by borrower
     * @param lenderVerifier address of verifier with which lenders should be verified to lend
     * @param borrowAssetStrategy address of strategy to deposit lent tokens to in savings account
     * @param areTokensTransferable boolean that represents if pool tokens for pooled credit line are transferable
     */
    struct LenderPoolConstants {
        uint256 startTime;
        address borrowAsset;
        address collateralAsset;
        uint256 borrowLimit;
        uint256 minBorrowAmount;
        address lenderVerifier;
        address borrowAssetStrategy;
        bool areTokensTransferable;
    }

    /**
     * @notice Struct that stores the variables of a pooled credit line
     * @param lenders mapping that stores lender specific info for the pooled credit line
     * @param sharesHeld total shares of borrow token held by the pooled credit line
              sharesHeld is set when the pcl is started and is equal to the shares equivalent to borrowLimit
              when any amount is borrowed sharedHeld is reduced and when interest is withdrawn sharesHeld is reduced
              when any amount is repaid sharedHeld is increased.
              if any liquidity is withdrawn by the lender after liquidation or closing of the pcl, sharesHeld is
              not changed.
     * @param borrowerInterestShares total interest in shares repaid by borrower
     * @param borrowerInterestSharesWithdrawn shares withdrawn from borrowerInterestShares
     * @param yieldInterestWithdrawnShares total yield interest in shares withdrawn by all lenders together
     * @param collateralHeld total collateral tokens held by pooled credit line in case of liquidation
     */
    struct LenderPoolVariables {
        mapping(address => LenderInfo) lenders;
        uint256 sharesHeld;
        uint256 borrowerInterestShares;
        uint256 borrowerInterestSharesWithdrawn;
        uint256 yieldInterestWithdrawnShares;
        uint256 collateralHeld;
    }

    /**
     * @notice Mapping that stores constants for pooledCreditLine against it's id
     */
    mapping(uint256 => LenderPoolConstants) public pooledCLConstants;
    /**
     * @notice Mapping that stores variables for pooledCreditLine against it's id
     */
    mapping(uint256 => LenderPoolVariables) public pooledCLVariables;
    /**
     * @notice Mapping that stores total pooledCreditLine token supply against the creditLineId
     * @dev Since ERC1155 tokens don't support the totalSupply function it is maintained here
     */
    mapping(uint256 => uint256) public totalSupply;

    //-------------------------------- State variables end --------------------------------//

    //-------------------------------- Modifiers start --------------------------------//

    /**
     * @notice Modifier that allows only pooled credit line to call a function
     */
    modifier onlyPooledCreditLine() {
        require(msg.sender == address(POOLED_CREDIT_LINE), 'LP:OPCL1');
        _;
    }

    //-------------------------------- Modifiers end --------------------------------//

    //-------------------------------- Events start --------------------------------//

    //--------------------------- LenderPool events start ---------------------------//

    /**
     * @notice Emitted when lender deposits tokens for pooled credit line
     * @param id identifier for the pooled credit line
     * @param user address of the user
     * @param amount amount of tokens lent by user
     */
    event Lend(uint256 indexed id, address indexed user, uint256 amount);
    /**
     * @notice Emitted when liquidity provided by lender is withdrawn when pool is not cancelled
     * @param id identifier for the pooled credit line
     * @param user address of the lender
     * @param shares amount of shares of liquidity provided initially by lender withdrawn
     */
    event WithdrawLiquidity(uint256 indexed id, address indexed user, uint256 shares);
    /**
     * @notice Emitted when liquidity provided by lender is withdrawn as pool is cancelled
     * @param id identifier for the pooled credit line
     * @param user address of the lender
     * @param amount amount of tokens lent by the user which is withdrawn on pooled credit line cancellation
     */
    event WithdrawLiquidityOnCancel(uint256 indexed id, address indexed user, uint256 amount);
    /**
     * @notice Emitted when interest by yield or/and borrower is withdrawn
     * @param id identifier for the pooled credit line
     * @param user address of the lender
     * @param shares shares withdrawn by lender from interest accrued by yield as well as supplied by borrower
     */
    event InterestWithdrawn(uint256 indexed id, address indexed user, uint256 shares);
    /**
     * @notice Emitted when a lender withdraws their share of liquidation
     * @param id identifier for the pooled credit line
     * @param user address of the lender
     * @param collateralShare share of collateral withdrawn by lender from liquidation
     */
    event LiquidationWithdrawn(uint256 indexed id, address indexed user, uint256 collateralShare);
    /**
     * @notice Emitted when a pooled credit line is liquidated by a lender
     * @param id identifier for the pooled credit line
     * @param collateralLiquidated amount of collateral that is received after liquidation
     */
    event Liquidated(uint256 indexed id, uint256 collateralLiquidated);

    //--------------------------- LenderPool events end ---------------------------//

    //-------------------------------- Events end --------------------------------//

    //-------------------------------- Init start --------------------------------//

    /**
     * @notice constructor to initialize immutable global variables
     * @param _pooledCreditLine address of pooled credit line contract
     * @param _savingsAccount address of savings account contract
     * @param _verification address of verification contract
     */
    constructor(
        address _pooledCreditLine,
        address _savingsAccount,
        address _verification
    ) {
        require(_pooledCreditLine != address(0), 'LP:C1');
        require(_savingsAccount != address(0), 'LP:C2');
        require(_verification != address(0), 'LP:C3');
        POOLED_CREDIT_LINE = IPooledCreditLine(_pooledCreditLine);
        SAVINGS_ACCOUNT = ISavingsAccount(_savingsAccount);
        VERIFICATION = IVerification(_verification);
    }

    /**
     * @notice initializes the contract in context of proxy
     */
    function initialize() external initializer {
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        __ERC1155_init('URI');
    }

    //-------------------------------- Init end --------------------------------//

    //-------------------------------- PCL creation start --------------------------------//

    /**
     * @notice function invoked when creating pooled credit line
     * @dev only pooled credit line can call the create function
     * @param _id identifier for the pooled credit line
     * @param _lenderVerifier address of verifier with which lenders should be verified to lend
     * @param _borrowAsset address of token that is being lent by lenders & borrowed by borrower
     * @param _borrowAssetStrategy address of strategy to deposit lent tokens to savings account
     * @param _borrowLimit max tokens that was requested by borrower
     * @param _minBorrowAmount min tokens that was requested by borrower
     * @param _collectionPeriod time for which tokens can be lent to pooled credit lines
     * @param _areTokensTransferable boolean that represents if pool tokens for credit line are transferable
     */
    function create(
        uint256 _id,
        address _lenderVerifier,
        address _borrowAsset,
        address _borrowAssetStrategy,
        uint256 _borrowLimit,
        uint256 _minBorrowAmount,
        uint256 _collectionPeriod,
        bool _areTokensTransferable
    ) external override nonReentrant onlyPooledCreditLine {
        pooledCLConstants[_id].startTime = block.timestamp.add(_collectionPeriod);
        pooledCLConstants[_id].borrowAsset = _borrowAsset;
        pooledCLConstants[_id].borrowLimit = _borrowLimit;
        pooledCLConstants[_id].minBorrowAmount = _minBorrowAmount;
        pooledCLConstants[_id].lenderVerifier = _lenderVerifier;
        pooledCLConstants[_id].borrowAssetStrategy = _borrowAssetStrategy;
        pooledCLConstants[_id].areTokensTransferable = _areTokensTransferable;

        uint256 allowance = SAVINGS_ACCOUNT.allowance(address(this), _borrowAsset, address(POOLED_CREDIT_LINE));
        if (allowance != type(uint256).max) {
            SAVINGS_ACCOUNT.approve(_borrowAsset, address(POOLED_CREDIT_LINE), type(uint256).max);
        }
    }

    //-------------------------------- PCL creation end --------------------------------//

    //-------------------------------- Lend & accept start --------------------------------//

    /**
     * @notice Function used by lenders to lend to pooled credit line
     * @dev lent amount is deposited to savings account only once borrow limit is reached or if start is called
     * @param _id identifier for the pooled credit line
     * @param _amount amount of borrow tokens to lend
     */
    function lend(uint256 _id, uint256 _amount) external nonReentrant {
        require(_amount != 0, 'LP:L1');
        require(VERIFICATION.isUser(msg.sender, pooledCLConstants[_id].lenderVerifier), 'LP:L2');
        require(block.timestamp < pooledCLConstants[_id].startTime, 'LP:L3');

        uint256 _totalLent = totalSupply[_id];
        uint256 _maxLent = pooledCLConstants[_id].borrowLimit;
        require(_maxLent > _totalLent, 'LP:L4');

        uint256 _amountToLend = _amount;
        if (_totalLent.add(_amount) > _maxLent) {
            _amountToLend = _maxLent.sub(_totalLent);
        }
        address _borrowAsset = pooledCLConstants[_id].borrowAsset;

        IERC20(_borrowAsset).safeTransferFrom(msg.sender, address(this), _amountToLend);
        _mint(msg.sender, _id, _amountToLend, '');

        emit Lend(_id, msg.sender, _amountToLend);
    }

    /**
     * @notice function used to start the pooled credit line once the start time is reached
     * @dev this function needs to be called by the borrower
     * @param _id identifier for the pooled credit line
     */
    function start(uint256 _id) external override nonReentrant {
        uint256 _startTime = pooledCLConstants[_id].startTime;
        require(_startTime != 0, 'LP:S1');
        // PCL can be started once the collection period is over
        require(block.timestamp >= _startTime, 'LP:S2');
        // PCL cannot be started once it has ended
        // PCL remains in the REQUESTED stage if it is not started
        // check _withdrawLiquidity method to see how these cases are handled
        require(block.timestamp < POOLED_CREDIT_LINE.getEndsAt(_id), 'LP:S3');

        uint256 _totalLent = totalSupply[_id];
        require(_totalLent >= pooledCLConstants[_id].minBorrowAmount, 'LP:S4');

        _accept(_id, _totalLent);
    }

    function _accept(uint256 _id, uint256 _amount) private {
        address _borrowAsset = pooledCLConstants[_id].borrowAsset;
        address _strategy = pooledCLConstants[_id].borrowAssetStrategy;
        IERC20(_borrowAsset).safeApprove(_strategy, _amount);
        pooledCLVariables[_id].sharesHeld = SAVINGS_ACCOUNT.deposit(_borrowAsset, _strategy, address(this), _amount);

        // If msg.sender is not borrower, then tx is rejected
        POOLED_CREDIT_LINE.accept(_id, _amount, msg.sender);

        pooledCLConstants[_id].borrowLimit = _amount;
        delete pooledCLConstants[_id].startTime;
        delete pooledCLConstants[_id].minBorrowAmount;
    }

    //-------------------------------- Lend & accept end --------------------------------//

    //-------------------------------- callbacks start --------------------------------//

    /**
     * @notice Function invoked on borrow from the pooled credit line
     * @dev only pooledCreditLineContract can invoke
     * @param _id identifier for the pooled credit line
     * @param _sharesBorrowed amount of shares borrowed
     */
    function borrowed(uint256 _id, uint256 _sharesBorrowed) external override nonReentrant onlyPooledCreditLine {
        pooledCLVariables[_id].sharesHeld = pooledCLVariables[_id].sharesHeld.sub(_sharesBorrowed);
    }

    /**
     * @notice Function invoked when repayment is done to pooled credit line
     * @dev only pooledCreditLineContract can invoke
     * @param _id identifier for the pooled credit line
     * @param _sharesRepaid shares repaid
     * @param _interestShares interest in shares repaid
     */
    function repaid(
        uint256 _id,
        uint256 _sharesRepaid,
        uint256 _interestShares
    ) external override nonReentrant onlyPooledCreditLine {
        pooledCLVariables[_id].sharesHeld = pooledCLVariables[_id].sharesHeld.add(_sharesRepaid);
        pooledCLVariables[_id].borrowerInterestShares = pooledCLVariables[_id].borrowerInterestShares.add(_interestShares);
    }

    /**
     * @notice Function invoked when pooled credit line is cancelled
     * @dev only pooledCreditLineContract can invoke
     * @param _id identifier for the pooled credit line
     */
    function requestCancelled(uint256 _id) external override onlyPooledCreditLine {
        // We want *function lend* to fail, so that lenders do not keep on lending even after the CL is cancelled.
        delete pooledCLConstants[_id].startTime;

        // After this, we cannot delete *pooledCLConstants[_id]*, else we risk getting stuck with some of the lenders'
        // liquidity inside of this contract. Therefore, after this, the user must themselves call *withdrawLiquidity*
    }

    /**
     * @notice Function invoked when pooled credit line is terminated by admin
     * @dev only pooledCreditLineContract can invoke
     * @param _id identifier for the pooled credit line
     * @param _to address to which all the borrow tokens are transferred
     */
    function terminate(uint256 _id, address _to) external override nonReentrant onlyPooledCreditLine {
        address _strategy = pooledCLConstants[_id].borrowAssetStrategy;
        address _borrowAsset = pooledCLConstants[_id].borrowAsset;
        // this is the maximum amount which can be borrowed from the PCL
        uint256 _borrowedTokens = pooledCLConstants[_id].borrowLimit;
        // the borrower has not borrowed this much amount yet
        // for eg: _borrowedLimit is 1000 DAI and the amount borrowed is 90 DAI
        // also _notBorrowed == _borrowedLimit when the PCL has not started
        uint256 _notBorrowed = _borrowedTokens.sub(POOLED_CREDIT_LINE.getPrincipal(_id));
        uint256 _notBorrowedInShares = IYield(_strategy).getSharesForTokens(_notBorrowed, _borrowAsset);
        uint256 _sharesHeld = pooledCLVariables[_id].sharesHeld;
        if (_sharesHeld != 0) {
            uint256 _totalInterestInShares = _sharesHeld.sub(_notBorrowedInShares);
            // the amount of _borrowAsset deposited by lenders against the PCL is equal to totalSupply[_id]
            // when the PCL is active totalSupply[_id] == _borrowedLimit
            // but _borrowLimit is some cases can be different than totalSupply[_id]
            // for eg: before the PCL has started the borrowLimit asked by borrower is 1000 DAI
            // but the lenders have only deposited 900 DAI till now so totalSupply[_id] is 900 DAI
            // another eg is when the PCL has already been liquidated and some lenders have withdrawn the funds
            // in this case too _borrowedLimit is greater than the totalSupply[_id]
            // we multiply _notBorrowedInShares with the ratio of totalSupply[_id]/_borrowLimit
            // this is done to get the _actualNotBorrowedInShares which might be less than the
            // _notBorrowedInShares because of totalSupply[_id] being less than _borrowedLimit
            uint256 _actualNotBorrowedInShares = _notBorrowedInShares.mul(totalSupply[_id]).div(_borrowedTokens);
            // shareWithdrawable = _actualNotBorrowedInShares + _totalInterestInShares
            // _totalInterestInShares is not adjusted for change in totalSupply[_id] because
            // no withdrawal of the principal fund deposited in the PCL can happen when it is active
            // interest withdrawn from the PCL has already been deducted from sharesHeld
            // interest (borrow + yield) come into the picture only after the PCL was activated in its lifetime
            // borrowInterest is accrued only when PCL is active
            // yield interest is accrued funds are deposited in the _strategy contract and is intrinsic to the shares
            // any change in the totalSupply[_id] on does affect the interest shares in the PCL
            uint256 _totalBorrowAsset = _actualNotBorrowedInShares.add(_totalInterestInShares);
            if (_totalBorrowAsset != 0) {
                SAVINGS_ACCOUNT.withdrawShares(_borrowAsset, _strategy, _to, _totalBorrowAsset, false);
            }
        }

        uint256 _collateralHeld = pooledCLVariables[_id].collateralHeld;
        if (_collateralHeld != 0) {
            // transferring the collateral that is transferred to Lender pool to distribute among lenders as part of liquidation
            IERC20(pooledCLConstants[_id].collateralAsset).safeTransfer(_to, _collateralHeld);
        }
        delete pooledCLConstants[_id];
        delete pooledCLVariables[_id];
    }

    //-------------------------------- callbacks end --------------------------------//

    //-------------------------------- Interest start --------------------------------//

    /**
     * @notice Function used to withdraw interest repaid by the borrower and
               the yield interest generated by the borrow assets deposited in the strategy
     * @dev Tokens lent are locked till end of Pooled Credit line. 
            Any interest paid by borrower can be withdrawn by lenders proportional to
            their token balances for that pooled credit line. Partial withdrawal of
            interest is not allowed. Whenever they call the `withdrawInterest` function
            they will get the entire amount of interest that is owed to them by that time
     * @param _id identifier for the pooled credit line
     */
    function withdrawInterest(uint256 _id) external nonReentrant {
        uint256 _interestSharesWithdrawn = _withdrawInterest(_id, msg.sender);
        require(_interestSharesWithdrawn != 0, 'LP:WI1');
    }

    function _withdrawInterest(uint256 _id, address _lender) private returns (uint256 _interestSharesWithdrawn) {
        address _strategy = pooledCLConstants[_id].borrowAssetStrategy;
        address _borrowAsset = pooledCLConstants[_id].borrowAsset;
        // this checks if the constants are not deleted
        require(_strategy != address(0), 'LP:IWI1');

        uint256 _interestSharesToWithdraw = _updateInterestSharesToWithdraw(_id, _lender, _strategy, _borrowAsset);

        if (_interestSharesToWithdraw != 0) {
            pooledCLVariables[_id].sharesHeld = pooledCLVariables[_id].sharesHeld.sub(_interestSharesToWithdraw);
            SAVINGS_ACCOUNT.withdrawShares(_borrowAsset, _strategy, _lender, _interestSharesToWithdraw, false);
            emit InterestWithdrawn(_id, _lender, _interestSharesToWithdraw);
        }

        return _interestSharesToWithdraw;
    }

    /*
     * @dev this function updates the interest shares withdrawn by the lender.
            interest shares are of 2 types
            - borrowerInterestSharesWithdrawn: this is the interest paid by the borrower and withdrawn by the lender
            - yieldInterestWithdrawnShares: this is the interest accrued from the yield strategy and withdrawn by the lender
     */
    function _updateInterestSharesToWithdraw(
        uint256 _id,
        address _lender,
        address _strategy,
        address _borrowAsset
    ) private returns (uint256) {
        uint256 _lenderBalance = balanceOf(_lender, _id);
        if (_lenderBalance == 0) {
            return 0;
        }

        uint256 _borrowLimit = pooledCLConstants[_id].borrowLimit;
        (uint256 _borrowerInterestSharesForLender, uint256 _yieldInterestSharesForLender) = _calculateLenderInterest(
            _id,
            _lender,
            _strategy,
            _borrowAsset,
            _lenderBalance,
            _borrowLimit
        );

        if (_borrowerInterestSharesForLender != 0) {
            pooledCLVariables[_id].lenders[_lender].borrowerInterestSharesWithdrawn = pooledCLVariables[_id]
                .lenders[_lender]
                .borrowerInterestSharesWithdrawn
                .add(_borrowerInterestSharesForLender);
            pooledCLVariables[_id].borrowerInterestSharesWithdrawn = pooledCLVariables[_id].borrowerInterestSharesWithdrawn.add(
                _borrowerInterestSharesForLender
            );
        }

        if (_yieldInterestSharesForLender != 0) {
            pooledCLVariables[_id].lenders[_lender].yieldInterestWithdrawnShares = pooledCLVariables[_id]
                .lenders[_lender]
                .yieldInterestWithdrawnShares
                .add(_yieldInterestSharesForLender);
            pooledCLVariables[_id].yieldInterestWithdrawnShares = pooledCLVariables[_id].yieldInterestWithdrawnShares.add(
                _yieldInterestSharesForLender
            );
        }

        return _yieldInterestSharesForLender.add(_borrowerInterestSharesForLender);
    }

    /**
     * @notice Function used to get interest withdrawable by a lender in pooled credit line.
               the interest this function returns is a sum of borrowerInterest + yieldInterest
               borrower interest is the interest paid by the borrower
               yield interest is the interest generated by the yield strategy
     * @dev it is a view function as far as the Pooled credit lines are concerned and doesn't 
            make any state changes except for getSharesForTokens and getTokensForShares in yield
     * @param _lender address of lender for whom interest is withdrawn
     */
    function getLenderInterestWithdrawable(uint256 _id, address _lender) external returns (uint256) {
        address _strategy = pooledCLConstants[_id].borrowAssetStrategy;
        address _borrowAsset = pooledCLConstants[_id].borrowAsset;
        // get borrower repayments and yield interest shares
        (uint256 _borrowerInterestShares, uint256 _yieldInterestShares) = _calculateLenderInterest(
            _id,
            _lender,
            _strategy,
            _borrowAsset,
            balanceOf(_lender, _id),
            pooledCLConstants[_id].borrowLimit
        );
        // convert total interest shares into tokens and return
        return IYield(_strategy).getTokensForShares(_borrowerInterestShares.add(_yieldInterestShares), _borrowAsset);
    }

    function _calculateLenderInterest(
        uint256 _id,
        address _lender,
        address _strategy,
        address _borrowAsset,
        uint256 _lenderBalance,
        uint256 _borrowLimit
    ) private returns (uint256 _borrowerInterestSharesForLender, uint256 _yieldInterestSharesForLender) {
        uint256 _totalInterestWithdrawableInShares;
        {
            uint256 _sharesHeld = pooledCLVariables[_id].sharesHeld;
            // _sharesHeld is set in the _accept method
            // _sharesHeld == 0 is in these PCL stages: not created, requested, cancelled and terminated
            if (_sharesHeld == 0) {
                return (0, 0);
            }
            uint256 _notBorrowed = _borrowLimit.sub(POOLED_CREDIT_LINE.getPrincipal(_id));
            uint256 _notBorrowedInShares = IYield(_strategy).getSharesForTokens(_notBorrowed, _borrowAsset);
            _totalInterestWithdrawableInShares = _sharesHeld.sub(_notBorrowedInShares);
        }
        uint256 _borrowerInterestShares = pooledCLVariables[_id].borrowerInterestShares;
        _borrowerInterestSharesForLender = (_borrowerInterestShares.mul(_lenderBalance).div(_borrowLimit)).sub(
            pooledCLVariables[_id].lenders[_lender].borrowerInterestSharesWithdrawn
        );

        {
            uint256 _borrowerInterestWithdrawableInShares = _borrowerInterestShares.sub(
                pooledCLVariables[_id].borrowerInterestSharesWithdrawn
            );
            // _notBorrowed is converted to _notBorrowedInShares using the current exchange rate
            // The difference in _sharesHeld and (_notBorrowedInShares + shares withdrawn)
            // is the _totalYieldInterest
            _yieldInterestSharesForLender = 0;
            if (_totalInterestWithdrawableInShares > _borrowerInterestWithdrawableInShares) {
                uint256 _totalYieldInterestShares = _totalInterestWithdrawableInShares.sub(_borrowerInterestWithdrawableInShares).add(
                    pooledCLVariables[_id].yieldInterestWithdrawnShares
                );
                _yieldInterestSharesForLender = (_totalYieldInterestShares.mul(_lenderBalance).div(_borrowLimit)).sub(
                    pooledCLVariables[_id].lenders[_lender].yieldInterestWithdrawnShares
                );
            }
        }
    }

    //-------------------------------- Interest end --------------------------------//

    //-------------------------------- Liquidity withdraw start --------------------------------//

    /**
     * @notice Function to withdraw liquidity by lender
     * @dev Liquidity can be withdrawn when the pooled credit line in the following scenarios
            - pcl is cancelled by the borrower
            - pcl gets cancelled because because desired amount wasn't reached
            - pcl gets cancelled because it was never started by the borrower and endTime has reached
            - pcl is liquidated before the endTime has reached
            - pcl is liquidated after the endTime has reached
            - pcl is closed after all repayments
           in the other cases this function reverts
     * @param _id identifier for the pooled credit line
     */

    function withdrawLiquidity(uint256 _id) external nonReentrant {
        _withdrawLiquidity(_id, false);
    }

    function _withdrawLiquidity(uint256 _id, bool _isLiquidationWithdrawn) private {
        uint256 _liquidityProvided = balanceOf(msg.sender, _id);
        require(_liquidityProvided != 0, 'LP:IWL1');

        PooledCreditLineStatus _status = POOLED_CREDIT_LINE.getStatusAndUpdate(_id);

        address _borrowAsset = pooledCLConstants[_id].borrowAsset;

        if (_status == PooledCreditLineStatus.REQUESTED) {
            if (block.timestamp >= pooledCLConstants[_id].startTime && totalSupply[_id] < pooledCLConstants[_id].minBorrowAmount) {
                POOLED_CREDIT_LINE.cancelRequestOnLowCollection(_id);
            } else if (block.timestamp >= POOLED_CREDIT_LINE.getEndsAt(_id)) {
                POOLED_CREDIT_LINE.cancelRequestOnRequestedStateAtEnd(_id);
            } else {
                revert('LP:IWL3');
            }
            _status = PooledCreditLineStatus.CANCELLED;
            delete pooledCLConstants[_id].startTime;
        }

        if (_status == PooledCreditLineStatus.CANCELLED) {
            // Case 0:
            // Credit Line request was cancelled by the borrower, which deletes the creditLineVariables, hence status = uint256(0)
            // Cancellation can only be done in the REQUESTED state, therefore, the borrowLimit target was also not met
            // &&
            // Case 1: Pooled credit line never started because desired amount wasn't reached
            // _maxToLend is 0 if credit line is accepted so this case is never run

            //transfer liquidity provided
            IERC20(_borrowAsset).safeTransfer(msg.sender, _liquidityProvided);
            emit WithdrawLiquidityOnCancel(_id, msg.sender, _liquidityProvided);
        } else if (_status == PooledCreditLineStatus.CLOSED || _status == PooledCreditLineStatus.LIQUIDATED) {
            if (_status == PooledCreditLineStatus.LIQUIDATED) {
                // _isLiquidationWithdrawn is true when _withdrawLiquidity is called from within
                // withdrawTokensAfterLiquidation which means the lender is withdrawing all assets after the PCL
                // has been liquidated. Once PCL has been liquidated lender cannot call withdrawLiquidity directly
                require(_isLiquidationWithdrawn, 'LP:IWL2');
            }
            // all other cases distribute the sharesHeld proportional to their poolToken balances
            address _strategy = pooledCLConstants[_id].borrowAssetStrategy;
            uint256 _principalWithdrawable = _calculatePrincipalWithdrawable(_id, msg.sender);
            uint256 _interestSharesWithdrawable = _updateInterestSharesToWithdraw(_id, msg.sender, _strategy, _borrowAsset);
            uint256 _interestWithdrawable;
            if (_interestSharesWithdrawable != 0) {
                _interestWithdrawable = IYield(_strategy).getTokensForShares(_interestSharesWithdrawable, _borrowAsset);
                pooledCLVariables[_id].sharesHeld = pooledCLVariables[_id].sharesHeld.sub(_interestSharesWithdrawable);
            }
            uint256 _amountToWithdraw = _principalWithdrawable.add(_interestWithdrawable);
            uint256 _sharesToWithdraw = IYield(_strategy).getSharesForTokens(_amountToWithdraw, _borrowAsset);
            if (_sharesToWithdraw != 0) {
                SAVINGS_ACCOUNT.withdrawShares(_borrowAsset, _strategy, msg.sender, _sharesToWithdraw, false);
            }
            emit WithdrawLiquidity(_id, msg.sender, _sharesToWithdraw);
        } else {
            revert('LP:IWL3');
        }

        _burn(msg.sender, _id, _liquidityProvided);
    }

    /**
     * @notice Function that can be used to calculate principal withdrawable
     * @param _id identifier for the pooled credit line
     * @param _lender lender whose share of principal is to be withdrawn
     * @return Principal withdrawable
     */
    function calculatePrincipalWithdrawable(uint256 _id, address _lender) external returns (uint256) {
        PooledCreditLineStatus _status = POOLED_CREDIT_LINE.getStatusAndUpdate(_id);
        if (_status == PooledCreditLineStatus.CLOSED || _status == PooledCreditLineStatus.LIQUIDATED) {
            return _calculatePrincipalWithdrawable(_id, _lender);
        } else if (
            _status == PooledCreditLineStatus.CANCELLED ||
            (_status == PooledCreditLineStatus.REQUESTED &&
                ((block.timestamp >= pooledCLConstants[_id].startTime && totalSupply[_id] < pooledCLConstants[_id].minBorrowAmount) ||
                    block.timestamp >= POOLED_CREDIT_LINE.getEndsAt(_id)))
        ) {
            // this else if block covers the conditions when PCL was cancelled OR
            // the PCL was in requested stage but never started
            return balanceOf(_lender, _id);
        } else {
            return 0;
        }
    }

    /*
    * @dev returns the amount of principal the lender can withdraw after the pcl has been liquidated or closed
           this value is equal to (total lent amount - principal borrowed) * lenders lp balance / total lent amount
    */
    function _calculatePrincipalWithdrawable(uint256 _id, address _lender) private view returns (uint256) {
        uint256 _borrowedTokens = pooledCLConstants[_id].borrowLimit;
        uint256 _totalLiquidityWithdrawable = _borrowedTokens.sub(POOLED_CREDIT_LINE.getPrincipal(_id));
        uint256 _principalWithdrawable = _totalLiquidityWithdrawable.mul(balanceOf(_lender, _id)).div(_borrowedTokens);
        return _principalWithdrawable;
    }

    //-------------------------------- Liquidity withdraw end --------------------------------//

    //-------------------------------- Liquidation start --------------------------------//

    /**
     * @notice Function used to liquidate a pooled credit line
     * @dev only one of the lenders can liquidate their pooled credit line
     * @param _id identifier for the pooled credit line
     * @param _withdraw flag used to identify if lender's share of
              liquidated collateral and liquidity (amount lent + interest) is also withdrawn
     */
    function liquidate(uint256 _id, bool _withdraw) external nonReentrant {
        uint256 _lendingShare = balanceOf(msg.sender, _id);
        require(_lendingShare != 0, 'LP:LIQ1');
        // This line would call the liquidate function in the pooledCreditLine contract.
        // Which would transfer the totalCollateralTokens to the pooledCreditLine contract.
        (address _collateralAsset, uint256 _collateralLiquidated) = POOLED_CREDIT_LINE.liquidate(_id);
        pooledCLConstants[_id].collateralAsset = _collateralAsset;
        pooledCLVariables[_id].collateralHeld = _collateralLiquidated;

        emit Liquidated(_id, _collateralLiquidated);

        if (_withdraw) {
            // This function would give the share of the lender who called this function from the total liquidated amount
            // this will withdraw both the _collateralAsset and the borrowAsset
            _withdrawTokensAfterLiquidation(_id, _lendingShare);
        }
    }

    /**
     * @notice Function used to withdraw lender's share of liquidated collateral and the borrowAsset
     * @param _id identifier for the pooled credit line
     */
    function withdrawTokensAfterLiquidation(uint256 _id) external nonReentrant {
        uint256 _lendingShare = balanceOf(msg.sender, _id);
        require(_lendingShare != 0, 'LP:WLC1');
        _withdrawTokensAfterLiquidation(_id, _lendingShare);
    }

    function _withdrawTokensAfterLiquidation(uint256 _id, uint256 _balance) private {
        address _collateralAsset = pooledCLConstants[_id].collateralAsset;
        require(_collateralAsset != address(0), 'LP:IWLC1');
        uint256 _collateralLiquidated = pooledCLVariables[_id].collateralHeld;
        uint256 _currentSupply = totalSupply[_id];

        uint256 _lenderCollateralShare = _balance.mul(_collateralLiquidated).div(_currentSupply);

        if (_lenderCollateralShare != 0) {
            pooledCLVariables[_id].collateralHeld = pooledCLVariables[_id].collateralHeld.sub(_lenderCollateralShare);

            IERC20(_collateralAsset).safeTransfer(msg.sender, _lenderCollateralShare);
            emit LiquidationWithdrawn(_id, msg.sender, _lenderCollateralShare);
        }
        // this will withdraw the lender's share of liquidity (amount lent + interest)
        _withdrawLiquidity(_id, true);
    }

    //-------------------------------- Liquidation end --------------------------------//

    //-------------------------------- Pre token transfer start --------------------------------//

    function _beforeTokenTransfer(
        address,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory
    ) internal override {
        require(from != to, 'LP:IT1');
        for (uint256 i; i < ids.length; ++i) {
            uint256 id = ids[i];
            if (to != address(0)) {
                // cannot transfer to the borrower
                require(to != POOLED_CREDIT_LINE.getBorrowerAddress(id), 'LP:IT2');
                // cannot transfer to a non verified user
                require(VERIFICATION.isUser(to, pooledCLConstants[id].lenderVerifier), 'LP:IT3');
            }

            uint256 amount = amounts[i];

            if (from == address(0)) {
                // this is the case for minting tokens
                // increase the total supply of lp tokens
                totalSupply[id] = totalSupply[id].add(amount);
            } else if (to == address(0)) {
                // this is the case for burn
                // reduce the total supply of lp tokens
                uint256 supply = totalSupply[id];
                require(supply >= amount, 'LP:IT4');
                totalSupply[id] = supply - amount;
            } else {
                // case for user to user transfer
                require(pooledCLConstants[id].areTokensTransferable, 'LP:IT5');
            }

            if (from != address(0)) {
                // we need to transfer the lender info from to the receiving address
                _rebalanceInterestWithdrawn(id, amount, from, to);
            }
        }
    }

    function _rebalanceInterestWithdrawn(
        uint256 id,
        uint256 amount,
        address from,
        address to
    ) private {
        if (from != address(0) && to != address(0)) {
            // if the transfer is from user to user, we will withdraw all the interest for the user
            // this is done because we need to transfer the lender info
            // if the interest is not withdrawn the [from] user will not be able to withdraw the interest owned to them
            _withdrawInterest(id, from);
            _withdrawInterest(id, to);
        }

        uint256 fromBalance = balanceOf(from, id);
        require(fromBalance != 0, 'LP:IRIW1');

        uint256 yieldInterestOnTransferAmount = pooledCLVariables[id].lenders[from].yieldInterestWithdrawnShares.mul(amount).div(
            fromBalance
        );
        uint256 borrowerInterestOnTransferAmount = pooledCLVariables[id].lenders[from].borrowerInterestSharesWithdrawn.mul(amount).div(
            fromBalance
        );

        if (borrowerInterestOnTransferAmount != 0) {
            pooledCLVariables[id].lenders[from].borrowerInterestSharesWithdrawn = pooledCLVariables[id]
                .lenders[from]
                .borrowerInterestSharesWithdrawn
                .sub(borrowerInterestOnTransferAmount);
        }

        if (yieldInterestOnTransferAmount != 0) {
            pooledCLVariables[id].lenders[from].yieldInterestWithdrawnShares = pooledCLVariables[id]
                .lenders[from]
                .yieldInterestWithdrawnShares
                .sub(yieldInterestOnTransferAmount);
        }

        if (to != address(0)) {
            if (borrowerInterestOnTransferAmount != 0) {
                pooledCLVariables[id].lenders[to].borrowerInterestSharesWithdrawn = pooledCLVariables[id]
                    .lenders[to]
                    .borrowerInterestSharesWithdrawn
                    .add(borrowerInterestOnTransferAmount);
            }
            if (yieldInterestOnTransferAmount != 0) {
                pooledCLVariables[id].lenders[to].yieldInterestWithdrawnShares = pooledCLVariables[id]
                    .lenders[to]
                    .yieldInterestWithdrawnShares
                    .add(yieldInterestOnTransferAmount);
            }
        }
    }

    //-------------------------------- Pre token transfer end --------------------------------//

    //-------------------------------- getters start --------------------------------//

    /**
     * @notice Function used to get withdrawal info of a lender for a specific pooled credit line
     * @param _id identifier for the pooled credit line
     * @param _lender address of the lender for which query is made
     * @return returns lender info
     */
    function getLenderInfo(uint256 _id, address _lender) external view returns (LenderInfo memory) {
        return pooledCLVariables[_id].lenders[_lender];
    }

    //-------------------------------- getters end --------------------------------//
}
