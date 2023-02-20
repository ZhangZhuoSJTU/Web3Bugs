// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.0;

import "./FullMath.sol";
import "hardhat/console.sol";

library SwapLib {
    function handleFees(
        uint256 output,
        uint24 swapFee,
        uint256 barFee,
        uint256 currentLiquidity,
        uint256 totalFeeAmount,
        uint256 amountOut,
        uint256 protocolFee,
        uint256 feeGrowthGlobal
    )
        internal
        pure
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        uint256 feeAmount = FullMath.mulDivRoundingUp(output, swapFee, 1e6);

        totalFeeAmount += feeAmount;

        amountOut += output - feeAmount;

        // @dev Calculate `protocolFee` and convert pips to bips
        uint256 feeDelta = FullMath.mulDivRoundingUp(feeAmount, barFee, 1e4);

        protocolFee += feeDelta;

        // @dev Updating `feeAmount` based on the protocolFee.
        feeAmount -= feeDelta;

        feeGrowthGlobal += FullMath.mulDiv(feeAmount, 0x100000000000000000000000000000000, currentLiquidity);

        return (totalFeeAmount, amountOut, protocolFee, feeGrowthGlobal);
    }
}
