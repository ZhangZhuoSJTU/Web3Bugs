// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./ITempusPool.sol";
import "./token/PrincipalShare.sol";
import "./token/YieldShare.sol";
import "./math/Fixed256xVar.sol";
import "./utils/PermanentlyOwnable.sol";
import "./utils/UntrustedERC20.sol";

/// @author The tempus.finance team
/// @title Implementation of Tempus Pool
abstract contract TempusPool is ITempusPool, PermanentlyOwnable {
    using SafeERC20 for IERC20;
    using UntrustedERC20 for IERC20;
    using Fixed256xVar for uint256;

    uint public constant override version = 1;

    address public immutable override yieldBearingToken;
    address public immutable override backingToken;

    uint256 public immutable override startTime;
    uint256 public immutable override maturityTime;

    uint256 public immutable override initialInterestRate;
    uint256 public immutable exchangeRateONE;
    uint256 public immutable yieldBearingONE;
    uint256 public immutable override backingTokenONE;
    uint256 public override maturityInterestRate;
    IPoolShare public immutable override principalShare;
    IPoolShare public immutable override yieldShare;
    address public immutable override controller;

    uint256 private immutable initialEstimatedYield;

    bool public override matured;

    FeesConfig feesConfig;

    uint256 public immutable override maxDepositFee;
    uint256 public immutable override maxEarlyRedeemFee;
    uint256 public immutable override maxMatureRedeemFee;

    /// total amount of fees accumulated in pool
    uint256 public override totalFees;

    /// Constructs Pool with underlying token, start and maturity date
    /// @param _yieldBearingToken Yield Bearing Token, such as cDAI or aUSDC
    /// @param _backingToken backing token (or zero address if ETH)
    /// @param ctrl The authorized TempusController of the pool
    /// @param maturity maturity time of this pool
    /// @param initInterestRate initial interest rate of the pool
    /// @param exchangeRateOne 1.0 expressed in exchange rate decimal precision
    /// @param estimatedFinalYield estimated yield for the whole lifetime of the pool
    /// @param principalName name of Tempus Principal Share
    /// @param principalSymbol symbol of Tempus Principal Share
    /// @param yieldName name of Tempus Yield Share
    /// @param yieldSymbol symbol of Tempus Yield Share
    /// @param maxFeeSetup Maximum fee percentages that this pool can have,
    ///                    values in Yield Bearing Token precision
    constructor(
        address _yieldBearingToken,
        address _backingToken,
        address ctrl,
        uint256 maturity,
        uint256 initInterestRate,
        uint256 exchangeRateOne,
        uint256 estimatedFinalYield,
        string memory principalName,
        string memory principalSymbol,
        string memory yieldName,
        string memory yieldSymbol,
        FeesConfig memory maxFeeSetup
    ) {
        require(maturity > block.timestamp, "maturityTime is after startTime");

        yieldBearingToken = _yieldBearingToken;
        backingToken = _backingToken;
        controller = ctrl;
        startTime = block.timestamp;
        maturityTime = maturity;
        initialInterestRate = initInterestRate;
        exchangeRateONE = exchangeRateOne;
        yieldBearingONE = 10**ERC20(_yieldBearingToken).decimals();
        initialEstimatedYield = estimatedFinalYield;

        maxDepositFee = maxFeeSetup.depositPercent;
        maxEarlyRedeemFee = maxFeeSetup.earlyRedeemPercent;
        maxMatureRedeemFee = maxFeeSetup.matureRedeemPercent;

        uint8 backingDecimals = _backingToken != address(0) ? IERC20Metadata(_backingToken).decimals() : 18;
        backingTokenONE = 10**backingDecimals;
        principalShare = new PrincipalShare(this, principalName, principalSymbol, backingDecimals);
        yieldShare = new YieldShare(this, yieldName, yieldSymbol, backingDecimals);
    }

    modifier onlyController() {
        require(msg.sender == controller, "Only callable by TempusController");
        _;
    }

    function depositToUnderlying(uint256 backingAmount) internal virtual returns (uint256 mintedYieldTokenAmount);

    function withdrawFromUnderlyingProtocol(uint256 amount, address recipient)
        internal
        virtual
        returns (uint256 backingTokenAmount);

    /// Finalize the pool after maturity.
    function finalize() external override onlyController {
        if (!matured) {
            require(block.timestamp >= maturityTime, "Maturity not been reached yet.");
            maturityInterestRate = currentInterestRate();
            matured = true;

            assert(IERC20(address(principalShare)).totalSupply() == IERC20(address(yieldShare)).totalSupply());
        }
    }

    function getFeesConfig() external view override returns (FeesConfig memory) {
        return feesConfig;
    }

    function setFeesConfig(FeesConfig calldata newFeesConfig) external override onlyOwner {
        require(newFeesConfig.depositPercent <= maxDepositFee, "Deposit fee percent > max");
        require(newFeesConfig.earlyRedeemPercent <= maxEarlyRedeemFee, "Early redeem fee percent > max");
        require(newFeesConfig.matureRedeemPercent <= maxMatureRedeemFee, "Mature redeem fee percent > max");
        feesConfig = newFeesConfig;
    }

    function transferFees(address authorizer, address recipient) external override onlyController {
        require(authorizer == owner(), "Only owner can transfer fees.");
        uint256 amount = totalFees;
        totalFees = 0;

        IERC20 token = IERC20(yieldBearingToken);
        token.safeTransfer(recipient, amount);
    }

    function depositBacking(uint256 backingTokenAmount, address recipient)
        external
        payable
        override
        onlyController
        returns (
            uint256 mintedShares,
            uint256 depositedYBT,
            uint256 fee,
            uint256 rate
        )
    {
        require(backingTokenAmount > 0, "backingTokenAmount must be greater than 0");

        depositedYBT = depositToUnderlying(backingTokenAmount);
        assert(depositedYBT > 0);

        (mintedShares, , fee, rate) = _deposit(depositedYBT, recipient);
    }

    function deposit(uint256 yieldTokenAmount, address recipient)
        external
        override
        onlyController
        returns (
            uint256 mintedShares,
            uint256 depositedBT,
            uint256 fee,
            uint256 rate
        )
    {
        require(yieldTokenAmount > 0, "yieldTokenAmount must be greater than 0");
        // Collect the deposit
        yieldTokenAmount = IERC20(yieldBearingToken).untrustedTransferFrom(msg.sender, address(this), yieldTokenAmount);

        (mintedShares, depositedBT, fee, rate) = _deposit(yieldTokenAmount, recipient);
    }

    /// @param yieldTokenAmount YBT amount in YBT decimal precision
    function _deposit(uint256 yieldTokenAmount, address recipient)
        internal
        returns (
            uint256 mintedShares,
            uint256 depositedBT,
            uint256 fee,
            uint256 rate
        )
    {
        require(!matured, "Maturity reached.");
        rate = updateInterestRate();
        require(rate >= initialInterestRate, "Negative yield!");

        // Collect fees if they are set, reducing the number of tokens for the sender
        // thus leaving more YBT in the TempusPool than there are minted TPS/TYS
        uint256 tokenAmount = yieldTokenAmount;
        uint256 depositFees = feesConfig.depositPercent;
        if (depositFees != 0) {
            fee = tokenAmount.mulfV(depositFees, yieldBearingONE);
            tokenAmount -= fee;
            totalFees += fee;
        }

        // Issue appropriate shares
        depositedBT = numAssetsPerYieldToken(tokenAmount, rate);
        mintedShares = numSharesToMint(depositedBT, rate);

        PrincipalShare(address(principalShare)).mint(recipient, mintedShares);
        YieldShare(address(yieldShare)).mint(recipient, mintedShares);
    }

    function redeemToBacking(
        address from,
        uint256 principalAmount,
        uint256 yieldAmount,
        address recipient
    )
        external
        payable
        override
        onlyController
        returns (
            uint256 redeemedYieldTokens,
            uint256 redeemedBackingTokens,
            uint256 fee,
            uint256 rate
        )
    {
        (redeemedYieldTokens, fee, rate) = burnShares(from, principalAmount, yieldAmount);

        redeemedBackingTokens = withdrawFromUnderlyingProtocol(redeemedYieldTokens, recipient);
    }

    function redeem(
        address from,
        uint256 principalAmount,
        uint256 yieldAmount,
        address recipient
    )
        external
        override
        onlyController
        returns (
            uint256 redeemedYieldTokens,
            uint256 fee,
            uint256 rate
        )
    {
        (redeemedYieldTokens, fee, rate) = burnShares(from, principalAmount, yieldAmount);

        redeemedYieldTokens = IERC20(yieldBearingToken).untrustedTransfer(recipient, redeemedYieldTokens);
    }

    function burnShares(
        address from,
        uint256 principalAmount,
        uint256 yieldAmount
    )
        internal
        returns (
            uint256 redeemedYieldTokens,
            uint256 fee,
            uint256 interestRate
        )
    {
        require(IERC20(address(principalShare)).balanceOf(from) >= principalAmount, "Insufficient principals.");
        require(IERC20(address(yieldShare)).balanceOf(from) >= yieldAmount, "Insufficient yields.");

        // Redeeming prior to maturity is only allowed in equal amounts.
        require(matured || (principalAmount == yieldAmount), "Inequal redemption not allowed before maturity.");

        // Burn the appropriate shares
        PrincipalShare(address(principalShare)).burnFrom(from, principalAmount);
        YieldShare(address(yieldShare)).burnFrom(from, yieldAmount);

        uint256 currentRate = updateInterestRate();
        (redeemedYieldTokens, , fee, interestRate) = getRedemptionAmounts(principalAmount, yieldAmount, currentRate);
        totalFees += fee;
    }

    function getRedemptionAmounts(
        uint256 principalAmount,
        uint256 yieldAmount,
        uint256 currentRate
    )
        private
        view
        returns (
            uint256 redeemableYieldTokens,
            uint256 redeemableBackingTokens,
            uint256 redeemFeeAmount,
            uint256 interestRate
        )
    {
        interestRate = effectiveRate(currentRate);

        if (interestRate < initialInterestRate) {
            redeemableBackingTokens = (principalAmount * interestRate) / initialInterestRate;
        } else {
            uint256 rateDiff = interestRate - initialInterestRate;
            // this is expressed in percent with exchangeRate precision
            uint256 yieldPercent = rateDiff.divfV(initialInterestRate, exchangeRateONE);
            uint256 redeemAmountFromYieldShares = yieldAmount.mulfV(yieldPercent, exchangeRateONE);

            // TODO: Scale based on number of decimals for tokens
            redeemableBackingTokens = principalAmount + redeemAmountFromYieldShares;

            // after maturity, all additional yield is being collected as fee
            if (matured && currentRate > interestRate) {
                uint256 additionalYieldRate = currentRate - interestRate;
                uint256 feeBackingAmount = yieldAmount.mulfV(
                    additionalYieldRate.mulfV(initialInterestRate, exchangeRateONE),
                    exchangeRateONE
                );
                redeemFeeAmount = numYieldTokensPerAsset(feeBackingAmount, currentRate);
            }
        }

        redeemableYieldTokens = numYieldTokensPerAsset(redeemableBackingTokens, currentRate);

        uint256 redeemFeePercent = matured ? feesConfig.matureRedeemPercent : feesConfig.earlyRedeemPercent;
        if (redeemFeePercent != 0) {
            uint256 regularRedeemFee = redeemableYieldTokens.mulfV(redeemFeePercent, yieldBearingONE);
            redeemableYieldTokens -= regularRedeemFee;
            redeemFeeAmount += regularRedeemFee;

            redeemableBackingTokens = numAssetsPerYieldToken(redeemableYieldTokens, currentRate);
        }
    }

    function effectiveRate(uint256 currentRate) private view returns (uint256) {
        if (matured) {
            return (currentRate < maturityInterestRate) ? currentRate : maturityInterestRate;
        } else {
            return currentRate;
        }
    }

    /// @dev Calculates current yield - since beginning of the pool
    /// @notice Includes principal, so in case of 5% yield it returns 1.05
    /// @param interestRate Current interest rate of the underlying protocol
    /// @return Current yield relative to 1, such as 1.05 (+5%) or 0.97 (-3%)
    function currentYield(uint256 interestRate) private view returns (uint256) {
        return effectiveRate(interestRate).divfV(initialInterestRate, exchangeRateONE);
    }

    function currentYield() private returns (uint256) {
        return currentYield(updateInterestRate());
    }

    function currentYieldStored() private view returns (uint256) {
        return currentYield(currentInterestRate());
    }

    function estimatedYield() private returns (uint256) {
        return estimatedYield(currentYield());
    }

    function estimatedYieldStored() private view returns (uint256) {
        return estimatedYield(currentYieldStored());
    }

    /// @dev Calculates estimated yield at maturity
    /// @notice Includes principal, so in case of 5% yield it returns 1.05
    /// @param yieldCurrent Current yield - since beginning of the pool
    /// @return Estimated yield at maturity relative to 1, such as 1.05 (+5%) or 0.97 (-3%)
    function estimatedYield(uint256 yieldCurrent) private view returns (uint256) {
        if (matured) {
            return yieldCurrent;
        }
        uint256 currentTime = block.timestamp;
        uint256 timeToMaturity = (maturityTime > currentTime) ? (maturityTime - currentTime) : 0;
        uint256 poolDuration = maturityTime - startTime;
        uint256 timeLeft = timeToMaturity.divfV(poolDuration, exchangeRateONE);

        return yieldCurrent + timeLeft.mulfV(initialEstimatedYield, exchangeRateONE);
    }

    /// pricePerYield = currentYield * (estimatedYield - 1) / (estimatedYield)
    /// Return value decimal precision in backing token precision
    function pricePerYieldShare(uint256 currYield, uint256 estYield) private view returns (uint256) {
        uint one = exchangeRateONE;
        // in case we have estimate for negative yield
        if (estYield < one) {
            return uint256(0);
        }
        uint256 yieldPrice = (estYield - one).mulfV(currYield, one).divfV(estYield, one);
        return interestRateToSharePrice(yieldPrice);
    }

    /// pricePerPrincipal = currentYield / estimatedYield
    /// Return value decimal precision in backing token precision
    function pricePerPrincipalShare(uint256 currYield, uint256 estYield) private view returns (uint256) {
        // in case we have estimate for negative yield
        if (estYield < exchangeRateONE) {
            return interestRateToSharePrice(currYield);
        }
        uint256 principalPrice = currYield.divfV(estYield, exchangeRateONE);
        return interestRateToSharePrice(principalPrice);
    }

    function pricePerYieldShare() external override returns (uint256) {
        return pricePerYieldShare(currentYield(), estimatedYield());
    }

    function pricePerYieldShareStored() external view override returns (uint256) {
        return pricePerYieldShare(currentYieldStored(), estimatedYieldStored());
    }

    function pricePerPrincipalShare() external override returns (uint256) {
        return pricePerPrincipalShare(currentYield(), estimatedYield());
    }

    function pricePerPrincipalShareStored() external view override returns (uint256) {
        return pricePerPrincipalShare(currentYieldStored(), estimatedYieldStored());
    }

    function numSharesToMint(uint256 depositedBT, uint256 currentRate) private view returns (uint256) {
        return (depositedBT * initialInterestRate) / currentRate;
    }

    function estimatedMintedShares(uint256 amount, bool isBackingToken) public view override returns (uint256) {
        uint256 currentRate = currentInterestRate();
        uint256 depositedBT = isBackingToken ? amount : numAssetsPerYieldToken(amount, currentRate);
        return numSharesToMint(depositedBT, currentRate);
    }

    function estimatedRedeem(
        uint256 principals,
        uint256 yields,
        bool toBackingToken
    ) public view override returns (uint256) {
        uint256 currentRate = currentInterestRate();
        (uint256 yieldTokens, uint256 backingTokens, , ) = getRedemptionAmounts(principals, yields, currentRate);
        return toBackingToken ? backingTokens : yieldTokens;
    }

    /// @dev This updates the underlying pool's interest rate
    ///      It should be done first thing before deposit/redeem to avoid arbitrage
    /// @return Updated current Interest Rate, decimal precision depends on specific TempusPool implementation
    function updateInterestRate() internal virtual returns (uint256);

    /// @dev This returns the stored Interest Rate of the YBT (Yield Bearing Token) pool
    ///      it is safe to call this after updateInterestRate() was called
    /// @return Stored Interest Rate, decimal precision depends on specific TempusPool implementation
    function currentInterestRate() public view virtual override returns (uint256);

    function numYieldTokensPerAsset(uint backingTokens, uint interestRate) public pure virtual override returns (uint);

    function numAssetsPerYieldToken(uint yieldTokens, uint interestRate) public pure virtual override returns (uint);

    /// @return Converts an interest rate decimal into a Principal/Yield Share decimal
    function interestRateToSharePrice(uint interestRate) internal view virtual returns (uint);
}
