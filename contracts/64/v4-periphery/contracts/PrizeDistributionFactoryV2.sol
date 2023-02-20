// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@pooltogether/v4-core/contracts/interfaces/ITicket.sol";
import "@pooltogether/v4-core/contracts/interfaces/IPrizeDistributionBuffer.sol";
import "@pooltogether/v4-core/contracts/interfaces/IPrizeDistributionSource.sol";
import "@pooltogether/v4-core/contracts/libraries/ExtendedSafeCastLib.sol";
import "@pooltogether/owner-manager-contracts/contracts/Ownable.sol";

import "./interfaces/IPrizeTierHistoryV2.sol";

/**
 * @title PrizeDistributionFactoryV2
 * @author PoolTogether Inc.
 * @notice The PrizeDistributionFactoryV2 populates a Prize Distribution Buffer for a prize pool.  It uses a PrizeTierHistoryV2, Draw Buffer and Ticket
 * to compute the correct prize distribution.  It automatically sets the cardinality based on
 * the DPR (Draw Percentage Rate), prize, minPickCost and the total ticket supply.
 */
contract PrizeDistributionFactoryV2 is Ownable {
    using ExtendedSafeCastLib for uint256;

    /* ============ Events ============ */

    /**
     * @notice Emitted when a new Prize Distribution is pushed.
     * @param drawId The draw id for which the prize distribution was pushed
     */
    event PrizeDistributionPushed(uint32 indexed drawId);

    /**
     * @notice Emitted when a Prize Distribution is set (overrides another).
     * @param drawId The draw id for which the prize distribution was set
     */
    event PrizeDistributionSet(uint32 indexed drawId);

    /* ============ Variables ============ */

    /// @notice The prize tier history to pull tier information from.
    IPrizeTierHistoryV2 public immutable prizeTierHistory;

    /// @notice The draw buffer to pull the draw from.
    IDrawBuffer public immutable drawBuffer;

    /**
     * @notice The prize distribution buffer to push and set.
     * @dev This contract must be the manager or owner of the buffer.
     */
    IPrizeDistributionBuffer public immutable prizeDistributionBuffer;

    /// @notice The ticket whose average total supply will be measured to calculate the portion of picks
    ITicket public immutable ticket;

    /// @notice The minimum cost of each pick.  Used to calculate the cardinality.
    uint256 public immutable minPickCost;

    /**
     * @notice Unit of normalization.
     * @dev The Draw Percentage Rate (DPR) being a 1e9 number,
     *      we need to normalize calculations by scaling up or down by 1e9
     */
    uint32 public constant RATE_NORMALIZATION = 1e9;

    /* ============ Constructor ============ */

    /**
     * @notice PrizeDistributionFactoryV2 constructor.
     * @param _owner Address of the contract owner
     * @param _prizeTierHistory Address of the IPrizeTierHistoryV2 contract
     * @param _drawBuffer Address of the DrawBuffer contract
     * @param _prizeDistributionBuffer Address of the PrizeDistributionBuffer contract
     * @param _ticket Address of the Prize Pool Ticket contract
     * @param _minPickCost Minimum cost of a pick for a draw
     */
    constructor(
        address _owner,
        IPrizeTierHistoryV2 _prizeTierHistory,
        IDrawBuffer _drawBuffer,
        IPrizeDistributionBuffer _prizeDistributionBuffer,
        ITicket _ticket,
        uint256 _minPickCost
    ) Ownable(_owner) {
        require(_owner != address(0), "PDC/owner-zero");
        require(address(_prizeTierHistory) != address(0), "PDC/pth-zero");
        require(address(_drawBuffer) != address(0), "PDC/db-zero");
        require(address(_prizeDistributionBuffer) != address(0), "PDC/pdb-zero");
        require(address(_ticket) != address(0), "PDC/ticket-zero");
        require(_minPickCost > 0, "PDC/pick-cost-gt-zero");

        minPickCost = _minPickCost;
        prizeTierHistory = _prizeTierHistory;
        drawBuffer = _drawBuffer;
        prizeDistributionBuffer = _prizeDistributionBuffer;
        ticket = _ticket;
    }

    /* ============ External Functions ============ */

    /**
     * @notice Push a new prize distribution onto the PrizeDistributionBuffer.
     *         PrizeTier and Draw for the given draw id will be pulled in and the prize distribution will be computed.
     * @param _drawId The draw id to compute for
     * @return The resulting Prize Distribution
     */
    function pushPrizeDistribution(uint32 _drawId)
        external
        returns (IPrizeDistributionBuffer.PrizeDistribution memory)
    {
        IPrizeDistributionBuffer.PrizeDistribution
            memory _prizeDistribution = _calculatePrizeDistribution(_drawId);

        prizeDistributionBuffer.pushPrizeDistribution(_drawId, _prizeDistribution);

        emit PrizeDistributionPushed(_drawId);

        return _prizeDistribution;
    }

    /**
     * @notice Allows the owner to override an existing prize distribution in the buffer.
     *         PrizeTier and Draw for the given draw id will be pulled in and the prize distribution will be computed.
     * @param _drawId The draw id to compute for
     * @return The resulting Prize Distribution
     */
    function setPrizeDistribution(uint32 _drawId)
        external
        onlyOwner
        returns (IPrizeDistributionBuffer.PrizeDistribution memory)
    {
        IPrizeDistributionBuffer.PrizeDistribution
            memory _prizeDistribution = _calculatePrizeDistribution(_drawId);

        prizeDistributionBuffer.setPrizeDistribution(_drawId, _prizeDistribution);

        emit PrizeDistributionSet(_drawId);

        return _prizeDistribution;
    }

    /**
     * @notice Calculate Prize Distribution for a given drawId
     * @param _drawId Draw ID
     * @return PrizeDistribution
     */
    function calculatePrizeDistribution(uint32 _drawId)
        external
        view
        virtual
        returns (IPrizeDistributionBuffer.PrizeDistribution memory)
    {
        return _calculatePrizeDistribution(_drawId);
    }

    /* ============ Internal Functions ============ */

    /**
     * @notice Calculate Prize Distribution for a given drawId
     * @param _drawId Draw ID
     * @return PrizeDistribution
     */
    function _calculatePrizeDistribution(uint32 _drawId)
        internal
        view
        virtual
        returns (IPrizeDistributionBuffer.PrizeDistribution memory)
    {
        IPrizeTierHistoryV2.PrizeTierV2 memory _prizeTier = prizeTierHistory.getPrizeTier(_drawId);
        IDrawBeacon.Draw memory _draw = drawBuffer.getDraw(_drawId);

        (
            uint64[] memory _startTimes,
            uint64[] memory _endTimes
        ) = _calculateDrawPeriodTimestampOffsets(
                _draw.timestamp,
                _draw.beaconPeriodSeconds,
                _prizeTier.endTimestampOffset
            );

        uint256 _totalSupply = ticket.getAverageTotalSuppliesBetween(_startTimes, _endTimes)[0];

        (uint8 _cardinality, uint104 _numberOfPicks) = _calculateCardinalityAndNumberOfPicks(
            _prizeTier.bitRangeSize,
            _prizeTier.prize,
            _prizeTier.dpr,
            minPickCost,
            _totalSupply
        );

        IPrizeDistributionBuffer.PrizeDistribution
            memory _prizeDistribution = IPrizeDistributionSource.PrizeDistribution({
                bitRangeSize: _prizeTier.bitRangeSize,
                matchCardinality: _cardinality,
                startTimestampOffset: _draw.beaconPeriodSeconds,
                endTimestampOffset: _prizeTier.endTimestampOffset,
                maxPicksPerUser: _prizeTier.maxPicksPerUser,
                expiryDuration: _prizeTier.expiryDuration,
                numberOfPicks: _numberOfPicks,
                tiers: _prizeTier.tiers,
                prize: _prizeTier.prize
            });

        return _prizeDistribution;
    }

    /**
     * @notice Compute prize pool cardinality and number of picks for a draw.
     * @dev `cardinality` must be gte to one, that's why we use a do/while loop to increase it.
     * @param _bitRangeSize Bit range size
     * @param _prize Total prize amount
     * @param _dpr Draw percentage rate
     * @param _minPickCost Minimum cost for a pick
     * @param _totalSupply Prize Pool Ticket total supply
     * @return cardinality and number of picks
     */
    function _calculateCardinalityAndNumberOfPicks(
        uint8 _bitRangeSize,
        uint256 _prize,
        uint32 _dpr,
        uint256 _minPickCost,
        uint256 _totalSupply
    ) internal pure returns (uint8 cardinality, uint104 numberOfPicks) {
        uint256 _odds = (_dpr * _totalSupply) / _prize;

        if (_odds == 0) {
            return (cardinality = 1, numberOfPicks);
        }

        /**
         * maxPicks = totalSupply / minPickCost
         * targetPicks = maxPicks / odds = (totalSupply / minPickCost) / ((dpr * totalSupply) / prize)
         * targetPicks = (1 / minPickCost) / ((dpr * 1) / prize) = prize / (dpr * minPickCost)
         */
        uint256 _targetPicks = (_prize * RATE_NORMALIZATION) / (_dpr * _minPickCost);

        do {
            cardinality++;
        } while (_calculateTotalPicks(_bitRangeSize, cardinality + 1) < _targetPicks);

        numberOfPicks = ((_calculateTotalPicks(_bitRangeSize, cardinality) * _odds) /
            RATE_NORMALIZATION).toUint104();
    }

    /**
     * @notice Calculate Draw period start and end timestamp.
     * @param _timestamp Timestamp at which the draw was created by the DrawBeacon
     * @param _startOffset Draw start time offset in seconds
     * @param _endOffset Draw end time offset in seconds
     * @return Draw start and end timestamp
     */
    function _calculateDrawPeriodTimestampOffsets(
        uint64 _timestamp,
        uint32 _startOffset,
        uint32 _endOffset
    ) internal pure returns (uint64[] memory, uint64[] memory) {
        uint64[] memory _startTimestamps = new uint64[](1);
        uint64[] memory _endTimestamps = new uint64[](1);

        _startTimestamps[0] = _timestamp - _startOffset;
        _endTimestamps[0] = _timestamp - _endOffset;

        return (_startTimestamps, _endTimestamps);
    }

    /**
     * @notice Calculate total picks for a draw.
     * @param _bitRangeSize Bit range size
     * @param _cardinality Cardinality
     * @return Total number of picks
     */
    function _calculateTotalPicks(uint8 _bitRangeSize, uint8 _cardinality)
        internal
        pure
        returns (uint256)
    {
        return (2**_bitRangeSize)**_cardinality;
    }
}
