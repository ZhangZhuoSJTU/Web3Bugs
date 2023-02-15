// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@pooltogether/owner-manager-contracts/contracts/Manageable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IReserve.sol";
import "./libraries/ObservationLib.sol";
import "./libraries/RingBufferLib.sol";

/**
    * @title  PoolTogether V4 Reserve
    * @author PoolTogether Inc Team
    * @notice The Reserve contract provides historical lookups of a token balance increase during a target timerange.
              As the Reserve contract transfers OUT tokens, the withdraw accumulator is increased. When tokens are
              transfered IN new checkpoint *can* be created if checkpoint() is called after transfering tokens.
              By using the reserve and withdraw accumulators to create a new checkpoint, any contract or account
              can lookup the balance increase of the reserve for a target timerange.   
    * @dev    By calculating the total held tokens in a specific time range, contracts that require knowledge 
              of captured interest during a draw period, can easily call into the Reserve and deterministically
              determine the newly aqcuired tokens for that time range. 
 */
contract Reserve is IReserve, Manageable {
    using SafeERC20 for IERC20;

    /// @notice ERC20 token
    IERC20 public immutable token;

    /// @notice Total withdraw amount from reserve
    uint224 public withdrawAccumulator;
    uint32 private _gap;

    uint24 internal nextIndex;
    uint24 internal cardinality;

    /// @notice The maximum number of twab entries
    uint24 internal constant MAX_CARDINALITY = 16777215; // 2**24 - 1

    ObservationLib.Observation[MAX_CARDINALITY] internal reserveAccumulators;

    /* ============ Events ============ */

    event Deployed(IERC20 indexed token);

    /* ============ Constructor ============ */

    /**
     * @notice Constructs Ticket with passed parameters.
     * @param _owner Owner address
     * @param _token ERC20 address
     */
    constructor(address _owner, IERC20 _token) Ownable(_owner) {
        token = _token;
        emit Deployed(_token);
    }

    /* ============ External Functions ============ */

    /// @inheritdoc IReserve
    function checkpoint() external override {
        _checkpoint();
    }

    /// @inheritdoc IReserve
    function getToken() external view override returns (IERC20) {
        return token;
    }

    /// @inheritdoc IReserve
    function getReserveAccumulatedBetween(uint32 _startTimestamp, uint32 _endTimestamp)
        external
        view
        override
        returns (uint224)
    {
        require(_startTimestamp < _endTimestamp, "Reserve/start-less-then-end");
        uint24 _cardinality = cardinality;
        uint24 _nextIndex = nextIndex;

        (uint24 _newestIndex, ObservationLib.Observation memory _newestObservation) = _getNewestObservation(_nextIndex);
        (uint24 _oldestIndex, ObservationLib.Observation memory _oldestObservation) = _getOldestObservation(_nextIndex);

        uint224 _start = _getReserveAccumulatedAt(
            _newestObservation,
            _oldestObservation,
            _newestIndex,
            _oldestIndex,
            _cardinality,
            _startTimestamp
        );

        uint224 _end = _getReserveAccumulatedAt(
            _newestObservation,
            _oldestObservation,
            _newestIndex,
            _oldestIndex,
            _cardinality,
            _endTimestamp
        );

        return _end - _start;
    }

    /// @inheritdoc IReserve
    function withdrawTo(address _recipient, uint256 _amount) external override onlyManagerOrOwner {
        _checkpoint();

        withdrawAccumulator += uint224(_amount);
        
        token.safeTransfer(_recipient, _amount);

        emit Withdrawn(_recipient, _amount);
    }

    /* ============ Internal Functions ============ */

    /**
     * @notice Find optimal observation checkpoint using target timestamp
     * @dev    Uses binary search if target timestamp is within ring buffer range.
     * @param _newestObservation ObservationLib.Observation
     * @param _oldestObservation ObservationLib.Observation
     * @param _newestIndex The index of the newest observation
     * @param _oldestIndex The index of the oldest observation
     * @param _cardinality       RingBuffer Range
     * @param _timestamp          Timestamp target
     *
     * @return Optimal reserveAccumlator for timestamp.
     */
    function _getReserveAccumulatedAt(
        ObservationLib.Observation memory _newestObservation,
        ObservationLib.Observation memory _oldestObservation,
        uint24 _newestIndex,
        uint24 _oldestIndex,
        uint24 _cardinality,
        uint32 _timestamp
    ) internal view returns (uint224) {
        uint32 timeNow = uint32(block.timestamp);

        // IF empty ring buffer exit early.
        if (_cardinality == 0) return 0;

        /**
         * Ring Buffer Search Optimization
         * Before performing binary search on the ring buffer check
         * to see if timestamp is within range of [o T n] by comparing
         * the target timestamp to the oldest/newest observation.timestamps
         * IF the timestamp is out of the ring buffer range avoid starting
         * a binary search, because we can return NULL or oldestObservation.amount
         */

        /**
         * IF oldestObservation.timestamp is after timestamp: T[old ]
         * the Reserve did NOT have a balance or the ring buffer
         * no longer contains that timestamp checkpoint.
         */
        if (_oldestObservation.timestamp > _timestamp) {
            return 0;
        }

        /**
         * IF newestObservation.timestamp is before timestamp: [ new]T
         * return _newestObservation.amount since observation
         * contains the highest checkpointed reserveAccumulator.
         */
        if (_newestObservation.timestamp <= _timestamp) {
            return _newestObservation.amount;
        }

        // IF the timestamp is witin range of ring buffer start/end: [new T old]
        // FIND the closest observation to the left(or exact) of timestamp: [OT ]
        (
            ObservationLib.Observation memory beforeOrAt,
            ObservationLib.Observation memory atOrAfter
        ) = ObservationLib.binarySearch(
                reserveAccumulators,
                _newestIndex,
                _oldestIndex,
                _timestamp,
                _cardinality,
                timeNow
            );

        // IF target timestamp is EXACT match for atOrAfter.timestamp observation return amount.
        // NOT having an exact match with atOrAfter means values will contain accumulator value AFTER the searchable range.
        // ELSE return observation.totalDepositedAccumulator closest to LEFT of target timestamp.
        if (atOrAfter.timestamp == _timestamp) {
            return atOrAfter.amount;
        } else {
            return beforeOrAt.amount;
        }
    }

    /// @notice Records the currently accrued reserve amount.
    function _checkpoint() internal {
        uint24 _cardinality = cardinality;
        uint24 _nextIndex = nextIndex;
        uint256 _balanceOfReserve = token.balanceOf(address(this));
        uint224 _withdrawAccumulator = withdrawAccumulator; //sload
        (uint24 newestIndex, ObservationLib.Observation memory newestObservation) = _getNewestObservation(_nextIndex);

        /**
         * IF tokens have been deposited into Reserve contract since the last checkpoint
         * create a new Reserve balance checkpoint. The will will update multiple times in a single block.
         */
        if (_balanceOfReserve + _withdrawAccumulator > newestObservation.amount) {
            uint32 nowTime = uint32(block.timestamp);

            // checkpointAccumulator = currentBalance + totalWithdraws
            uint224 newReserveAccumulator = uint224(_balanceOfReserve) + _withdrawAccumulator;

            // IF newestObservation IS NOT in the current block.
            // CREATE observation in the accumulators ring buffer.
            if (newestObservation.timestamp != nowTime) {
                reserveAccumulators[_nextIndex] = ObservationLib.Observation({
                    amount: newReserveAccumulator,
                    timestamp: nowTime
                });
                nextIndex = uint24(RingBufferLib.nextIndex(_nextIndex, MAX_CARDINALITY));
                if (_cardinality < MAX_CARDINALITY) {
                    cardinality = _cardinality + 1;
                }
            }
            // ELSE IF newestObservation IS in the current block.
            // UPDATE the checkpoint previously created in block history.
            else {
                reserveAccumulators[newestIndex] = ObservationLib.Observation({
                    amount: newReserveAccumulator,
                    timestamp: nowTime
                });
            }

            emit Checkpoint(newReserveAccumulator, _withdrawAccumulator);
        }
    }

    /// @notice Retrieves the oldest observation
    /// @param _nextIndex The next index of the Reserve observations
    function _getOldestObservation(uint24 _nextIndex)
        internal
        view
        returns (uint24 index, ObservationLib.Observation memory observation)
    {
        index = _nextIndex;
        observation = reserveAccumulators[index];

        // If the TWAB is not initialized we go to the beginning of the TWAB circular buffer at index 0
        if (observation.timestamp == 0) {
            index = 0;
            observation = reserveAccumulators[0];
        }
    }

    /// @notice Retrieves the newest observation
    /// @param _nextIndex The next index of the Reserve observations
    function _getNewestObservation(uint24 _nextIndex)
        internal
        view
        returns (uint24 index, ObservationLib.Observation memory observation)
    {
        index = uint24(RingBufferLib.newestIndex(_nextIndex, MAX_CARDINALITY));
        observation = reserveAccumulators[index];
    }
}
