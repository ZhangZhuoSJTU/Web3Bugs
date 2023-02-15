// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./OpenLevInterface.sol";
import "./Types.sol";
import "./Adminable.sol";
import "./DelegateInterface.sol";
import "./ControllerInterface.sol";
import "./IWETH.sol";
import "./XOLEInterface.sol";
import "./Types.sol";
import "./OpenLevV1Lib.sol";

/// @title OpenLeverage margin trade logic
/// @author OpenLeverage
/// @notice Use this contract for margin trade.
/// @dev Admin of this contract is the address of Timelock. Admin set configs and transfer insurance expected to XOLE.
contract OpenLevV1 is DelegateInterface, Adminable, ReentrancyGuard, OpenLevInterface, OpenLevStorage {
    using SafeMath for uint;
    using TransferHelper for IERC20;
    using DexData for bytes;

    constructor ()
    {
    }

    /// @notice initialize proxy contract
    /// @dev This function is not supposed to call multiple times. All configs can be set through other functions.
    /// @param _controller Address of contract ControllerDelegator.
    /// @param _dexAggregator contract DexAggregatorDelegator.
    /// @param depositTokens Tokens allowed to deposit. Removed from logic. Allows all tokens.
    /// @param _wETH Address of wrapped native coin.
    /// @param _xOLE Address of XOLEDelegator.
    /// @param _supportDexs Indexes of Dexes supported. Indexes are listed in contracts/lib/DexData.sol.
    function initialize(
        address _controller,
        DexAggregatorInterface _dexAggregator,
        address[] memory depositTokens,
        address _wETH,
        address _xOLE,
        uint8[] memory _supportDexs
    ) public {
        depositTokens;
        require(msg.sender == admin, "NAD");
        addressConfig.controller = _controller;
        addressConfig.dexAggregator = _dexAggregator;
        addressConfig.wETH = _wETH;
        addressConfig.xOLE = _xOLE;
        for (uint i = 0; i < _supportDexs.length; i++) {
            supportDexs[_supportDexs[i]] = true;
        }
        OpenLevV1Lib.setCalculateConfigInternal(22, 33, 2500, 5, 25, 25, 5000e18, 500, 5, 60, calculateConfig);
    }

    /// @notice Create new trading pair.
    /// @dev This function is typically called by ControllerDelegator.
    /// @param pool0 Contract LpoolDelegator, lending pool of token0.
    /// @param pool1 Contract LpoolDelegator, lending pool of token1.
    /// @param marginLimit The liquidation trigger ratio of deposited token value to borrowed token value.
    /// @param dexData Pair initiate data including index, feeRate of the Dex and tax rate of the underlying tokens.
    /// @return The new created pair ID.
    function addMarket(
        LPoolInterface pool0,
        LPoolInterface pool1,
        uint16 marginLimit,
        bytes memory dexData
    ) external override returns (uint16) {
        uint16 marketId = numPairs;
        OpenLevV1Lib.addMarket(pool0, pool1, marginLimit, dexData, marketId, markets, calculateConfig, addressConfig, supportDexs, taxes);
        numPairs ++;
        return marketId;
    }

    /// @notice Margin trade or just add more deposit tokens.
    /// @dev To support token with tax and reward. Stores share of all token balances of this contract.
    /// @param longToken Token to long. False for token0, true for token1.
    /// @param depositToken Token to deposit. False for token0, true for token1.
    /// @param deposit Amount of ERC20 tokens to deposit. WETH deposit is not supported.
    /// @param borrow Amount of ERC20 to borrow from the short token pool.
    /// @param minBuyAmount Slippage for Dex trading.
    /// @param dexData Index and fee rate for the trading Dex.
    function marginTrade(
        uint16 marketId,
        bool longToken,
        bool depositToken,
        uint deposit,
        uint borrow,
        uint minBuyAmount,
        bytes memory dexData
    ) external payable override nonReentrant onlySupportDex(dexData) {
        Types.TradeVars memory tv;
        Types.MarketVars memory vars = toMarketVar(longToken, true, markets[marketId]);
        verifyTrade(vars, marketId, longToken, depositToken, deposit, borrow, dexData);
        (ControllerInterface(addressConfig.controller)).marginTradeAllowed(marketId);

        if (dexData.isUniV2Class()) {
            OpenLevV1Lib.updatePriceInternal(address(vars.buyToken), address(vars.sellToken), dexData);
        }

        tv.totalHeld = totalHelds[address(vars.buyToken)];
        tv.depositErc20 = depositToken == longToken ? vars.buyToken : vars.sellToken;

        deposit = transferIn(msg.sender, tv.depositErc20, deposit);

        // Borrow
        uint borrowed;
        if (borrow > 0) {
            {
                uint balance = vars.sellToken.balanceOf(address(this));
                vars.sellPool.borrowBehalf(msg.sender, borrow);
                borrowed = vars.sellToken.balanceOf(address(this)).sub(balance);
            }

            if (depositToken == longToken){
                (uint currentPrice, uint8 priceDecimals) = addressConfig.dexAggregator.getPrice(address(vars.sellToken), address(vars.buyToken), dexData);
                tv.borrowValue = borrow.mul(currentPrice).div(10 ** uint(priceDecimals));
            }else{
                tv.borrowValue = borrow;
            }
        }

        require(borrow == 0 || deposit.mul(10000).div(tv.borrowValue) > vars.marginLimit, "MAM");
        tv.fees = feesAndInsurance(msg.sender, deposit.add(tv.borrowValue), address(tv.depositErc20), marketId, tv.totalHeld, vars.reserveBuyToken);
        tv.depositAfterFees = deposit.sub(tv.fees);
        tv.dexDetail = dexData.toDexDetail();

        if (depositToken == longToken ){
            if (borrowed > 0){
                tv.newHeld = flashSell(marketId, address(vars.buyToken), address(vars.sellToken), borrowed, minBuyAmount, dexData);
                tv.token0Price = longToken ? tv.newHeld.mul(1e18).div(borrowed) : borrowed.mul(1e18).div(tv.newHeld);
            }
            tv.newHeld = tv.newHeld.add(tv.depositAfterFees);
        }else{
            tv.tradeSize = tv.depositAfterFees.add(borrowed);
            tv.newHeld = flashSell(marketId, address(vars.buyToken), address(vars.sellToken), tv.tradeSize, minBuyAmount, dexData);
            tv.token0Price = longToken ? tv.newHeld.mul(1e18).div(tv.tradeSize) : tv.tradeSize.mul(1e18).div(tv.newHeld);
        }

        Types.Trade storage trade = activeTrades[msg.sender][marketId][longToken];
        tv.newHeld = OpenLevV1Lib.amountToShare(tv.newHeld, tv.totalHeld, vars.reserveBuyToken);
        trade.held = trade.held.add(tv.newHeld);
        trade.depositToken = depositToken;
        trade.deposited = trade.deposited.add(tv.depositAfterFees);
        trade.lastBlockNum = uint128(block.number);

        totalHelds[address(vars.buyToken)] = totalHelds[address(vars.buyToken)].add(tv.newHeld);

        require(OpenLevV1Lib.isPositionHealthy(
                msg.sender,
                true,
                OpenLevV1Lib.shareToAmount(trade.held, totalHelds[address(vars.buyToken)], vars.buyToken.balanceOf(address(this))),
                vars,
                dexData
            ), "PNH");

        emit MarginTrade(msg.sender, marketId, longToken, depositToken, deposit, borrow, tv.newHeld, tv.fees, tv.token0Price, tv.dexDetail);
    }

    /// @notice Close trade by shares.
    /// @dev To support token with tax, function expect to fail if share of borrowed funds not repayed.
    /// @param longToken Token to long. False for token0, true for token1.
    /// @param closeHeld Amount of shares to close.
    /// @param minOrMaxAmount Slippage for Dex trading.
    /// @param dexData Index and fee rate for the trading Dex.
    function closeTrade(uint16 marketId, bool longToken, uint closeHeld, uint minOrMaxAmount, bytes memory dexData) external override nonReentrant onlySupportDex(dexData) {
        Types.Trade storage trade = activeTrades[msg.sender][marketId][longToken];
        Types.MarketVars memory marketVars = toMarketVar(longToken, false, markets[marketId]);

        //verify
        verifyCloseBefore(trade, marketVars, closeHeld, dexData);

        uint closeAmount = OpenLevV1Lib.shareToAmount(closeHeld, totalHelds[address(marketVars.sellToken)], marketVars.reserveSellToken);

        Types.CloseTradeVars memory closeTradeVars;
        closeTradeVars.fees = feesAndInsurance(msg.sender, closeAmount, address(marketVars.sellToken), marketId, totalHelds[address(marketVars.sellToken)], marketVars.reserveSellToken);
        closeTradeVars.closeAmountAfterFees = closeAmount.sub(closeTradeVars.fees);
        closeTradeVars.closeRatio = closeHeld.mul(1e18).div(trade.held);
        closeTradeVars.isPartialClose = closeHeld != trade.held;
        closeTradeVars.borrowed = marketVars.buyPool.borrowBalanceCurrent(msg.sender);
        closeTradeVars.repayAmount = Utils.toAmountBeforeTax(closeTradeVars.borrowed, taxes[marketId][address(marketVars.buyToken)][0]);
        closeTradeVars.dexDetail = dexData.toDexDetail();

        //partial close
        if (closeTradeVars.isPartialClose) {
            closeTradeVars.repayAmount = closeTradeVars.repayAmount.mul(closeTradeVars.closeRatio).div(1e18);
            closeTradeVars.depositDecrease = trade.deposited.mul(closeTradeVars.closeRatio).div(1e18);
            trade.deposited = trade.deposited.sub(closeTradeVars.depositDecrease);
        } else {
            closeTradeVars.depositDecrease = trade.deposited;
        }

        if (trade.depositToken != longToken) {
            minOrMaxAmount = Utils.maxOf(closeTradeVars.repayAmount, minOrMaxAmount);
            closeTradeVars.receiveAmount = flashSell(marketId, address(marketVars.buyToken), address(marketVars.sellToken), closeTradeVars.closeAmountAfterFees, minOrMaxAmount, dexData);
            require(closeTradeVars.receiveAmount >= closeTradeVars.repayAmount, "ISR");

            closeTradeVars.sellAmount = closeTradeVars.closeAmountAfterFees;
            marketVars.buyPool.repayBorrowBehalf(msg.sender, closeTradeVars.repayAmount);

            closeTradeVars.depositReturn = closeTradeVars.receiveAmount.sub(closeTradeVars.repayAmount);
            doTransferOut(msg.sender, marketVars.buyToken, closeTradeVars.depositReturn);
        } else {
            uint balance = marketVars.buyToken.balanceOf(address(this));
            minOrMaxAmount = Utils.minOf(closeTradeVars.closeAmountAfterFees, minOrMaxAmount);
            closeTradeVars.sellAmount = flashBuy(marketId, address(marketVars.buyToken), address(marketVars.sellToken), closeTradeVars.repayAmount, minOrMaxAmount, dexData);
            closeTradeVars.receiveAmount = marketVars.buyToken.balanceOf(address(this)).sub(balance);
            require(closeTradeVars.receiveAmount >= closeTradeVars.repayAmount, "ISR");

            marketVars.buyPool.repayBorrowBehalf(msg.sender, closeTradeVars.repayAmount);
            closeTradeVars.depositReturn = closeTradeVars.closeAmountAfterFees.sub(closeTradeVars.sellAmount);
            require(marketVars.sellToken.balanceOf(address(this)) >= closeTradeVars.depositReturn, "ISB");
            doTransferOut(msg.sender, marketVars.sellToken, closeTradeVars.depositReturn);
        }

        uint repayed = closeTradeVars.borrowed.sub(marketVars.buyPool.borrowBalanceCurrent(msg.sender));
        require(repayed >= closeTradeVars.borrowed.mul(closeTradeVars.closeRatio).div(1e18), "IRP");

        if (!closeTradeVars.isPartialClose) {
            delete activeTrades[msg.sender][marketId][longToken];
        }else{
            trade.held = trade.held.sub(closeHeld);
            trade.lastBlockNum = uint128(block.number);
        }

        totalHelds[address(marketVars.sellToken)] = totalHelds[address(marketVars.sellToken)].sub(closeHeld);

        closeTradeVars.token0Price = longToken ? closeTradeVars.sellAmount.mul(1e18).div(closeTradeVars.receiveAmount) : closeTradeVars.receiveAmount.mul(1e18).div(closeTradeVars.sellAmount);
        if (dexData.isUniV2Class()) {
            OpenLevV1Lib.updatePriceInternal(address(marketVars.buyToken), address(marketVars.sellToken), dexData);
        }

        emit TradeClosed(msg.sender, marketId, longToken, trade.depositToken, closeAmount, closeTradeVars.depositDecrease, closeTradeVars.depositReturn, closeTradeVars.fees,
            closeTradeVars.token0Price, closeTradeVars.dexDetail);
    }

    /// @notice Liquidate if trade below margin limit.
    /// @dev For trades without sufficient funds to repay, use insurance.
    /// @param owner Owner of the trade to liquidate.
    /// @param longToken Token to long. False for token0, true for token1.
    /// @param minBuy Slippage for Dex trading.
    /// @param maxSell Slippage for Dex trading.
    /// @param dexData Index and fee rate for the trading Dex.
    function liquidate(address owner, uint16 marketId, bool longToken, uint minBuy, uint maxSell, bytes memory dexData) external override nonReentrant onlySupportDex(dexData) {
        Types.Trade memory trade = activeTrades[owner][marketId][longToken];
        Types.MarketVars memory marketVars = toMarketVar(longToken, false, markets[marketId]);
        if (dexData.isUniV2Class()) {
            OpenLevV1Lib.updatePriceInternal(address(marketVars.buyToken), address(marketVars.sellToken), dexData);
        }

        verifyCloseOrLiquidateBefore(trade.held, trade.lastBlockNum, marketVars.dexs, dexData.toDexDetail());
        uint closeAmount = OpenLevV1Lib.shareToAmount(trade.held, totalHelds[address(marketVars.sellToken)], marketVars.reserveSellToken);

        (ControllerInterface(addressConfig.controller)).liquidateAllowed(marketId, msg.sender, closeAmount, dexData);
        require(!OpenLevV1Lib.isPositionHealthy(owner, false, closeAmount, marketVars, dexData), "PIH");

        Types.LiquidateVars memory liquidateVars;
        liquidateVars.fees = feesAndInsurance(owner, closeAmount, address(marketVars.sellToken), marketId, totalHelds[address(marketVars.sellToken)], marketVars.reserveSellToken);
        liquidateVars.penalty = closeAmount.mul(calculateConfig.penaltyRatio).div(10000);
        if (liquidateVars.penalty > 0) {
            doTransferOut(msg.sender, marketVars.sellToken, liquidateVars.penalty);
        }
        liquidateVars.remainAmountAfterFees = closeAmount.sub(liquidateVars.fees).sub(liquidateVars.penalty);
        liquidateVars.dexDetail = dexData.toDexDetail();
        liquidateVars.borrowed = marketVars.buyPool.borrowBalanceCurrent(owner);
        liquidateVars.borrowed = Utils.toAmountBeforeTax(liquidateVars.borrowed, taxes[marketId][address(marketVars.buyToken)][0]);
        liquidateVars.marketId = marketId;
        liquidateVars.longToken = longToken;

        bool buySuccess;
        bytes memory sellAmountData;
        if (longToken == trade.depositToken) {
            maxSell = Utils.minOf(maxSell, liquidateVars.remainAmountAfterFees);
            marketVars.sellToken.safeApprove(address(addressConfig.dexAggregator), maxSell);
            (buySuccess, sellAmountData) = address(addressConfig.dexAggregator).call(
                abi.encodeWithSelector(addressConfig.dexAggregator.buy.selector, address(marketVars.buyToken), address(marketVars.sellToken), taxes[liquidateVars.marketId][address(marketVars.buyToken)][2],
                taxes[liquidateVars.marketId][address(marketVars.sellToken)][1], liquidateVars.borrowed, maxSell, dexData)
            );
        }

        if (buySuccess) {
            {
                uint temp;
                assembly {
                    temp := mload(add(sellAmountData, 0x20))
                }
                liquidateVars.sellAmount = temp;
            }

            liquidateVars.receiveAmount = marketVars.buyToken.balanceOf(address(this)).sub(marketVars.reserveBuyToken);
            marketVars.buyPool.repayBorrowBehalf(owner, liquidateVars.borrowed);
            liquidateVars.depositReturn = liquidateVars.remainAmountAfterFees.sub(liquidateVars.sellAmount);
            doTransferOut(owner, marketVars.sellToken, liquidateVars.depositReturn);
        } else {
            liquidateVars.sellAmount = liquidateVars.remainAmountAfterFees;
            liquidateVars.receiveAmount = flashSell(marketId, address(marketVars.buyToken), address(marketVars.sellToken), liquidateVars.sellAmount, minBuy, dexData);
            if (liquidateVars.receiveAmount >= liquidateVars.borrowed) {
                // fail if buy failed but sell succeeded
                require (longToken != trade.depositToken, "PH");
                marketVars.buyPool.repayBorrowBehalf(owner, liquidateVars.borrowed);
                liquidateVars.depositReturn = liquidateVars.receiveAmount.sub(liquidateVars.borrowed);
                doTransferOut(owner, marketVars.buyToken, liquidateVars.depositReturn);
            } else {
                liquidateVars.finalRepayAmount = reduceInsurance(liquidateVars.borrowed, liquidateVars.receiveAmount, liquidateVars.marketId, liquidateVars.longToken, address(marketVars.buyToken), marketVars.reserveBuyToken);
                liquidateVars.outstandingAmount = liquidateVars.borrowed.sub(liquidateVars.finalRepayAmount);
                marketVars.buyPool.repayBorrowEndByOpenLev(owner, liquidateVars.finalRepayAmount);
            }
        }

        liquidateVars.token0Price = longToken ? liquidateVars.sellAmount.mul(1e18).div(liquidateVars.receiveAmount) : liquidateVars.receiveAmount.mul(1e18).div(liquidateVars.sellAmount);
        totalHelds[address(marketVars.sellToken)] = totalHelds[address(marketVars.sellToken)].sub(trade.held);

        emit Liquidation(owner, marketId, longToken, trade.depositToken, trade.held, liquidateVars.outstandingAmount, msg.sender,
            trade.deposited, liquidateVars.depositReturn, liquidateVars.fees, liquidateVars.token0Price, liquidateVars.penalty, liquidateVars.dexDetail);

        delete activeTrades[owner][marketId][longToken];
    }

    function toMarketVar(bool longToken, bool open, Types.Market storage market) internal view returns (Types.MarketVars memory) {
        return open == longToken ?
        Types.MarketVars(
            market.pool1,
            market.pool0,
            IERC20(market.token1),
            IERC20(market.token0),
            IERC20(market.token1).balanceOf(address(this)),
            IERC20(market.token0).balanceOf(address(this)),
            market.pool1Insurance,
            market.pool0Insurance,
            market.marginLimit,
            market.priceDiffientRatio,
            market.dexs) :
        Types.MarketVars(
            market.pool0,
            market.pool1,
            IERC20(market.token0),
            IERC20(market.token1),
            IERC20(market.token0).balanceOf(address(this)),
            IERC20(market.token1).balanceOf(address(this)),
            market.pool0Insurance,
            market.pool1Insurance,
            market.marginLimit,
            market.priceDiffientRatio,
            market.dexs);
    }

    /// @notice Get ratios of deposited token value to borrowed token value.
    /// @dev Caluclate ratio with current price and twap price.
    /// @param owner Owner of the trade to liquidate.
    /// @param longToken Token to long. False for token0, true for token1.
    /// @param dexData Index and fee rate for the trading Dex.
    /// @return current Margin ratio calculated using current price.
    /// @return cAvg Margin ratio calculated using twap price.
    /// @return hAvg Margin ratio calculated using last recorded twap price.
    /// @return limit The liquidation trigger ratio of deposited token value to borrowed token value.
    function marginRatio(address owner, uint16 marketId, bool longToken, bytes memory dexData) external override onlySupportDex(dexData) view returns (uint current, uint cAvg, uint hAvg, uint32 limit) {
        Types.MarketVars memory vars = toMarketVar(longToken, false, markets[marketId]);
        limit = vars.marginLimit;
        (current, cAvg, hAvg,,) =
        OpenLevV1Lib.marginRatio(
            owner,
            activeTrades[owner][marketId][longToken].held,
            address(vars.sellToken),
            address(vars.buyToken),
            vars.buyPool,
            false,
            dexData
        );
    }

    /// @notice Check if a price update is required on Dex.
    /// @param dexData Index and fee rate for the trading Dex.
    function shouldUpdatePrice(uint16 marketId, bytes memory dexData) external override view returns (bool){
        Types.Market memory market = markets[marketId];
        return OpenLevV1Lib.shouldUpdatePriceInternal(addressConfig.dexAggregator, calculateConfig.twapDuration,  market.priceDiffientRatio, market.token0, market.token1, dexData);
    }

    /// @notice Update price on Dex.
    /// @param dexData Index and fee rate for the trading Dex.
    function updatePrice(uint16 marketId, bytes memory dexData) external override {
        OpenLevV1Lib.updatePrice(marketId, markets[marketId], addressConfig, calculateConfig, dexData);
    }

    /// @notice List of all supporting Dexes.
    function getMarketSupportDexs(uint16 marketId) external override view returns (uint32[] memory){
        return markets[marketId].dexs;
    }

    function reduceInsurance(uint totalRepayment, uint remaining, uint16 marketId, bool longToken, address token, uint reserve) internal returns (uint maxCanRepayAmount) {
        Types.Market storage market = markets[marketId];
        uint needed = totalRepayment.sub(remaining);
        needed = OpenLevV1Lib.amountToShare(needed, totalHelds[token], reserve);
        maxCanRepayAmount = totalRepayment;
        if (longToken) {
            if (market.pool0Insurance >= needed) {
                market.pool0Insurance = market.pool0Insurance - needed;
                totalHelds[token] = totalHelds[token].sub(needed);
            } else {
                maxCanRepayAmount = OpenLevV1Lib.shareToAmount(market.pool0Insurance, totalHelds[token], reserve);
                maxCanRepayAmount = maxCanRepayAmount.add(remaining);
                totalHelds[token] = totalHelds[token].sub(market.pool0Insurance);
                market.pool0Insurance = 0;
            }
        } else {
            if (market.pool1Insurance >= needed) {
                market.pool1Insurance = market.pool1Insurance - needed;
            } else {
                maxCanRepayAmount = OpenLevV1Lib.shareToAmount(market.pool1Insurance, totalHelds[token], reserve);
                maxCanRepayAmount = maxCanRepayAmount.add(remaining);
                totalHelds[token] = totalHelds[token].sub(market.pool1Insurance);
                market.pool1Insurance = 0;
            }
        }
    }

    function feesAndInsurance(address trader, uint tradeSize, address token, uint16 marketId, uint totalHeld, uint reserve) internal returns (uint) {
        // (uint fee, uint newInsurance) = OpenLevV1Lib.feesAndInsurance(markets[marketId], calculateConfig, addressConfig.xOLE, trader, tradeSize, token);
        Types.Market storage market = markets[marketId];
        uint defaultFees = tradeSize.mul(market.feesRate).div(10000);
        uint newFees = defaultFees;
        // if trader holds more xOLE, then should enjoy trading discount.
        if (XOLEInterface(addressConfig.xOLE).balanceOf(trader) > calculateConfig.feesDiscountThreshold) {
            newFees = defaultFees.sub(defaultFees.mul(calculateConfig.feesDiscount).div(100));
        }
        // if trader update price, then should enjoy trading discount.
        if (market.priceUpdater == trader) {
            newFees = newFees.sub(defaultFees.mul(calculateConfig.updatePriceDiscount).div(100));
        }
        uint newInsurance = newFees.mul(calculateConfig.insuranceRatio).div(100);
        IERC20(token).safeTransfer(addressConfig.xOLE, newFees.sub(newInsurance));

        newInsurance = OpenLevV1Lib.amountToShare(newInsurance, totalHeld, reserve);
        if (token == market.token1) {
            market.pool1Insurance = market.pool1Insurance.add(newInsurance);
        } else {
            market.pool0Insurance = market.pool0Insurance.add(newInsurance);
        }

        totalHelds[token] = totalHelds[token].add(newInsurance);
        return newFees;
    }

    function flashSell(uint16 marketId, address buyToken, address sellToken, uint sellAmount, uint minBuyAmount, bytes memory data) internal returns (uint buyAmount){
        if (sellAmount > 0){
            DexAggregatorInterface dexAggregator = addressConfig.dexAggregator;
            IERC20(sellToken).safeApprove(address(dexAggregator), sellAmount);
            buyAmount = dexAggregator.sell(buyToken, sellToken, taxes[marketId][buyToken][2], taxes[marketId][sellToken][1], sellAmount, minBuyAmount, data);
        }
    }

    function flashBuy(uint16 marketId, address buyToken, address sellToken, uint buyAmount, uint maxSellAmount, bytes memory data) internal returns (uint sellAmount){
        if (buyAmount > 0){
            DexAggregatorInterface dexAggregator = addressConfig.dexAggregator;
            IERC20(sellToken).safeApprove(address(dexAggregator), maxSellAmount);
            sellAmount = dexAggregator.buy(buyToken, sellToken, taxes[marketId][buyToken][2], taxes[marketId][sellToken][1], buyAmount, maxSellAmount, data);
        }
    }

    /// @dev All credited on this contract and share with all token holder if any rewards for the transfer.
    function transferIn(address from, IERC20 token, uint amount) internal returns (uint) {
        return OpenLevV1Lib.transferIn(from, token, addressConfig.wETH, amount);
    }

    /// @dev All credited on "to" if any taxes for the transfer.
    function doTransferOut(address to, IERC20 token, uint amount) internal {
        OpenLevV1Lib.doTransferOut(to, token, addressConfig.wETH, amount);
    }

    /*** Admin Functions ***/
    function setCalculateConfig(uint16 defaultFeesRate,
        uint8 insuranceRatio,
        uint16 defaultMarginLimit,
        uint16 priceDiffientRatio,
        uint16 updatePriceDiscount,
        uint16 feesDiscount,
        uint128 feesDiscountThreshold,
        uint16 penaltyRatio,
        uint8 maxLiquidationPriceDiffientRatio,
        uint16 twapDuration) external override onlyAdmin() {
        OpenLevV1Lib.setCalculateConfigInternal(defaultFeesRate, insuranceRatio, defaultMarginLimit, priceDiffientRatio, updatePriceDiscount,
            feesDiscount, feesDiscountThreshold, penaltyRatio, maxLiquidationPriceDiffientRatio, twapDuration, calculateConfig);
        emit NewCalculateConfig(defaultFeesRate, insuranceRatio, defaultMarginLimit, priceDiffientRatio, updatePriceDiscount, feesDiscount, feesDiscountThreshold, penaltyRatio, maxLiquidationPriceDiffientRatio, twapDuration);
    }

    function setAddressConfig(address controller, DexAggregatorInterface dexAggregator) external override onlyAdmin() {
        OpenLevV1Lib.setAddressConfigInternal(controller, dexAggregator, addressConfig);
        emit NewAddressConfig(controller, address(dexAggregator));
    }

    function setMarketConfig(uint16 marketId, uint16 feesRate, uint16 marginLimit, uint16 priceDiffientRatio, uint32[] memory dexs) external override onlyAdmin() {
        OpenLevV1Lib.setMarketConfigInternal(feesRate, marginLimit, priceDiffientRatio, dexs, markets[marketId]);
        emit NewMarketConfig(marketId, feesRate, marginLimit, priceDiffientRatio, dexs);
    }

    /// @notice List of all supporting Dexes.
    /// @param poolIndex index of insurance pool, 0 for token0, 1 for token1
    function moveInsurance(uint16 marketId, uint8 poolIndex, address to, uint amount) external override nonReentrant() onlyAdmin() {
        Types.Market storage market = markets[marketId];
        if (poolIndex == 0) {
            market.pool0Insurance = market.pool0Insurance.sub(amount);
            (IERC20(market.token0)).safeTransfer(to, OpenLevV1Lib.shareToAmount(amount, totalHelds[market.token0], IERC20(market.token0).balanceOf(address(this))));
            return;
        }
        market.pool1Insurance = market.pool1Insurance.sub(amount);
        (IERC20(market.token1)).safeTransfer(to, OpenLevV1Lib.shareToAmount(amount, totalHelds[market.token1], IERC20(market.token1).balanceOf(address(this))));
    }

    function setSupportDex(uint8 dex, bool support) public override onlyAdmin() {
        supportDexs[dex] = support;
    }

    function setTaxRate(uint16 marketId, address token, uint index, uint24 tax) external override onlyAdmin(){
        taxes[marketId][token][index] = tax;
    }

    function verifyTrade(Types.MarketVars memory vars, uint16 marketId, bool longToken, bool depositToken, uint deposit, uint borrow, bytes memory dexData) internal view {
        Types.Trade memory trade = activeTrades[msg.sender][marketId][longToken];
        OpenLevV1Lib.verifyTrade(vars, longToken, depositToken, deposit, borrow, dexData, addressConfig, trade);
    }

    function verifyCloseBefore(Types.Trade memory trade, Types.MarketVars memory vars, uint closeHeld, bytes memory dexData) internal view {
        verifyCloseOrLiquidateBefore(trade.held, trade.lastBlockNum, vars.dexs, dexData.toDexDetail());
        require(closeHeld <= trade.held, "CBH");
    }

    function verifyCloseOrLiquidateBefore(uint held, uint lastBlockNumber, uint32[] memory dexs, uint32 dex) internal view {
        require(held != 0 && lastBlockNumber != block.number && OpenLevV1Lib.isInSupportDex(dexs, dex), "HI0");
    }

    modifier onlySupportDex(bytes memory dexData) {
        require(OpenLevV1Lib.isSupportDex(supportDexs, dexData.toDex()), "UDX");
        _;
    }
}