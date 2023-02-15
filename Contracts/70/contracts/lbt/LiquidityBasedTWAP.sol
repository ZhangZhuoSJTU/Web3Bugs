// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../external/libraries/UniswapV2OracleLibrary.sol";

import "../interfaces/external/chainlink/IAggregatorV3.sol";
import "../interfaces/external/uniswap/IUniswapV2Pair.sol";

import "../interfaces/lbt/ILiquidityBasedTWAP.sol";
import "../interfaces/dex-v2/pool/IVaderPoolV2.sol";

contract LiquidityBasedTWAP is ILiquidityBasedTWAP, Ownable {
    /* ========== LIBRARIES ========== */

    using FixedPoint for FixedPoint.uq112x112;
    using FixedPoint for FixedPoint.uq144x112;

    /* ========== STATE VARIABLES ========== */

    address public immutable vader;
    IVaderPoolV2 public immutable vaderPool;

    IUniswapV2Pair[] public vaderPairs;
    IERC20[] public usdvPairs;

    uint256 public override maxUpdateWindow;
    uint256[2] public totalLiquidityWeight;
    uint256[2] public override previousPrices;
    mapping(address => ExchangePair) public twapData;
    mapping(address => IAggregatorV3) public oracles;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _vader, IVaderPoolV2 _vaderPool) {
        require(
            _vader != address(0) && _vaderPool != IVaderPoolV2(address(0)),
            "LBTWAP::construction: Zero Address"
        );
        vader = _vader;
        vaderPool = _vaderPool;
    }

    /* ========== VIEWS ========== */

    function getStaleVaderPrice() external view returns (uint256) {
        uint256 totalPairs = vaderPairs.length;
        uint256[] memory pastLiquidityWeights = new uint256[](totalPairs);
        uint256 pastTotalLiquidityWeight = totalLiquidityWeight[
            uint256(Paths.VADER)
        ];

        for (uint256 i; i < totalPairs; ++i)
            pastLiquidityWeights[i] = twapData[address(vaderPairs[i])]
                .pastLiquidityEvaluation;

        return
            _calculateVaderPrice(
                pastLiquidityWeights,
                pastTotalLiquidityWeight
            );
    }

    function getStaleUSDVPrice() external view returns (uint256) {
        uint256 totalPairs = usdvPairs.length;
        uint256[] memory pastLiquidityWeights = new uint256[](totalPairs);
        uint256 pastTotalLiquidityWeight = totalLiquidityWeight[
            uint256(Paths.USDV)
        ];

        for (uint256 i; i < totalPairs; ++i)
            pastLiquidityWeights[i] = twapData[address(usdvPairs[i])]
                .pastLiquidityEvaluation;

        return
            _calculateUSDVPrice(pastLiquidityWeights, pastTotalLiquidityWeight);
    }

    function getChainlinkPrice(address asset) public view returns (uint256) {
        IAggregatorV3 oracle = oracles[asset];

        (uint80 roundID, int256 price, , , uint80 answeredInRound) = oracle
            .latestRoundData();

        require(
            answeredInRound >= roundID,
            "LBTWAP::getChainlinkPrice: Stale Chainlink Price"
        );

        require(price > 0, "LBTWAP::getChainlinkPrice: Chainlink Malfunction");

        return uint256(price);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function getVaderPrice() external returns (uint256) {
        (
            uint256[] memory pastLiquidityWeights,
            uint256 pastTotalLiquidityWeight
        ) = syncVaderPrice();

        return
            _calculateVaderPrice(
                pastLiquidityWeights,
                pastTotalLiquidityWeight
            );
    }

    function syncVaderPrice()
        public
        override
        returns (
            uint256[] memory pastLiquidityWeights,
            uint256 pastTotalLiquidityWeight
        )
    {
        uint256 _totalLiquidityWeight;
        uint256 totalPairs = vaderPairs.length;
        pastLiquidityWeights = new uint256[](totalPairs);
        pastTotalLiquidityWeight = totalLiquidityWeight[uint256(Paths.VADER)];

        for (uint256 i; i < totalPairs; ++i) {
            IUniswapV2Pair pair = vaderPairs[i];
            ExchangePair storage pairData = twapData[address(pair)];
            uint256 timeElapsed = block.timestamp - pairData.lastMeasurement;

            if (timeElapsed < pairData.updatePeriod) continue;

            uint256 pastLiquidityEvaluation = pairData.pastLiquidityEvaluation;
            uint256 currentLiquidityEvaluation = _updateVaderPrice(
                pair,
                pairData,
                timeElapsed
            );

            pastLiquidityWeights[i] = pastLiquidityEvaluation;

            pairData.pastLiquidityEvaluation = currentLiquidityEvaluation;

            _totalLiquidityWeight += currentLiquidityEvaluation;
        }

        totalLiquidityWeight[uint256(Paths.VADER)] = _totalLiquidityWeight;
    }

    function _updateVaderPrice(
        IUniswapV2Pair pair,
        ExchangePair storage pairData,
        uint256 timeElapsed
    ) internal returns (uint256 currentLiquidityEvaluation) {
        bool isFirst = pair.token0() == vader;

        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();

        (uint256 reserveNative, uint256 reserveForeign) = isFirst
            ? (reserve0, reserve1)
            : (reserve1, reserve0);

        (
            uint256 price0Cumulative,
            uint256 price1Cumulative,
            uint256 currentMeasurement
        ) = UniswapV2OracleLibrary.currentCumulativePrices(address(pair));

        uint256 nativeTokenPriceCumulative = isFirst
            ? price0Cumulative
            : price1Cumulative;

        unchecked {
            pairData.nativeTokenPriceAverage = FixedPoint.uq112x112(
                uint224(
                    (nativeTokenPriceCumulative -
                        pairData.nativeTokenPriceCumulative) / timeElapsed
                )
            );
        }

        pairData.nativeTokenPriceCumulative = nativeTokenPriceCumulative;

        pairData.lastMeasurement = currentMeasurement;

        currentLiquidityEvaluation =
            (reserveNative * previousPrices[uint256(Paths.VADER)]) +
            (reserveForeign * getChainlinkPrice(pairData.foreignAsset));
    }

    function _calculateVaderPrice(
        uint256[] memory liquidityWeights,
        uint256 totalVaderLiquidityWeight
    ) internal view returns (uint256) {
        uint256 totalUSD;
        uint256 totalVader;
        uint256 totalPairs = vaderPairs.length;

        for (uint256 i; i < totalPairs; ++i) {
            IUniswapV2Pair pair = vaderPairs[i];
            ExchangePair storage pairData = twapData[address(pair)];

            uint256 foreignPrice = getChainlinkPrice(pairData.foreignAsset);

            totalUSD +=
                (foreignPrice * liquidityWeights[i]) /
                totalVaderLiquidityWeight;

            totalVader +=
                (pairData
                    .nativeTokenPriceAverage
                    .mul(pairData.foreignUnit)
                    .decode144() * liquidityWeights[i]) /
                totalVaderLiquidityWeight;
        }

        // NOTE: Accuracy of VADER & USDV is 18 decimals == 1 ether
        return (totalUSD * 1 ether) / totalVader;
    }

    function setupVader(
        IUniswapV2Pair pair,
        IAggregatorV3 oracle,
        uint256 updatePeriod,
        uint256 vaderPrice
    ) external onlyOwner {
        require(
            previousPrices[uint256(Paths.VADER)] == 0,
            "LBTWAP::setupVader: Already Initialized"
        );

        previousPrices[uint256(Paths.VADER)] = vaderPrice;

        _addVaderPair(pair, oracle, updatePeriod);
    }

    // NOTE: Discuss whether minimum paired liquidity value should be enforced at code level
    function addVaderPair(
        IUniswapV2Pair pair,
        IAggregatorV3 oracle,
        uint256 updatePeriod
    ) external onlyOwner {
        require(
            previousPrices[uint256(Paths.VADER)] != 0,
            "LBTWAP::addVaderPair: Vader Uninitialized"
        );

        _addVaderPair(pair, oracle, updatePeriod);
    }

    function _addVaderPair(
        IUniswapV2Pair pair,
        IAggregatorV3 oracle,
        uint256 updatePeriod
    ) internal {
        require(
            updatePeriod != 0,
            "LBTWAP::addVaderPair: Incorrect Update Period"
        );

        require(oracle.decimals() == 8, "LBTWAP::addVaderPair: Non-USD Oracle");

        ExchangePair storage pairData = twapData[address(pair)];

        bool isFirst = pair.token0() == vader;

        (address nativeAsset, address foreignAsset) = isFirst
            ? (pair.token0(), pair.token1())
            : (pair.token1(), pair.token0());

        oracles[foreignAsset] = oracle;

        require(nativeAsset == vader, "LBTWAP::addVaderPair: Unsupported Pair");

        pairData.foreignAsset = foreignAsset;
        pairData.foreignUnit = uint96(
            10**uint256(IERC20Metadata(foreignAsset).decimals())
        );

        pairData.updatePeriod = updatePeriod;
        pairData.lastMeasurement = block.timestamp;

        pairData.nativeTokenPriceCumulative = isFirst
            ? pair.price0CumulativeLast()
            : pair.price1CumulativeLast();

        (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();

        (uint256 reserveNative, uint256 reserveForeign) = isFirst
            ? (reserve0, reserve1)
            : (reserve1, reserve0);

        uint256 pairLiquidityEvaluation = (reserveNative *
            previousPrices[uint256(Paths.VADER)]) +
            (reserveForeign * getChainlinkPrice(foreignAsset));

        pairData.pastLiquidityEvaluation = pairLiquidityEvaluation;

        totalLiquidityWeight[uint256(Paths.VADER)] += pairLiquidityEvaluation;

        vaderPairs.push(pair);

        if (maxUpdateWindow < updatePeriod) maxUpdateWindow = updatePeriod;
    }

    function getUSDVPrice() external returns (uint256) {
        (
            uint256[] memory pastLiquidityWeights,
            uint256 pastTotalLiquidityWeight
        ) = syncUSDVPrice();

        return
            _calculateUSDVPrice(pastLiquidityWeights, pastTotalLiquidityWeight);
    }

    function syncUSDVPrice()
        public
        override
        returns (
            uint256[] memory pastLiquidityWeights,
            uint256 pastTotalLiquidityWeight
        )
    {
        uint256 _totalLiquidityWeight;
        uint256 totalPairs = usdvPairs.length;
        pastLiquidityWeights = new uint256[](totalPairs);
        pastTotalLiquidityWeight = totalLiquidityWeight[uint256(Paths.USDV)];

        for (uint256 i; i < totalPairs; ++i) {
            IERC20 foreignAsset = usdvPairs[i];
            ExchangePair storage pairData = twapData[address(foreignAsset)];
            uint256 timeElapsed = block.timestamp - pairData.lastMeasurement;

            if (timeElapsed < pairData.updatePeriod) continue;

            uint256 pastLiquidityEvaluation = pairData.pastLiquidityEvaluation;
            uint256 currentLiquidityEvaluation = _updateUSDVPrice(
                foreignAsset,
                pairData,
                timeElapsed
            );

            pastLiquidityWeights[i] = pastLiquidityEvaluation;

            pairData.pastLiquidityEvaluation = currentLiquidityEvaluation;

            _totalLiquidityWeight += currentLiquidityEvaluation;
        }

        totalLiquidityWeight[uint256(Paths.USDV)] = _totalLiquidityWeight;
    }

    function _updateUSDVPrice(
        IERC20 foreignAsset,
        ExchangePair storage pairData,
        uint256 timeElapsed
    ) internal returns (uint256 currentLiquidityEvaluation) {
        (uint256 reserveNative, uint256 reserveForeign, ) = vaderPool
            .getReserves(foreignAsset);

        (
            uint256 nativeTokenPriceCumulative,
            ,
            uint256 currentMeasurement
        ) = vaderPool.cumulativePrices(foreignAsset);

        unchecked {
            pairData.nativeTokenPriceAverage = FixedPoint.uq112x112(
                uint224(
                    (nativeTokenPriceCumulative -
                        pairData.nativeTokenPriceCumulative) / timeElapsed
                )
            );
        }

        pairData.nativeTokenPriceCumulative = nativeTokenPriceCumulative;

        pairData.lastMeasurement = currentMeasurement;

        currentLiquidityEvaluation =
            (reserveNative * previousPrices[uint256(Paths.USDV)]) +
            (reserveForeign * getChainlinkPrice(address(foreignAsset)));
    }

    function _calculateUSDVPrice(
        uint256[] memory liquidityWeights,
        uint256 totalUSDVLiquidityWeight
    ) internal view returns (uint256) {
        uint256 totalUSD;
        uint256 totalUSDV;
        uint256 totalPairs = usdvPairs.length;

        for (uint256 i; i < totalPairs; ++i) {
            IERC20 foreignAsset = usdvPairs[i];
            ExchangePair storage pairData = twapData[address(foreignAsset)];

            uint256 foreignPrice = getChainlinkPrice(address(foreignAsset));

            totalUSD +=
                (foreignPrice * liquidityWeights[i]) /
                totalUSDVLiquidityWeight;

            totalUSDV +=
                (pairData
                    .nativeTokenPriceAverage
                    .mul(pairData.foreignUnit)
                    .decode144() * liquidityWeights[i]) /
                totalUSDVLiquidityWeight;
        }

        // NOTE: Accuracy of VADER & USDV is 18 decimals == 1 ether
        return (totalUSD * 1 ether) / totalUSDV;
    }

    function setupUSDV(
        IERC20 foreignAsset,
        IAggregatorV3 oracle,
        uint256 updatePeriod,
        uint256 usdvPrice
    ) external onlyOwner {
        require(
            previousPrices[uint256(Paths.USDV)] == 0,
            "LBTWAP::setupUSDV: Already Initialized"
        );

        previousPrices[uint256(Paths.USDV)] = usdvPrice;

        _addUSDVPair(foreignAsset, oracle, updatePeriod);
    }

    // NOTE: Discuss whether minimum paired liquidity value should be enforced at code level
    function addUSDVPair(
        IERC20 foreignAsset,
        IAggregatorV3 oracle,
        uint256 updatePeriod
    ) external onlyOwner {
        require(
            previousPrices[uint256(Paths.USDV)] != 0,
            "LBTWAP::addUSDVPair: USDV Uninitialized"
        );

        _addUSDVPair(foreignAsset, oracle, updatePeriod);
    }

    function _addUSDVPair(
        IERC20 foreignAsset,
        IAggregatorV3 oracle,
        uint256 updatePeriod
    ) internal {
        require(
            updatePeriod != 0,
            "LBTWAP::addUSDVPair: Incorrect Update Period"
        );

        require(oracle.decimals() == 8, "LBTWAP::addUSDVPair: Non-USD Oracle");

        oracles[address(foreignAsset)] = oracle;

        ExchangePair storage pairData = twapData[address(foreignAsset)];

        // NOTE: Redundant
        // pairData.foreignAsset = foreignAsset;

        pairData.foreignUnit = uint96(
            10**uint256(IERC20Metadata(address(foreignAsset)).decimals())
        );

        pairData.updatePeriod = updatePeriod;
        pairData.lastMeasurement = block.timestamp;

        (uint256 nativeTokenPriceCumulative, , ) = vaderPool.cumulativePrices(
            foreignAsset
        );

        pairData.nativeTokenPriceCumulative = nativeTokenPriceCumulative;

        (uint256 reserveNative, uint256 reserveForeign, ) = vaderPool
            .getReserves(foreignAsset);

        uint256 pairLiquidityEvaluation = (reserveNative *
            previousPrices[uint256(Paths.USDV)]) +
            (reserveForeign * getChainlinkPrice(address(foreignAsset)));

        pairData.pastLiquidityEvaluation = pairLiquidityEvaluation;

        totalLiquidityWeight[uint256(Paths.USDV)] += pairLiquidityEvaluation;

        usdvPairs.push(foreignAsset);

        if (maxUpdateWindow < updatePeriod) maxUpdateWindow = updatePeriod;
    }
}
