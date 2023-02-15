// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { Governable } from "./legos/Governable.sol";
import { ERC20Detailed, IOracle, IRegistry, IVAMM, IAMM } from "./Interfaces.sol";

contract AMM is IAMM, Governable {
    using SafeCast for uint256;
    using SafeCast for int256;

    uint256 public constant spotPriceTwapInterval = 1 hours;
    uint256 public constant fundingPeriod = 1 hours;
    int256 constant BASE_PRECISION = 1e18;

    // System-wide config

    IOracle public oracle;
    address public clearingHouse;

    // AMM config

    IVAMM override public vamm;
    address override public underlyingAsset;
    string public name;

    uint256 public fundingBufferPeriod;
    uint256 public nextFundingTime;
    int256 public fundingRate;
    int256 public cumulativePremiumFraction;
    int256 public cumulativePremiumPerDtoken;
    int256 public posAccumulator;

    uint256 public longOpenInterestNotional;
    uint256 public shortOpenInterestNotional;

    enum Side { LONG, SHORT }
    struct Position {
        int256 size;
        uint256 openNotional;
        int256 lastPremiumFraction;
    }
    mapping(address => Position) override public positions;

    struct Maker {
        uint vUSD;
        uint vAsset;
        uint dToken;
        int pos; // position
        int posAccumulator; // value of global.posAccumulator until which pos has been updated
        int lastPremiumFraction;
        int lastPremiumPerDtoken;
    }
    mapping(address => Maker) override public makers;

    struct ReserveSnapshot {
        uint256 lastPrice;
        uint256 timestamp;
        uint256 blockNumber;
    }
    ReserveSnapshot[] public reserveSnapshots;

    /**
    * @dev We do not deliberately have a Pause state. There is only a master-level pause at clearingHouse level
    */
    enum AMMState { Inactive, Ignition, Active }
    AMMState public ammState;

    uint256[50] private __gap;

    // Events

    event PositionChanged(address indexed trader, int256 size, uint256 openNotional, int256 realizedPnl);
    event FundingRateUpdated(int256 premiumFraction, int256 rate, uint256 underlyingPrice, uint256 timestamp, uint256 blockNumber);
    event FundingPaid(address indexed trader, int256 takerPosSize, int256 takerFundingPayment, int256 makerFundingPayment, int256 latestCumulativePremiumFraction, int256 latestPremiumPerDtoken);
    event Swap(int256 baseAsset, uint256 quoteAsset, uint256 lastPrice, uint256 openInterestNotional);
    event LiquidityAdded(address indexed maker, uint dToken, uint baseAsset, uint quoteAsset, uint timestamp);
    event LiquidityRemoved(address indexed maker, uint dToken, uint baseAsset, uint quoteAsset, uint timestamp, int256 realizedPnl);

    modifier onlyClearingHouse() {
        require(msg.sender == clearingHouse, "Only clearingHouse");
        _;
    }

    modifier onlyVamm() {
        require(msg.sender == address(vamm), "Only VAMM");
        _;
    }

    function initialize(
        address _registry,
        address _underlyingAsset,
        string memory _name,
        address _vamm,
        address _governance
    ) external initializer {
        _setGovernace(_governance);

        vamm = IVAMM(_vamm);
        underlyingAsset = _underlyingAsset;
        name = _name;
        fundingBufferPeriod = 15 minutes;

        syncDeps(_registry);
    }

    /**
    * @dev baseAssetQuantity != 0 has been validated in clearingHouse._openPosition()
    */
    function openPosition(address trader, int256 baseAssetQuantity, uint quoteAssetLimit)
        override
        external
        onlyClearingHouse
        returns (int realizedPnl, uint quoteAsset, bool isPositionIncreased)
    {
        require(ammState == AMMState.Active, "AMM.openPosition.not_active");
        Position memory position = positions[trader];
        bool isNewPosition = position.size == 0 ? true : false;
        Side side = baseAssetQuantity > 0 ? Side.LONG : Side.SHORT;
        if (isNewPosition || (position.size > 0 ? Side.LONG : Side.SHORT) == side) {
            // realizedPnl = 0;
            quoteAsset = _increasePosition(trader, baseAssetQuantity, quoteAssetLimit);
            isPositionIncreased = true;
        } else {
            (realizedPnl, quoteAsset, isPositionIncreased) = _openReversePosition(trader, baseAssetQuantity, quoteAssetLimit);
        }
        _emitPositionChanged(trader, realizedPnl);
    }

    function liquidatePosition(address trader)
        override
        external
        onlyClearingHouse
        returns (int realizedPnl, uint quoteAsset)
    {
        // don't need an ammState check because there should be no active positions
        Position memory position = positions[trader];
        bool isLongPosition = position.size > 0 ? true : false;
        // sending market orders can fk the trader. @todo put some safe guards around price of liquidations
        if (isLongPosition) {
            (realizedPnl, quoteAsset) = _reducePosition(trader, -position.size, 0);
        } else {
            (realizedPnl, quoteAsset) = _reducePosition(trader, -position.size, type(uint).max);
        }
        _emitPositionChanged(trader, realizedPnl);
    }

    function updatePosition(address trader)
        override
        external
        onlyClearingHouse
        returns(int256 fundingPayment)
    {
        if (ammState != AMMState.Active) return 0;
        (
            int256 takerFundingPayment,
            int256 makerFundingPayment,
            int256 latestCumulativePremiumFraction,
            int256 latestPremiumPerDtoken
        ) = getPendingFundingPayment(trader);

        Position storage position = positions[trader];
        position.lastPremiumFraction = latestCumulativePremiumFraction;

        Maker storage maker = makers[trader];
        maker.lastPremiumFraction = latestCumulativePremiumFraction;
        maker.lastPremiumPerDtoken = latestPremiumPerDtoken;

        emit FundingPaid(trader, position.size, takerFundingPayment, makerFundingPayment, latestCumulativePremiumFraction, latestPremiumPerDtoken);

        // +: trader paid, -: trader received
        fundingPayment = takerFundingPayment + makerFundingPayment;
        if (fundingPayment < 0) {
            fundingPayment -= fundingPayment / 1e3; // receivers charged 0.1% to account for rounding-offs
        }
    }

    function addLiquidity(address maker, uint baseAssetQuantity, uint minDToken)
        override
        external
        onlyClearingHouse
    {
        require(ammState != AMMState.Inactive, "AMM.addLiquidity.amm_inactive");
        uint quoteAsset;
        uint baseAssetBal = vamm.balances(1);
        if (baseAssetBal == 0) {
            quoteAsset = baseAssetQuantity * vamm.price_scale() / 1e30;
        } else {
            quoteAsset = baseAssetQuantity * vamm.balances(0) / baseAssetBal;
        }

        uint _dToken = vamm.add_liquidity([quoteAsset, baseAssetQuantity], minDToken);

        // updates
        Maker storage _maker = makers[maker];
        if (_maker.dToken > 0) { // Maker only accumulates position when they had non-zero liquidity
            _maker.pos += (posAccumulator - _maker.posAccumulator) * _maker.dToken.toInt256() / 1e18;
        }
        _maker.vUSD += quoteAsset;
        _maker.vAsset += baseAssetQuantity;
        _maker.dToken += _dToken;
        _maker.posAccumulator = posAccumulator;
        emit LiquidityAdded(maker, _dToken, baseAssetQuantity, quoteAsset, _blockTimestamp());
    }

    function removeLiquidity(address maker, uint amount, uint minQuote, uint minBase)
        override
        external
        onlyClearingHouse
        returns (int256 /* realizedPnl */, uint /* quoteAsset */)
    {
        Maker memory _maker = makers[maker];
        if (_maker.dToken == 0) {
            return (0,0);
        }

        Position memory _taker = positions[maker];
        // amount <= _maker.dToken will be asserted when updating maker.dToken
        (
            int256 makerPosition,
            uint256 totalOpenNotional,
            int256 feeAdjustedPnl,
            uint[2] memory dBalances
        ) = vamm.remove_liquidity(
            amount,
            [minQuote /* minimum QuoteAsset amount */, minBase /* minimum BaseAsset amount */],
            _maker.vUSD,
            _maker.vAsset,
            _maker.dToken,
            _taker.size,
            _taker.openNotional
        );

        {
            // update maker info
            Maker storage __maker = makers[maker];
            uint diff = _maker.dToken - amount;

            if (diff == 0) {
                __maker.pos = 0;
                __maker.vAsset = 0;
                __maker.vUSD = 0;
                __maker.dToken = 0;
            } else {
                // muitiply by diff because a taker position will also be opened while removing liquidity and its funding payment is calculated seperately
                __maker.pos = _maker.pos + (posAccumulator - _maker.posAccumulator) * diff.toInt256() / 1e18;
                __maker.vAsset = _maker.vAsset * diff / _maker.dToken;
                __maker.vUSD = _maker.vUSD * diff / _maker.dToken;
                __maker.dToken = diff;
            }
            __maker.posAccumulator = posAccumulator;
        }

        int256 realizedPnl = feeAdjustedPnl;
        {
            if (makerPosition != 0) {
                // translate impermanent position to a permanent one
                Position storage position = positions[maker];
                if (makerPosition * position.size < 0) { // reducing or reversing position
                    uint newNotional = getCloseQuote(position.size + makerPosition);
                    int256 reducePositionPnl = _getPnlWhileReducingPosition(position.size, position.openNotional, makerPosition, newNotional);
                    realizedPnl += reducePositionPnl;
                }
                position.openNotional = totalOpenNotional;
                position.size += makerPosition;

                // update long and short open interest notional
                if (makerPosition > 0) {
                    longOpenInterestNotional += makerPosition.toUint256();
                } else {
                    shortOpenInterestNotional += (-makerPosition).toUint256();
                }
            }
        }

        emit LiquidityRemoved(maker, amount, dBalances[1] /** baseAsset */,
            dBalances[0] /** quoteAsset */, _blockTimestamp(), realizedPnl);
        return (realizedPnl, dBalances[0]);
    }


    function getOpenNotionalWhileReducingPosition(
        int256 positionSize,
        uint256 newNotionalPosition,
        int256 unrealizedPnl,
        int256 baseAssetQuantity
    )
        override
        public
        pure
        returns(uint256 remainOpenNotional, int realizedPnl)
    {
        require(abs(positionSize) >= abs(baseAssetQuantity), "AMM.ONLY_REDUCE_POS");
        bool isLongPosition = positionSize > 0 ? true : false;

        realizedPnl = unrealizedPnl * abs(baseAssetQuantity) / abs(positionSize);
        int256 unrealizedPnlAfter = unrealizedPnl - realizedPnl;

        /**
        * We need to determine the openNotional value of the reduced position now.
        * We know notionalPosition and unrealizedPnlAfter (unrealizedPnl times the ratio of open position)
        * notionalPosition = notionalPosition - quoteAsset (exchangedQuoteAssetAmount)
        * calculate openNotional (it's different depends on long or short side)
        * long: unrealizedPnl = notionalPosition - openNotional => openNotional = notionalPosition - unrealizedPnl
        * short: unrealizedPnl = openNotional - notionalPosition => openNotional = notionalPosition + unrealizedPnl
        */
        if (isLongPosition) {
            /**
            * Let baseAssetQuantity = Q, position.size = size, by definition of _reducePosition, abs(size) >= abs(Q)
            * quoteAsset = notionalPosition * Q / size
            * unrealizedPnlAfter = unrealizedPnl - realizedPnl = unrealizedPnl - unrealizedPnl * Q / size
            * remainOpenNotional = notionalPosition - notionalPosition * Q / size - unrealizedPnl + unrealizedPnl * Q / size
            * => remainOpenNotional = notionalPosition(size-Q)/size - unrealizedPnl(size-Q)/size
            * => remainOpenNotional = (notionalPosition - unrealizedPnl) * (size-Q)/size
            * Since notionalPosition includes the PnL component, notionalPosition >= unrealizedPnl and size >= Q
            * Hence remainOpenNotional >= 0
            */
            remainOpenNotional = (newNotionalPosition.toInt256() - unrealizedPnlAfter).toUint256();  // will assert that remainOpenNotional >= 0
        } else {
            /**
            * Let baseAssetQuantity = Q, position.size = size, by definition of _reducePosition, abs(size) >= abs(Q)
            * quoteAsset = notionalPosition * Q / size
            * unrealizedPnlAfter = unrealizedPnl - realizedPnl = unrealizedPnl - unrealizedPnl * Q / size
            * remainOpenNotional = notionalPosition - notionalPosition * Q / size + unrealizedPnl - unrealizedPnl * Q / size
            * => remainOpenNotional = notionalPosition(size-Q)/size + unrealizedPnl(size-Q)/size
            * => remainOpenNotional = (notionalPosition + unrealizedPnl) * (size-Q)/size
            * => In AMM.sol, unrealizedPnl = position.openNotional - notionalPosition
            * => notionalPosition + unrealizedPnl >= 0
            * Hence remainOpenNotional >= 0
            */
            remainOpenNotional = (newNotionalPosition.toInt256() + unrealizedPnlAfter).toUint256();  // will assert that remainOpenNotional >= 0
        }
    }

    /**
     * @notice update funding rate
     * @dev only allow to update while reaching `nextFundingTime`
     */
    function settleFunding()
        override
        external
        onlyClearingHouse
    {
        if (ammState != AMMState.Active) return;
        require(_blockTimestamp() >= nextFundingTime, "settle funding too early");

        // premium = twapMarketPrice - twapIndexPrice
        // timeFraction = fundingPeriod(1 hour) / 1 day
        // premiumFraction = premium * timeFraction
        int256 underlyingPrice = getUnderlyingTwapPrice(spotPriceTwapInterval);
        int256 premium = getTwapPrice(spotPriceTwapInterval) - underlyingPrice;
        int256 premiumFraction = (premium * int256(fundingPeriod)) / 1 days;

        // update funding rate = premiumFraction / twapIndexPrice
        _updateFundingRate(premiumFraction, underlyingPrice);

        int256 premiumPerDtoken = posAccumulator * premiumFraction;

        // makers pay slightly more to account for rounding off
        premiumPerDtoken = (premiumPerDtoken / BASE_PRECISION) + 1;

        cumulativePremiumFraction += premiumFraction;
        cumulativePremiumPerDtoken += premiumPerDtoken;

        // Updates for next funding event
        // in order to prevent multiple funding settlement during very short time after network congestion
        uint256 minNextValidFundingTime = _blockTimestamp() + fundingBufferPeriod;

        // floor((nextFundingTime + fundingPeriod) / 3600) * 3600
        uint256 nextFundingTimeOnHourStart = ((nextFundingTime + fundingPeriod) / 1 hours) * 1 hours;

        // max(nextFundingTimeOnHourStart, minNextValidFundingTime)
        nextFundingTime = nextFundingTimeOnHourStart > minNextValidFundingTime
            ? nextFundingTimeOnHourStart
            : minNextValidFundingTime;
    }

    // View

    function getSnapshotLen() external view returns (uint256) {
        return reserveSnapshots.length;
    }

    function getUnderlyingTwapPrice(uint256 _intervalInSeconds) public view returns (int256) {
        return oracle.getUnderlyingTwapPrice(underlyingAsset, _intervalInSeconds);
    }

    function getTwapPrice(uint256 _intervalInSeconds) public view returns (int256) {
        return int256(_calcTwap(_intervalInSeconds));
    }

    function getNotionalPositionAndUnrealizedPnl(address trader)
        override
        external
        view
        returns(uint256 notionalPosition, int256 unrealizedPnl, int256 size, uint256 openNotional)
    {
        Position memory _taker = positions[trader];
        Maker memory _maker = makers[trader];

        (notionalPosition, size, unrealizedPnl, openNotional) = vamm.get_notional(
            _maker.dToken,
            _maker.vUSD,
            _maker.vAsset,
            _taker.size,
            _taker.openNotional
        );
    }

    function getPendingFundingPayment(address trader)
        override
        public
        view
        returns(
            int256 takerFundingPayment,
            int256 makerFundingPayment,
            int256 latestCumulativePremiumFraction,
            int256 latestPremiumPerDtoken
        )
    {
        latestCumulativePremiumFraction = cumulativePremiumFraction;
        Position memory taker = positions[trader];

        takerFundingPayment = (latestCumulativePremiumFraction - taker.lastPremiumFraction)
            * taker.size
            / BASE_PRECISION;

        // Maker funding payment
        latestPremiumPerDtoken = cumulativePremiumPerDtoken;

        Maker memory maker = makers[trader];
        int256 dToken = maker.dToken.toInt256();
        if (dToken > 0) {
            int256 cpf = latestCumulativePremiumFraction - maker.lastPremiumFraction;
            makerFundingPayment = (
                maker.pos * cpf +
                (
                    latestPremiumPerDtoken
                    - maker.lastPremiumPerDtoken
                    - maker.posAccumulator * cpf / BASE_PRECISION
                ) * dToken
            ) / BASE_PRECISION;
        }
    }

    function getCloseQuote(int256 baseAssetQuantity) override public view returns(uint256 quoteAssetQuantity) {
        if (baseAssetQuantity > 0) {
            return vamm.get_dy(1, 0, baseAssetQuantity.toUint256());
        } else if (baseAssetQuantity < 0) {
            return vamm.get_dx(0, 1, (-baseAssetQuantity).toUint256());
        }
        return 0;
    }

    function getTakerNotionalPositionAndUnrealizedPnl(address trader) override public view returns(uint takerNotionalPosition, int256 unrealizedPnl) {
        Position memory position = positions[trader];
        if (position.size > 0) {
            takerNotionalPosition = vamm.get_dy(1, 0, position.size.toUint256());
            unrealizedPnl = takerNotionalPosition.toInt256() - position.openNotional.toInt256();
        } else if (position.size < 0) {
            takerNotionalPosition = vamm.get_dx(0, 1, (-position.size).toUint256());
            unrealizedPnl = position.openNotional.toInt256() - takerNotionalPosition.toInt256();
        }
    }

    function lastPrice() external view returns(uint256) {
        return vamm.last_prices() / 1e12;
    }

    function openInterestNotional() public view returns (uint256) {
        return longOpenInterestNotional + shortOpenInterestNotional;
    }

    // internal

    /**
    * @dev Go long on an asset
    * @param baseAssetQuantity Exact base asset quantity to go long
    * @param max_dx Maximum amount of quote asset to be used while longing baseAssetQuantity. Lower means longing at a lower price (desirable).
    * @return quoteAssetQuantity quote asset utilised. quoteAssetQuantity / baseAssetQuantity was the average rate.
      quoteAssetQuantity <= max_dx
    */
    function _long(int256 baseAssetQuantity, uint max_dx) internal returns (uint256 quoteAssetQuantity) {
        require(baseAssetQuantity > 0, "VAMM._long: baseAssetQuantity is <= 0");

        uint _lastPrice;
        (quoteAssetQuantity, _lastPrice) = vamm.exchangeExactOut(
            0, // sell quote asset
            1, // purchase base asset
            baseAssetQuantity.toUint256(), // long exactly. Note that statement asserts that baseAssetQuantity >= 0
            max_dx
        ); // 6 decimals precision

        _addReserveSnapshot(_lastPrice);
        // since maker position will be opposite of the trade
        posAccumulator -= baseAssetQuantity * 1e18 / vamm.totalSupply().toInt256();
        emit Swap(baseAssetQuantity, quoteAssetQuantity, _lastPrice, openInterestNotional());
    }

    /**
    * @dev Go short on an asset
    * @param baseAssetQuantity Exact base asset quantity to short
    * @param min_dy Minimum amount of quote asset to be used while shorting baseAssetQuantity. Higher means shorting at a higher price (desirable).
    * @return quoteAssetQuantity quote asset utilised. quoteAssetQuantity / baseAssetQuantity was the average short rate.
      quoteAssetQuantity >= min_dy.
    */
    function _short(int256 baseAssetQuantity, uint min_dy) internal returns (uint256 quoteAssetQuantity) {
        require(baseAssetQuantity < 0, "VAMM._short: baseAssetQuantity is >= 0");

        uint _lastPrice;
        (quoteAssetQuantity, _lastPrice) = vamm.exchange(
            1, // sell base asset
            0, // get quote asset
            (-baseAssetQuantity).toUint256(), // short exactly. Note that statement asserts that baseAssetQuantity <= 0
            min_dy
        );

        _addReserveSnapshot(_lastPrice);
        // since maker position will be opposite of the trade
        posAccumulator -= baseAssetQuantity * 1e18 / vamm.totalSupply().toInt256();
        emit Swap(baseAssetQuantity, quoteAssetQuantity, _lastPrice, openInterestNotional());
    }

    function _emitPositionChanged(address trader, int256 realizedPnl) internal {
        Position memory position = positions[trader];
        emit PositionChanged(trader, position.size, position.openNotional, realizedPnl);
    }

    // @dev check takerPosition != 0 before calling
    function _getPnlWhileReducingPosition(
        int256 takerPosition,
        uint takerOpenNotional,
        int256 makerPosition,
        uint newNotional
    ) internal pure returns (int256 pnlToBeRealized) {
        /**
            makerNotional = newNotional * makerPos / totalPos
            if (side remains same)
                reducedOpenNotional = takerOpenNotional * makerPos / takerPos
                pnl = makerNotional - reducedOpenNotional
            else (reverse position)
                closedPositionNotional = newNotional * takerPos / totalPos
                pnl = closePositionNotional - takerOpenNotional
         */

        uint totalPosition = abs(makerPosition + takerPosition).toUint256();
        if (abs(takerPosition) > abs(makerPosition)) { // taker position side remains same
            uint reducedOpenNotional = takerOpenNotional * abs(makerPosition).toUint256() / abs(takerPosition).toUint256();
            uint makerNotional = newNotional * abs(makerPosition).toUint256() / totalPosition;
            pnlToBeRealized = _getPnlToBeRealized(takerPosition, makerNotional, reducedOpenNotional);
        } else { // taker position side changes
            // @todo handle case when totalPosition = 0
            uint closedPositionNotional = newNotional * abs(takerPosition).toUint256() / totalPosition;
            pnlToBeRealized = _getPnlToBeRealized(takerPosition, closedPositionNotional, takerOpenNotional);
        }
    }

    function _getPnlToBeRealized(int256 takerPosition, uint notionalPosition, uint openNotional) internal pure returns (int256 pnlToBeRealized) {
        if (takerPosition > 0) {
            pnlToBeRealized = notionalPosition.toInt256() - openNotional.toInt256();
        } else {
            pnlToBeRealized = openNotional.toInt256() - notionalPosition.toInt256();
        }
    }

    function _increasePosition(address trader, int256 baseAssetQuantity, uint quoteAssetLimit)
        internal
        returns(uint quoteAsset)
    {
        if (baseAssetQuantity > 0) { // Long - purchase baseAssetQuantity
            longOpenInterestNotional += baseAssetQuantity.toUint256();
            quoteAsset = _long(baseAssetQuantity, quoteAssetLimit);
        } else { // Short - sell baseAssetQuantity
            shortOpenInterestNotional += (-baseAssetQuantity).toUint256();
            quoteAsset = _short(baseAssetQuantity, quoteAssetLimit);
        }
        positions[trader].size += baseAssetQuantity; // -ve baseAssetQuantity will increase short position
        positions[trader].openNotional += quoteAsset;
    }

    function _openReversePosition(address trader, int256 baseAssetQuantity, uint quoteAssetLimit)
        internal
        returns (int realizedPnl, uint quoteAsset, bool isPositionIncreased)
    {
        Position memory position = positions[trader];
        if (abs(position.size) >= abs(baseAssetQuantity)) {
            (realizedPnl, quoteAsset) = _reducePosition(trader, baseAssetQuantity, quoteAssetLimit);
        } else {
            uint closedRatio = (quoteAssetLimit * abs(position.size).toUint256()) / abs(baseAssetQuantity).toUint256();
            (realizedPnl, quoteAsset) = _reducePosition(trader, -position.size, closedRatio);

            // this is required because the user might pass a very less value (slippage-prone) while shorting
            if (quoteAssetLimit >= quoteAsset) {
                quoteAssetLimit -= quoteAsset;
            }
            quoteAsset += _increasePosition(trader, baseAssetQuantity + position.size, quoteAssetLimit);
            isPositionIncreased = true;
        }
    }

    /**
    * @dev validate that baseAssetQuantity <= position.size should be performed before the call to _reducePosition
    */
    function _reducePosition(address trader, int256 baseAssetQuantity, uint quoteAssetLimit)
        internal
        returns (int realizedPnl, uint256 quoteAsset)
    {
        (, int256 unrealizedPnl) = getTakerNotionalPositionAndUnrealizedPnl(trader);

        Position storage position = positions[trader]; // storage because there are updates at the end
        bool isLongPosition = position.size > 0 ? true : false;

        if (isLongPosition) {
            longOpenInterestNotional -= (-baseAssetQuantity).toUint256();
            quoteAsset = _short(baseAssetQuantity, quoteAssetLimit);
        } else {
            shortOpenInterestNotional -= baseAssetQuantity.toUint256();
            quoteAsset = _long(baseAssetQuantity, quoteAssetLimit);
        }
        uint256 notionalPosition = getCloseQuote(position.size + baseAssetQuantity);
        (position.openNotional, realizedPnl) = getOpenNotionalWhileReducingPosition(position.size, notionalPosition, unrealizedPnl, baseAssetQuantity);
        position.size += baseAssetQuantity;
    }

    function _addReserveSnapshot(uint256 price)
        internal
    {
        uint256 currentBlock = block.number;
        uint256 blockTimestamp = _blockTimestamp();

        if (reserveSnapshots.length == 0) {
            reserveSnapshots.push(
                ReserveSnapshot(price, blockTimestamp, currentBlock)
            );
            return;
        }

        ReserveSnapshot storage latestSnapshot = reserveSnapshots[reserveSnapshots.length - 1];
        // update values in snapshot if in the same block
        if (currentBlock == latestSnapshot.blockNumber) {
            latestSnapshot.lastPrice = price;
        } else {
            reserveSnapshots.push(
                ReserveSnapshot(price, blockTimestamp, currentBlock)
            );
        }
    }

    function _blockTimestamp() internal view virtual returns (uint256) {
        return block.timestamp;
    }

    function _calcTwap(uint256 _intervalInSeconds)
        internal
        view
        returns (uint256)
    {
        uint256 snapshotIndex = reserveSnapshots.length - 1;
        uint256 currentPrice = reserveSnapshots[snapshotIndex].lastPrice;
        if (_intervalInSeconds == 0) {
            return currentPrice;
        }

        uint256 baseTimestamp = _blockTimestamp() - _intervalInSeconds;
        ReserveSnapshot memory currentSnapshot = reserveSnapshots[snapshotIndex];
        // return the latest snapshot price directly
        // if only one snapshot or the timestamp of latest snapshot is earlier than asking for
        if (reserveSnapshots.length == 1 || currentSnapshot.timestamp <= baseTimestamp) {
            return currentPrice;
        }

        uint256 previousTimestamp = currentSnapshot.timestamp;
        uint256 period = _blockTimestamp() - previousTimestamp;
        uint256 weightedPrice = currentPrice * period;
        while (true) {
            // if snapshot history is too short
            if (snapshotIndex == 0) {
                return weightedPrice / period;
            }

            snapshotIndex = snapshotIndex - 1;
            currentSnapshot = reserveSnapshots[snapshotIndex];
            currentPrice = reserveSnapshots[snapshotIndex].lastPrice;

            // check if current round timestamp is earlier than target timestamp
            if (currentSnapshot.timestamp <= baseTimestamp) {
                // weighted time period will be (target timestamp - previous timestamp). For example,
                // now is 1000, _interval is 100, then target timestamp is 900. If timestamp of current round is 970,
                // and timestamp of NEXT round is 880, then the weighted time period will be (970 - 900) = 70,
                // instead of (970 - 880)
                weightedPrice = weightedPrice + (currentPrice * (previousTimestamp - baseTimestamp));
                break;
            }

            uint256 timeFraction = previousTimestamp - currentSnapshot.timestamp;
            weightedPrice = weightedPrice + (currentPrice * timeFraction);
            period = period + timeFraction;
            previousTimestamp = currentSnapshot.timestamp;
        }
        return weightedPrice / _intervalInSeconds;
    }

    function _updateFundingRate(
        int256 _premiumFraction,
        int256 _underlyingPrice
    ) internal {
        fundingRate = _premiumFraction * 1e6 / _underlyingPrice;
        emit FundingRateUpdated(_premiumFraction, fundingRate, _underlyingPrice.toUint256(), _blockTimestamp(), block.number);
    }

    // Pure

    function abs(int x) private pure returns (int) {
        return x >= 0 ? x : -x;
    }

    // Governance

    function setAmmState(AMMState _state) external onlyGovernance {
        require(ammState != _state, "AMM.setAmmState.sameState");
        ammState = _state;
        if (_state == AMMState.Active) {
            nextFundingTime = ((_blockTimestamp() + fundingPeriod) / 1 hours) * 1 hours;
        }
    }

    function syncDeps(address _registry) public onlyGovernance {
        IRegistry registry = IRegistry(_registry);
        clearingHouse = registry.clearingHouse();
        oracle = IOracle(registry.oracle());
    }

    function setFundingBufferPeriod(uint _fundingBufferPeriod) external onlyGovernance {
        fundingBufferPeriod = _fundingBufferPeriod;
    }
}
