// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./lib/LibMath.sol";
import "./lib/LibPrices.sol";
import "./Interfaces/IPricing.sol";
import "./Interfaces/ITracerPerpetualSwaps.sol";
import "./Interfaces/IInsurance.sol";
import "./Interfaces/IOracle.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";

contract Pricing is IPricing {
    using LibMath for uint256;
    using LibMath for int256;
    using PRBMathSD59x18 for int256;

    address public tracer;
    IInsurance public insurance;
    IOracle public oracle;

    // pricing metrics
    Prices.PriceInstant[24] internal hourlyTracerPrices;
    Prices.PriceInstant[24] internal hourlyOraclePrices;

    // funding index => funding rate
    mapping(uint256 => Prices.FundingRateInstant) public fundingRates;

    // funding index => insurance funding rate
    mapping(uint256 => Prices.FundingRateInstant) public insuranceFundingRates;

    // market's time value
    int256 public override timeValue;

    // funding index
    uint256 public override currentFundingIndex;

    // timing variables
    uint256 public startLastHour;
    uint256 public startLast24Hours;
    uint8 public override currentHour;

    event HourlyPriceUpdated(uint256 price, uint256 currentHour);
    event FundingRateUpdated(int256 fundingRate, int256 cumulativeFundingRate);
    event InsuranceFundingRateUpdated(int256 insuranceFundingRate, int256 insuranceFundingRateValue);

    /**
     * @dev Set tracer perps factory
     * @dev ensure that oracle contract is returning WAD values. This may be done
     *      by wrapping the raw oracle in an adapter (see contracts/oracle)
     * @param _tracer The address of the tracer this pricing contract links too
     */
    constructor(
        address _tracer,
        address _insurance,
        address _oracle
    ) {
        tracer = _tracer;
        insurance = IInsurance(_insurance);
        oracle = IOracle(_oracle);
        startLastHour = block.timestamp;
        startLast24Hours = block.timestamp;
    }

    /**
     * @notice Updates pricing information given a trade of a certain volume at
     *         a set price
     * @param tradePrice the price the trade executed at
     */
    function recordTrade(uint256 tradePrice) external override onlyTracer {
        uint256 currentOraclePrice = oracle.latestAnswer();
        if (startLastHour <= block.timestamp - 1 hours) {
            // emit the old hourly average
            uint256 hourlyTracerPrice = getHourlyAvgTracerPrice(currentHour);
            emit HourlyPriceUpdated(hourlyTracerPrice, currentHour);

            // update funding rate for the previous hour
            updateFundingRate();

            // update the time value
            if (startLast24Hours <= block.timestamp - 24 hours) {
                // Update the interest rate every 24 hours
                updateTimeValue();
                startLast24Hours = block.timestamp;
            }

            // update time metrics after all other state
            startLastHour = block.timestamp;

            // Check current hour and loop around if need be
            if (currentHour == 23) {
                currentHour = 0;
            } else {
                currentHour = currentHour + 1;
            }

            // add new pricing entry for new hour
            updatePrice(tradePrice, currentOraclePrice, true);
        } else {
            // Update old pricing entry
            updatePrice(tradePrice, currentOraclePrice, false);
        }
    }

    /**
     * @notice Updates both the latest market price and the latest underlying asset price (from an oracle) for a given tracer market given a tracer price
     *         and an oracle price.
     * @param marketPrice The price that a tracer was bought at, returned by the TracerPerpetualSwaps.sol contract when an order is filled
     * @param oraclePrice The price of the underlying asset that the Tracer is based upon as returned by a Chainlink Oracle
     * @param newRecord Bool that decides if a new hourly record should be started (true) or if a current hour should be updated (false)
     */
    function updatePrice(
        uint256 marketPrice,
        uint256 oraclePrice,
        bool newRecord
    ) internal {
        // Price records entries updated every hour
        if (newRecord) {
            // Make new hourly record, total = marketprice, numtrades set to 1;
            Prices.PriceInstant memory newHourly = Prices.PriceInstant(marketPrice, 1);
            hourlyTracerPrices[currentHour] = newHourly;
            // As above but with Oracle price
            Prices.PriceInstant memory oracleHour = Prices.PriceInstant(oraclePrice, 1);
            hourlyOraclePrices[currentHour] = oracleHour;
        } else {
            // If an update is needed, add the market price to a running total and increment number of trades
            hourlyTracerPrices[currentHour].cumulativePrice =
                hourlyTracerPrices[currentHour].cumulativePrice +
                marketPrice;
            hourlyTracerPrices[currentHour].trades = hourlyTracerPrices[currentHour].trades + 1;
            // As above but with oracle price
            hourlyOraclePrices[currentHour].cumulativePrice =
                hourlyOraclePrices[currentHour].cumulativePrice +
                oraclePrice;
            hourlyOraclePrices[currentHour].trades = hourlyOraclePrices[currentHour].trades + 1;
        }
    }

    /**
     * @notice Updates the funding rate and the insurance funding rate
     */
    function updateFundingRate() internal {
        // Get 8 hour time-weighted-average price (TWAP) and calculate the new funding rate and store it a new variable
        ITracerPerpetualSwaps _tracer = ITracerPerpetualSwaps(tracer);
        Prices.TWAP memory twapPrices = getTWAPs(currentHour);
        int256 iPoolFundingRate = insurance.getPoolFundingRate().toInt256();
        uint256 underlyingTWAP = twapPrices.underlying;
        uint256 derivativeTWAP = twapPrices.derivative;

        int256 newFundingRate = PRBMathSD59x18.mul(
            derivativeTWAP.toInt256() - underlyingTWAP.toInt256() - timeValue,
            _tracer.fundingRateSensitivity().toInt256()
        );

        // Create variable with value of new funding rate value
        int256 currentFundingRateValue = fundingRates[currentFundingIndex].cumulativeFundingRate;
        int256 cumulativeFundingRate = currentFundingRateValue + newFundingRate;

        // as above but with insurance funding rate value
        int256 currentInsuranceFundingRateValue = insuranceFundingRates[currentFundingIndex].cumulativeFundingRate;
        int256 iPoolFundingRateValue = currentInsuranceFundingRateValue + iPoolFundingRate;

        // Call setter functions on calculated variables
        setFundingRate(newFundingRate, cumulativeFundingRate);
        emit FundingRateUpdated(newFundingRate, cumulativeFundingRate);
        setInsuranceFundingRate(iPoolFundingRate, iPoolFundingRateValue);
        emit InsuranceFundingRateUpdated(iPoolFundingRate, iPoolFundingRateValue);
        // increment funding index
        currentFundingIndex = currentFundingIndex + 1;
    }

    /**
     * @notice Given the address of a tracer market this function will get the current fair price for that market
     */
    function fairPrice() external view override returns (uint256) {
        return Prices.fairPrice(oracle.latestAnswer(), timeValue);
    }

    ////////////////////////////
    ///  SETTER FUNCTIONS   ///
    //////////////////////////

    /**
     * @notice Calculates and then updates the time Value for a tracer market
     */
    function updateTimeValue() internal {
        (uint256 avgPrice, uint256 oracleAvgPrice) = get24HourPrices();

        timeValue += Prices.timeValue(avgPrice, oracleAvgPrice);
    }

    /**
     * @notice Sets the values of the fundingRate struct
     * @param fundingRate The funding Rate of the Tracer, calculated by updateFundingRate
     * @param cumulativeFundingRate The cumulativeFundingRate, incremented each time the funding rate is updated
     */
    function setFundingRate(int256 fundingRate, int256 cumulativeFundingRate) internal {
        fundingRates[currentFundingIndex] = Prices.FundingRateInstant(
            block.timestamp,
            fundingRate,
            cumulativeFundingRate
        );
    }

    /**
     * @notice Sets the values of the fundingRate struct for a particular Tracer Marker
     * @param fundingRate The insurance funding Rate of the Tracer, calculated by updateFundingRate
     * @param cumulativeFundingRate The cumulativeFundingRate, incremented each time the funding rate is updated
     */
    function setInsuranceFundingRate(int256 fundingRate, int256 cumulativeFundingRate) internal {
        insuranceFundingRates[currentFundingIndex] = Prices.FundingRateInstant(
            block.timestamp,
            fundingRate,
            cumulativeFundingRate
        );
    }

    // todo by using public variables lots of these can be removed
    /**
     * @return each variable of the fundingRate struct of a particular tracer at a particular funding rate index
     */
    function getFundingRate(uint256 index) external view override returns (Prices.FundingRateInstant memory) {
        return fundingRates[index];
    }

    /**
     * @return all of the variables in the funding rate struct (insurance rate) from a particular tracer market
     */
    function getInsuranceFundingRate(uint256 index) external view override returns (Prices.FundingRateInstant memory) {
        return insuranceFundingRates[index];
    }

    /**
     * @notice Gets an 8 hour time weighted avg price for a given tracer, at a particular hour. More recent prices are weighted more heavily.
     * @param hour An integer representing what hour of the day to collect from (0-24)
     * @return the time weighted average price for both the oraclePrice (derivative price) and the Tracer Price
     */
    function getTWAPs(uint256 hour) public view override returns (Prices.TWAP memory) {
        return Prices.calculateTWAP(hour, hourlyTracerPrices, hourlyOraclePrices);
    }

    /**
     * @notice Gets a 24 hour tracer and oracle price for a given tracer market
     * @return the average price over a 24 hour period for oracle and Tracer price
     */
    function get24HourPrices() public view override returns (uint256, uint256) {
        return (Prices.averagePriceForPeriod(hourlyTracerPrices), Prices.averagePriceForPeriod(hourlyOraclePrices));
    }

    /**
     * @notice Gets the average tracer price for a given market during a certain hour
     * @param hour The hour of which you want the hourly average Price
     * @return the average price of the tracer for a particular hour
     */
    function getHourlyAvgTracerPrice(uint256 hour) public view override returns (uint256) {
        return Prices.averagePrice(hourlyTracerPrices[hour]);
    }

    /**
     * @notice Gets the average oracle price for a given market during a certain hour
     * @param hour The hour of which you want the hourly average Price
     */
    function getHourlyAvgOraclePrice(uint256 hour) external view override returns (uint256) {
        return Prices.averagePrice(hourlyOraclePrices[hour]);
    }

    /**
     * @dev Used when only valid tracers are allowed
     */
    modifier onlyTracer() {
        require(msg.sender == tracer, "PRC: Only Tracer");
        _;
    }
}
