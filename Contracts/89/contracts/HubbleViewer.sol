// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { IClearingHouse, IMarginAccount, IAMM, IVAMM, IHubbleViewer } from "./Interfaces.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

contract HubbleViewer is IHubbleViewer {
    using SafeCast for uint256;
    using SafeCast for int256;

    int256 constant PRECISION_INT = 1e6;
    uint256 constant PRECISION_UINT = 1e6;

    uint constant VUSD_IDX = 0;

    IClearingHouse public immutable clearingHouse;
    IMarginAccount public immutable marginAccount;
    address public immutable registry;

    struct Position {
        int256 size;
        uint256 openNotional;
        int256 unrealizedPnl;
        uint256 avgOpen;
    }

    /// @dev UI Helper
    struct MarketInfo {
        address amm;
        address underlying;
    }

    constructor(
        IClearingHouse _clearingHouse,
        IMarginAccount _marginAccount,
        address _registry
    ) {
        clearingHouse = _clearingHouse;
        marginAccount = _marginAccount;
        registry = _registry;
    }

    function getMarginFractionAndMakerStatus(address[] calldata traders)
        external
        view
        returns(int256[] memory fractions, bool[] memory isMaker)
    {
        uint len = traders.length;
        fractions = new int256[](len);
        isMaker = new bool[](len);
        for (uint i = 0; i < len; i++) {
            fractions[i] = clearingHouse.getMarginFraction(traders[i]);
            isMaker[i] = clearingHouse.isMaker(traders[i]);
        }
    }

    function getNotionalPositionAndMargin(address[] calldata traders)
        external
        view
        returns(uint256[] memory notionalPositions, int256[] memory margins)
    {
        notionalPositions = new uint256[](traders.length);
        margins = new int256[](traders.length);
        for (uint i = 0; i < traders.length; i++) {
            (notionalPositions[i], margins[i]) = clearingHouse.getNotionalPositionAndMargin(traders[i], true /* includeFundingPayments */);
        }
    }

    function marginAccountLiquidatationStatus(address[] calldata traders)
        external
        view
        returns(IMarginAccount.LiquidationStatus[] memory isLiquidatable, uint[] memory repayAmount, uint[] memory incentivePerDollar)
    {
        isLiquidatable = new IMarginAccount.LiquidationStatus[](traders.length);
        repayAmount = new uint[](traders.length);
        incentivePerDollar = new uint[](traders.length);
        for (uint i = 0; i < traders.length; i++) {
            (isLiquidatable[i], repayAmount[i], incentivePerDollar[i]) = marginAccount.isLiquidatable(traders[i], true);
        }
    }

    /**
    * @notice Get information about all user positions
    * @param trader Trader for which information is to be obtained
    * @return positions in order of amms
    *   positions[i].size - BaseAssetQuantity amount longed (+ve) or shorted (-ve)
    *   positions[i].openNotional - $ value of position
    *   positions[i].unrealizedPnl - in dollars. +ve is profit, -ve if loss
    *   positions[i].avgOpen - Average $ value at which position was started
    */
    function userPositions(address trader) external view returns(Position[] memory positions) {
        uint l = clearingHouse.getAmmsLength();
        positions = new Position[](l);
        for (uint i = 0; i < l; i++) {
            IAMM amm = clearingHouse.amms(i);
            (positions[i].size, positions[i].openNotional, ) = amm.positions(trader);
            if (positions[i].size == 0) {
                positions[i].unrealizedPnl = 0;
                positions[i].avgOpen = 0;
            } else {
                (,positions[i].unrealizedPnl) = amm.getTakerNotionalPositionAndUnrealizedPnl(trader);
                positions[i].avgOpen = positions[i].openNotional * 1e18 / _abs(positions[i].size).toUint256();
            }
        }
    }

    /**
    * @notice Get information about maker's all impermanent positions
    * @param maker Maker for which information is to be obtained
    * @return positions in order of amms
    *   positions[i].size - BaseAssetQuantity amount longed (+ve) or shorted (-ve)
    *   positions[i].openNotional - $ value of position
    *   positions[i].unrealizedPnl - in dollars. +ve is profit, -ve if loss
    *   positions[i].avgOpen - Average $ value at which position was started
    */
    function makerPositions(address maker) external view returns(Position[] memory positions) {
        uint l = clearingHouse.getAmmsLength();
        positions = new Position[](l);
        for (uint i = 0; i < l; i++) {
            (
                positions[i].size,
                positions[i].openNotional,
                positions[i].unrealizedPnl
            ) = getMakerPositionAndUnrealizedPnl(maker, i);
            if (positions[i].size == 0) {
                positions[i].avgOpen = 0;
            } else {
                positions[i].avgOpen = positions[i].openNotional * 1e18 / _abs(positions[i].size).toUint256();
            }
        }
    }

    function markets() external view returns(MarketInfo[] memory _markets) {
        uint l = clearingHouse.getAmmsLength();
        _markets = new MarketInfo[](l);
        for (uint i = 0; i < l; i++) {
            IAMM amm = clearingHouse.amms(i);
            _markets[i] = MarketInfo(address(amm), amm.underlyingAsset());
        }
    }

    /**
    * Get final margin fraction and liquidation price if user longs/shorts baseAssetQuantity
    * @param idx AMM Index
    * @param baseAssetQuantity Positive if long, negative if short, scaled 18 decimals
    * @return expectedMarginFraction Resultant Margin fraction when the trade is executed
    * @return quoteAssetQuantity USD rate for the trade
    * @return liquidationPrice Mark Price at which trader will be liquidated
    */
    function getTakerExpectedMFAndLiquidationPrice(address trader, uint idx, int256 baseAssetQuantity)
        external
        view
        returns (int256 expectedMarginFraction, uint256 quoteAssetQuantity, uint256 liquidationPrice)
    {
        IAMM amm = clearingHouse.amms(idx);
        // get quoteAsset required to swap baseAssetQuantity
        quoteAssetQuantity = getQuote(baseAssetQuantity, idx);

        // get total notionalPosition and margin (including unrealizedPnL and funding)
        (uint256 notionalPosition, int256 margin) = clearingHouse.getNotionalPositionAndMargin(trader, true /* includeFundingPayments */);

        // get market specific position info
        (int256 takerPosSize,,) = amm.positions(trader);
        uint takerNowNotional = amm.getCloseQuote(takerPosSize);
        uint takerUpdatedNotional = amm.getCloseQuote(takerPosSize + baseAssetQuantity);
        // Calculate new total notionalPosition
        notionalPosition = notionalPosition + takerUpdatedNotional - takerNowNotional;

        margin -= _calculateTradeFee(quoteAssetQuantity).toInt256();
        expectedMarginFraction = _getMarginFraction(margin, notionalPosition);
        liquidationPrice = _getLiquidationPrice(trader, amm, notionalPosition, margin, baseAssetQuantity, quoteAssetQuantity);
    }

    /**
    * Get final margin fraction and liquidation price if user add/remove liquidity
    * @param idx AMM Index
    * @param vUSD vUSD amount to be added in the pool (in 6 decimals)
    * @param isRemove true is liquidity is being removed, false if added
    * @return expectedMarginFraction Resultant Margin fraction after the tx
    * @return liquidationPrice Mark Price at which maker will be liquidated
    */
    function getMakerExpectedMFAndLiquidationPrice(address trader, uint idx, uint vUSD, bool isRemove)
        external
        view
        returns (int256 expectedMarginFraction, uint256 liquidationPrice)
    {
        // get total notionalPosition and margin (including unrealizedPnL and funding)
        (uint256 notionalPosition, int256 margin) = clearingHouse.getNotionalPositionAndMargin(trader, true /* includeFundingPayments */);

        IAMM amm = clearingHouse.amms(idx);

        // get taker info
        (int256 takerPosSize,,) = amm.positions(trader);
        uint takerNotional = amm.getCloseQuote(takerPosSize);
        // get maker info
        (uint makerDebt,,,,,,) = amm.makers(trader);
        // calculate total value of deposited liquidity after the tx
        if (isRemove) {
            makerDebt = 2 * (makerDebt - vUSD);
        } else {
            makerDebt = 2 * (makerDebt + vUSD);
        }

        {
            // calculate effective notionalPosition
            (int256 makerPosSize,,) = getMakerPositionAndUnrealizedPnl(trader, idx);
            uint totalPosNotional = amm.getCloseQuote(makerPosSize + takerPosSize);
            notionalPosition += _max(makerDebt + takerNotional, totalPosNotional);
        }

        {
            (uint nowNotional,,,) = amm.getNotionalPositionAndUnrealizedPnl(trader);
            notionalPosition -= nowNotional;
        }

        expectedMarginFraction = _getMarginFraction(margin, notionalPosition);
        liquidationPrice = _getLiquidationPrice(trader, amm, notionalPosition, margin, 0, 0);
    }

    function getLiquidationPrice(address trader, uint idx) external view returns (uint liquidationPrice) {
        // get total notionalPosition and margin (including unrealizedPnL and funding)
        (uint256 notionalPosition, int256 margin) = clearingHouse.getNotionalPositionAndMargin(trader, true /* includeFundingPayments */);
        IAMM amm = clearingHouse.amms(idx);
        liquidationPrice = _getLiquidationPrice(trader, amm, notionalPosition, margin, 0, 0);
    }

    /**
    * @notice get maker impermanent position and unrealizedPnl for a particular amm
    * @param _maker maker address
    * @param idx amm index
    * @return position Maker's current impermanent position
    * @return openNotional Position open notional for the current impermanent position inclusive of fee earned
    * @return unrealizedPnl PnL if maker removes liquidity and closes their impermanent position in the same amm
    */
    function getMakerPositionAndUnrealizedPnl(address _maker, uint idx)
        override
        public
        view
        returns (int256 position, uint openNotional, int256 unrealizedPnl)
    {
        IAMM amm = clearingHouse.amms(idx);
        IVAMM vamm = amm.vamm();

        (uint vUSD, uint vAsset, uint dToken,,,,) = amm.makers(_maker);
        (position, openNotional, unrealizedPnl) = vamm.get_maker_position(dToken, vUSD, vAsset, dToken);
    }

    /**
    * @notice calculate amount of quote asset required for trade
    * @param baseAssetQuantity base asset to long/short
    * @param idx amm index
    */
    function getQuote(int256 baseAssetQuantity, uint idx) public view returns(uint256 quoteAssetQuantity) {
        IAMM amm = clearingHouse.amms(idx);
        IVAMM vamm = amm.vamm();

        if (baseAssetQuantity >= 0) {
            return vamm.get_dx(0, 1, baseAssetQuantity.toUint256()) + 1;
        }
        // rounding-down while shorting is not a problem
        // because lower the min_dy, more permissible it is
        return vamm.get_dy(1, 0, (-baseAssetQuantity).toUint256());
    }

    /**
    * @notice calculate amount of base asset required for trade
    * @param quoteAssetQuantity amount of quote asset to long/short
    * @param idx amm index
    * @param isLong long - true, short - false
    */
    function getBase(uint256 quoteAssetQuantity, uint idx, bool isLong) external view returns(int256 /* baseAssetQuantity */) {
        IAMM amm = clearingHouse.amms(idx);
        IVAMM vamm = amm.vamm();

        uint256 baseAssetQuantity;
        if (isLong) {
            baseAssetQuantity = vamm.get_dy(0, 1, quoteAssetQuantity);
            return baseAssetQuantity.toInt256();
        }
        baseAssetQuantity = vamm.get_dx(1, 0, quoteAssetQuantity);
        return -(baseAssetQuantity.toInt256());
    }

    /**
    * @notice Get total liquidity deposited by maker and its current value
    * @param _maker maker for which information to be obtained
    * @return
    *   vAsset - current base asset amount of maker in the pool
    *   vUSD - current quote asset amount of maker in the pool
    *   totalDeposited - total value of initial liquidity deposited in the pool by maker
    *   dToken - maker dToken balance
    *   vAssetBalance - base token liquidity in the pool
    *   vUSDBalance - quote token liquidity in the pool
    */
    function getMakerLiquidity(address _maker, uint idx) external view returns (uint vAsset, uint vUSD, uint totalDeposited, uint dToken, uint vAssetBalance, uint vUSDBalance) {
        IAMM amm = clearingHouse.amms(idx);
        IVAMM vamm = amm.vamm();
        (vUSD,, dToken,,,,) = amm.makers(_maker);

        totalDeposited = 2 * vUSD;
        uint totalDTokenSupply = vamm.totalSupply();
        vUSDBalance = vamm.balances(0);
        vAssetBalance = vamm.balances(1);

        if (totalDTokenSupply > 0) {
            vUSD = vUSDBalance * dToken / totalDTokenSupply;
            vAsset = vAssetBalance * dToken / totalDTokenSupply;
        }
    }

    /**
    * @notice calculate base and quote asset amount form dToken
     */
    function calcWithdrawAmounts(uint dToken, uint idx) external view returns (uint quoteAsset, uint baseAsset) {
        IAMM amm = clearingHouse.amms(idx);
        IVAMM vamm = amm.vamm();

        uint totalDTokenSupply = vamm.totalSupply();
        if (totalDTokenSupply > 0) {
            quoteAsset = vamm.balances(0) * dToken / totalDTokenSupply;
            baseAsset = vamm.balances(1) * dToken / totalDTokenSupply;
        }
    }

    /**
    * @notice Get amount of token to add/remove given the amount of other token
    * @param inputAmount quote/base asset amount to add or remove, base - 18 decimal, quote - 6 decimal
    * @param isBase true if inputAmount is base asset
    * @param deposit true -> addLiquidity, false -> removeLiquidity
    * @return fillAmount base/quote asset amount to be added/removed
    *         dToken - equivalent dToken amount
    */
    function getMakerQuote(uint idx, uint inputAmount, bool isBase, bool deposit) external view returns (uint fillAmount, uint dToken) {
        IAMM amm = clearingHouse.amms(idx);
        IVAMM vamm = amm.vamm();

        if (isBase) {
            // calculate quoteAsset amount, fillAmount = quoteAsset, inputAmount = baseAsset
            uint baseAssetBal = vamm.balances(1);
            if (baseAssetBal == 0) {
                fillAmount = inputAmount * vamm.price_scale() / 1e30;
            } else {
                fillAmount = inputAmount * vamm.balances(0) / baseAssetBal;
            }
            dToken = vamm.calc_token_amount([fillAmount, inputAmount], deposit);
        } else {
            uint bal0 = vamm.balances(0);
            // calculate quote asset amount, fillAmount = baseAsset, inputAmount = quoteAsset
            if (bal0 == 0) {
                fillAmount = inputAmount * 1e30 / vamm.price_scale();
            } else {
                fillAmount = inputAmount * vamm.balances(1) / bal0;
            }
            dToken = vamm.calc_token_amount([inputAmount, fillAmount], deposit);
        }
    }

    /**
    * @notice get user margin for all collaterals
    */
    function userInfo(address trader) external view returns(int256[] memory) {
        uint length = marginAccount.supportedAssetsLen();
        int256[] memory _margin = new int256[](length);
        // -ve funding means user received funds
        _margin[VUSD_IDX] = marginAccount.margin(VUSD_IDX, trader) - clearingHouse.getTotalFunding(trader);
        for (uint i = 1; i < length; i++) {
            _margin[i] = marginAccount.margin(i, trader);
        }
        return _margin;
    }

    /**
    * @notice get user account information
    */
    function getAccountInfo(address trader) external view returns (
        int totalCollateral,
        int256 freeMargin,
        int256 marginFraction,
        uint notionalPosition,
        int256 unrealizedPnl
    ) {
        int256 margin;
        (margin, totalCollateral) = marginAccount.weightedAndSpotCollateral(trader);
        marginFraction = clearingHouse.getMarginFraction(trader);
        (notionalPosition, unrealizedPnl) = clearingHouse.getTotalNotionalPositionAndUnrealizedPnl(trader);
        int256 minAllowableMargin = clearingHouse.minAllowableMargin();
        freeMargin = margin + unrealizedPnl - clearingHouse.getTotalFunding(trader) - notionalPosition.toInt256() * minAllowableMargin / PRECISION_INT;
    }

    // Internal

    /**
    * @dev At liquidation,
    * (margin + pnl) / notionalPosition = maintenanceMargin (MM)
    * => pnl = MM * notionalPosition - margin
    *
    * for long, pnl = liquidationPrice * size - openNotional
    * => liquidationPrice = (pnl + openNotional) / size
    *
    * for short, pnl = openNotional - liquidationPrice * size
    * => liquidationPrice = (openNotional - pnl) / size
    */
    function _getLiquidationPrice(
            address trader,
            IAMM amm,
            uint256 notionalPosition,
            int256 margin,
            int256 baseAssetQuantity,
            uint quoteAssetQuantity
        )
        internal
        view
        returns(uint256 liquidationPrice)
    {
        if (notionalPosition == 0) {
            return 0;
        }

        (, int256 unrealizedPnl, int256 totalPosSize, uint256 openNotional) = amm.getNotionalPositionAndUnrealizedPnl(trader);

        if (baseAssetQuantity != 0) {
            // Calculate effective position and openNotional
            if (baseAssetQuantity * totalPosSize >= 0) { // increasingPosition i.e. same direction trade
                openNotional += quoteAssetQuantity;
            } else { // open reverse position
                uint totalPosNotional = amm.getCloseQuote(totalPosSize + baseAssetQuantity);
                if (_abs(totalPosSize) >= _abs(baseAssetQuantity)) { // position side remains same after the trade
                    (openNotional,) = amm.getOpenNotionalWhileReducingPosition(
                        totalPosSize,
                        totalPosNotional,
                        unrealizedPnl,
                        baseAssetQuantity
                    );
                } else { // position side changes after the trade
                    openNotional = totalPosNotional;
                }
            }
            totalPosSize += baseAssetQuantity;
        }

        int256 pnlForLiquidation = clearingHouse.maintenanceMargin() * notionalPosition.toInt256() / PRECISION_INT - margin;
        int256 _liquidationPrice;
        if (totalPosSize > 0) {
            _liquidationPrice = (openNotional.toInt256() + pnlForLiquidation) * 1e18 / totalPosSize;
        } else if (totalPosSize < 0) {
            _liquidationPrice = (openNotional.toInt256() - pnlForLiquidation) * 1e18 / (-totalPosSize);
        }

        if (_liquidationPrice < 0) { // is this possible?
            _liquidationPrice = 0;
        }
        return _liquidationPrice.toUint256();
    }

    function _calculateTradeFee(uint quoteAsset) internal view returns (uint) {
        return quoteAsset * clearingHouse.tradeFee() / PRECISION_UINT;
    }

    // Pure

    function _getMarginFraction(int256 accountValue, uint notionalPosition) private pure returns(int256) {
        if (notionalPosition == 0) {
            return type(int256).max;
        }
        return accountValue * PRECISION_INT / notionalPosition.toInt256();
    }

    function _abs(int x) private pure returns (int) {
        return x >= 0 ? x : -x;
    }

    function _max(uint x, uint y) private pure returns (uint) {
        return x >= y ? x : y;
    }
}
