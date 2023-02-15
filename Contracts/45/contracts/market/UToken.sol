//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
pragma abicoder v1;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "../Controller.sol";
import "../interfaces/IUserManager.sol";
import "../interfaces/IAssetManager.sol";
import "../interfaces/IUErc20.sol";
import "../interfaces/IInterestRateModel.sol";

/**
 *  @title UToken Contract
 *  @dev Union accountBorrows can borrow and repay thru this component.
 */
contract UToken is Controller, ReentrancyGuardUpgradeable {
    using SafeERC20Upgradeable for IUErc20;

    bool public constant IS_UTOKEN = true;
    uint256 public constant WAD = 1e18;
    uint256 internal constant BORROW_RATE_MAX_MANTISSA = 0.0005e16; //Maximum borrow rate that can ever be applied (.0005% / block)
    uint256 internal constant RESERVE_FACTORY_MAX_MANTISSA = 1e18; //Maximum fraction of interest that can be set aside for reserves

    address public underlying;
    IInterestRateModel public interestRateModel;
    uint256 internal initialExchangeRateMantissa; //Initial exchange rate used when minting the first UTokens (used when totalSupply = 0)
    uint256 public reserveFactorMantissa; //Fraction of interest currently set aside for reserves
    uint256 public accrualBlockNumber; //Block number that interest was last accrued at
    uint256 public borrowIndex; //Accumulator of the total earned interest rate since the opening of the market
    uint256 public totalBorrows; //Total amount of outstanding borrows of the underlying in this market
    uint256 public totalReserves; //Total amount of reserves of the underlying held in this marke
    uint256 public totalRedeemable; //Calculates the exchange rate from the underlying to the uToken
    uint256 public overdueBlocks; //overdue duration, based on the number of blocks
    uint256 public originationFee;
    uint256 public debtCeiling; //The debt limit for the whole system
    uint256 public maxBorrow;
    uint256 public minBorrow;
    address public assetManager;
    address public userManager;
    IUErc20 public uErc20;

    struct BorrowSnapshot {
        uint256 principal;
        uint256 interest;
        uint256 interestIndex;
        uint256 lastRepay; //Calculate if it is overdue
    }

    /**
     * @notice Mapping of account addresses to outstanding borrow balances
     */
    mapping(address => BorrowSnapshot) internal accountBorrows;

    /**
     *  @dev Change of the interest rate model
     *  @param oldInterestRateModel Old interest rate model address
     *  @param newInterestRateModel New interest rate model address
     */
    event LogNewMarketInterestRateModel(address oldInterestRateModel, address newInterestRateModel);

    event LogMint(address minter, uint256 underlyingAmount, uint256 uTokenAmount);

    event LogRedeem(address redeemer, uint256 redeemTokensIn, uint256 redeemAmountIn, uint256 redeemAmount);

    event LogReservesAdded(address reserver, uint256 actualAddAmount, uint256 totalReservesNew);

    event LogReservesReduced(address receiver, uint256 reduceAmount, uint256 totalReservesNew);

    /**
     *  @dev Event borrow
     *  @param account Member address
     *  @param amount Borrow amount
     *  @param fee Origination fee
     */
    event LogBorrow(address indexed account, uint256 amount, uint256 fee);

    /**
     *  @dev Event repay
     *  @param account Member address
     *  @param amount Repay amount
     */
    event LogRepay(address indexed account, uint256 amount);

    /**
     *  @dev modifier limit member
     */
    modifier onlyMember(address account) {
        require(IUserManager(userManager).checkIsMember(account), "UToken: caller is not a member");
        _;
    }

    modifier onlyAssetManager() {
        require(msg.sender == assetManager, "UToken: caller is not assetManager");
        _;
    }

    modifier onlyUserManager() {
        require(msg.sender == userManager, "UToken: caller is not userManager");
        _;
    }

    function __UToken_init(
        IUErc20 uErc20_,
        address underlying_,
        uint256 initialExchangeRateMantissa_,
        uint256 reserveFactorMantissa_,
        uint256 originationFee_,
        uint256 debtCeiling_,
        uint256 maxBorrow_,
        uint256 minBorrow_,
        uint256 overdueBlocks_,
        address admin_
    ) public initializer {
        require(initialExchangeRateMantissa_ > 0, "initial exchange rate must be greater than zero.");
        require(address(underlying_) != address(0), "underlying token is zero");
        require(
            reserveFactorMantissa_ >= 0 && reserveFactorMantissa_ <= RESERVE_FACTORY_MAX_MANTISSA,
            "reserveFactorMantissa error"
        );
        uErc20 = uErc20_;
        Controller.__Controller_init(admin_);
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        underlying = underlying_;
        originationFee = originationFee_;
        debtCeiling = debtCeiling_;
        maxBorrow = maxBorrow_;
        minBorrow = minBorrow_;
        overdueBlocks = overdueBlocks_;
        initialExchangeRateMantissa = initialExchangeRateMantissa_;
        reserveFactorMantissa = reserveFactorMantissa_;
        accrualBlockNumber = getBlockNumber();
        borrowIndex = WAD;
    }

    function setAssetManager(address assetManager_) external onlyAdmin {
        assetManager = assetManager_;
    }

    function setUserManager(address userManager_) external onlyAdmin {
        userManager = userManager_;
    }

    /**
     *  @dev Change loan origination fee value
     *  Accept claims only from the admin
     *  @param originationFee_ Fees deducted for each loan transaction
     */
    function setOriginationFee(uint256 originationFee_) external onlyAdmin {
        originationFee = originationFee_;
    }

    /**
     *  @dev Update the market debt ceiling to a fixed amount, for example, 1 billion DAI etc.
     *  Accept claims only from the admin
     *  @param debtCeiling_ The debt limit for the whole system
     */
    function setDebtCeiling(uint256 debtCeiling_) external onlyAdmin {
        debtCeiling = debtCeiling_;
    }

    /**
     *  @dev Update the minimum loan size
     *  Accept claims only from the admin
     *  @param minBorrow_ Minimum loan amount per user
     */
    function setMinBorrow(uint256 minBorrow_) external onlyAdmin {
        minBorrow = minBorrow_;
    }

    /**
     *  @dev Update the max loan size
     *  Accept claims only from the admin
     *  @param maxBorrow_ Max loan amount per user
     */
    function setMaxBorrow(uint256 maxBorrow_) external onlyAdmin {
        maxBorrow = maxBorrow_;
    }

    /**
     *  @dev Change loan overdue duration, based on the number of blocks
     *  Accept claims only from the admin
     *  @param overdueBlocks_ Maximum late repayment block. The number of arrivals is a default
     */
    function setOverdueBlocks(uint256 overdueBlocks_) external onlyAdmin {
        overdueBlocks = overdueBlocks_;
    }

    /**
     *  @dev Change to a different interest rate model
     *  Accept claims only from the admin
     *  @param newInterestRateModel New interest rate model address
     */
    function setInterestRateModel(address newInterestRateModel) external onlyAdmin {
        _setInterestRateModelFresh(newInterestRateModel);
    }

    function setReserveFactor(uint256 reserveFactorMantissa_) external onlyAdmin {
        require(
            reserveFactorMantissa_ >= 0 && reserveFactorMantissa_ <= RESERVE_FACTORY_MAX_MANTISSA,
            "reserveFactorMantissa error"
        );
        reserveFactorMantissa = reserveFactorMantissa_;
    }

    /**
     *  @dev Returns the remaining amount that can be borrowed from the market.
     *  @return Remaining total amount
     */
    function getRemainingLoanSize() public view returns (uint256) {
        if (debtCeiling >= totalBorrows) {
            return debtCeiling - totalBorrows;
        } else {
            return 0;
        }
    }

    /**
     *  @dev Get the last repay block
     *  @param account Member address
     *  @return lastRepay
     */
    function getLastRepay(address account) public view returns (uint256 lastRepay) {
        lastRepay = accountBorrows[account].lastRepay;
    }

    /**
     *  @dev Get member interest index
     *  @param account Member address
     *  @return interestIndex
     */
    function getInterestIndex(address account) public view returns (uint256 interestIndex) {
        interestIndex = accountBorrows[account].interestIndex;
    }

    /**
     *  @dev Check if the member's loan is overdue
     *  @param account Member address
     *  @return isOverdue
     */
    function checkIsOverdue(address account) public view returns (bool isOverdue) {
        if (getBorrowed(account) == 0) {
            isOverdue = false;
        } else {
            uint256 lastRepay = getLastRepay(account);
            uint256 diff = getBlockNumber() - lastRepay;
            isOverdue = (overdueBlocks < diff);
        }
    }

    /**
     *  @dev Get the origination fee
     *  @param amount Amount to be calculated
     *  @return Handling fee
     */
    function calculatingFee(uint256 amount) public view returns (uint256) {
        return (originationFee * amount) / WAD;
    }

    /**
     *  @dev Get member loan data
     *  @param member Member address
     *  @return principal totalBorrowed asset apr limit isOverdue lastRepay
     */
    function getLoan(address member)
        public
        view
        returns (
            uint256 principal,
            uint256 totalBorrowed,
            address asset,
            uint256 apr,
            int256 limit,
            bool isOverdue,
            uint256 lastRepay
        )
    {
        principal = accountBorrows[msg.sender].principal;
        totalBorrowed = borrowBalanceStoredInternal(member);
        asset = underlying;
        apr = borrowRatePerBlock();
        lastRepay = getLastRepay(member);
        limit = _getCreditLimit(member);
        isOverdue = checkIsOverdue(member);
    }

    /**
     *  @dev Get the borrowed principle
     *  @param account Member address
     *  @return borrowed
     */
    function getBorrowed(address account) public view returns (uint256 borrowed) {
        borrowed = accountBorrows[account].principal;
    }

    /**
     *  @dev Get a member's current owed balance, including the principle and interest but without updating the user's states.
     *  @param account Member address
     *  @return Borrowed amount
     */
    function borrowBalanceView(address account) public view returns (uint256) {
        return accountBorrows[account].principal + calculatingInterest(account);
    }

    /**
     *  @dev Get a member's total owed, including the principle and the interest calculated based on the interest index.
     *  @param account Member address
     *  @return Borrowed amount
     */
    function borrowBalanceStoredInternal(address account) internal view returns (uint256) {
        BorrowSnapshot memory loan = accountBorrows[account];

        /* If borrowBalance = 0 then borrowIndex is likely also 0.
         * Rather than failing the calculation with a division by 0, we immediately return 0 in this case.
         */
        if (loan.principal == 0) {
            return 0;
        }

        uint256 principalTimesIndex = (loan.principal + loan.interest) * borrowIndex;
        return principalTimesIndex / loan.interestIndex;
    }

    /**
     *  @dev Get the borrowing interest rate per block
     *  @return Borrow rate
     */
    function borrowRatePerBlock() public view returns (uint256) {
        uint256 borrowRateMantissa = interestRateModel.getBorrowRate();
        require(borrowRateMantissa <= BORROW_RATE_MAX_MANTISSA, "borrow rate is absurdly high");
        return borrowRateMantissa;
    }

    /**
     * @notice Returns the current per-block supply interest rate for this UToken
     * @return The supply interest rate per block, scaled by 1e18
     */
    function supplyRatePerBlock() public view returns (uint256) {
        return interestRateModel.getSupplyRate(reserveFactorMantissa);
    }

    /**
     * @notice Accrue interest then return the up-to-date exchange rate
     * @return Calculated exchange rate scaled by 1e18
     */
    function exchangeRateCurrent() public nonReentrant returns (uint256) {
        require(accrueInterest(), "UToken: accrue interest failed");
        return exchangeRateStored();
    }

    /**
     * @notice Calculates the exchange rate from the underlying to the UToken
     * @dev This function does not accrue interest before calculating the exchange rate
     * @return Calculated exchange rate scaled by 1e18
     */
    function exchangeRateStored() public view returns (uint256) {
        uint256 totalSupply_ = uErc20.totalSupply();
        if (totalSupply_ == 0) {
            return initialExchangeRateMantissa;
        } else {
            return (totalRedeemable * WAD) / totalSupply_;
        }
    }

    /**
     *  @dev Calculating member's borrowed interest
     *  @param account Member address
     *  @return Interest amount
     */
    function calculatingInterest(address account) public view returns (uint256) {
        BorrowSnapshot memory loan = accountBorrows[account];

        if (loan.principal == 0) {
            return 0;
        }

        uint256 borrowRate = borrowRatePerBlock();
        uint256 currentBlockNumber = getBlockNumber();
        uint256 blockDelta = currentBlockNumber - accrualBlockNumber;
        uint256 simpleInterestFactor = borrowRate * blockDelta;
        uint256 borrowIndexNew = (simpleInterestFactor * borrowIndex) / WAD + borrowIndex;

        uint256 principalTimesIndex = (loan.principal + loan.interest) * borrowIndexNew;
        uint256 balance = principalTimesIndex / loan.interestIndex;

        return balance - accountBorrows[account].principal;
    }

    /**
     *  @dev Borrowing from the market
     *  Accept claims only from the member
     *  Borrow amount must in the range of creditLimit, minBorrow, maxBorrow, debtCeiling and not overdue
     *  @param amount Borrow amount
     */
    function borrow(uint256 amount) external onlyMember(msg.sender) whenNotPaused nonReentrant {
        IAssetManager assetManagerContract = IAssetManager(assetManager);
        require(amount >= minBorrow, "UToken: amount less than loan size min");

        require(amount <= getRemainingLoanSize(), "UToken: amount more than loan global size max");

        uint256 fee = calculatingFee(amount);
        require(borrowBalanceView(msg.sender) + amount + fee <= maxBorrow, "UToken: amount large than borrow size max");

        require(!checkIsOverdue(msg.sender), "UToken: Member has loans overdue");

        require(amount <= assetManagerContract.getLoanableAmount(underlying), "UToken: Not enough to lend out");
        require(
            uint256(_getCreditLimit(msg.sender)) >= amount + fee,
            "UToken: The loan amount plus fee is greater than credit limit"
        );

        require(accrueInterest(), "UToken: accrue interest failed");

        uint256 borrowedAmount = borrowBalanceStoredInternal(msg.sender);

        //Set lastRepay init data
        if (accountBorrows[msg.sender].lastRepay == 0) {
            accountBorrows[msg.sender].lastRepay = getBlockNumber();
        }

        uint256 accountBorrowsNew = borrowedAmount + amount + fee;
        uint256 totalBorrowsNew = totalBorrows + amount + fee;
        uint256 oldPrincipal = accountBorrows[msg.sender].principal;

        accountBorrows[msg.sender].principal += amount + fee;
        uint256 newPrincipal = accountBorrows[msg.sender].principal;
        IUserManager(userManager).updateLockedData(msg.sender, newPrincipal - oldPrincipal, true);
        accountBorrows[msg.sender].interest = accountBorrowsNew - accountBorrows[msg.sender].principal;
        accountBorrows[msg.sender].interestIndex = borrowIndex;
        totalBorrows = totalBorrowsNew;
        // The origination fees contribute to the reserve
        totalReserves += fee;

        require(assetManagerContract.withdraw(underlying, msg.sender, amount), "UToken: Failed to withdraw");

        emit LogBorrow(msg.sender, amount, fee);
    }

    function repayBorrow(uint256 repayAmount) external whenNotPaused nonReentrant {
        _repayBorrowFresh(msg.sender, msg.sender, repayAmount);
    }

    function repayBorrowBehalf(address borrower, uint256 repayAmount) external whenNotPaused nonReentrant {
        _repayBorrowFresh(msg.sender, borrower, repayAmount);
    }

    /**
     *  @dev Repay the loan
     *  Accept claims only from the member
     *  Updated member lastPaymentEpoch only when the repayment amount is greater than interest
     *  @param payer Payer address
     *  @param borrower Borrower address
     *  @param amount Repay amount
     */
    function _repayBorrowFresh(
        address payer,
        address borrower,
        uint256 amount
    ) private {
        IUErc20 assetToken = IUErc20(underlying);
        //In order to prevent the state from being changed, put the value at the top
        bool isOverdue = checkIsOverdue(borrower);
        uint256 oldPrincipal = accountBorrows[borrower].principal;
        require(accrueInterest(), "UToken: accrue interest failed");
        require(accrualBlockNumber == getBlockNumber(), "UToken: market not fresh");

        uint256 interest = calculatingInterest(borrower);
        uint256 borrowedAmount = borrowBalanceStoredInternal(borrower);

        uint256 repayAmount;
        if (amount > borrowedAmount) {
            repayAmount = borrowedAmount;
        } else {
            repayAmount = amount;
        }

        require(repayAmount > 0, "UToken: repay amount or owed amount is zero");

        require(assetToken.allowance(payer, address(this)) >= repayAmount, "UToken: Not enough allowance to repay");

        uint256 toReserveAmount;
        uint256 toRedeemableAmount;
        if (repayAmount >= interest) {
            toReserveAmount = (interest * reserveFactorMantissa) / WAD;
            toRedeemableAmount = interest - toReserveAmount;

            if (isOverdue) {
                IUserManager(userManager).updateTotalFrozen(borrower, false);
                IUserManager(userManager).repayLoanOverdue(borrower, underlying, accountBorrows[borrower].lastRepay);
            }
            accountBorrows[borrower].principal = borrowedAmount - repayAmount;
            accountBorrows[borrower].interest = 0;

            if (accountBorrows[borrower].principal == 0) {
                //LastRepay is cleared when the arrears are paid off, and reinitialized the next time the loan is borrowed
                accountBorrows[borrower].lastRepay = 0;
            } else {
                accountBorrows[borrower].lastRepay = getBlockNumber();
            }
        } else {
            toReserveAmount = (repayAmount * reserveFactorMantissa) / WAD;
            toRedeemableAmount = repayAmount - toReserveAmount;
            accountBorrows[borrower].interest = interest - repayAmount;
        }

        totalReserves += toReserveAmount;
        totalRedeemable += toRedeemableAmount;

        uint256 newPrincipal = accountBorrows[borrower].principal;
        accountBorrows[borrower].interestIndex = borrowIndex;
        totalBorrows -= repayAmount;

        IUserManager(userManager).updateLockedData(borrower, oldPrincipal - newPrincipal, false);

        assetToken.safeTransferFrom(payer, address(this), repayAmount);

        assetToken.safeApprove(assetManager, 0);
        assetToken.safeApprove(assetManager, repayAmount);

        require(IAssetManager(assetManager).deposit(underlying, repayAmount), "UToken: Deposit failed");

        emit LogRepay(borrower, repayAmount);
    }

    function repayBorrowWithPermit(
        address borrower,
        uint256 amount,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public whenNotPaused {
        IUErc20 erc20Token = IUErc20(underlying);
        erc20Token.permit(msg.sender, address(this), nonce, expiry, true, v, r, s);

        _repayBorrowFresh(msg.sender, borrower, amount);
    }

    /**
     *  @dev Accrue interest
     *  @return Accrue interest finished
     */
    function accrueInterest() public returns (bool) {
        uint256 borrowRate = borrowRatePerBlock();
        uint256 currentBlockNumber = getBlockNumber();
        uint256 blockDelta = currentBlockNumber - accrualBlockNumber;

        uint256 simpleInterestFactor = borrowRate * blockDelta;
        uint256 interestAccumulated = (simpleInterestFactor * totalBorrows) / WAD;
        uint256 totalBorrowsNew = interestAccumulated + totalBorrows;
        uint256 borrowIndexNew = (simpleInterestFactor * borrowIndex) / WAD + borrowIndex;

        accrualBlockNumber = currentBlockNumber;
        borrowIndex = borrowIndexNew;
        totalBorrows = totalBorrowsNew;

        return true;
    }

    /**
     * @notice Get the underlying balance of the `owner`
     * @dev This also accrues interest in a transaction
     * @param owner The address of the account to query
     * @return The amount of underlying owned by `owner`
     */
    function balanceOfUnderlying(address owner) external returns (uint256) {
        return exchangeRateCurrent() * uErc20.balanceOf(owner);
    }

    function mint(uint256 mintAmount) external whenNotPaused nonReentrant {
        require(accrueInterest(), "UToken: accrue interest failed");
        uint256 exchangeRate = exchangeRateStored();
        IUErc20 assetToken = IUErc20(underlying);
        uint256 balanceBefore = assetToken.balanceOf(address(this));
        require(assetToken.allowance(msg.sender, address(this)) >= mintAmount, "UToken: Not enough allowance");
        assetToken.safeTransferFrom(msg.sender, address(this), mintAmount);
        uint256 balanceAfter = assetToken.balanceOf(address(this));
        uint256 actualMintAmount = balanceAfter - balanceBefore;
        totalRedeemable += actualMintAmount;
        uint256 mintTokens = (actualMintAmount * WAD) / exchangeRate;
        uErc20.mint(msg.sender, mintTokens);

        assetToken.safeApprove(assetManager, 0);
        assetToken.safeApprove(assetManager, actualMintAmount);

        require(IAssetManager(assetManager).deposit(underlying, actualMintAmount), "UToken: Deposit failed");

        emit LogMint(msg.sender, actualMintAmount, mintTokens);
    }

    /**
     * @notice Sender redeems uTokens in exchange for the underlying asset
     * @dev Accrues interest whether or not the operation succeeds, unless reverted
     * @param redeemTokens The number of uTokens to redeem into underlying
     */
    function redeem(uint256 redeemTokens) external whenNotPaused nonReentrant {
        require(accrueInterest(), "UToken: accrue interest failed");
        _redeemFresh(payable(msg.sender), redeemTokens, 0);
    }

    /**
     * @notice Sender redeems uTokens in exchange for a specified amount of underlying asset
     * @dev Accrues interest whether or not the operation succeeds, unless reverted
     * @param redeemAmount The amount of underlying to receive from redeeming uTokens
     */
    function redeemUnderlying(uint256 redeemAmount) external whenNotPaused nonReentrant {
        require(accrueInterest(), "UToken: accrue interest failed");
        _redeemFresh(payable(msg.sender), 0, redeemAmount);
    }

    /**
     * @notice User redeems uTokens in exchange for the underlying asset
     * @dev Assumes interest has already been accrued up to the current block
     * @param redeemer The address of the account which is redeeming the tokens
     * @param redeemTokensIn The number of uTokens to redeem into underlying (only one of redeemTokensIn or redeemAmountIn may be non-zero)
     * @param redeemAmountIn The number of underlying tokens to receive from redeeming uTokens (only one of redeemTokensIn or redeemAmountIn may be non-zero)
     */
    function _redeemFresh(
        address payable redeemer,
        uint256 redeemTokensIn,
        uint256 redeemAmountIn
    ) internal {
        require(redeemTokensIn == 0 || redeemAmountIn == 0, "one of redeemTokensIn or redeemAmountIn must be zero");

        IAssetManager assetManagerContract = IAssetManager(assetManager);

        uint256 exchangeRate = exchangeRateStored();

        uint256 redeemTokens;
        uint256 redeemAmount;

        if (redeemTokensIn > 0) {
            /*
             * We calculate the exchange rate and the amount of underlying to be redeemed:
             *  redeemTokens = redeemTokensIn
             *  redeemAmount = redeemTokensIn x exchangeRateCurrent
             */
            redeemTokens = redeemTokensIn;
            redeemAmount = (redeemTokensIn * exchangeRate) / WAD;
        } else {
            /*
             * We get the current exchange rate and calculate the amount to be redeemed:
             *  redeemTokens = redeemAmountIn / exchangeRate
             *  redeemAmount = redeemAmountIn
             */
            redeemTokens = (redeemAmountIn * WAD) / exchangeRate;
            redeemAmount = redeemAmountIn;
        }

        require(totalRedeemable >= redeemAmount, "redeem amount error");
        totalRedeemable -= redeemAmount;
        uErc20.burn(redeemer, redeemTokens);

        require(assetManagerContract.withdraw(underlying, redeemer, redeemAmount), "UToken: Failed to withdraw");

        emit LogRedeem(redeemer, redeemTokensIn, redeemAmountIn, redeemAmount);
    }

    function addReserves(uint256 addAmount) external whenNotPaused nonReentrant {
        require(accrueInterest(), "UToken: accrue interest failed");
        IUErc20 assetToken = IUErc20(underlying);
        uint256 balanceBefore = assetToken.balanceOf(address(this));
        require(assetToken.allowance(msg.sender, address(this)) >= addAmount, "UToken: Not enough allowance");
        assetToken.safeTransferFrom(msg.sender, address(this), addAmount);
        uint256 balanceAfter = assetToken.balanceOf(address(this));
        uint256 actualAddAmount = balanceAfter - balanceBefore;

        uint256 totalReservesNew = totalReserves + actualAddAmount;
        /* Revert on overflow */
        require(totalReservesNew >= totalReserves, "add reserves unexpected overflow");
        totalReserves = totalReservesNew;

        assetToken.safeApprove(assetManager, 0);
        assetToken.safeApprove(assetManager, balanceAfter);

        require(IAssetManager(assetManager).deposit(underlying, balanceAfter), "UToken: Deposit failed");

        emit LogReservesAdded(msg.sender, actualAddAmount, totalReservesNew);
    }

    function removeReserves(address receiver, uint256 reduceAmount) external whenNotPaused nonReentrant onlyAdmin {
        require(accrueInterest(), "UToken: accrue interest failed");
        require(reduceAmount <= totalReserves, "amount is large than totalReserves");

        IAssetManager assetManagerContract = IAssetManager(assetManager);

        uint256 totalReservesNew = totalReserves - reduceAmount;
        // We checked reduceAmount <= totalReserves above, so this should never revert.
        require(totalReservesNew <= totalReserves, "reduce reserves unexpected underflow");

        totalReserves = totalReservesNew;

        require(assetManagerContract.withdraw(underlying, receiver, reduceAmount), "UToken: Failed to withdraw");

        emit LogReservesReduced(receiver, reduceAmount, totalReservesNew);
    }

    function debtWriteOff(address borrower, uint256 amount) external whenNotPaused onlyUserManager {
        uint256 oldPrincipal = accountBorrows[borrower].principal;
        uint256 repayAmount;
        if (amount > oldPrincipal) {
            repayAmount = oldPrincipal;
        } else {
            repayAmount = amount;
        }

        accountBorrows[borrower].principal = oldPrincipal - repayAmount;
        totalBorrows -= repayAmount;
    }

    /**
     * @dev Function to simply retrieve block number
     *  This exists mainly for inheriting test contracts to stub this result.
     */
    function getBlockNumber() internal view returns (uint256) {
        return block.number;
    }

    function _setInterestRateModelFresh(address newInterestRateModel_) private {
        address oldInterestRateModel = address(interestRateModel);
        address newInterestRateModel = newInterestRateModel_;
        require(
            IInterestRateModel(newInterestRateModel).isInterestRateModel(),
            "UToken: new model is not a interestRateModel"
        );
        interestRateModel = IInterestRateModel(newInterestRateModel);

        emit LogNewMarketInterestRateModel(oldInterestRateModel, newInterestRateModel);
    }

    /**
     *  @dev Update borrower overdue info
     *  @param account Borrower address
     */
    function updateOverdueInfo(address account) external whenNotPaused {
        if (checkIsOverdue(account)) {
            IUserManager(userManager).updateTotalFrozen(account, true);
        }
    }

    /**
     *  @dev Batch update borrower overdue info
     *  @param accounts Borrowers address
     */
    function batchUpdateOverdueInfos(address[] calldata accounts) external whenNotPaused {
        address[] memory overdueAccounts = new address[](accounts.length);
        bool[] memory isOverdues = new bool[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            if (checkIsOverdue(accounts[i])) {
                overdueAccounts[i] = accounts[i];
                isOverdues[i] = true;
            }
        }
        IUserManager(userManager).batchUpdateTotalFrozen(overdueAccounts, isOverdues);
    }

    /**
     *  @dev Get a member's available credit limit
     *  @param account Member address
     *  @return Member credit limit
     */
    function _getCreditLimit(address account) private view returns (int256) {
        return IUserManager(userManager).getCreditLimit(account);
    }
}
