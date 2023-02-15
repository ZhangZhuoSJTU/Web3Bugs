// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol";
import '@uniswap/v3-core/contracts/libraries/SafeCast.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import "../../lib/DexData.sol";
import "../../lib/TransferHelper.sol";
import "../../lib/Utils.sol";


contract UniV3Dex is IUniswapV3SwapCallback {
    using SafeMath for uint;
    using TransferHelper for IERC20;
    using SafeCast for uint256;
    using Utils for uint256;
    IUniswapV3Factory public  uniV3Factory;
    uint16 private constant observationSize = 12;

    struct SwapCallData {
        IUniswapV3Pool pool;
        address recipient;
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }

    struct SwapCallbackData {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address payer;
        uint24 transferFeeRate;
    }

    function initializeUniV3(
        IUniswapV3Factory _uniV3Factory
    ) internal {
        uniV3Factory = _uniV3Factory;
    }

    function uniV3Sell(address buyToken, address sellToken, uint24 sellTax, uint24 buyTax, uint sellAmount, uint minBuyAmount, uint24 fee, bool checkPool, address payer, address payee) internal returns (uint amountOut){
        // to slience warning
        buyTax;
        SwapCallbackData memory data = SwapCallbackData({tokenIn : sellToken, tokenOut : buyToken, fee : fee, payer : payer, transferFeeRate: sellTax});
        SwapCallData memory callData;
        callData.zeroForOne = data.tokenIn < data.tokenOut;
        callData.recipient = payee;
        callData.amountSpecified = sellAmount.toInt256();
        callData.sqrtPriceLimitX96 = getSqrtPriceLimitX96(callData.zeroForOne);
        callData.pool = getPool(data.tokenIn, data.tokenOut, fee);
        if (checkPool) {
            require(isPoolObservationsEnough(callData.pool), "Pool observations not enough");
        }
        (int256 amount0, int256 amount1) =
        callData.pool.swap(
            callData.recipient,
            callData.zeroForOne,
            callData.amountSpecified,
            callData.sqrtPriceLimitX96,
            abi.encode(data)
        );
        amountOut = uint256(- (callData.zeroForOne ? amount1 : amount0));
        require(amountOut >= minBuyAmount, 'buy amount less than min');
        require(sellAmount == uint256(callData.zeroForOne ? amount0 : amount1), 'Cannot sell all');
    }

    function uniV3SellMul(uint sellAmount, uint minBuyAmount, DexData.V3PoolData[] memory path) internal returns (uint buyAmount){
        for (uint i = 0; i < path.length; i++) {
            DexData.V3PoolData memory poolData = path[i];
            address buyToken = poolData.tokenB;
            address sellToken = poolData.tokenA;
            bool isLast = i == path.length - 1;
            address payer = i == 0 ? msg.sender : address(this);
            address payee = isLast ? msg.sender : address(this);
            buyAmount = uniV3Sell(buyToken, sellToken, 0, 0, sellAmount, 0, poolData.fee, false, payer, payee);
            if (!isLast) {
                sellAmount = buyAmount;
            }
        }
        require(buyAmount >= minBuyAmount, 'buy amount less than min');
    }

    function uniV3Buy(address buyToken, address sellToken, uint buyAmount, uint maxSellAmount, uint24 fee, bool checkPool, uint24 buyTokenFeeRate, uint24 sellTokenFeeRate) internal returns (uint amountIn){
        SwapCallbackData memory data = SwapCallbackData({tokenIn : sellToken, tokenOut : buyToken, fee : fee, payer : msg.sender, transferFeeRate: sellTokenFeeRate});
        bool zeroForOne = data.tokenIn < data.tokenOut;
        IUniswapV3Pool pool = getPool(data.tokenIn, data.tokenOut, fee);
        if (checkPool) {
            require(isPoolObservationsEnough(pool), "Pool observations not enough");
        }

        buyAmount = buyAmount.toAmountBeforeTax(buyTokenFeeRate);
        int buyAmountInt = - buyAmount.toInt256();

        (int256 amount0Delta, int256 amount1Delta) =
        pool.swap(
            data.payer,
            zeroForOne,
            buyAmountInt,
            getSqrtPriceLimitX96(zeroForOne),
            abi.encode(data)
        );

        uint256 amountOutReceived;
        (amountIn, amountOutReceived) = zeroForOne
        ? (uint256(amount0Delta), uint256(- amount1Delta))
        : (uint256(amount1Delta), uint256(- amount0Delta));
        require(amountOutReceived == buyAmount, 'Cannot buy enough');
        require(amountIn <= maxSellAmount, 'sell amount not enough');
    }


    function uniV3GetPrice(address desToken, address quoteToken, uint8 decimals, uint24 fee) internal view returns (uint256 price, IUniswapV3Pool pool){
        pool = getPool(desToken, quoteToken, fee);
        (uint160 sqrtPriceX96,,,,,,) = pool.slot0();
        price = getPriceBySqrtPriceX96(desToken, quoteToken, sqrtPriceX96, decimals);
    }

    function uniV3GetAvgPrice(address desToken, address quoteToken, uint32 secondsAgo, uint8 decimals, uint24 fee) internal view returns (uint256 price, uint256 timestamp, IUniswapV3Pool pool){
        require(secondsAgo > 0, "SecondsAgo must >0");
        pool = getPool(desToken, quoteToken, fee);
        price = calcAvgPrice(pool, desToken, quoteToken, secondsAgo, decimals);
        timestamp = block.timestamp.sub(secondsAgo);
    }

    function uniV3GetPriceCAvgPriceHAvgPrice(address desToken, address quoteToken, uint32 secondsAgo, uint8 decimals, uint24 fee) internal view returns (uint price, uint cAvgPrice, uint256 hAvgPrice, uint256 timestamp){
        IUniswapV3Pool pool;
        (price, pool) = uniV3GetPrice(desToken, quoteToken, decimals, fee);
        (cAvgPrice, hAvgPrice) = calcAvgPrices(pool, desToken, quoteToken, secondsAgo / 2, secondsAgo, decimals);
        timestamp = block.timestamp.sub(secondsAgo);
    }

    function increaseV3Observation(address desToken, address quoteToken, uint24 fee) internal {
        getPool(desToken, quoteToken, fee).increaseObservationCardinalityNext(observationSize);
    }

    function getPriceBySqrtPriceX96(address desToken, address quoteToken, uint160 sqrtPriceX96, uint8 decimals) internal pure returns (uint256){
        uint priceScale = 10 ** decimals;
        // maximum～2**
        uint token0Price;
        // when sqrtPrice>1  retain 4 decimals
        if (sqrtPriceX96 > (2 ** 96)) {
            token0Price = (uint(sqrtPriceX96) >> (86)).mul((uint(sqrtPriceX96) >> (86))).mul(priceScale) >> (10 * 2);
        } else {
            token0Price = uint(sqrtPriceX96).mul(uint(sqrtPriceX96)).mul(priceScale) >> (96 * 2);
        }
        if (desToken < quoteToken) {
            return token0Price;
        } else {
            return uint(priceScale).mul(priceScale).div(token0Price);
        }
    }

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata _data
    ) external override {
        require(amount0Delta > 0 || amount1Delta > 0);
        SwapCallbackData memory data = abi.decode(_data, (SwapCallbackData));
        require(msg.sender == address(getPool(data.tokenIn, data.tokenOut, data.fee)), "V3 call back invalid");
        uint256 amountToPay = uint256(amount0Delta > 0 ? amount0Delta : amount1Delta).toAmountBeforeTax(data.transferFeeRate);
        if (data.payer == address(this)) {
            IERC20(data.tokenIn).safeTransfer(msg.sender, amountToPay);
        } else {
            IERC20(data.tokenIn).safeTransferFrom(data.payer, msg.sender, amountToPay);
        }
    }

    function calcAvgPrice(IUniswapV3Pool pool, address desToken, address quoteToken, uint32 secondsAgo, uint8 decimals) internal view returns (uint price){
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = 0;
        secondsAgos[1] = secondsAgo;
        (int56[] memory tickCumulatives1,) = pool.observe(secondsAgos);
        int24 avgTick = int24(((tickCumulatives1[0] - tickCumulatives1[1]) / (secondsAgo)));
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(avgTick);
        price = getPriceBySqrtPriceX96(desToken, quoteToken, sqrtPriceX96, decimals);
    }

    function calcAvgPrices(IUniswapV3Pool pool, address desToken, address quoteToken, uint32 second1, uint32 second2, uint8 decimals) internal view returns (uint price1, uint price2){
        uint32[] memory secondsAgos = new uint32[](3);
        secondsAgos[0] = 0;
        secondsAgos[1] = second1;
        secondsAgos[2] = second2;
        (int56[] memory tickCumulatives,) = pool.observe(secondsAgos);
        int24 avgTick1 = int24(((tickCumulatives[0] - tickCumulatives[1]) / (second1)));
        uint160 sqrtPriceX961 = TickMath.getSqrtRatioAtTick(avgTick1);
        price1 = getPriceBySqrtPriceX96(desToken, quoteToken, sqrtPriceX961, decimals);
        int24 avgTick2 = int24(((tickCumulatives[1] - tickCumulatives[2]) / (second2 - second1)));
        uint160 sqrtPriceX962 = TickMath.getSqrtRatioAtTick(avgTick2);
        price2 = getPriceBySqrtPriceX96(desToken, quoteToken, sqrtPriceX962, decimals);
    }

    function getSqrtPriceLimitX96(bool zeroForOne) internal pure returns (uint160) {
        return zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1;
    }

    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) internal view returns (IUniswapV3Pool) {
        if (address(uniV3Factory) == 0x1F98431c8aD98523631AE4a59f267346ea31F984) {
            return IUniswapV3Pool(PoolAddress.computeAddress(address(uniV3Factory) , PoolAddress.getPoolKey(tokenA, tokenB, fee)));
        } else {
            return IUniswapV3Pool(uniV3Factory.getPool(tokenA, tokenB, fee));
        }
    }

    function isPoolObservationsEnough(IUniswapV3Pool pool) internal view returns (bool){
        (,,,,uint16 count,,) = pool.slot0();
        return count >= observationSize;
    }

}