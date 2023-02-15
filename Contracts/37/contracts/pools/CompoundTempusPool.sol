// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../TempusPool.sol";
import "../protocols/compound/ICErc20.sol";
import "../math/Fixed256xVar.sol";
import "../utils/UntrustedERC20.sol";

/// Allows depositing ERC20 into Compound's CErc20 contracts
contract CompoundTempusPool is TempusPool {
    using SafeERC20 for IERC20;
    using UntrustedERC20 for IERC20;
    using Fixed256xVar for uint256;

    ICErc20 internal immutable cToken;
    bytes32 public immutable override protocolName = "Compound";

    constructor(
        ICErc20 token,
        address controller,
        uint256 maturity,
        uint256 exchangeRateOne,
        uint256 estYield,
        string memory principalName,
        string memory principalSymbol,
        string memory yieldName,
        string memory yieldSymbol,
        FeesConfig memory maxFeeSetup
    )
        TempusPool(
            address(token),
            token.underlying(),
            controller,
            maturity,
            token.exchangeRateCurrent(),
            exchangeRateOne,
            estYield,
            principalName,
            principalSymbol,
            yieldName,
            yieldSymbol,
            maxFeeSetup
        )
    {
        require(token.isCToken(), "token is not a CToken");
        require(token.decimals() == 8, "CErc20 token must have 8 decimals precision");
        uint8 underlyingDecimals = ICErc20(token.underlying()).decimals();
        require(underlyingDecimals <= 36, "Underlying ERC20 token decimals must be <= 36");

        address[] memory markets = new address[](1);
        markets[0] = address(token);
        require(token.comptroller().enterMarkets(markets)[0] == 0, "enterMarkets failed");

        cToken = token;
    }

    function depositToUnderlying(uint256 backingAmount) internal override returns (uint256) {
        require(msg.value == 0, "ETH deposits not supported");

        uint preDepositBalance = IERC20(yieldBearingToken).balanceOf(address(this));

        // Pull user's Backing Tokens
        backingAmount = IERC20(backingToken).untrustedTransferFrom(msg.sender, address(this), backingAmount);

        // Deposit to Compound
        IERC20(backingToken).safeIncreaseAllowance(address(cToken), backingAmount);
        require(cToken.mint(backingAmount) == 0, "CErc20 mint failed");

        return IERC20(yieldBearingToken).balanceOf(address(this)) - preDepositBalance;
    }

    function withdrawFromUnderlyingProtocol(uint256 yieldBearingTokensAmount, address recipient)
        internal
        override
        returns (uint256 backingTokenAmount)
    {
        // tempus pool owns YBT
        assert(cToken.balanceOf(address(this)) >= yieldBearingTokensAmount);
        require(cToken.redeem(yieldBearingTokensAmount) == 0, "CErc20 redeem failed");

        // need to rescale the truncated amount which was used during cToken.redeem()
        uint256 backing = numAssetsPerYieldToken(yieldBearingTokensAmount, updateInterestRate());
        return IERC20(backingToken).untrustedTransfer(recipient, backing);
    }

    /// @return Updated current Interest Rate in 10**(18 - 8 + Underlying Token Decimals) decimal precision
    ///         This varying rate enables simple conversion from Compound cToken to backing token precision
    function updateInterestRate() internal override returns (uint256) {
        // NOTE: exchangeRateCurrent() will accrue interest and gets the latest Interest Rate
        //       The default exchange rate for Compound is 0.02 and grows
        //       cTokens are minted as (backingAmount / rate), so 1 DAI = 50 cDAI with 0.02 rate
        return cToken.exchangeRateCurrent();
    }

    /// @return Current Interest Rate in 10**(18 - 8 + Underlying Token Decimals) decimal precision
    ///         This varying rate enables simple conversion from Compound cToken to backing token precision
    function currentInterestRate() public view override returns (uint256) {
        return cToken.exchangeRateStored();
    }

    // NOTE: yieldTokens are in YieldToken precision, return value is in BackingToken precision
    //       This conversion happens automatically due to pre-scaled rate
    function numAssetsPerYieldToken(uint yieldTokens, uint rate) public pure override returns (uint) {
        return yieldTokens.mulfV(rate, 1e18);
    }

    // NOTE: backingTokens are in BackingToken precision, return value is in YieldToken precision
    //       This conversion happens automatically due to pre-scaled rate
    function numYieldTokensPerAsset(uint backingTokens, uint rate) public pure override returns (uint) {
        return backingTokens.divfV(rate, 1e18);
    }

    function interestRateToSharePrice(uint interestRate) internal pure override returns (uint) {
        // rate is always (10 + backing.decimals), so converting back is always 1e10
        return interestRate / 1e10;
    }
}
