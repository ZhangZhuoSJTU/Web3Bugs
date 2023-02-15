// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {Timed} from "./../utils/Timed.sol";
import {CoreRef} from "./../refs/CoreRef.sol";
import {Decimal} from "../external/Decimal.sol";
import {Constants} from "./../Constants.sol";
import {Deviation} from "./../utils/Deviation.sol";
import {IScalingPriceOracle} from "./IScalingPriceOracle.sol";
import {BokkyPooBahsDateTimeContract} from "./../external/calendar/BokkyPooBahsDateTimeContract.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ChainlinkClient, Chainlink} from "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";

/// @notice contract that receives a chainlink price feed and then linearly interpolates that rate over
/// a 28 day period into the VOLT price. Interest is compounded monthly when the rate is updated
/// @author Elliot Friedman
contract ScalingPriceOracle is
    Timed,
    ChainlinkClient,
    IScalingPriceOracle,
    BokkyPooBahsDateTimeContract
{
    using SafeCast for *;
    using Deviation for *;
    using Decimal for Decimal.D256;
    using Chainlink for Chainlink.Request;

    /// ---------- Mutable Price Variables ----------

    /// @notice current amount that oracle price is inflating/deflating by monthly in basis points
    int256 public override monthlyChangeRateBasisPoints;

    /// @notice oracle price. starts off at 1e18 and compounds monthly
    uint256 public override oraclePrice = 1e18;

    /// ---------- Mutable CPI Variables Packed Into Single Storage Slot to Save an SSTORE & SLOAD ----------

    /// @notice the current month's CPI data
    uint128 public currentMonth;

    /// @notice the previous month's CPI data
    uint128 public previousMonth;

    /// ---------- Immutable Variables ----------

    /// @notice the time frame over which all changes in CPI data are applied
    /// 28 days was chosen as that is the shortest length of a month
    uint256 public constant override TIMEFRAME = 28 days;

    /// @notice the maximum allowable deviation in basis points for a new chainlink oracle update
    /// only allow price changes by 20% in a month.
    /// Any change over this threshold in either direction will be rejected
    uint256 public constant override MAXORACLEDEVIATION = 2_000;

    /// @notice address of chainlink oracle to send request
    address public immutable oracle;

    /// @notice job id that retrieves the latest CPI data
    bytes32 public immutable jobId;

    /// @notice amount in LINK paid to node operator for each request
    uint256 public immutable fee;

    /// @param _oracle address of chainlink data provider
    /// @param _jobid job id
    /// @param _fee maximum fee paid to chainlink data provider
    /// @param _currentMonth current month's inflation data
    /// @param _previousMonth previous month's inflation data
    constructor(
        address _oracle,
        bytes32 _jobid,
        uint256 _fee,
        uint128 _currentMonth,
        uint128 _previousMonth
    ) Timed(TIMEFRAME) {
        uint256 chainId;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            chainId := chainid()
        }

        if (chainId == 1 || chainId == 42) {
            setPublicChainlinkToken();
        }

        oracle = _oracle;
        jobId = _jobid;
        fee = _fee;

        currentMonth = _currentMonth;
        previousMonth = _previousMonth;

        _initTimed();

        /// calculate new monthly CPI-U rate in basis points based on current and previous month
        int256 aprBasisPoints = getMonthlyAPR();

        /// store data and apply the change rate over the next month to the VOLT price
        _oracleUpdateChangeRate(aprBasisPoints);
    }

    // ----------- Getters -----------

    /// @notice get the current scaled oracle price
    /// applies the change smoothly over a 28 day period
    /// scaled by 18 decimals
    // prettier-ignore
    function getCurrentOraclePrice() public view override returns (uint256) {
        int256 oraclePriceInt = oraclePrice.toInt256();

        int256 timeDelta = Math.min(block.timestamp - startTime, TIMEFRAME).toInt256();
        int256 pricePercentageChange = oraclePriceInt * monthlyChangeRateBasisPoints / Constants.BP_INT;
        int256 priceDelta = pricePercentageChange * timeDelta / TIMEFRAME.toInt256();

        return (oraclePriceInt + priceDelta).toUint256();
    }

    /// @notice get APR from chainlink data by measuring (current month - previous month) / previous month
    /// @return percentageChange percentage change in basis points over past month
    function getMonthlyAPR() public view returns (int256 percentageChange) {
        int256 delta = int128(currentMonth) - int128(previousMonth);
        percentageChange = (delta * Constants.BP_INT) / int128(previousMonth);
    }

    /// ------------- Public API To Request Chainlink Data -------------

    /// @notice Create a Chainlink request to retrieve API response, find the target
    /// data, then multiply by 1000 (to remove decimal places from data).
    /// @return requestId for this request
    /// only allows 1 request per month after the 14th day
    /// callable by anyone after time period and 14th day of the month
    function requestCPIData()
        external
        afterTimeInit
        returns (bytes32 requestId)
    {
        require(
            getDay(block.timestamp) > 14,
            "ScalingPriceOracle: cannot request data before the 15th"
        );

        Chainlink.Request memory request = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfill.selector
        );

        return sendChainlinkRequestTo(oracle, request, fee);
    }

    /// ------------- Chainlink Node Operator API -------------

    /// @notice Receive the response in the form of uint256
    /// @param _requestId of the chainlink request
    /// @param _cpiData latest CPI data from BLS
    /// called by the chainlink oracle
    function fulfill(bytes32 _requestId, uint256 _cpiData)
        external
        recordChainlinkFulfillment(_requestId)
    {
        _updateCPIData(_cpiData);
    }

    // ----------- Internal state changing api -----------

    /// @notice helper function to store and validate new chainlink data
    /// @param _cpiData latest CPI data from BLS
    /// update will fail if new values exceed deviation threshold of 20% monthly
    function _updateCPIData(uint256 _cpiData) internal {
        require(
            MAXORACLEDEVIATION.isWithinDeviationThreshold(
                currentMonth.toInt256(),
                _cpiData.toInt256()
            ),
            "ScalingPriceOracle: Chainlink data outside of deviation threshold"
        );

        /// store CPI data, removes stale data
        _addNewMonth(uint128(_cpiData));

        /// calculate new monthly CPI-U rate in basis points
        int256 aprBasisPoints = getMonthlyAPR();

        /// pass data to VOLT Price Oracle
        _oracleUpdateChangeRate(aprBasisPoints);
    }

    /// @notice function for chainlink oracle to be able to call in and change the rate
    /// @param newChangeRateBasisPoints the new monthly interest rate applied to the chainlink oracle price
    ///
    /// function effects:
    ///   compounds interest accumulated over period
    ///   set new change rate in basis points for next period
    function _oracleUpdateChangeRate(int256 newChangeRateBasisPoints) internal {
        /// compound the interest with the current rate
        oraclePrice = getCurrentOraclePrice();

        int256 currentChangeRateBasisPoints = monthlyChangeRateBasisPoints; /// save 1 SSLOAD

        /// emit even if there isn't an update
        emit CPIMonthlyChangeRateUpdate(
            currentChangeRateBasisPoints,
            newChangeRateBasisPoints
        );

        /// if the oracle change rate is the same as last time, save an SSTORE
        if (newChangeRateBasisPoints == currentChangeRateBasisPoints) {
            return;
        }

        monthlyChangeRateBasisPoints = newChangeRateBasisPoints;
    }

    /// @notice this is the only method needed as we will be storing the most recent 2 months of data
    /// @param newMonth the new month to store
    function _addNewMonth(uint128 newMonth) internal {
        previousMonth = currentMonth;

        currentMonth = newMonth;
    }
}
