// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@pooltogether/owner-manager-contracts/contracts/Manageable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IReserve.sol";
import "./libraries/ObservationLib.sol";

/**
    * @title  PoolTogether V4 Reserve
    * @author PoolTogether Inc Team
    * @notice The Reserve contract provides historical lookups of a token balance increase during a target timerange.
              As the Reserve contract transfers OUT tokens, the withdraw accumulator is increased. When tokens are
              transfered IN new checkpoint *can* be created if checkpoint() is called after transfering tokens.
              By using the reserve and withdraw accumulators to create a new checkpoint, any contract or account
              can lookup the balance increase of the reserve for a target timerange.   
    * @dev    By calculating the total held tokens in a speicific time range, contracts that require knowledge 
              of captured interest during a draw period, can easily call into the Reserve and determininstially
              determine the newly aqcuired tokens for that time range. 
 */
contract Reserve is IReserve, Manageable {
    using SafeERC20 for IERC20;

    /// @notice ERC20 token
    IERC20 public immutable token;

    /// @notice Total withdraw amount from reserve
    uint224 public withdrawAccumulator;

    /// @notice The maximum number of twab entries
    uint24 internal constant MAX_CARDINALITY = 16777215; // 2**24

    ObservationLib.Observation[MAX_CARDINALITY] internal reserveAccumulators;

    uint24 internal cardinality;

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

        ObservationLib.Observation memory _newestObservation;

        if (_cardinality > 0) {
            _newestObservation = reserveAccumulators[_cardinality - 1];
        }

        ObservationLib.Observation memory _oldestObservation = reserveAccumulators[0];

        uint224 _start = _getReserveAccumulatedAt(
            _newestObservation,
            _oldestObservation,
            _cardinality,
            _startTimestamp
        );

        uint224 _end = _getReserveAccumulatedAt(
            _newestObservation,
            _oldestObservation,
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
     * @param _cardinality       RingBuffer Range
     * @param _timestamp          Timestamp target
     *
     * @return Optimal reserveAccumlator for timestamp.
     */
    function _getReserveAccumulatedAt(
        ObservationLib.Observation memory _newestObservation,
        ObservationLib.Observation memory _oldestObservation,
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
                _cardinality - 1,
                0,
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
        uint256 _balanceOfReserve = token.balanceOf(address(this));
        uint224 _withdrawAccumulator = withdrawAccumulator; //sload
        ObservationLib.Observation memory _newestObservation = _getNewestObservation(_cardinality);

        /**
         * IF tokens have been deposited into Reserve contract since the last checkpoint
         * create a new Reserve balance checkpoint. The will will update multiple times in a single block.
         */
        if (_balanceOfReserve + _withdrawAccumulator > _newestObservation.amount) {
            uint32 nowTime = uint32(block.timestamp);

            // checkpointAccumulator = currentBalance + totalWithdraws
            uint224 newReserveAccumulator = uint224(_balanceOfReserve) + _withdrawAccumulator;

            // IF _newestObservation IS NOT in the current block.
            // CREATE observation in the accumulators ring buffer.
            if (_newestObservation.timestamp != nowTime) {
                reserveAccumulators[_cardinality] = ObservationLib.Observation({
                    amount: newReserveAccumulator,
                    timestamp: nowTime
                });

                cardinality++;
            }
            // ELSE IF _newestObservation IS in the current block.
            // UPDATE the checkpoint previously created in block history.
            else {
                reserveAccumulators[_cardinality - 1] = ObservationLib.Observation({
                    amount: newReserveAccumulator,
                    timestamp: nowTime
                });
            }

            emit Checkpoint(newReserveAccumulator, _withdrawAccumulator);
        }
    }

    /// @notice Retrieves the newest observation
    function _getNewestObservation(uint24 _cardinality)
        internal
        view
        returns (ObservationLib.Observation memory _observation)
    {
        if (_cardinality > 0) _observation = reserveAccumulators[_cardinality - 1];
    }
}
