// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@pooltogether/v4-core/contracts/interfaces/ITicket.sol";
import "@pooltogether/v4-core/contracts/interfaces/IPrizeDistributionBuffer.sol";
import "@pooltogether/v4-core/contracts/interfaces/IPrizeDistributionSource.sol";
import "@pooltogether/owner-manager-contracts/contracts/Manageable.sol";
import "./interfaces/IPrizeTierHistory.sol";

/**
 * @title Prize Distribution Factory
 * @author PoolTogether Inc.
 * @notice The Prize Distribution Factory populates a Prize Distribution Buffer for a prize pool.  It uses a Prize Tier History, Draw Buffer and Ticket
 * to compute the correct prize distribution.  It automatically sets the cardinality based on the minPickCost and the total network ticket supply.
 */
contract PrizeDistributionFactory is Manageable {
    using ExtendedSafeCastLib for uint256;

    /// @notice Emitted when a new Prize Distribution is pushed.
    /// @param drawId The draw id for which the prize dist was pushed
    /// @param totalNetworkTicketSupply The total network ticket supply that was used to compute the cardinality and portion of picks
    event PrizeDistributionPushed(uint32 indexed drawId, uint256 totalNetworkTicketSupply);

    /// @notice Emitted when a Prize Distribution is set (overrides another)
    /// @param drawId The draw id for which the prize dist was set
    /// @param totalNetworkTicketSupply The total network ticket supply that was used to compute the cardinality and portion of picks
    event PrizeDistributionSet(uint32 indexed drawId, uint256 totalNetworkTicketSupply);

    /// @notice The prize tier history to pull tier information from
    IPrizeTierHistory public immutable prizeTierHistory;

    /// @notice The draw buffer to pull the draw from
    IDrawBuffer public immutable drawBuffer;

    /// @notice The prize distribution buffer to push and set.  This contract must be the manager or owner of the buffer.
    IPrizeDistributionBuffer public immutable prizeDistributionBuffer;

    /// @notice The ticket whose average total supply will be measured to calculate the portion of picks
    ITicket public immutable ticket;

    /// @notice The minimum cost of each pick.  Used to calculate the cardinality.
    uint256 public immutable minPickCost;

    constructor(
        address _owner,
        IPrizeTierHistory _prizeTierHistory,
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

    /**
     * @notice Allows the owner or manager to push a new prize distribution onto the buffer.
     * The PrizeTier and Draw for the given draw id will be pulled in, and the total network ticket supply will be used to calculate cardinality.
     * @param _drawId The draw id to compute for
     * @param _totalNetworkTicketSupply The total supply of tickets across all prize pools for the network that the ticket belongs to.
     * @return The resulting Prize Distribution
     */
    function pushPrizeDistribution(uint32 _drawId, uint256 _totalNetworkTicketSupply)
        external
        onlyManagerOrOwner
        returns (IPrizeDistributionBuffer.PrizeDistribution memory)
    {
        IPrizeDistributionBuffer.PrizeDistribution
            memory prizeDistribution = calculatePrizeDistribution(
                _drawId,
                _totalNetworkTicketSupply
            );
        prizeDistributionBuffer.pushPrizeDistribution(_drawId, prizeDistribution);

        emit PrizeDistributionPushed(_drawId, _totalNetworkTicketSupply);

        return prizeDistribution;
    }

    /**
     * @notice Allows the owner or manager to override an existing prize distribution in the buffer.
     * The PrizeTier and Draw for the given draw id will be pulled in, and the total network ticket supply will be used to calculate cardinality.
     * @param _drawId The draw id to compute for
     * @param _totalNetworkTicketSupply The total supply of tickets across all prize pools for the network that the ticket belongs to.
     * @return The resulting Prize Distribution
     */
    function setPrizeDistribution(uint32 _drawId, uint256 _totalNetworkTicketSupply)
        external
        onlyOwner
        returns (IPrizeDistributionBuffer.PrizeDistribution memory)
    {
        IPrizeDistributionBuffer.PrizeDistribution
            memory prizeDistribution = calculatePrizeDistribution(
                _drawId,
                _totalNetworkTicketSupply
            );
        prizeDistributionBuffer.setPrizeDistribution(_drawId, prizeDistribution);

        emit PrizeDistributionSet(_drawId, _totalNetworkTicketSupply);

        return prizeDistribution;
    }

    /**
     * @notice Calculates what the prize distribution will be, given a draw id and total network ticket supply.
     * @param _drawId The draw id to pull from the Draw Buffer and Prize Tier History
     * @param _totalNetworkTicketSupply The total of all ticket supplies across all prize pools in this network
     * @return PrizeDistribution using info from the Draw for the given draw id, total network ticket supply, and PrizeTier for the draw.
     */
    function calculatePrizeDistribution(uint32 _drawId, uint256 _totalNetworkTicketSupply)
        public
        view
        virtual
        returns (IPrizeDistributionBuffer.PrizeDistribution memory)
    {
        IDrawBeacon.Draw memory draw = drawBuffer.getDraw(_drawId);
        return
            calculatePrizeDistributionWithDrawData(
                _drawId,
                _totalNetworkTicketSupply,
                draw.beaconPeriodSeconds,
                draw.timestamp
            );
    }

    /**
     * @notice Calculates what the prize distribution will be, given a draw id and total network ticket supply.
     * @param _drawId The draw from which to use the Draw and
     * @param _totalNetworkTicketSupply The sum of all ticket supplies across all prize pools on the network
     * @param _beaconPeriodSeconds The beacon period in seconds
     * @param _drawTimestamp The timestamp at which the draw RNG request started.
     * @return A PrizeDistribution based on the given params and PrizeTier for the passed draw id
     */
    function calculatePrizeDistributionWithDrawData(
        uint32 _drawId,
        uint256 _totalNetworkTicketSupply,
        uint32 _beaconPeriodSeconds,
        uint64 _drawTimestamp
    ) public view virtual returns (IPrizeDistributionBuffer.PrizeDistribution memory) {
        uint256 maxPicks = _totalNetworkTicketSupply / minPickCost;

        IPrizeDistributionBuffer.PrizeDistribution
            memory prizeDistribution = _calculatePrizeDistribution(
                _drawId,
                _beaconPeriodSeconds,
                maxPicks
            );

        uint64[] memory startTimestamps = new uint64[](1);
        uint64[] memory endTimestamps = new uint64[](1);

        startTimestamps[0] = _drawTimestamp - prizeDistribution.startTimestampOffset;
        endTimestamps[0] = _drawTimestamp - prizeDistribution.endTimestampOffset;

        uint256[] memory ticketAverageTotalSupplies = ticket.getAverageTotalSuppliesBetween(
            startTimestamps,
            endTimestamps
        );

        require(
            _totalNetworkTicketSupply >= ticketAverageTotalSupplies[0],
            "PDF/invalid-network-supply"
        );

        if (_totalNetworkTicketSupply > 0) {
            prizeDistribution.numberOfPicks = uint256(
                (prizeDistribution.numberOfPicks * ticketAverageTotalSupplies[0]) /
                    _totalNetworkTicketSupply
            ).toUint104();
        } else {
            prizeDistribution.numberOfPicks = 0;
        }

        return prizeDistribution;
    }

    /**
     * @notice Gets the PrizeDistributionBuffer for a drawId
     * @param _drawId drawId
     * @param _startTimestampOffset The start timestamp offset to use for the prize distribution
     * @param _maxPicks The maximum picks that the distribution should allow.  The Prize Distribution's numberOfPicks will be less than or equal to this number.
     * @return prizeDistribution
     */
    function _calculatePrizeDistribution(
        uint32 _drawId,
        uint32 _startTimestampOffset,
        uint256 _maxPicks
    ) internal view virtual returns (IPrizeDistributionBuffer.PrizeDistribution memory) {
        IPrizeTierHistory.PrizeTier memory prizeTier = prizeTierHistory.getPrizeTier(_drawId);

        uint8 cardinality;
        do {
            cardinality++;
        } while ((2**prizeTier.bitRangeSize)**(cardinality + 1) < _maxPicks);

        IPrizeDistributionBuffer.PrizeDistribution
            memory prizeDistribution = IPrizeDistributionSource.PrizeDistribution({
                bitRangeSize: prizeTier.bitRangeSize,
                matchCardinality: cardinality,
                startTimestampOffset: _startTimestampOffset,
                endTimestampOffset: prizeTier.endTimestampOffset,
                maxPicksPerUser: prizeTier.maxPicksPerUser,
                expiryDuration: prizeTier.expiryDuration,
                numberOfPicks: uint256((2**prizeTier.bitRangeSize)**cardinality).toUint104(),
                tiers: prizeTier.tiers,
                prize: prizeTier.prize
            });

        return prizeDistribution;
    }
}
