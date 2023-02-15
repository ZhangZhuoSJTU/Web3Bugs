// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "../math/Fixed256xVar.sol";

library AMMBalancesHelper {
    using Fixed256xVar for uint256;

    uint256 internal constant ONE = 1e18;

    function getLiquidityProvisionSharesAmounts(uint256[] memory ammBalances, uint256 shares)
        internal
        pure
        returns (uint256[] memory)
    {
        uint256[2] memory ammDepositPercentages = getAMMBalancesRatio(ammBalances);
        uint256[] memory ammLiquidityProvisionAmounts = new uint256[](2);

        (ammLiquidityProvisionAmounts[0], ammLiquidityProvisionAmounts[1]) = (
            shares.mulfV(ammDepositPercentages[0], ONE),
            shares.mulfV(ammDepositPercentages[1], ONE)
        );

        return ammLiquidityProvisionAmounts;
    }

    function getAMMBalancesRatio(uint256[] memory ammBalances) internal pure returns (uint256[2] memory balancesRatio) {
        uint256 rate = ammBalances[0].divfV(ammBalances[1], ONE);

        (balancesRatio[0], balancesRatio[1]) = rate > ONE ? (ONE, ONE.divfV(rate, ONE)) : (rate, ONE);
    }
}
