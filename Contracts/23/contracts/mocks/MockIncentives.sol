// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >0.7.0;
pragma experimental ABIEncoderV2;

import "../internal/balances/Incentives.sol";
import "../internal/nTokenHandler.sol";

contract MockIncentives {
    function setNTokenParameters(
        uint16 currencyId,
        address tokenAddress,
        int256 totalSupply,
        uint32 emissionRate,
        uint32 blockTime
    ) external returns (uint256) {
        nTokenHandler.setNTokenAddress(currencyId, tokenAddress);
        nTokenHandler.setIncentiveEmissionRate(tokenAddress, emissionRate);
        return nTokenHandler.changeNTokenSupply(tokenAddress, totalSupply, blockTime);
    }

    function calculateIntegralTotalSupply(address tokenAddress, uint256 blockTime) 
        external
        view 
        returns (uint256, uint256, uint256) 
    {
        return nTokenHandler.calculateIntegralTotalSupply(tokenAddress, blockTime);
    }

    function calculateIncentivesToClaim(
        address tokenAddress,
        uint256 nTokenBalance,
        uint256 lastClaimTime,
        uint256 lastClaimIntegralSupply,
        uint256 blockTime
    ) external view returns (uint256) {
        // prettier-ignore
        (
            /* */,
            uint256 integralTotalSupply,
            /* */
        ) = nTokenHandler.calculateIntegralTotalSupply(tokenAddress, blockTime);

        return
            Incentives.calculateIncentivesToClaim(
                tokenAddress,
                nTokenBalance,
                lastClaimTime,
                lastClaimIntegralSupply,
                blockTime,
                integralTotalSupply
            );
    }
}
