// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "../../external/libraries/FixedPoint.sol";

interface ILiquidityBasedTWAP {
    /* ========== STRUCTS ========== */

    struct ExchangePair {
        uint256 nativeTokenPriceCumulative;
        FixedPoint.uq112x112 nativeTokenPriceAverage;
        uint256 lastMeasurement;
        uint256 updatePeriod;
        uint256 pastLiquidityEvaluation;
        address foreignAsset;
        uint96 foreignUnit;
    }

    enum Paths {
        VADER,
        USDV
    }

    /* ========== FUNCTIONS ========== */

    function previousPrices(uint256 i) external returns (uint256);

    function maxUpdateWindow() external returns (uint256);

    function getVaderPrice() external returns (uint256);

    function syncVaderPrice()
        external
        returns (
            uint256[] memory pastLiquidityWeights,
            uint256 pastTotalLiquidityWeight
        );

    function getUSDVPrice() external returns (uint256);

    function syncUSDVPrice()
        external
        returns (
            uint256[] memory pastLiquidityWeights,
            uint256 pastTotalLiquidityWeight
        );

    /* ========== EVENTS ========== */
}
