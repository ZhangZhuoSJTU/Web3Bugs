// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../Types.sol";
import "../lib/DexData.sol";


contract QueryHelper {
    using DexData for bytes;
    using SafeMath for uint;

    constructor ()
    {

    }
    struct PositionVars {
        uint deposited;
        uint held;
        uint borrowed;
        uint marginRatio;
        uint32 marginLimit;
    }
    enum LiqStatus{
        HEALTHY, // Do nothing
        UPDATE, // Need update price
        WAITING, // Waiting
        LIQ, // Can liquidate
        NOP// No position
    }

    struct LiqVars {
        LiqStatus status;
        uint lastUpdateTime;
        uint currentMarginRatio;
        uint cAvgMarginRatio;
        uint hAvgMarginRatio;
        uint32 marginLimit;
    }

    struct PoolVars {
        uint totalBorrows;
        uint cash;
        uint totalReserves;
        uint availableForBorrow;
        uint insurance;
        uint supplyRatePerBlock;
        uint borrowRatePerBlock;
        uint reserveFactorMantissa;
        uint exchangeRate;
        uint baseRatePerBlock;
        uint multiplierPerBlock;
        uint jumpMultiplierPerBlock;
        uint kink;
    }

    struct XOLEVars {
        uint totalStaked;
        uint totalShared;
        uint tranferedToAccount;
        uint devFund;
        uint balanceOf;
    }

    function getTraderPositons(IOpenLev openLev, uint16 marketId, address[] calldata traders, bool[] calldata longTokens, bytes calldata dexData) external view returns (PositionVars[] memory results){
        results = new PositionVars[](traders.length);
        IOpenLev.MarketVar memory market = openLev.markets(marketId);
        for (uint i = 0; i < traders.length; i++) {
            PositionVars memory item;
            Types.Trade memory trade = openLev.activeTrades(traders[i], marketId, longTokens[i]);
            if (trade.held == 0) {
                results[i] = item;
                continue;
            }
            item.held = trade.held;
            item.deposited = trade.deposited;
            (item.marginRatio,,,item.marginLimit) = openLev.marginRatio(traders[i], marketId, longTokens[i], dexData);
            item.borrowed = longTokens[i] ? market.pool0.borrowBalanceCurrent(traders[i]) : market.pool1.borrowBalanceCurrent(traders[i]);
            results[i] = item;
        }
        return results;
    }

    struct LiqReqVars {
        IOpenLev openLev;
        address owner;
        uint16 marketId;
        bool longToken;
        uint256 token0price;
        uint256 token0cAvgPrice;
        uint256 token1price;
        uint256 token1cAvgPrice;
        uint256 timestamp;
        bytes dexData;
    }
    //offchain call
    function getTraderLiqs(IOpenLev openLev, uint16 marketId, address[] calldata traders, bool[] calldata longTokens, bytes calldata dexData) external returns (LiqVars[] memory results){
        results = new LiqVars[](traders.length);
        LiqReqVars memory reqVar;
        reqVar.openLev = openLev;
        reqVar.marketId = marketId;
        reqVar.dexData = dexData;
        IOpenLev.MarketVar memory market = reqVar.openLev.markets(reqVar.marketId);
        IOpenLev.AddressConfig memory adrConf = reqVar.openLev.addressConfig();
        IOpenLev.CalculateConfig memory calConf = reqVar.openLev.getCalculateConfig();
        (,,,, reqVar.timestamp) = adrConf.dexAggregator.getPriceCAvgPriceHAvgPrice(market.token0, market.token1, calConf.twapDuration, reqVar.dexData);
        openLev.updatePrice(marketId, dexData);
        (reqVar.token0price, reqVar.token0cAvgPrice,,,) = adrConf.dexAggregator.getPriceCAvgPriceHAvgPrice(market.token0, market.token1, calConf.twapDuration, reqVar.dexData);
        (reqVar.token1price, reqVar.token1cAvgPrice,,,) = adrConf.dexAggregator.getPriceCAvgPriceHAvgPrice(market.token1, market.token0, calConf.twapDuration, reqVar.dexData);

        for (uint i = 0; i < traders.length; i++) {
            reqVar.owner = traders[i];
            reqVar.longToken = longTokens[i];
            LiqVars memory item;
            Types.Trade memory trade = reqVar.openLev.activeTrades(reqVar.owner, reqVar.marketId, reqVar.longToken);
            if (trade.held == 0) {
                item.status = LiqStatus.NOP;
                results[i] = item;
                continue;
            }
            item.lastUpdateTime = reqVar.timestamp;
            (item.currentMarginRatio, item.cAvgMarginRatio, item.hAvgMarginRatio, item.marginLimit) = reqVar.openLev.marginRatio(reqVar.owner, reqVar.marketId, reqVar.longToken, reqVar.dexData);
            if (item.currentMarginRatio > item.marginLimit && item.cAvgMarginRatio > item.marginLimit && item.hAvgMarginRatio > item.marginLimit) {
                item.status = LiqStatus.HEALTHY;
            }
            else if (item.currentMarginRatio < item.marginLimit && item.cAvgMarginRatio > item.marginLimit && item.hAvgMarginRatio > item.marginLimit) {
                if (dexData.isUniV2Class()) {
                    if (block.timestamp - calConf.twapDuration > item.lastUpdateTime) {
                        item.status = LiqStatus.UPDATE;
                    } else {
                        item.status = LiqStatus.WAITING;
                    }
                } else {
                    item.status = LiqStatus.WAITING;
                }
            } else if (item.currentMarginRatio < item.marginLimit && item.cAvgMarginRatio < item.marginLimit) {
                //Liq
                if (block.timestamp - calConf.twapDuration > item.lastUpdateTime || item.hAvgMarginRatio < item.marginLimit) {
                    // cAvgRatio diff currentRatio >+-5% ,waiting
                    if ((longTokens[i] == false && reqVar.token0cAvgPrice > reqVar.token0price && reqVar.token0cAvgPrice.mul(100).div(reqVar.token0price) - 100 >= calConf.maxLiquidationPriceDiffientRatio)
                        || (longTokens[i] == true && reqVar.token1cAvgPrice > reqVar.token1price && reqVar.token1cAvgPrice.mul(100).div(reqVar.token1price) - 100 >= calConf.maxLiquidationPriceDiffientRatio)) {
                        if (dexData.isUniV2Class()) {
                            item.status = LiqStatus.UPDATE;
                        } else {
                            item.status = LiqStatus.WAITING;
                        }
                    } else {
                        item.status = LiqStatus.LIQ;
                    }
                } else {
                    item.status = LiqStatus.WAITING;
                }
            }
            results[i] = item;
        }
        return results;
    }
    // offchain call
    function calPriceCAvgPriceHAvgPrice(IOpenLev openLev, uint16 marketId, address desToken, address quoteToken, uint32 secondsAgo, bytes memory dexData) external
    returns (uint price, uint cAvgPrice, uint256 hAvgPrice, uint8 decimals, uint256 timestamp){
        IOpenLev.AddressConfig memory adrConf = openLev.addressConfig();
        (,,,, timestamp) = adrConf.dexAggregator.getPriceCAvgPriceHAvgPrice(desToken, quoteToken, secondsAgo, dexData);
        openLev.updatePrice(marketId, dexData);
        (price, cAvgPrice, hAvgPrice, decimals,) = adrConf.dexAggregator.getPriceCAvgPriceHAvgPrice(desToken, quoteToken, secondsAgo, dexData);
    }

    struct LiqCallVars {
        uint defaultFees;
        uint newFees;
        uint penalty;
        uint heldAfterFees;
        uint borrows;
        uint currentBuyAmount;
        uint currentSellAmount;
        bool canRepayBorrows;
    }
    //offchain call slippage 10%=>100
    function getLiqCallData(IOpenLev openLev, IV3Quoter v3Quoter, uint16 marketId, uint16 slippage, address trader, bool longToken, bytes memory dexData) external returns (uint minOrMaxAmount,
        bytes memory callDexData)
    {
        IOpenLev.MarketVar memory market = openLev.markets(marketId);
        Types.Trade memory trade = openLev.activeTrades(trader, marketId, longToken);
        LiqCallVars memory callVars;
        // cal remain held after fees and penalty
        callVars.defaultFees = trade.held.mul(market.feesRate).div(10000);
        callVars.newFees = callVars.defaultFees;
        IOpenLev.AddressConfig memory adrConf = openLev.addressConfig();
        IOpenLev.CalculateConfig memory calConf = openLev.getCalculateConfig();
        // if trader holds more xOLE, then should enjoy trading discount.
        if (IXOLE(adrConf.xOLE).balanceOf(trader) > calConf.feesDiscountThreshold) {
            callVars.newFees = callVars.defaultFees.sub(callVars.defaultFees.mul(calConf.feesDiscount).div(100));
        }
        // if trader update price, then should enjoy trading discount.
        if (market.priceUpdater == trader) {
            callVars.newFees = callVars.newFees.sub(callVars.defaultFees.mul(calConf.updatePriceDiscount).div(100));
        }
        callVars.penalty = trade.held.mul(calConf.penaltyRatio).div(10000);
        callVars.heldAfterFees = trade.held.sub(callVars.penalty).sub(callVars.newFees);
        callVars.borrows = longToken ? market.pool0.borrowBalanceCurrent(trader) : market.pool1.borrowBalanceCurrent(trader);

        callVars.currentBuyAmount = dexData.isUniV2Class() ?
        adrConf.dexAggregator.calBuyAmount(longToken ?
            market.token0 : market.token1, longToken ? market.token1 : market.token0, callVars.heldAfterFees, dexData) :
        v3Quoter.quoteExactInputSingle(longToken ? market.token1 : market.token0, longToken ? market.token0 : market.token1, dexData.toFee(), callVars.heldAfterFees, 0);
        callVars.canRepayBorrows = callVars.currentBuyAmount >= callVars.borrows;
        //flash sell,cal minBuyAmount
        if (trade.depositToken != longToken || !callVars.canRepayBorrows) {
            minOrMaxAmount = callVars.currentBuyAmount.sub(callVars.currentBuyAmount.mul(slippage).div(1000));
            callDexData = dexData.isUniV2Class() ? dexData : abi.encodePacked(dexData, hex"01");
        }
        // flash buy,cal maxSellAmount
        else {
            callVars.currentSellAmount = dexData.isUniV2Class() ?
            adrConf.dexAggregator.calSellAmount(longToken ?
                market.token0 : market.token1, longToken ? market.token1 : market.token0, callVars.borrows, dexData) :
            v3Quoter.quoteExactOutputSingle(longToken ? market.token1 : market.token0, longToken ? market.token0 : market.token1, dexData.toFee(), callVars.borrows, 0);
            minOrMaxAmount = callVars.currentSellAmount.add(callVars.currentSellAmount.mul(slippage).div(1000));
            callDexData = dexData.isUniV2Class() ? dexData : abi.encodePacked(dexData, hex"00");
        }
    }

    function getPoolDetails(IOpenLev openLev, uint16[] calldata marketIds, LPoolInterface[] calldata pools) external view returns (PoolVars[] memory results){
        results = new PoolVars[](pools.length);
        for (uint i = 0; i < pools.length; i++) {
            LPoolInterface pool = pools[i];
            IOpenLev.MarketVar memory market = openLev.markets(marketIds[i]);
            PoolVars memory item;
            item.insurance = address(market.pool0) == address(pool) ? market.pool0Insurance : market.pool1Insurance;
            item.cash = pool.getCash();
            item.totalBorrows = pool.totalBorrowsCurrent();
            item.totalReserves = pool.totalReserves();
            item.availableForBorrow = pool.availableForBorrow();
            item.supplyRatePerBlock = pool.supplyRatePerBlock();
            item.borrowRatePerBlock = pool.borrowRatePerBlock();
            item.reserveFactorMantissa = pool.reserveFactorMantissa();
            item.exchangeRate = pool.exchangeRateStored();
            item.baseRatePerBlock = pool.baseRatePerBlock();
            item.multiplierPerBlock = pool.multiplierPerBlock();
            item.jumpMultiplierPerBlock = pool.jumpMultiplierPerBlock();
            item.kink = pool.kink();
            results[i] = item;
        }
        return results;
    }

    function getXOLEDetail(IXOLE xole, IERC20 balanceOfToken) external view returns (XOLEVars memory vars){
        vars.totalStaked = xole.totalLocked();
        vars.totalShared = xole.totalRewarded();
        vars.tranferedToAccount = xole.withdrewReward();
        vars.devFund = xole.devFund();
        if (address(0) != address(balanceOfToken)) {
            vars.balanceOf = balanceOfToken.balanceOf(address(xole));
        }
    }
}

interface IXOLE {
    function totalLocked() external view returns (uint256);

    function totalRewarded() external view returns (uint256);

    function withdrewReward() external view returns (uint256);

    function devFund() external view returns (uint256);

    function balanceOf(address addr) external view returns (uint256);


}

interface DexAggregatorInterface {
    function calBuyAmount(address buyToken, address sellToken, uint sellAmount, bytes memory data) external view returns (uint);

    function calSellAmount(address buyToken, address sellToken, uint buyAmount, bytes memory data) external view returns (uint);

    function getPriceCAvgPriceHAvgPrice(address desToken, address quoteToken, uint32 secondsAgo, bytes memory dexData) external view returns (uint price, uint cAvgPrice, uint256 hAvgPrice, uint8 decimals, uint256 timestamp);

}

interface IV3Quoter {
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut);

    function quoteExactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountIn);
}

interface IOpenLev {
    struct MarketVar {// Market info
        LPoolInterface pool0;       // Lending Pool 0
        LPoolInterface pool1;       // Lending Pool 1
        address token0;              // Lending Token 0
        address token1;              // Lending Token 1
        uint16 marginLimit;         // Margin ratio limit for specific trading pair. Two decimal in percentage, ex. 15.32% => 1532
        uint16 feesRate;            // feesRate 30=>0.3%
        uint16 priceDiffientRatio;
        address priceUpdater;
        uint pool0Insurance;        // Insurance balance for token 0
        uint pool1Insurance;        // Insurance balance for token 1
    }

    struct AddressConfig {
        DexAggregatorInterface dexAggregator;
        address controller;
        address wETH;
        address xOLE;
    }

    struct CalculateConfig {
        uint16 defaultFeesRate; // 30 =>0.003
        uint8 insuranceRatio; // 33=>33%
        uint16 defaultMarginLimit; // 3000=>30%
        uint16 priceDiffientRatio; //10=>10%
        uint16 updatePriceDiscount;//25=>25%
        uint16 feesDiscount; // 25=>25%
        uint128 feesDiscountThreshold; //  30 * (10 ** 18) minimal holding of xOLE to enjoy fees discount
        uint16 penaltyRatio;//100=>1%
        uint8 maxLiquidationPriceDiffientRatio;//30=>30%
        uint16 twapDuration;//28=>28s
    }

    function activeTrades(address owner, uint16 marketId, bool longToken) external view returns (Types.Trade memory);

    function marginRatio(address owner, uint16 marketId, bool longToken, bytes memory dexData) external view returns (uint current, uint cAvg, uint hAvg, uint32 limit);

    function markets(uint16 marketId) external view returns (MarketVar memory);

    function getMarketSupportDexs(uint16 marketId) external view returns (uint32[] memory);

    function addressConfig() external view returns (AddressConfig memory);

    function getCalculateConfig() external view returns (CalculateConfig memory);

    function updatePrice(uint16 marketId, bytes memory dexData) external;

}
