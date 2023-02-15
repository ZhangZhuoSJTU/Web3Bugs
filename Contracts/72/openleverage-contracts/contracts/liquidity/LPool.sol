// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;


import "./LPoolInterface.sol";
import "./LPoolDepositor.sol";
import "../lib/Exponential.sol";
import "../Adminable.sol";
import "../lib/CarefulMath.sol";
import "../lib/TransferHelper.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../DelegateInterface.sol";
import "../ControllerInterface.sol";
import "../IWETH.sol";

/// @title OpenLeverage's LToken Contract
/// @dev Abstract base for LTokens
/// @author OpenLeverage
contract LPool is DelegateInterface, Adminable, LPoolInterface, Exponential, ReentrancyGuard {
    using TransferHelper for IERC20;
    using SafeMath for uint;

    constructor() {

    }
    
    /// @notice Initialize the money market
    /// @param controller_ The address of the Controller
    /// @param baseRatePerBlock_ The base interest rate which is the y-intercept when utilization rate is 0
    /// @param multiplierPerBlock_ The multiplier of utilization rate that gives the slope of the interest rate
    /// @param jumpMultiplierPerBlock_ The multiplierPerBlock after hitting a specified utilization point
    /// @param kink_ The utilization point at which the jump multiplier is applied
    /// @param initialExchangeRateMantissa_ The initial exchange rate, scaled by 1e18
    /// @param name_ EIP-20 name of this token
    /// @param symbol_ EIP-20 symbol of this token
    /// @param decimals_ EIP-20 decimal precision of this token
    function initialize(
        address underlying_,
        bool isWethPool_,
        address controller_,
        uint256 baseRatePerBlock_,
        uint256 multiplierPerBlock_,
        uint256 jumpMultiplierPerBlock_,
        uint256 kink_,
        uint initialExchangeRateMantissa_,
        string memory name_,
        string memory symbol_,
        uint8 decimals_) public {
        require(underlying_ != address(0), "underlying_ address cannot be 0");
        require(controller_ != address(0), "controller_ address cannot be 0");
        require(msg.sender == admin, "Only allow to be called by admin");
        require(accrualBlockNumber == 0 && borrowIndex == 0, "inited once");

        // Set initial exchange rate
        initialExchangeRateMantissa = initialExchangeRateMantissa_;
        require(initialExchangeRateMantissa > 0, "Initial Exchange Rate Mantissa should be greater zero");
        //set controller
        controller = controller_;
        isWethPool = isWethPool_;
        //set interestRateModel
        baseRatePerBlock = baseRatePerBlock_;
        multiplierPerBlock = multiplierPerBlock_;
        jumpMultiplierPerBlock = jumpMultiplierPerBlock_;
        kink = kink_;

        // Initialize block number and borrow index (block number mocks depend on controller being set)
        accrualBlockNumber = getBlockNumber();
        borrowIndex = 1e25;
        //80%
        borrowCapFactorMantissa = 0.8e18;
        //10%
        reserveFactorMantissa = 0.1e18;


        name = name_;
        symbol = symbol_;
        decimals = decimals_;

        _notEntered = true;

        // Set underlying and sanity check it
        underlying = underlying_;
        IERC20(underlying).totalSupply();
        emit Transfer(address(0), msg.sender, 0);
    }

    /// @notice Transfer `tokens` tokens from `src` to `dst` by `spender`
    /// @dev Called by both `transfer` and `transferFrom` internally
    /// @param spender The address of the account performing the transfer
    /// @param src The address of the source account
    /// @param dst The address of the destination account
    /// @param tokens The number of tokens to transfer
    /// @return Whether or not the transfer succeeded
    function transferTokens(address spender, address src, address dst, uint tokens) internal returns (bool) {
        require(dst != address(0), "dst address cannot be 0");
        /* Do not allow self-transfers */
        require(src != dst, "src = dst");
        /* Fail if transfer not allowed */
        (ControllerInterface(controller)).transferAllowed(src, dst, tokens);

        /* Get the allowance, infinite for the account owner */
        uint startingAllowance = 0;
        if (spender == src) {
            startingAllowance = uint(- 1);
        } else {
            startingAllowance = transferAllowances[src][spender];
        }

        /* Do the calculations, checking for {under,over}flow */
        MathError mathErr;
        uint allowanceNew;
        uint srcTokensNew;
        uint dstTokensNew;

        (mathErr, allowanceNew) = subUInt(startingAllowance, tokens);
        require(mathErr == MathError.NO_ERROR, 'not allowed');

        (mathErr, srcTokensNew) = subUInt(accountTokens[src], tokens);
        require(mathErr == MathError.NO_ERROR, 'not enough');

        (mathErr, dstTokensNew) = addUInt(accountTokens[dst], tokens);
        require(mathErr == MathError.NO_ERROR, 'too much');

        accountTokens[src] = srcTokensNew;
        accountTokens[dst] = dstTokensNew;

        /* Eat some of the allowance (if necessary) */
        if (startingAllowance != uint(- 1)) {
            transferAllowances[src][spender] = allowanceNew;
        }
        /* We emit a Transfer event */
        emit Transfer(src, dst, tokens);
        return true;
    }

    /// @notice Transfer `amount` tokens from `msg.sender` to `dst`
    /// @param dst The address of the destination account
    /// @param amount The number of tokens to transfer
    /// @return Whether or not the transfer succeeded
    function transfer(address dst, uint256 amount) external override nonReentrant returns (bool) {
        return transferTokens(msg.sender, msg.sender, dst, amount);
    }

    /// @notice Transfer `amount` tokens from `src` to `dst`
    /// @param src The address of the source account
    /// @param dst The address of the destination account
    /// @param amount The number of tokens to transfer
    /// @return Whether or not the transfer succeeded
    function transferFrom(address src, address dst, uint256 amount) external override nonReentrant returns (bool) {
        return transferTokens(msg.sender, src, dst, amount);
    }

    /// @notice Approve `spender` to transfer up to `amount` from `src`
    /// @dev This will overwrite the approval amount for `spender`
    ///  and is subject to issues noted [here](https://eips.ethereum.org/EIPS/eip-20#approve)
    /// @param spender The address of the account which may transfer tokens
    /// @param amount The number of tokens that are approved (-1 means infinite)
    /// @return Whether or not the approval succeeded
    function approve(address spender, uint256 amount) external override returns (bool) {
        address src = msg.sender;
        transferAllowances[src][spender] = amount;
        emit Approval(src, spender, amount);
        return true;
    }

    /// @notice Get the current allowance from `owner` for `spender`
    /// @param owner The address of the account which owns the tokens to be spent
    /// @param spender The address of the account which may transfer tokens
    /// @return The number of tokens allowed to be spent (-1 means infinite)
    function allowance(address owner, address spender) external override view returns (uint256) {
        return transferAllowances[owner][spender];
    }

    /// @notice Get the token balance of the `owner`
    /// @param owner The address of the account to query
    /// @return The number of tokens owned by `owner`
    function balanceOf(address owner) external override view returns (uint256) {
        return accountTokens[owner];
    }

    /// @notice Get the underlying balance of the `owner`
    /// @dev This also accrues interest in a transaction
    /// @param owner The address of the account to query
    /// @return The amount of underlying owned by `owner`
    function balanceOfUnderlying(address owner) external override returns (uint) {
        Exp memory exchangeRate = Exp({mantissa : exchangeRateCurrent()});
        (MathError mErr, uint balance) = mulScalarTruncate(exchangeRate, accountTokens[owner]);
        require(mErr == MathError.NO_ERROR, "calc failed");
        return balance;
    }

    /*** User Interface ***/

    /// @notice Sender supplies assets into the market and receives lTokens in exchange
    /// @dev Accrues interest whether or not the operation succeeds, unless reverted
    /// @param mintAmount The amount of the underlying asset to supply
    function mint(uint mintAmount) external override nonReentrant {
        accrueInterest();
        mintFresh(msg.sender, mintAmount, false);
    }

    function mintTo(address to, uint amount) external payable override nonReentrant {
        accrueInterest();
        if (isWethPool) {
            mintFresh(to, msg.value, false);
        } else {
            mintFresh(to, amount, true);
        }
    }

    function mintEth() external payable override nonReentrant {
        require(isWethPool, "not eth pool");
        accrueInterest();
        mintFresh(msg.sender, msg.value, false);
    }

    /// @notice Sender redeems lTokens in exchange for the underlying asset
    /// @dev Accrues interest whether or not the operation succeeds, unless reverted
    /// @param redeemTokens The number of lTokens to redeem into underlying
    function redeem(uint redeemTokens) external override nonReentrant {
        accrueInterest();
        // redeemFresh emits redeem-specific logs on errors, so we don't need to
        redeemFresh(msg.sender, redeemTokens, 0);
    }

    /// @notice Sender redeems lTokens in exchange for a specified amount of underlying asset
    /// @dev Accrues interest whether or not the operation succeeds, unless reverted
    /// @param redeemAmount The amount of underlying to redeem
    function redeemUnderlying(uint redeemAmount) external override nonReentrant {
        accrueInterest();
        // redeemFresh emits redeem-specific logs on errors, so we don't need to
        redeemFresh(msg.sender, 0, redeemAmount);
    }

    function borrowBehalf(address borrower, uint borrowAmount) external override nonReentrant {
        accrueInterest();
        // borrowFresh emits borrow-specific logs on errors, so we don't need to
        borrowFresh(payable(borrower), msg.sender, borrowAmount);
    }

    /// @notice Sender repays a borrow belonging to borrower
    /// @param borrower the account with the debt being payed off
    /// @param repayAmount The amount to repay
    function repayBorrowBehalf(address borrower, uint repayAmount) external override nonReentrant {
        accrueInterest();
        // repayBorrowFresh emits repay-borrow-specific logs on errors, so we don't need to
        repayBorrowFresh(msg.sender, borrower, repayAmount, false);
    }

    function repayBorrowEndByOpenLev(address borrower, uint repayAmount) external override nonReentrant {
        accrueInterest();
        repayBorrowFresh(msg.sender, borrower, repayAmount, true);
    }


    /*** Safe Token ***/

    /// Gets balance of this contract in terms of the underlying
    /// @dev This excludes the value of the current message, if any
    /// @return The quantity of underlying tokens owned by this contract
    function getCashPrior() internal view returns (uint) {
        return IERC20(underlying).balanceOf(address(this));
    }


    /**
     * @dev Similar to EIP20 transfer, except it handles a False result from `transferFrom` and reverts in that case.
     *      This will revert due to insufficient balance or insufficient allowance.
     *      This function returns the actual amount received,
     *      which may be less than `amount` if there is a fee attached to the transfer.
     *
     *      Note: This wrapper safely handles non-standard ERC-20 tokens that do not return a value.
     *            See here: https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
     */
    function doTransferIn(address from, uint amount, bool convertWeth) internal returns (uint actualAmount) {
        if (isWethPool && convertWeth) {
            actualAmount = msg.value;
            IWETH(underlying).deposit{value : actualAmount}();
        } else {
            actualAmount = IERC20(underlying).safeTransferFrom(from, address(this), amount);
        }
    }

    /**
     * @dev Similar to EIP20 transfer, except it handles a False success from `transfer` and returns an explanatory
     *      error code rather than reverting. If caller has not called checked protocol's balance, this may revert due to
     *      insufficient cash held in this contract. If caller has checked protocol's balance prior to this call, and verified
     *      it is >= amount, this should not revert in normal conditions.
     *
     *      Note: This wrapper safely handles non-standard ERC-20 tokens that do not return a value.
     *            See here: https://medium.com/coinmonks/missing-return-value-bug-at-least-130-tokens-affected-d67bf08521ca
     */
    function doTransferOut(address payable to, uint amount, bool convertWeth) internal {
        if (isWethPool && convertWeth) {
            IWETH(underlying).withdraw(amount);
            to.transfer(amount);
        } else {
            IERC20(underlying).safeTransfer(to, amount);
        }
    }

    function availableForBorrow() external view override returns (uint){
        uint cash = getCashPrior();
        (MathError err0, uint sum) = addThenSubUInt(cash, totalBorrows, totalReserves);
        if (err0 != MathError.NO_ERROR) {
            return 0;
        }
        (MathError err1, uint maxAvailable) = mulScalarTruncate(Exp({mantissa : sum}), borrowCapFactorMantissa);
        if (err1 != MathError.NO_ERROR) {
            return 0;
        }
        if (totalBorrows > maxAvailable) {
            return 0;
        }
        return maxAvailable - totalBorrows;
    }


    /// @notice Get a snapshot of the account's balances, and the cached exchange rate
    /// @dev This is used by controller to more efficiently perform liquidity checks.
    /// @param account Address of the account to snapshot
    /// @return ( token balance, borrow balance, exchange rate mantissa)
    function getAccountSnapshot(address account) external override view returns (uint, uint, uint) {
        uint cTokenBalance = accountTokens[account];
        uint borrowBalance;
        uint exchangeRateMantissa;

        MathError mErr;

        (mErr, borrowBalance) = borrowBalanceStoredInternal(account);
        if (mErr != MathError.NO_ERROR) {
            return (0, 0, 0);
        }

        (mErr, exchangeRateMantissa) = exchangeRateStoredInternal();
        if (mErr != MathError.NO_ERROR) {
            return (0, 0, 0);
        }

        return (cTokenBalance, borrowBalance, exchangeRateMantissa);
    }

    /// @dev Function to simply retrieve block number
    ///  This exists mainly for inheriting test contracts to stub this result.
    function getBlockNumber() internal view returns (uint) {
        return block.number;
    }

    /// @notice Returns the current per-block borrow interest rate for this cToken
    /// @return The borrow interest rate per block, scaled by 1e18
    function borrowRatePerBlock() external override view returns (uint) {
        return getBorrowRateInternal(getCashPrior(), totalBorrows, totalReserves);
    }

    
    /// @notice Returns the current per-block supply interest rate for this cToken
    /// @return The supply interest rate per block, scaled by 1e18
    function supplyRatePerBlock() external override view returns (uint) {
        return getSupplyRateInternal(getCashPrior(), totalBorrows, totalReserves, reserveFactorMantissa);
    }

    function utilizationRate(uint cash, uint borrows, uint reserves) internal pure returns (uint) {
        // Utilization rate is 0 when there are no borrows
        if (borrows == 0) {
            return 0;
        }
        return borrows.mul(1e18).div(cash.add(borrows).sub(reserves));
    }

    /// @notice Calculates the current borrow rate per block, with the error code expected by the market
    /// @param cash The amount of cash in the market
    /// @param borrows The amount of borrows in the market
    /// @return The borrow rate percentage per block as a mantissa (scaled by 1e18)
    function getBorrowRateInternal(uint cash, uint borrows, uint reserves) internal view returns (uint) {
        uint util = utilizationRate(cash, borrows, reserves);
        if (util <= kink) {
            return util.mul(multiplierPerBlock).div(1e18).add(baseRatePerBlock);
        } else {
            uint normalRate = kink.mul(multiplierPerBlock).div(1e18).add(baseRatePerBlock);
            uint excessUtil = util.sub(kink);
            return excessUtil.mul(jumpMultiplierPerBlock).div(1e18).add(normalRate);
        }
    }

    /// @notice Calculates the current supply rate per block
    /// @param cash The amount of cash in the market
    /// @param borrows The amount of borrows in the market
    /// @return The supply rate percentage per block as a mantissa (scaled by 1e18)
    function getSupplyRateInternal(uint cash, uint borrows, uint reserves, uint reserveFactor) internal view returns (uint) {
        uint oneMinusReserveFactor = uint(1e18).sub(reserveFactor);
        uint borrowRate = getBorrowRateInternal(cash, borrows, reserves);
        uint rateToPool = borrowRate.mul(oneMinusReserveFactor).div(1e18);
        return utilizationRate(cash, borrows, reserves).mul(rateToPool).div(1e18);
    }

    /// @notice Returns the current total borrows plus accrued interest
    /// @return The total borrows with interest
    function totalBorrowsCurrent() external override view returns (uint) {
        /* Remember the initial block number */
        uint currentBlockNumber = getBlockNumber();
        uint accrualBlockNumberPrior = accrualBlockNumber;

        /* Short-circuit accumulating 0 interest */
        if (accrualBlockNumberPrior == currentBlockNumber) {
            return totalBorrows;
        }

        /* Read the previous values out of storage */
        uint cashPrior = getCashPrior();
        uint borrowsPrior = totalBorrows;
        uint reservesPrior = totalReserves;

        /* Calculate the current borrow interest rate */
        uint borrowRateMantissa = getBorrowRateInternal(cashPrior, borrowsPrior, reservesPrior);
        require(borrowRateMantissa <= borrowRateMaxMantissa, "borrower rate higher");

        /* Calculate the number of blocks elapsed since the last accrual */
        (MathError mathErr, uint blockDelta) = subUInt(currentBlockNumber, accrualBlockNumberPrior);
        require(mathErr == MathError.NO_ERROR, "calc block delta erro");

        Exp memory simpleInterestFactor;
        uint interestAccumulated;
        uint totalBorrowsNew;

        (mathErr, simpleInterestFactor) = mulScalar(Exp({mantissa : borrowRateMantissa}), blockDelta);
        require(mathErr == MathError.NO_ERROR, 'calc interest factor error');

        (mathErr, interestAccumulated) = mulScalarTruncate(simpleInterestFactor, borrowsPrior);
        require(mathErr == MathError.NO_ERROR, 'calc interest acc error');

        (mathErr, totalBorrowsNew) = addUInt(interestAccumulated, borrowsPrior);
        require(mathErr == MathError.NO_ERROR, 'calc total borrows error');

        return totalBorrowsNew;
    }

    /// @notice Accrue interest to updated borrowIndex and then calculate account's borrow balance using the updated borrowIndex
    /// @param account The address whose balance should be calculated after updating borrowIndex
    /// @return The calculated balance
    function borrowBalanceCurrent(address account) external view override returns (uint) {
        (MathError err0, uint borrowIndex) = calCurrentBorrowIndex();
        require(err0 == MathError.NO_ERROR, "calc borrow index fail");
        (MathError err1, uint result) = borrowBalanceStoredInternalWithBorrowerIndex(account, borrowIndex);
        require(err1 == MathError.NO_ERROR, "calc fail");
        return result;
    }

    function borrowBalanceStored(address account) external override view returns (uint){
        return accountBorrows[account].principal;
    }


    /// @notice Return the borrow balance of account based on stored data
    /// @param account The address whose balance should be calculated
    /// @return (error code, the calculated balance or 0 if error code is non-zero)
    function borrowBalanceStoredInternal(address account) internal view returns (MathError, uint) {
        return borrowBalanceStoredInternalWithBorrowerIndex(account, borrowIndex);
    }

    /// @notice Return the borrow balance of account based on stored data
    /// @param account The address whose balance should be calculated
    /// @return (error code, the calculated balance or 0 if error code is non-zero)
    function borrowBalanceStoredInternalWithBorrowerIndex(address account, uint borrowIndex) internal view returns (MathError, uint) {
        /* Note: we do not assert that the market is up to date */
        MathError mathErr;
        uint principalTimesIndex;
        uint result;

        /* Get borrowBalance and borrowIndex */
        BorrowSnapshot storage borrowSnapshot = accountBorrows[account];

        /* If borrowBalance = 0 then borrowIndex is likely also 0.
         * Rather than failing the calculation with a division by 0, we immediately return 0 in this case.
         */
        if (borrowSnapshot.principal == 0) {
            return (MathError.NO_ERROR, 0);
        }

        /* Calculate new borrow balance using the interest index:
         *  recentBorrowBalance = borrower.borrowBalance * market.borrowIndex / borrower.borrowIndex
         */
        (mathErr, principalTimesIndex) = mulUInt(borrowSnapshot.principal, borrowIndex);
        if (mathErr != MathError.NO_ERROR) {
            return (mathErr, 0);
        }

        (mathErr, result) = divUInt(principalTimesIndex, borrowSnapshot.interestIndex);
        if (mathErr != MathError.NO_ERROR) {
            return (mathErr, 0);
        }

        return (MathError.NO_ERROR, result);
    }

    /// @notice Accrue interest then return the up-to-date exchange rate
    /// @return Calculated exchange rate scaled by 1e18
    function exchangeRateCurrent() public override nonReentrant returns (uint) {
        accrueInterest();
        return exchangeRateStored();
    }

    /// Calculates the exchange rate from the underlying to the LToken
    /// @dev This function does not accrue interest before calculating the exchange rate
    /// @return Calculated exchange rate scaled by 1e18
    function exchangeRateStored() public override view returns (uint) {
        (MathError err, uint result) = exchangeRateStoredInternal();
        require(err == MathError.NO_ERROR, "calc fail");
        return result;
    }

    /// @notice Calculates the exchange rate from the underlying to the LToken
    /// @dev This function does not accrue interest before calculating the exchange rate
    /// @return (error code, calculated exchange rate scaled by 1e18)
    function exchangeRateStoredInternal() internal view returns (MathError, uint) {
        uint _totalSupply = totalSupply;
        if (_totalSupply == 0) {
            /*
             * If there are no tokens minted:
             *  exchangeRate = initialExchangeRate
             */
            return (MathError.NO_ERROR, initialExchangeRateMantissa);
        } else {
            /*
             * Otherwise:
             *  exchangeRate = (totalCash + totalBorrows - totalReserves) / totalSupply
             */
            uint _totalCash = getCashPrior();
            uint cashPlusBorrowsMinusReserves;
            Exp memory exchangeRate;
            MathError mathErr;

            (mathErr, cashPlusBorrowsMinusReserves) = addThenSubUInt(_totalCash, totalBorrows, totalReserves);
            if (mathErr != MathError.NO_ERROR) {
                return (mathErr, 0);
            }

            (mathErr, exchangeRate) = getExp(cashPlusBorrowsMinusReserves, _totalSupply);
            if (mathErr != MathError.NO_ERROR) {
                return (mathErr, 0);
            }

            return (MathError.NO_ERROR, exchangeRate.mantissa);
        }
    }

    /// @notice Get cash balance of this cToken in the underlying asset
    /// @return The quantity of underlying asset owned by this contract
    function getCash() external override view returns (uint) {
        return IERC20(underlying).balanceOf(address(this));
    }

    function calCurrentBorrowIndex() internal view returns (MathError, uint) {
        /* Remember the initial block number */
        uint currentBlockNumber = getBlockNumber();
        uint accrualBlockNumberPrior = accrualBlockNumber;
        uint borrowIndexNew;
        /* Short-circuit accumulating 0 interest */
        if (accrualBlockNumberPrior == currentBlockNumber) {
            return (MathError.NO_ERROR, borrowIndex);
        }
        uint borrowRateMantissa = getBorrowRateInternal(getCashPrior(), totalBorrows, totalReserves);
        (MathError mathErr, uint blockDelta) = subUInt(currentBlockNumber, accrualBlockNumberPrior);

        Exp memory simpleInterestFactor;
        (mathErr, simpleInterestFactor) = mulScalar(Exp({mantissa : borrowRateMantissa}), blockDelta);
        if (mathErr != MathError.NO_ERROR) {
            return (mathErr, 0);
        }
        (mathErr, borrowIndexNew) = mulScalarTruncateAddUInt(simpleInterestFactor, borrowIndex, borrowIndex);
        return (mathErr, borrowIndexNew);
    }

    /// @notice Applies accrued interest to total borrows and reserves
    /// @dev This calculates interest accrued from the last checkpointed block
    ///   up to the current block and writes new checkpoint to storage.
    function accrueInterest() public override {
        /* Remember the initial block number */
        uint currentBlockNumber = getBlockNumber();
        uint accrualBlockNumberPrior = accrualBlockNumber;

        /* Short-circuit accumulating 0 interest */
        if (accrualBlockNumberPrior == currentBlockNumber) {
            return;
        }

        /* Read the previous values out of storage */
        uint cashPrior = getCashPrior();
        uint borrowsPrior = totalBorrows;
        uint borrowIndexPrior = borrowIndex;
        uint reservesPrior = totalReserves;

        /* Calculate the current borrow interest rate */
        uint borrowRateMantissa = getBorrowRateInternal(cashPrior, borrowsPrior, reservesPrior);
        require(borrowRateMantissa <= borrowRateMaxMantissa, "borrower rate higher");

        /* Calculate the number of blocks elapsed since the last accrual */
        (MathError mathErr, uint blockDelta) = subUInt(currentBlockNumber, accrualBlockNumberPrior);
        require(mathErr == MathError.NO_ERROR, "calc block delta erro");


        /*
         * Calculate the interest accumulated into borrows and reserves and the new index:
         *  simpleInterestFactor = borrowRate * blockDelta
         *  interestAccumulated = simpleInterestFactor * totalBorrows
         *  totalBorrowsNew = interestAccumulated + totalBorrows
         *  borrowIndexNew = simpleInterestFactor * borrowIndex + borrowIndex
         */

        Exp memory simpleInterestFactor;
        uint interestAccumulated;
        uint totalBorrowsNew;
        uint borrowIndexNew;
        uint totalReservesNew;

        (mathErr, simpleInterestFactor) = mulScalar(Exp({mantissa : borrowRateMantissa}), blockDelta);
        require(mathErr == MathError.NO_ERROR, 'calc interest factor error');

        (mathErr, interestAccumulated) = mulScalarTruncate(simpleInterestFactor, borrowsPrior);
        require(mathErr == MathError.NO_ERROR, 'calc interest acc error');

        (mathErr, totalBorrowsNew) = addUInt(interestAccumulated, borrowsPrior);
        require(mathErr == MathError.NO_ERROR, 'calc total borrows error');

        (mathErr, totalReservesNew) = mulScalarTruncateAddUInt(Exp({mantissa : reserveFactorMantissa}), interestAccumulated, reservesPrior);
        require(mathErr == MathError.NO_ERROR, 'calc total reserves error');

        (mathErr, borrowIndexNew) = mulScalarTruncateAddUInt(simpleInterestFactor, borrowIndexPrior, borrowIndexPrior);
        require(mathErr == MathError.NO_ERROR, 'calc borrows index error');


        /* We write the previously calculated values into storage */
        accrualBlockNumber = currentBlockNumber;
        borrowIndex = borrowIndexNew;
        totalBorrows = totalBorrowsNew;
        totalReserves = totalReservesNew;

        /* We emit an AccrueInterest event */
        emit AccrueInterest(cashPrior, interestAccumulated, borrowIndexNew, totalBorrowsNew);

    }

    struct MintLocalVars {
        MathError mathErr;
        uint exchangeRateMantissa;
        uint mintTokens;
        uint totalSupplyNew;
        uint accountTokensNew;
        uint actualMintAmount;
    }

    /// @notice User supplies assets into the market and receives lTokens in exchange
    /// @dev Assumes interest has already been accrued up to the current block
    /// @param minter The address of the account which is supplying the assets
    /// @param mintAmount The amount of the underlying asset to supply
    /// @return uint the actual mint amount.
    function mintFresh(address minter, uint mintAmount, bool isDelegete) internal sameBlock returns (uint) {
        MintLocalVars memory vars;
        (vars.mathErr, vars.exchangeRateMantissa) = exchangeRateStoredInternal();
        require(vars.mathErr == MathError.NO_ERROR, 'calc exchangerate error');

        /*
         *  We call `doTransferIn` for the minter and the mintAmount.
         *  Note: The cToken must handle variations between ERC-20 and ETH underlying.
         *  `doTransferIn` reverts if anything goes wrong, since we can't be sure if
         *  side-effects occurred. The function returns the amount actually transferred,
         *  in case of a fee. On success, the cToken holds an additional `actualMintAmount`
         *  of cash.
         */
        if (isDelegete) {
            uint balanceBefore = getCashPrior();
            LPoolDepositor(msg.sender).transferToPool(minter, mintAmount);
            uint balanceAfter = getCashPrior();
            require(balanceAfter > balanceBefore, 'mint 0');
            vars.actualMintAmount = balanceAfter - balanceBefore;
        } else {
            vars.actualMintAmount = doTransferIn(minter, mintAmount, true);
        }
        /*
         * We get the current exchange rate and calculate the number of lTokens to be minted:
         *  mintTokens = actualMintAmount / exchangeRate
         */

        (vars.mathErr, vars.mintTokens) = divScalarByExpTruncate(vars.actualMintAmount, Exp({mantissa : vars.exchangeRateMantissa}));
        require(vars.mathErr == MathError.NO_ERROR, "calc mint token error");

        /* Fail if mint not allowed */
        (ControllerInterface(controller)).mintAllowed(minter, vars.mintTokens);
        /*
         * We calculate the new total supply of lTokens and minter token balance, checking for overflow:
         *  totalSupplyNew = totalSupply + mintTokens
         *  accountTokensNew = accountTokens[minter] + mintTokens
         */
        (vars.mathErr, vars.totalSupplyNew) = addUInt(totalSupply, vars.mintTokens);
        require(vars.mathErr == MathError.NO_ERROR, "calc supply new failed");

        (vars.mathErr, vars.accountTokensNew) = addUInt(accountTokens[minter], vars.mintTokens);
        require(vars.mathErr == MathError.NO_ERROR, "calc tokens new ailed");

        /* We write previously calculated values into storage */
        totalSupply = vars.totalSupplyNew;
        accountTokens[minter] = vars.accountTokensNew;

        /* We emit a Mint event, and a Transfer event */
        emit Mint(minter, vars.actualMintAmount, vars.mintTokens);
        emit Transfer(address(this), minter, vars.mintTokens);

        /* We call the defense hook */

        return vars.actualMintAmount;
    }


    struct RedeemLocalVars {
        MathError mathErr;
        uint exchangeRateMantissa;
        uint redeemTokens;
        uint redeemAmount;
        uint totalSupplyNew;
        uint accountTokensNew;
    }

    /// @notice User redeems lTokens in exchange for the underlying asset
    /// @dev Assumes interest has already been accrued up to the current block
    /// @param redeemer The address of the account which is redeeming the tokens
    /// @param redeemTokensIn The number of lTokens to redeem into underlying (only one of redeemTokensIn or redeemAmountIn may be non-zero)
    /// @param redeemAmountIn The number of underlying tokens to receive from redeeming lTokens (only one of redeemTokensIn or redeemAmountIn may be non-zero)
    function redeemFresh(address payable redeemer, uint redeemTokensIn, uint redeemAmountIn) internal sameBlock {
        require(redeemTokensIn == 0 || redeemAmountIn == 0, "one be zero");

        RedeemLocalVars memory vars;

        /* exchangeRate = invoke Exchange Rate Stored() */
        (vars.mathErr, vars.exchangeRateMantissa) = exchangeRateStoredInternal();
        require(vars.mathErr == MathError.NO_ERROR, 'calc exchangerate error');

        /* If redeemTokensIn > 0: */
        if (redeemTokensIn > 0) {
            /*
             * We calculate the exchange rate and the amount of underlying to be redeemed:
             *  redeemTokens = redeemTokensIn
             *  redeemAmount = redeemTokensIn x exchangeRateCurrent
             */
            vars.redeemTokens = redeemTokensIn;

            (vars.mathErr, vars.redeemAmount) = mulScalarTruncate(Exp({mantissa : vars.exchangeRateMantissa}), redeemTokensIn);
            require(vars.mathErr == MathError.NO_ERROR, 'calc redeem amount error');
        } else {
            /*
             * We get the current exchange rate and calculate the amount to be redeemed:
             *  redeemTokens = redeemAmountIn / exchangeRate
             *  redeemAmount = redeemAmountIn
             */

            (vars.mathErr, vars.redeemTokens) = divScalarByExpTruncate(redeemAmountIn, Exp({mantissa : vars.exchangeRateMantissa}));
            require(vars.mathErr == MathError.NO_ERROR, 'calc redeem tokens error');
            vars.redeemAmount = redeemAmountIn;
        }

        /* Fail if redeem not allowed */
        (ControllerInterface(controller)).redeemAllowed(redeemer, vars.redeemTokens);

        /*
         * We calculate the new total supply and redeemer balance, checking for underflow:
         *  totalSupplyNew = totalSupply - redeemTokens
         *  accountTokensNew = accountTokens[redeemer] - redeemTokens
         */
        (vars.mathErr, vars.totalSupplyNew) = subUInt(totalSupply, vars.redeemTokens);
        require(vars.mathErr == MathError.NO_ERROR, 'calc supply new error');

        (vars.mathErr, vars.accountTokensNew) = subUInt(accountTokens[redeemer], vars.redeemTokens);
        require(vars.mathErr == MathError.NO_ERROR, 'calc token new error');
        require(getCashPrior() >= vars.redeemAmount, 'cash < redeem');

        /* We write previously calculated values into storage */
        totalSupply = vars.totalSupplyNew;
        accountTokens[redeemer] = vars.accountTokensNew;
        /*
         * We invoke doTransferOut for the redeemer and the redeemAmount.
         *  Note: The cToken must handle variations between ERC-20 and ETH underlying.
         *  On success, the cToken has redeemAmount less of cash.
         *  doTransferOut reverts if anything goes wrong, since we can't be sure if side effects occurred.
         */
        doTransferOut(redeemer, vars.redeemAmount, true);


        /* We emit a Transfer event, and a Redeem event */
        emit Transfer(redeemer, address(this), vars.redeemTokens);
        emit Redeem(redeemer, vars.redeemAmount, vars.redeemTokens);

        /* We call the defense hook */
    }

    struct BorrowLocalVars {
        MathError mathErr;
        uint accountBorrows;
        uint accountBorrowsNew;
        uint totalBorrowsNew;
    }

    /// @notice Users borrow assets from the protocol to their own address
    /// @param borrowAmount The amount of the underlying asset to borrow
    function borrowFresh(address payable borrower, address payable payee, uint borrowAmount) internal sameBlock {
        /* Fail if borrow not allowed */
        (ControllerInterface(controller)).borrowAllowed(borrower, payee, borrowAmount);

        /* Fail gracefully if protocol has insufficient underlying cash */
        require(getCashPrior() >= borrowAmount, 'cash<borrow');

        BorrowLocalVars memory vars;

        /*
         * We calculate the new borrower and total borrow balances, failing on overflow:
         *  accountBorrowsNew = accountBorrows + borrowAmount
         *  totalBorrowsNew = totalBorrows + borrowAmount
         */
        (vars.mathErr, vars.accountBorrows) = borrowBalanceStoredInternal(borrower);
        require(vars.mathErr == MathError.NO_ERROR, 'calc acc borrows error');

        (vars.mathErr, vars.accountBorrowsNew) = addUInt(vars.accountBorrows, borrowAmount);
        require(vars.mathErr == MathError.NO_ERROR, 'calc acc borrows error');

        (vars.mathErr, vars.totalBorrowsNew) = addUInt(totalBorrows, borrowAmount);
        require(vars.mathErr == MathError.NO_ERROR, 'calc total borrows error');

        /* We write the previously calculated values into storage */
        accountBorrows[borrower].principal = vars.accountBorrowsNew;
        accountBorrows[borrower].interestIndex = borrowIndex;
        totalBorrows = vars.totalBorrowsNew;

        /*
         * We invoke doTransferOut for the borrower and the borrowAmount.
         *  Note: The cToken must handle variations between ERC-20 and ETH underlying.
         *  On success, the cToken borrowAmount less of cash.
         *  doTransferOut reverts if anything goes wrong, since we can't be sure if side effects occurred.
         */
        doTransferOut(payee, borrowAmount, false);

        /* We emit a Borrow event */
        emit Borrow(borrower, payee, borrowAmount, vars.accountBorrowsNew, vars.totalBorrowsNew);

        /* We call the defense hook */
    }

    struct RepayBorrowLocalVars {
        MathError mathErr;
        uint repayAmount;
        uint borrowerIndex;
        uint accountBorrows;
        uint accountBorrowsNew;
        uint totalBorrowsNew;
        uint actualRepayAmount;
        uint badDebtsAmount;
    }

    /// @notice Borrows are repaid by another user (possibly the borrower).
    /// @param payer the account paying off the borrow
    /// @param borrower the account with the debt being payed off
    /// @param repayAmount the amount of undelrying tokens being returned
    function repayBorrowFresh(address payer, address borrower, uint repayAmount, bool isEnd) internal sameBlock returns (uint) {
        /* Fail if repayBorrow not allowed */
        (ControllerInterface(controller)).repayBorrowAllowed(payer, borrower, repayAmount, isEnd);

        RepayBorrowLocalVars memory vars;

        /* We remember the original borrowerIndex for verification purposes */
        vars.borrowerIndex = accountBorrows[borrower].interestIndex;

        /* We fetch the amount the borrower owes, with accumulated interest */
        (vars.mathErr, vars.accountBorrows) = borrowBalanceStoredInternal(borrower);
        require(vars.mathErr == MathError.NO_ERROR, 'calc acc borrow error');

        /* If repayAmount == -1, repayAmount = accountBorrows */
        if (repayAmount == uint(- 1)) {
            vars.repayAmount = vars.accountBorrows;
        } else {
            vars.repayAmount = repayAmount;
        }
        vars.actualRepayAmount = doTransferIn(payer, vars.repayAmount, false);


        if (isEnd && vars.accountBorrows > vars.actualRepayAmount) {
            vars.badDebtsAmount = vars.accountBorrows - vars.actualRepayAmount;
        }

        /*
        *  We calculate the new borrower and total borrow balances, failing on underflow:
        *  accountBorrowsNew = accountBorrows - repayAmount
        *  totalBorrowsNew = totalBorrows - repayAmount
        */
        if (vars.accountBorrows < vars.actualRepayAmount) {
            require(vars.actualRepayAmount.mul(1e18).div(vars.accountBorrows) <= 105e16, 'repay more than 5%');
            vars.accountBorrowsNew = 0;
        } else {
            if (isEnd) {
                vars.accountBorrowsNew = 0;
            } else {
                vars.accountBorrowsNew = vars.accountBorrows - vars.actualRepayAmount;
            }
        }
        //Avoid mantissa errors
        if (vars.actualRepayAmount > totalBorrows) {
            vars.totalBorrowsNew = 0;
        } else {
            if (isEnd) {
                vars.totalBorrowsNew = totalBorrows.sub(vars.accountBorrows);
            } else {
                vars.totalBorrowsNew = totalBorrows - vars.actualRepayAmount;
            }
        }

        /* We write the previously calculated values into storage */
        accountBorrows[borrower].principal = vars.accountBorrowsNew;
        accountBorrows[borrower].interestIndex = borrowIndex;
        totalBorrows = vars.totalBorrowsNew;

        /* We emit a RepayBorrow event */
        emit RepayBorrow(payer, borrower, vars.actualRepayAmount, vars.badDebtsAmount, vars.accountBorrowsNew, vars.totalBorrowsNew);

        /* We call the defense hook */

        return vars.actualRepayAmount;
    }

    /*** Admin Functions ***/

    /// @notice Sets a new CONTROLLER for the market
    /// @dev Admin function to set a new controller
    function setController(address newController) external override onlyAdmin {
        require(address(0) != newController, "0x");
        address oldController = controller;
        controller = newController;
        // Emit NewController(oldController, newController)
        emit NewController(oldController, newController);
    }

    function setBorrowCapFactorMantissa(uint newBorrowCapFactorMantissa) external override onlyAdmin {
        require(newBorrowCapFactorMantissa <= 1e18, 'Factor too large');
        uint oldBorrowCapFactorMantissa = borrowCapFactorMantissa;
        borrowCapFactorMantissa = newBorrowCapFactorMantissa;
        emit NewBorrowCapFactorMantissa(oldBorrowCapFactorMantissa, borrowCapFactorMantissa);
    }

    function setInterestParams(uint baseRatePerBlock_, uint multiplierPerBlock_, uint jumpMultiplierPerBlock_, uint kink_) external override onlyAdmin {
        //accrueInterest except first
        if (baseRatePerBlock != 0) {
            accrueInterest();
        }
        // total rate perYear < 2000%
        require(baseRatePerBlock_ < 1e13, 'Base rate too large');
        baseRatePerBlock = baseRatePerBlock_;
        require(multiplierPerBlock_ < 1e13, 'Mul rate too large');
        multiplierPerBlock = multiplierPerBlock_;
        require(jumpMultiplierPerBlock_ < 1e13, 'Jump rate too large');
        jumpMultiplierPerBlock = jumpMultiplierPerBlock_;
        require(kink_ <= 1e18, 'Kline too large');
        kink = kink_;
        emit NewInterestParam(baseRatePerBlock_, multiplierPerBlock_, jumpMultiplierPerBlock_, kink_);
    }

    function setReserveFactor(uint newReserveFactorMantissa) external override onlyAdmin {
        require(newReserveFactorMantissa <= 1e18, 'Factor too large');
        accrueInterest();
        uint oldReserveFactorMantissa = reserveFactorMantissa;
        reserveFactorMantissa = newReserveFactorMantissa;
        emit NewReserveFactor(oldReserveFactorMantissa, newReserveFactorMantissa);
    }

    function addReserves(uint addAmount) external override nonReentrant {
        accrueInterest();
        uint totalReservesNew;
        uint actualAddAmount = doTransferIn(msg.sender, addAmount, true);
        totalReservesNew = totalReserves.add(actualAddAmount);
        totalReserves = totalReservesNew;
        emit ReservesAdded(msg.sender, actualAddAmount, totalReservesNew);
    }

    function reduceReserves(address payable to, uint reduceAmount) external override nonReentrant onlyAdmin {
        accrueInterest();
        uint totalReservesNew;
        totalReservesNew = totalReserves.sub(reduceAmount);
        totalReserves = totalReservesNew;
        doTransferOut(to, reduceAmount, true);
        emit ReservesReduced(to, reduceAmount, totalReservesNew);
    }

    modifier sameBlock() {
        require(accrualBlockNumber == getBlockNumber(), 'not same block');
        _;
    }
}

