// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

library VaderMath {
    /* ========== CONSTANTS ========== */

    uint256 public constant ONE = 1 ether;

    /* ========== LIBRARY FUNCTIONS ========== */

    /**
     * @dev Calculates the amount of liquidity units for the {vaderDeposited}
     * and {assetDeposited} amounts across {totalPoolUnits}.
     *
     * The {vaderBalance} and {assetBalance} are taken into account in order to
     * calculate any necessary slippage adjustment.
     */
    function calculateLiquidityUnits(
        uint256 vaderDeposited,
        uint256 vaderBalance,
        uint256 assetDeposited,
        uint256 assetBalance,
        uint256 totalPoolUnits
    ) public pure returns (uint256) {
        // slipAdjustment
        uint256 slip = calculateSlipAdjustment(
            vaderDeposited,
            vaderBalance,
            assetDeposited,
            assetBalance
        );

        // (Va + vA)
        uint256 poolUnitFactor = (vaderBalance * assetDeposited) +
            (vaderDeposited * assetBalance);

        // 2VA
        uint256 denominator = ONE * 2 * vaderBalance * assetBalance;

        // P * [(Va + vA) / (2 * V * A)] * slipAdjustment
        return ((totalPoolUnits * poolUnitFactor) / denominator) * slip;
    }

    /**
    * @dev Calculates the necessary slippage adjustment for the {vaderDeposited} and {assetDeposited}
    * amounts across the total {vaderBalance} and {assetBalance} amounts.
    */
    function calculateSlipAdjustment(
        uint256 vaderDeposited,
        uint256 vaderBalance,
        uint256 assetDeposited,
        uint256 assetBalance
    ) public pure returns (uint256) {
        // Va
        uint256 vaderAsset = vaderBalance * assetDeposited;

        // aV
        uint256 assetVader = assetBalance * vaderDeposited;

        // (v + V) * (a + A)
        uint256 denominator = (vaderDeposited + vaderBalance) *
            (assetDeposited + assetBalance);

        // 1 - [|Va - aV| / (v + V) * (a + A)]
        return ONE - (delta(vaderAsset, assetVader) / denominator);
    }

    /**
    * @dev Calculates the loss based on the supplied {releasedVader} and {releasedAsset}
    * compared to the supplied {originalVader} and {originalAsset}.
    */
    function calculateLoss(
        uint256 originalVader,
        uint256 originalAsset,
        uint256 releasedVader,
        uint256 releasedAsset
    ) public pure returns (uint256 loss) {
        //
        // TODO: Vader Formula Differs https://github.com/vetherasset/vaderprotocol-contracts/blob/main/contracts/Utils.sol#L347-L356
        //

        // [(A0 * P1) + V0]
        uint256 originalValue = ((originalAsset * releasedVader) /
            releasedAsset) + originalVader;

        // [(A1 * P1) + V1]
        uint256 releasedValue = ((releasedAsset * releasedVader) /
            releasedAsset) + releasedVader;

        // [(A0 * P1) + V0] - [(A1 * P1) + V1]
        if (originalValue > releasedValue) loss = originalValue - releasedValue;
    }

    /**
    * @dev Calculates the {amountOut} of the swap based on the supplied {amountIn}
    * across the supplied {reserveIn} and {reserveOut} amounts.
    */
    function calculateSwap(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        // x * Y * X
        uint256 numerator = amountIn * reserveIn * reserveOut;

        // (x + X) ^ 2
        uint256 denominator = pow(amountIn + reserveIn);

        amountOut = numerator / denominator;
    }

    /**
    * @dev Calculates the {amountIn} of the swap based on the supplied {amountOut}
    * across the supplied {reserveIn} and {reserveOut} amounts.
    */
    function calculateSwapReverse(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountIn) {
        // X * Y
        uint256 XY = reserveIn * reserveOut;

        // 2y
        uint256 y2 = amountOut * 2;

        // 4y
        uint256 y4 = y2 * 2;

        require(
            y4 < reserveOut,
            "VaderMath::calculateSwapReverse: Desired Output Exceeds Maximum Output Possible (1/4 of Liquidity Pool)"
        );

        // root(-X^2 * Y * (4y - Y))    =>    root(X^2 * Y * (Y - 4y)) as Y - 4y >= 0    =>    Y >= 4y holds true
        uint256 numeratorA = root(XY) * root(reserveIn * (reserveOut - y4));

        // X * (2y - Y)    =>    2yX - XY
        uint256 numeratorB = y2 * reserveIn;
        uint256 numeratorC = XY;

        // -1 * (root(-X^2 * Y * (4y - Y)) + (X * (2y - Y)))    =>    -1 * (root(X^2 * Y * (Y - 4y)) + 2yX - XY)    =>    XY - root(X^2 * Y * (Y - 4y) - 2yX
        uint256 numerator = numeratorC - numeratorA - numeratorB;

        // 2y
        uint256 denominator = y2;

        amountIn = numerator / denominator;
    }

    /**
    * @dev Calculates the difference between the supplied {a} and {b} values as a positive number.
    */
    function delta(uint256 a, uint256 b) public pure returns (uint256) {
        return a > b ? a - b : b - a;
    }

    /**
    * @dev Calculates the power of 2 of the supplied {a} value.
    */
    function pow(uint256 a) public pure returns (uint256) {
        return a * a;
    }

    /**
    * @dev Calculates the square root {c} of the supplied {a} value utilizing the Babylonian method:
    * https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method
    */
    function root(uint256 a) public pure returns (uint256 c) {
        if (a > 3) {
            c = a;
            uint256 x = a / 2 + 1;
            while (x < c) {
                c = x;
                x = (a / x + x) / 2;
            }
        } else if (a != 0) {
            c = 1;
        }
    }
}
