// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "./TokenHandler.sol";
import "../nTokenHandler.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

library Incentives {
    using SafeMath for uint256;

    /// @dev Notional incentivizes nTokens using the formula:
    ///     incentivesToClaim = (tokenBalance / totalSupply) * emissionRatePerYear * proRataYears
    ///     where proRataYears is:
    ///         (timeSinceLastClaim / YEAR) * INTERNAL_TOKEN_PRECISION
    /// @return (emissionRatePerYear * proRataYears), decimal basis is (1e8 * 1e8 = 1e16)
    function _getIncentiveRate(uint256 timeSinceLastClaim, uint256 emissionRatePerYear)
        private
        pure
        returns (uint256)
    {
        // (timeSinceLastClaim * INTERNAL_TOKEN_PRECISION) / YEAR
        uint256 proRataYears =
            timeSinceLastClaim.mul(uint256(Constants.INTERNAL_TOKEN_PRECISION)).div(Constants.YEAR);

        return proRataYears.mul(emissionRatePerYear);
    }

    /// @notice Calculates the claimable incentives for a particular nToken and account
    function calculateIncentivesToClaim(
        address tokenAddress,
        uint256 nTokenBalance,
        uint256 lastClaimTime,
        uint256 lastClaimIntegralSupply,
        uint256 blockTime,
        uint256 integralTotalSupply
    ) internal view returns (uint256) {
        if (lastClaimTime == 0 || lastClaimTime >= blockTime) return 0;

        // prettier-ignore
        (
            /* currencyId */,
            uint256 emissionRatePerYear,
            /* initializedTime */,
            /* parameters */
        ) = nTokenHandler.getNTokenContext(tokenAddress);

        // No overflow here, checked above
        uint256 timeSinceLastClaim = blockTime - lastClaimTime;
        uint256 incentiveRate =
            _getIncentiveRate(
                timeSinceLastClaim,
                // Convert this to the appropriate denomination
                emissionRatePerYear.mul(uint256(Constants.INTERNAL_TOKEN_PRECISION))
            );

        // Returns the average supply between now and the previous mint time using the integral of the total
        // supply.
        uint256 avgTotalSupply = integralTotalSupply.sub(lastClaimIntegralSupply).div(timeSinceLastClaim);
        if (avgTotalSupply == 0) return 0;

        uint256 incentivesToClaim = nTokenBalance.mul(incentiveRate).div(avgTotalSupply);
        // incentiveRate has a decimal basis of 1e16 so divide by token precision to reduce to 1e8
        incentivesToClaim = incentivesToClaim.div(uint256(Constants.INTERNAL_TOKEN_PRECISION));

        return incentivesToClaim;
    }

    /// @notice Incentives must be claimed every time nToken balance changes
    function claimIncentives(BalanceState memory balanceState, address account)
        internal
        returns (uint256)
    {
        uint256 blockTime = block.timestamp;
        address tokenAddress = nTokenHandler.nTokenAddress(balanceState.currencyId);
        uint256 integralTotalSupply = nTokenHandler.changeNTokenSupply(
            tokenAddress,
            balanceState.netNTokenSupplyChange,
            blockTime
        );

        uint256 incentivesToClaim = calculateIncentivesToClaim(
            tokenAddress,
            uint256(balanceState.storedNTokenBalance),
            balanceState.lastClaimTime,
            balanceState.lastClaimIntegralSupply,
            blockTime,
            integralTotalSupply
        );

        balanceState.lastClaimTime = blockTime;
        balanceState.lastClaimIntegralSupply = integralTotalSupply;

        if (incentivesToClaim > 0) TokenHandler.transferIncentive(account, incentivesToClaim);

        return incentivesToClaim;
    }
}
