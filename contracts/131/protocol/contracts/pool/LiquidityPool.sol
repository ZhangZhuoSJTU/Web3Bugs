// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

import "../../interfaces/IController.sol";
import "../../interfaces/pool/ILiquidityPool.sol";
import "../../interfaces/ILpToken.sol";
import "../../interfaces/IStakerVault.sol";
import "../../interfaces/IVault.sol";

import "../../libraries/AddressProviderHelpers.sol";
import "../../libraries/Errors.sol";
import "../../libraries/ScaledMath.sol";

import "../access/Authorization.sol";
import "../utils/Preparable.sol";
import "../utils/Pausable.sol";

/**
 * @dev Pausing/unpausing the pool will disable/re-enable deposits.
 */
abstract contract LiquidityPool is
    ILiquidityPool,
    Authorization,
    Preparable,
    Pausable,
    Initializable
{
    using AddressProviderHelpers for IAddressProvider;
    using ScaledMath for uint256;
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    struct WithdrawalFeeMeta {
        uint64 timeToWait;
        uint64 feeRatio;
        uint64 lastActionTimestamp;
    }

    bytes32 internal constant _VAULT_KEY = "Vault";
    bytes32 internal constant _RESERVE_DEVIATION_KEY = "ReserveDeviation";
    bytes32 internal constant _REQUIRED_RESERVES_KEY = "RequiredReserves";

    bytes32 internal constant _MAX_WITHDRAWAL_FEE_KEY = "MaxWithdrawalFee";
    bytes32 internal constant _MIN_WITHDRAWAL_FEE_KEY = "MinWithdrawalFee";
    bytes32 internal constant _WITHDRAWAL_FEE_DECREASE_PERIOD_KEY = "WithdrawalFeeDecreasePeriod";

    uint256 internal constant _INITIAL_RESERVE_DEVIATION = 0.005e18; // 0.5%
    uint256 internal constant _INITIAL_FEE_DECREASE_PERIOD = 1 weeks;
    uint256 internal constant _INITIAL_MAX_WITHDRAWAL_FEE = 0.03e18; // 3%

    /**
     * @notice even through admin votes and later governance, the withdrawal
     * fee will never be able to go above this value
     */
    uint256 internal constant _MAX_WITHDRAWAL_FEE = 0.05e18;

    /**
     * @notice Keeps track of the withdrawal fees on a per-address basis
     */
    mapping(address => WithdrawalFeeMeta) public withdrawalFeeMetas;

    IController public immutable controller;
    IAddressProvider public immutable addressProvider;

    IStakerVault public staker;
    ILpToken public lpToken;
    string public name;

    constructor(IController _controller)
        Authorization(_controller.addressProvider().getRoleManager())
    {
        controller = IController(_controller);
        addressProvider = IController(_controller).addressProvider();
    }

    /**
     * @notice Deposit funds into liquidity pool and mint LP tokens in exchange.
     * @param depositAmount Amount of the underlying asset to supply.
     * @return The actual amount minted.
     */
    function deposit(uint256 depositAmount) external payable override returns (uint256) {
        return depositFor(msg.sender, depositAmount, 0);
    }

    /**
     * @notice Deposit funds into liquidity pool and mint LP tokens in exchange.
     * @param depositAmount Amount of the underlying asset to supply.
     * @param minTokenAmount Minimum amount of LP tokens that should be minted.
     * @return The actual amount minted.
     */
    function deposit(uint256 depositAmount, uint256 minTokenAmount)
        external
        payable
        override
        returns (uint256)
    {
        return depositFor(msg.sender, depositAmount, minTokenAmount);
    }

    /**
     * @notice Deposit funds into liquidity pool and stake LP Tokens in Staker Vault.
     * @param depositAmount Amount of the underlying asset to supply.
     * @param minTokenAmount Minimum amount of LP tokens that should be minted.
     * @return The actual amount minted and staked.
     */
    function depositAndStake(uint256 depositAmount, uint256 minTokenAmount)
        external
        payable
        override
        returns (uint256)
    {
        uint256 amountMinted_ = depositFor(address(this), depositAmount, minTokenAmount);
        staker.stakeFor(msg.sender, amountMinted_);
        return amountMinted_;
    }

    /**
     * @notice Withdraws all funds from vault.
     * @dev Should be called in case of emergencies.
     */
    function withdrawAll() external override onlyGovernance {
        getVault().withdrawAll();
    }

    function setLpToken(address _lpToken)
        external
        override
        onlyRoles2(Roles.GOVERNANCE, Roles.POOL_FACTORY)
        returns (bool)
    {
        require(address(lpToken) == address(0), Error.ADDRESS_ALREADY_SET);
        require(ILpToken(_lpToken).minter() == address(this), Error.INVALID_MINTER);
        lpToken = ILpToken(_lpToken);
        _approveStakerVaultSpendingLpTokens();
        emit LpTokenSet(_lpToken);
        return true;
    }

    /**
     * @notice Checkpoint function to update a user's withdrawal fees on deposit and redeem
     * @param from Address sending from
     * @param to Address sending to
     * @param amount Amount to redeem or deposit
     */
    function handleLpTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external override {
        require(
            msg.sender == address(lpToken) || msg.sender == address(staker),
            Error.UNAUTHORIZED_ACCESS
        );
        if (
            addressProvider.isStakerVault(to, address(lpToken)) ||
            addressProvider.isStakerVault(from, address(lpToken)) ||
            addressProvider.isAction(to) ||
            addressProvider.isAction(from) ||
            addressProvider.isWhiteListedFeeHandler(to) ||
            addressProvider.isWhiteListedFeeHandler(from)
        ) {
            return;
        }

        if (to != address(0)) {
            _updateUserFeesOnDeposit(to, from, amount);
        }
    }

    /**
     * @notice Prepare update of required reserve ratio (with time delay enforced).
     * @param _newRatio New required reserve ratio.
     * @return `true` if success.
     */
    function prepareNewRequiredReserves(uint256 _newRatio)
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(_newRatio <= ScaledMath.ONE, Error.INVALID_AMOUNT);
        return _prepare(_REQUIRED_RESERVES_KEY, _newRatio);
    }

    /**
     * @notice Execute required reserve ratio update (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New required reserve ratio.
     */
    function executeNewRequiredReserves() external override returns (uint256) {
        uint256 requiredReserveRatio = _executeUInt256(_REQUIRED_RESERVES_KEY);
        _rebalanceVault();
        return requiredReserveRatio;
    }

    /**
     * @notice Reset the prepared required reserves.
     * @return `true` if success.
     */
    function resetRequiredReserves() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_REQUIRED_RESERVES_KEY);
    }

    /**
     * @notice Prepare update of reserve deviation ratio (with time delay enforced).
     * @param newRatio New reserve deviation ratio.
     * @return `true` if success.
     */
    function prepareNewReserveDeviation(uint256 newRatio)
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(newRatio <= (ScaledMath.DECIMAL_SCALE * 50) / 100, Error.INVALID_AMOUNT);
        return _prepare(_RESERVE_DEVIATION_KEY, newRatio);
    }

    /**
     * @notice Execute reserve deviation ratio update (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New reserve deviation ratio.
     */
    function executeNewReserveDeviation() external override returns (uint256) {
        uint256 reserveDeviation = _executeUInt256(_RESERVE_DEVIATION_KEY);
        _rebalanceVault();
        return reserveDeviation;
    }

    /**
     * @notice Reset the prepared reserve deviation.
     * @return `true` if success.
     */
    function resetNewReserveDeviation() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_RESERVE_DEVIATION_KEY);
    }

    /**
     * @notice Prepare update of min withdrawal fee (with time delay enforced).
     * @param newFee New min withdrawal fee.
     * @return `true` if success.
     */
    function prepareNewMinWithdrawalFee(uint256 newFee)
        external
        override
        onlyGovernance
        returns (bool)
    {
        _checkFeeInvariants(newFee, getMaxWithdrawalFee());
        return _prepare(_MIN_WITHDRAWAL_FEE_KEY, newFee);
    }

    /**
     * @notice Execute min withdrawal fee update (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New withdrawal fee.
     */
    function executeNewMinWithdrawalFee() external override returns (uint256) {
        uint256 newFee = _executeUInt256(_MIN_WITHDRAWAL_FEE_KEY);
        _checkFeeInvariants(newFee, getMaxWithdrawalFee());
        return newFee;
    }

    /**
     * @notice Reset the prepared min withdrawal fee
     * @return `true` if success.
     */
    function resetNewMinWithdrawalFee() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_MIN_WITHDRAWAL_FEE_KEY);
    }

    /**
     * @notice Prepare update of max withdrawal fee (with time delay enforced).
     * @param newFee New max withdrawal fee.
     * @return `true` if success.
     */
    function prepareNewMaxWithdrawalFee(uint256 newFee)
        external
        override
        onlyGovernance
        returns (bool)
    {
        _checkFeeInvariants(getMinWithdrawalFee(), newFee);
        return _prepare(_MAX_WITHDRAWAL_FEE_KEY, newFee);
    }

    /**
     * @notice Execute max withdrawal fee update (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New max withdrawal fee.
     */
    function executeNewMaxWithdrawalFee() external override returns (uint256) {
        uint256 newFee = _executeUInt256(_MAX_WITHDRAWAL_FEE_KEY);
        _checkFeeInvariants(getMinWithdrawalFee(), newFee);
        return newFee;
    }

    /**
     * @notice Reset the prepared max fee.
     * @return `true` if success.
     */
    function resetNewMaxWithdrawalFee() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_MAX_WITHDRAWAL_FEE_KEY);
    }

    /**
     * @notice Prepare update of withdrawal decrease fee period (with time delay enforced).
     * @param newPeriod New withdrawal fee decrease period.
     * @return `true` if success.
     */
    function prepareNewWithdrawalFeeDecreasePeriod(uint256 newPeriod)
        external
        override
        onlyGovernance
        returns (bool)
    {
        return _prepare(_WITHDRAWAL_FEE_DECREASE_PERIOD_KEY, newPeriod);
    }

    /**
     * @notice Execute withdrawal fee decrease period update (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New withdrawal fee decrease period.
     */
    function executeNewWithdrawalFeeDecreasePeriod() external override returns (uint256) {
        return _executeUInt256(_WITHDRAWAL_FEE_DECREASE_PERIOD_KEY);
    }

    /**
     * @notice Reset the prepared withdrawal fee decrease period update.
     * @return `true` if success.
     */
    function resetNewWithdrawalFeeDecreasePeriod() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_WITHDRAWAL_FEE_DECREASE_PERIOD_KEY);
    }

    /**
     * @notice Set the staker vault for this pool's LP token
     * @dev Staker vault and LP token pairs are immutable and the staker vault can only be set once for a pool.
     *      Only one vault exists per LP token. This information will be retrieved from the controller of the pool.
     * @return Address of the new staker vault for the pool.
     */
    function setStaker()
        external
        override
        onlyRoles2(Roles.GOVERNANCE, Roles.POOL_FACTORY)
        returns (bool)
    {
        require(address(staker) == address(0), Error.ADDRESS_ALREADY_SET);
        address stakerVault = addressProvider.getStakerVault(address(lpToken));
        require(stakerVault != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        staker = IStakerVault(stakerVault);
        _approveStakerVaultSpendingLpTokens();
        emit StakerVaultSet(stakerVault);
        return true;
    }

    /**
     * @notice Prepare setting a new Vault (with time delay enforced).
     * @param _vault Address of new Vault contract.
     * @return `true` if success.
     */
    function prepareNewVault(address _vault) external override onlyGovernance returns (bool) {
        _prepare(_VAULT_KEY, _vault);
        return true;
    }

    /**
     * @notice Execute Vault update (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return Address of new Vault contract.
     */
    function executeNewVault() external override returns (address) {
        IVault vault = getVault();
        if (address(vault) != address(0)) {
            vault.withdrawAll();
        }
        address newVault = _executeAddress(_VAULT_KEY);
        addressProvider.updateVault(address(vault), newVault);
        return newVault;
    }

    /**
     * @notice Reset the vault deadline.
     * @return `true` if success.
     */
    function resetNewVault() external override onlyGovernance returns (bool) {
        return _resetAddressConfig(_VAULT_KEY);
    }

    /**
     * @notice Redeems the underlying asset by burning LP tokens.
     * @param redeemLpTokens Number of tokens to burn for redeeming the underlying.
     * @return Actual amount of the underlying redeemed.
     */
    function redeem(uint256 redeemLpTokens) external override returns (uint256) {
        return redeem(redeemLpTokens, 0);
    }

    /**
     * @notice Rebalance vault according to required underlying backing reserves.
     */
    function rebalanceVault() external override onlyGovernance {
        _rebalanceVault();
    }

    /**
     * @notice Deposit funds for an address into liquidity pool and mint LP tokens in exchange.
     * @param account Account to deposit for.
     * @param depositAmount Amount of the underlying asset to supply.
     * @return Actual amount minted.
     */
    function depositFor(address account, uint256 depositAmount)
        external
        payable
        override
        returns (uint256)
    {
        return depositFor(account, depositAmount, 0);
    }

    /**
     * @notice Redeems the underlying asset by burning LP tokens, unstaking any LP tokens needed.
     * @param redeemLpTokens Number of tokens to unstake and/or burn for redeeming the underlying.
     * @param minRedeemAmount Minimum amount of underlying that should be received.
     * @return Actual amount of the underlying redeemed.
     */
    function unstakeAndRedeem(uint256 redeemLpTokens, uint256 minRedeemAmount)
        external
        override
        returns (uint256)
    {
        uint256 lpBalance_ = lpToken.balanceOf(msg.sender);
        require(
            lpBalance_ + staker.balanceOf(msg.sender) >= redeemLpTokens,
            Error.INSUFFICIENT_BALANCE
        );
        if (lpBalance_ < redeemLpTokens) {
            staker.unstakeFor(msg.sender, msg.sender, redeemLpTokens - lpBalance_);
        }
        return redeem(redeemLpTokens, minRedeemAmount);
    }

    /**
     * @notice Returns the address of the LP token of this pool
     * @return The address of the LP token
     */
    function getLpToken() external view override returns (address) {
        return address(lpToken);
    }

    /**
     * @notice Calculates the amount of LP tokens that need to be redeemed to get a certain amount of underlying (includes fees and exchange rate)
     * @param account Address of the account redeeming.
     * @param underlyingAmount The amount of underlying desired.
     * @return Amount of LP tokens that need to be redeemed.
     */
    function calcRedeem(address account, uint256 underlyingAmount)
        external
        view
        override
        returns (uint256)
    {
        require(underlyingAmount > 0, Error.INVALID_AMOUNT);
        ILpToken lpToken_ = lpToken;
        require(lpToken_.balanceOf(account) > 0, Error.INSUFFICIENT_BALANCE);

        uint256 currentExchangeRate = exchangeRate();
        uint256 withoutFeesLpAmount = underlyingAmount.scaledDiv(currentExchangeRate);
        if (withoutFeesLpAmount == lpToken_.totalSupply()) {
            return withoutFeesLpAmount;
        }

        WithdrawalFeeMeta memory meta = withdrawalFeeMetas[account];

        uint256 currentFeeRatio;
        if (!addressProvider.isAction(account)) {
            currentFeeRatio = getNewCurrentFees(
                meta.timeToWait,
                meta.lastActionTimestamp,
                meta.feeRatio
            );
        }
        uint256 scalingFactor = currentExchangeRate.scaledMul((ScaledMath.ONE - currentFeeRatio));
        uint256 neededLpTokens = underlyingAmount.scaledDivRoundUp(scalingFactor);

        return neededLpTokens;
    }

    function getUnderlying() external view virtual override returns (address);

    /**
     * @notice Deposit funds for an address into liquidity pool and mint LP tokens in exchange.
     * @param account Account to deposit for.
     * @param depositAmount Amount of the underlying asset to supply.
     * @param minTokenAmount Minimum amount of LP tokens that should be minted.
     * @return Actual amount minted.
     */
    function depositFor(
        address account,
        uint256 depositAmount,
        uint256 minTokenAmount
    ) public payable override notPaused returns (uint256) {
        if (depositAmount == 0) return 0;
        uint256 rate = exchangeRate();

        _doTransferIn(msg.sender, depositAmount);
        uint256 mintedLp = depositAmount.scaledDiv(rate);
        require(mintedLp >= minTokenAmount && mintedLp > 0, Error.INVALID_AMOUNT);

        lpToken.mint(account, mintedLp);
        _rebalanceVault();

        if (msg.sender == account || address(this) == account) {
            emit Deposit(msg.sender, depositAmount, mintedLp);
        } else {
            emit DepositFor(msg.sender, account, depositAmount, mintedLp);
        }
        return mintedLp;
    }

    /**
     * @notice Redeems the underlying asset by burning LP tokens.
     * @param redeemLpTokens Number of tokens to burn for redeeming the underlying.
     * @param minRedeemAmount Minimum amount of underlying that should be received.
     * @return Actual amount of the underlying redeemed.
     */
    function redeem(uint256 redeemLpTokens, uint256 minRedeemAmount)
        public
        override
        returns (uint256)
    {
        require(redeemLpTokens > 0, Error.INVALID_AMOUNT);
        ILpToken lpToken_ = lpToken;
        require(lpToken_.balanceOf(msg.sender) >= redeemLpTokens, Error.INSUFFICIENT_BALANCE);

        uint256 withdrawalFee = addressProvider.isAction(msg.sender)
            ? 0
            : getWithdrawalFee(msg.sender, redeemLpTokens);
        uint256 redeemMinusFees = redeemLpTokens - withdrawalFee;
        // Pay no fees on the last withdrawal (avoid locking funds in the pool)
        if (redeemLpTokens == lpToken_.totalSupply()) {
            redeemMinusFees = redeemLpTokens;
        }
        uint256 redeemUnderlying = redeemMinusFees.scaledMul(exchangeRate());
        require(redeemUnderlying >= minRedeemAmount, Error.NOT_ENOUGH_FUNDS_WITHDRAWN);

        _rebalanceVault(redeemUnderlying);

        lpToken_.burn(msg.sender, redeemLpTokens);
        _doTransferOut(payable(msg.sender), redeemUnderlying);
        emit Redeem(msg.sender, redeemUnderlying, redeemLpTokens);
        return redeemUnderlying;
    }

    /**
     * @return the current required reserves ratio
     */
    function getRequiredReserveRatio() public view virtual override returns (uint256) {
        return currentUInts256[_REQUIRED_RESERVES_KEY];
    }

    /**
     * @return the current maximum reserve deviation ratio
     */
    function getMaxReserveDeviationRatio() public view virtual override returns (uint256) {
        return currentUInts256[_RESERVE_DEVIATION_KEY];
    }

    /**
     * @notice Returns the current minimum withdrawal fee
     */
    function getMinWithdrawalFee() public view override returns (uint256) {
        return currentUInts256[_MIN_WITHDRAWAL_FEE_KEY];
    }

    /**
     * @notice Returns the current maximum withdrawal fee
     */
    function getMaxWithdrawalFee() public view override returns (uint256) {
        return currentUInts256[_MAX_WITHDRAWAL_FEE_KEY];
    }

    /**
     * @notice Returns the current withdrawal fee decrease period
     */
    function getWithdrawalFeeDecreasePeriod() public view override returns (uint256) {
        return currentUInts256[_WITHDRAWAL_FEE_DECREASE_PERIOD_KEY];
    }

    /**
     * @return the current vault of the liquidity pool
     */
    function getVault() public view virtual override returns (IVault) {
        return IVault(currentAddresses[_VAULT_KEY]);
    }

    /**
     * @notice Compute current exchange rate of LP tokens to underlying scaled to 1e18.
     * @dev Exchange rate means: underlying = LP token * exchangeRate
     * @return Current exchange rate.
     */
    function exchangeRate() public view override returns (uint256) {
        uint256 totalUnderlying_ = totalUnderlying();
        uint256 totalSupply = lpToken.totalSupply();
        if (totalSupply == 0 || totalUnderlying_ == 0) {
            return ScaledMath.ONE;
        }

        return totalUnderlying_.scaledDiv(totalSupply);
    }

    /**
     * @notice Compute total amount of underlying tokens for this pool.
     * @return Total amount of underlying in pool.
     */
    function totalUnderlying() public view override returns (uint256) {
        IVault vault = getVault();
        if (address(vault) == address(0)) {
            return _getBalanceUnderlying();
        }
        uint256 investedUnderlying = vault.getTotalUnderlying();
        return investedUnderlying + _getBalanceUnderlying();
    }

    /**
     * @notice Returns the withdrawal fee for `account`
     * @param account Address to get the withdrawal fee for
     * @param amount Amount to calculate the withdrawal fee for
     * @return Withdrawal fee in LP tokens
     */
    function getWithdrawalFee(address account, uint256 amount)
        public
        view
        override
        returns (uint256)
    {
        WithdrawalFeeMeta memory meta = withdrawalFeeMetas[account];

        if (lpToken.balanceOf(account) == 0) {
            return 0;
        }
        uint256 currentFee = getNewCurrentFees(
            meta.timeToWait,
            meta.lastActionTimestamp,
            meta.feeRatio
        );
        return amount.scaledMul(currentFee);
    }

    /**
     * @notice Calculates the withdrawal fee a user would currently need to pay on currentBalance.
     * @param timeToWait The total time to wait until the withdrawal fee reached the min. fee
     * @param lastActionTimestamp Timestamp of the last fee update
     * @param feeRatio Fees that would currently be paid on the user's entire balance
     * @return Updated fee amount on the currentBalance
     */
    function getNewCurrentFees(
        uint256 timeToWait,
        uint256 lastActionTimestamp,
        uint256 feeRatio
    ) public view override returns (uint256) {
        uint256 timeElapsed = _getTime() - lastActionTimestamp;
        uint256 minFeePercentage = getMinWithdrawalFee();
        if (timeElapsed >= timeToWait || minFeePercentage > feeRatio) {
            return minFeePercentage;
        }
        uint256 elapsedShare = timeElapsed.scaledDiv(timeToWait);
        return feeRatio - (feeRatio - minFeePercentage).scaledMul(elapsedShare);
    }

    function _rebalanceVault() internal {
        _rebalanceVault(0);
    }

    function _initialize(string calldata name_, address vault_)
        internal
        initializer
        returns (bool)
    {
        name = name_;

        _setConfig(_WITHDRAWAL_FEE_DECREASE_PERIOD_KEY, _INITIAL_FEE_DECREASE_PERIOD);
        _setConfig(_MAX_WITHDRAWAL_FEE_KEY, _INITIAL_MAX_WITHDRAWAL_FEE);
        _setConfig(_REQUIRED_RESERVES_KEY, ScaledMath.ONE);
        _setConfig(_RESERVE_DEVIATION_KEY, _INITIAL_RESERVE_DEVIATION);
        _setConfig(_VAULT_KEY, vault_);
        return true;
    }

    function _approveStakerVaultSpendingLpTokens() internal {
        address staker_ = address(staker);
        address lpToken_ = address(lpToken);
        if (staker_ == address(0) || lpToken_ == address(0)) return;
        IERC20(lpToken_).safeApprove(staker_, type(uint256).max);
    }

    function _doTransferIn(address from, uint256 amount) internal virtual;

    function _doTransferOut(address payable to, uint256 amount) internal virtual;

    /**
     * @dev Rebalances the pool's allocations to the vault
     * @param underlyingToWithdraw Amount of underlying to withdraw such that after the withdrawal the pool and vault allocations are correctly balanced.
     */
    function _rebalanceVault(uint256 underlyingToWithdraw) internal {
        IVault vault = getVault();

        if (address(vault) == address(0)) return;
        uint256 lockedLp = staker.getStakedByActions();
        uint256 totalUnderlyingStaked = lockedLp.scaledMul(exchangeRate());

        uint256 underlyingBalance = _getBalanceUnderlying(true);
        uint256 maximumDeviation = totalUnderlyingStaked.scaledMul(getMaxReserveDeviationRatio());

        uint256 nextTargetBalance = totalUnderlyingStaked.scaledMul(getRequiredReserveRatio());

        if (
            underlyingToWithdraw > underlyingBalance ||
            (underlyingBalance - underlyingToWithdraw) + maximumDeviation < nextTargetBalance
        ) {
            uint256 requiredDeposits = nextTargetBalance + underlyingToWithdraw - underlyingBalance;
            vault.withdraw(requiredDeposits);
        } else {
            uint256 nextBalance = underlyingBalance - underlyingToWithdraw;
            if (nextBalance > nextTargetBalance + maximumDeviation) {
                uint256 excessDeposits = nextBalance - nextTargetBalance;
                _doTransferOut(payable(address(vault)), excessDeposits);
                vault.deposit();
            }
        }
    }

    function _updateUserFeesOnDeposit(
        address account,
        address from,
        uint256 amountAdded
    ) internal {
        WithdrawalFeeMeta storage meta = withdrawalFeeMetas[account];
        uint256 balance = lpToken.balanceOf(account) +
            staker.stakedAndActionLockedBalanceOf(account);
        uint256 newCurrentFeeRatio = getNewCurrentFees(
            meta.timeToWait,
            meta.lastActionTimestamp,
            meta.feeRatio
        );
        uint256 shareAdded = amountAdded.scaledDiv(amountAdded + balance);
        uint256 shareExisting = ScaledMath.ONE - shareAdded;
        uint256 feeOnDeposit;
        if (from == address(0)) {
            feeOnDeposit = getMaxWithdrawalFee();
            meta.lastActionTimestamp = _getTime().toUint64();
        } else {
            WithdrawalFeeMeta storage fromMeta = withdrawalFeeMetas[from];
            feeOnDeposit = getNewCurrentFees(
                fromMeta.timeToWait,
                fromMeta.lastActionTimestamp,
                fromMeta.feeRatio
            );
            uint256 minTime_ = _getTime() - meta.timeToWait;
            if (meta.lastActionTimestamp < minTime_) {
                meta.lastActionTimestamp = minTime_.toUint64();
            }
            meta.lastActionTimestamp = ((shareExisting *
                uint256(meta.lastActionTimestamp) +
                shareAdded *
                _getTime()) / (shareExisting + shareAdded)).toUint64();
        }

        uint256 newFeeRatio = shareExisting.scaledMul(newCurrentFeeRatio) +
            shareAdded.scaledMul(feeOnDeposit);

        meta.feeRatio = newFeeRatio.toUint64();
        meta.timeToWait = getWithdrawalFeeDecreasePeriod().toUint64();
    }

    function _getBalanceUnderlying() internal view virtual returns (uint256);

    function _getBalanceUnderlying(bool transferInDone) internal view virtual returns (uint256);

    function _isAuthorizedToPause(address account) internal view override returns (bool) {
        return _roleManager().hasRole(Roles.GOVERNANCE, account);
    }

    /**
     * @dev Overridden for testing
     */
    function _getTime() internal view virtual returns (uint256) {
        return block.timestamp;
    }

    function _checkFeeInvariants(uint256 minFee, uint256 maxFee) internal pure {
        require(maxFee >= minFee, Error.INVALID_AMOUNT);
        require(maxFee <= _MAX_WITHDRAWAL_FEE, Error.INVALID_AMOUNT);
    }
}
