// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@pooltogether/pooltogether-rng-contracts/contracts/RNGInterface.sol";
import "@pooltogether/owner-manager-contracts/contracts/Ownable.sol";

import "./interfaces/IDrawBeacon.sol";
import "./interfaces/IDrawBuffer.sol";


/**
  * @title  PoolTogether V4 DrawBeacon
  * @author PoolTogether Inc Team
  * @notice Manages RNG (random number generator) requests and pushing Draws onto DrawBuffer.
            The DrawBeacon has 3 major actions for requesting a random number: start, cancel and complete.
            To create a new Draw, the user requests a new random number from the RNG service.
            When the random number is available, the user can create the draw using the create() method
            which will push the draw onto the DrawBuffer.
            If the RNG service fails to deliver a rng, when the request timeout elapses, the user can cancel the request.
*/
contract DrawBeacon is IDrawBeacon, Ownable {
    using SafeCast for uint256;
    using SafeERC20 for IERC20;

    /* ============ Variables ============ */

    /// @notice RNG contract interface
    RNGInterface internal rng;

    /// @notice Current RNG Request
    RngRequest internal rngRequest;

    /// @notice DrawBuffer address
    IDrawBuffer internal drawBuffer;

    /**
     * @notice RNG Request Timeout.  In fact, this is really a "complete draw" timeout.
     * @dev If the rng completes the award can still be cancelled.
     */
    uint32 internal rngTimeout;

    /// @notice Seconds between beacon period request
    uint32 internal beaconPeriodSeconds;

    /// @notice Epoch timestamp when beacon period can start
    uint64 internal beaconPeriodStartedAt;

    /**
     * @notice Next Draw ID to use when pushing a Draw onto DrawBuffer
     * @dev Starts at 1. This way we know that no Draw has been recorded at 0.
     */
    uint32 internal nextDrawId;

    /* ============ Structs ============ */

    /**
     * @notice RNG Request
     * @param id          RNG request ID
     * @param lockBlock   Block number that the RNG request is locked
     * @param requestedAt Time when RNG is requested
     */
    struct RngRequest {
        uint32 id;
        uint32 lockBlock;
        uint64 requestedAt;
    }

    /* ============ Events ============ */

    /**
     * @notice Emit when the DrawBeacon is deployed.
     * @param nextDrawId Draw ID at which the DrawBeacon should start. Can't be inferior to 1.
     * @param beaconPeriodStartedAt Timestamp when beacon period starts.
     */
    event Deployed(
        uint32 nextDrawId,
        uint64 beaconPeriodStartedAt
    );

    /* ============ Modifiers ============ */

    modifier requireDrawNotStarted() {
        _requireDrawNotStarted();
        _;
    }

    modifier requireCanStartDraw() {
        require(_isBeaconPeriodOver(), "DrawBeacon/beacon-period-not-over");
        require(!isRngRequested(), "DrawBeacon/rng-already-requested");
        _;
    }

    modifier requireCanCompleteRngRequest() {
        require(isRngRequested(), "DrawBeacon/rng-not-requested");
        require(isRngCompleted(), "DrawBeacon/rng-not-complete");
        _;
    }

    /* ============ Constructor ============ */

    /**
     * @notice Deploy the DrawBeacon smart contract.
     * @param _owner Address of the DrawBeacon owner
     * @param _drawBuffer The address of the draw buffer to push draws to
     * @param _rng The RNG service to use
     * @param _nextDrawId Draw ID at which the DrawBeacon should start. Can't be inferior to 1.
     * @param _beaconPeriodStart The starting timestamp of the beacon period.
     * @param _beaconPeriodSeconds The duration of the beacon period in seconds
     */
    constructor(
        address _owner,
        IDrawBuffer _drawBuffer,
        RNGInterface _rng,
        uint32 _nextDrawId,
        uint64 _beaconPeriodStart,
        uint32 _beaconPeriodSeconds,
        uint32 _rngTimeout
    ) Ownable(_owner) {
        require(_beaconPeriodStart > 0, "DrawBeacon/beacon-period-greater-than-zero");
        require(address(_rng) != address(0), "DrawBeacon/rng-not-zero");
        require(_nextDrawId >= 1, "DrawBeacon/next-draw-id-gte-one");

        beaconPeriodStartedAt = _beaconPeriodStart;
        nextDrawId = _nextDrawId;

        _setBeaconPeriodSeconds(_beaconPeriodSeconds);
        _setDrawBuffer(_drawBuffer);
        _setRngService(_rng);
        _setRngTimeout(_rngTimeout);

        emit Deployed(_nextDrawId, _beaconPeriodStart);
        emit BeaconPeriodStarted(_beaconPeriodStart);
    }

    /* ============ Public Functions ============ */

    /**
     * @notice Returns whether the random number request has completed.
     * @return True if a random number request has completed, false otherwise.
     */
    function isRngCompleted() public view override returns (bool) {
        return rng.isRequestComplete(rngRequest.id);
    }

    /**
     * @notice Returns whether a random number has been requested
     * @return True if a random number has been requested, false otherwise.
     */
    function isRngRequested() public view override returns (bool) {
        return rngRequest.id != 0;
    }

    /**
     * @notice Returns whether the random number request has timed out.
     * @return True if a random number request has timed out, false otherwise.
     */
    function isRngTimedOut() public view override returns (bool) {
        if (rngRequest.requestedAt == 0) {
            return false;
        } else {
            return rngTimeout + rngRequest.requestedAt < _currentTime();
        }
    }

    /* ============ External Functions ============ */

    /// @inheritdoc IDrawBeacon
    function canStartDraw() external view override returns (bool) {
        return _isBeaconPeriodOver() && !isRngRequested();
    }

    /// @inheritdoc IDrawBeacon
    function canCompleteDraw() external view override returns (bool) {
        return isRngRequested() && isRngCompleted();
    }

    /// @notice Calculates the next beacon start time, assuming all beacon periods have occurred between the last and now.
    /// @return The next beacon period start time
    function calculateNextBeaconPeriodStartTimeFromCurrentTime() external view returns (uint64) {
        return
            _calculateNextBeaconPeriodStartTime(
                beaconPeriodStartedAt,
                beaconPeriodSeconds,
                _currentTime()
            );
    }

    /// @inheritdoc IDrawBeacon
    function calculateNextBeaconPeriodStartTime(uint64 _time)
        external
        view
        override
        returns (uint64)
    {
        return
            _calculateNextBeaconPeriodStartTime(
                beaconPeriodStartedAt,
                beaconPeriodSeconds,
                _time
            );
    }

    /// @inheritdoc IDrawBeacon
    function cancelDraw() external override {
        require(isRngTimedOut(), "DrawBeacon/rng-not-timedout");
        uint32 requestId = rngRequest.id;
        uint32 lockBlock = rngRequest.lockBlock;
        delete rngRequest;
        emit DrawCancelled(requestId, lockBlock);
    }

    /// @inheritdoc IDrawBeacon
    function completeDraw() external override requireCanCompleteRngRequest {
        uint256 randomNumber = rng.randomNumber(rngRequest.id);
        uint32 _nextDrawId = nextDrawId;
        uint64 _beaconPeriodStartedAt = beaconPeriodStartedAt;
        uint32 _beaconPeriodSeconds = beaconPeriodSeconds;
        uint64 _time = _currentTime();

        // create Draw struct
        IDrawBeacon.Draw memory _draw = IDrawBeacon.Draw({
            winningRandomNumber: randomNumber,
            drawId: _nextDrawId,
            timestamp: rngRequest.requestedAt, // must use the startAward() timestamp to prevent front-running
            beaconPeriodStartedAt: _beaconPeriodStartedAt,
            beaconPeriodSeconds: _beaconPeriodSeconds
        });

        drawBuffer.pushDraw(_draw);

        // to avoid clock drift, we should calculate the start time based on the previous period start time.
        uint64 nextBeaconPeriodStartedAt = _calculateNextBeaconPeriodStartTime(
            _beaconPeriodStartedAt,
            _beaconPeriodSeconds,
            _time
        );
        beaconPeriodStartedAt = nextBeaconPeriodStartedAt;
        nextDrawId = _nextDrawId + 1;

        // Reset the rngReqeust state so Beacon period can start again.
        delete rngRequest;

        emit DrawCompleted(randomNumber);
        emit BeaconPeriodStarted(nextBeaconPeriodStartedAt);
    }

    /// @inheritdoc IDrawBeacon
    function beaconPeriodRemainingSeconds() external view override returns (uint64) {
        return _beaconPeriodRemainingSeconds();
    }

    /// @inheritdoc IDrawBeacon
    function beaconPeriodEndAt() external view override returns (uint64) {
        return _beaconPeriodEndAt();
    }

    function getBeaconPeriodSeconds() external view returns (uint32) {
        return beaconPeriodSeconds;
    }

    function getBeaconPeriodStartedAt() external view returns (uint64) {
        return beaconPeriodStartedAt;
    }

    function getDrawBuffer() external view returns (IDrawBuffer) {
        return drawBuffer;
    }

    function getNextDrawId() external view returns (uint32) {
        return nextDrawId;
    }

    /// @inheritdoc IDrawBeacon
    function getLastRngLockBlock() external view override returns (uint32) {
        return rngRequest.lockBlock;
    }

    function getLastRngRequestId() external view override returns (uint32) {
        return rngRequest.id;
    }

    function getRngService() external view returns (RNGInterface) {
        return rng;
    }

    function getRngTimeout() external view returns (uint32) {
        return rngTimeout;
    }

    /// @inheritdoc IDrawBeacon
    function isBeaconPeriodOver() external view override returns (bool) {
        return _isBeaconPeriodOver();
    }

    /// @inheritdoc IDrawBeacon
    function setDrawBuffer(IDrawBuffer newDrawBuffer)
        external
        override
        onlyOwner
        returns (IDrawBuffer)
    {
        return _setDrawBuffer(newDrawBuffer);
    }

    /// @inheritdoc IDrawBeacon
    function startDraw() external override requireCanStartDraw {
        (address feeToken, uint256 requestFee) = rng.getRequestFee();

        if (feeToken != address(0) && requestFee > 0) {
            IERC20(feeToken).safeIncreaseAllowance(address(rng), requestFee);
        }

        (uint32 requestId, uint32 lockBlock) = rng.requestRandomNumber();
        rngRequest.id = requestId;
        rngRequest.lockBlock = lockBlock;
        rngRequest.requestedAt = _currentTime();

        emit DrawStarted(requestId, lockBlock);
    }

    /// @inheritdoc IDrawBeacon
    function setBeaconPeriodSeconds(uint32 _beaconPeriodSeconds)
        external
        override
        onlyOwner
        requireDrawNotStarted
    {
        _setBeaconPeriodSeconds(_beaconPeriodSeconds);
    }

    /// @inheritdoc IDrawBeacon
    function setRngTimeout(uint32 _rngTimeout) external override onlyOwner requireDrawNotStarted {
        _setRngTimeout(_rngTimeout);
    }

    /// @inheritdoc IDrawBeacon
    function setRngService(RNGInterface _rngService)
        external
        override
        onlyOwner
        requireDrawNotStarted
    {
        _setRngService(_rngService);
    }

    /**
     * @notice Sets the RNG service that the Prize Strategy is connected to
     * @param _rngService The address of the new RNG service interface
     */
    function _setRngService(RNGInterface _rngService) internal
    {
        rng = _rngService;
        emit RngServiceUpdated(_rngService);
    }

    /* ============ Internal Functions ============ */

    /**
     * @notice Calculates when the next beacon period will start
     * @param _beaconPeriodStartedAt The timestamp at which the beacon period started
     * @param _beaconPeriodSeconds The duration of the beacon period in seconds
     * @param _time The timestamp to use as the current time
     * @return The timestamp at which the next beacon period would start
     */
    function _calculateNextBeaconPeriodStartTime(
        uint64 _beaconPeriodStartedAt,
        uint32 _beaconPeriodSeconds,
        uint64 _time
    ) internal pure returns (uint64) {
        uint64 elapsedPeriods = (_time - _beaconPeriodStartedAt) / _beaconPeriodSeconds;
        return _beaconPeriodStartedAt + (elapsedPeriods * _beaconPeriodSeconds);
    }

    /**
     * @notice returns the current time.  Used for testing.
     * @return The current time (block.timestamp)
     */
    function _currentTime() internal view virtual returns (uint64) {
        return uint64(block.timestamp);
    }

    /**
     * @notice Returns the timestamp at which the beacon period ends
     * @return The timestamp at which the beacon period ends
     */
    function _beaconPeriodEndAt() internal view returns (uint64) {
        return beaconPeriodStartedAt + beaconPeriodSeconds;
    }

    /**
     * @notice Returns the number of seconds remaining until the prize can be awarded.
     * @return The number of seconds remaining until the prize can be awarded.
     */
    function _beaconPeriodRemainingSeconds() internal view returns (uint64) {
        uint64 endAt = _beaconPeriodEndAt();
        uint64 time = _currentTime();

        if (endAt <= time) {
            return 0;
        }

        return endAt - time;
    }

    /**
     * @notice Returns whether the beacon period is over.
     * @return True if the beacon period is over, false otherwise
     */
    function _isBeaconPeriodOver() internal view returns (bool) {
        return _beaconPeriodEndAt() <= _currentTime();
    }

    /**
     * @notice Check to see draw is in progress.
     */
    function _requireDrawNotStarted() internal view {
        uint256 currentBlock = block.number;

        require(
            rngRequest.lockBlock == 0 || currentBlock < rngRequest.lockBlock,
            "DrawBeacon/rng-in-flight"
        );
    }

    /**
     * @notice Set global DrawBuffer variable.
     * @dev    All subsequent Draw requests/completions will be pushed to the new DrawBuffer.
     * @param _newDrawBuffer  DrawBuffer address
     * @return DrawBuffer
     */
    function _setDrawBuffer(IDrawBuffer _newDrawBuffer) internal returns (IDrawBuffer) {
        IDrawBuffer _previousDrawBuffer = drawBuffer;
        require(address(_newDrawBuffer) != address(0), "DrawBeacon/draw-history-not-zero-address");

        require(
            address(_newDrawBuffer) != address(_previousDrawBuffer),
            "DrawBeacon/existing-draw-history-address"
        );

        drawBuffer = _newDrawBuffer;

        emit DrawBufferUpdated(_newDrawBuffer);

        return _newDrawBuffer;
    }

    /**
     * @notice Sets the beacon period in seconds.
     * @param _beaconPeriodSeconds The new beacon period in seconds.  Must be greater than zero.
     */
    function _setBeaconPeriodSeconds(uint32 _beaconPeriodSeconds) internal {
        require(_beaconPeriodSeconds > 0, "DrawBeacon/beacon-period-greater-than-zero");
        beaconPeriodSeconds = _beaconPeriodSeconds;

        emit BeaconPeriodSecondsUpdated(_beaconPeriodSeconds);
    }

    /**
     * @notice Sets the RNG request timeout in seconds.  This is the time that must elapsed before the RNG request can be cancelled and the pool unlocked.
     * @param _rngTimeout The RNG request timeout in seconds.
     */
    function _setRngTimeout(uint32 _rngTimeout) internal {
        require(_rngTimeout > 60, "DrawBeacon/rng-timeout-gt-60-secs");
        rngTimeout = _rngTimeout;

        emit RngTimeoutSet(_rngTimeout);
    }
}
