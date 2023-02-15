// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@pooltogether/owner-manager-contracts/contracts/Manageable.sol";

import "./interfaces/IDrawBuffer.sol";
import "./interfaces/IDrawBeacon.sol";
import "./libraries/DrawRingBufferLib.sol";

/**
  * @title  PoolTogether V4 DrawBuffer
  * @author PoolTogether Inc Team
  * @notice The DrawBuffer provides historical lookups of Draws via a circular ring buffer.
            Historical Draws can be accessed on-chain using a drawId to calculate ring buffer storage slot.
            The Draw settings can be created by manager/owner and existing Draws can only be updated the owner.
            Once a starting Draw has been added to the ring buffer, all following draws must have a sequential Draw ID.
    @dev    A DrawBuffer store a limited number of Draws before beginning to overwrite (managed via the cardinality) previous Draws.
    @dev    All mainnet DrawBuffer(s) are updated directly from a DrawBeacon, but non-mainnet DrawBuffer(s) (Matic, Optimism, Arbitrum, etc...)
            will receive a cross-chain message, duplicating the mainnet Draw configuration - enabling a prize savings liquidity network.
*/
contract DrawBuffer is IDrawBuffer, Manageable {
    using DrawRingBufferLib for DrawRingBufferLib.Buffer;

    /// @notice Draws ring buffer max length.
    uint16 public constant MAX_CARDINALITY = 256;

    /// @notice Draws ring buffer array.
    IDrawBeacon.Draw[MAX_CARDINALITY] private drawRingBuffer;

    /// @notice Holds ring buffer information
    DrawRingBufferLib.Buffer internal bufferMetadata;

    /* ============ Deploy ============ */

    /**
     * @notice Deploy DrawBuffer smart contract.
     * @param _owner Address of the owner of the DrawBuffer.
     * @param _cardinality Draw ring buffer cardinality.
     */
    constructor(address _owner, uint8 _cardinality) Ownable(_owner) {
        bufferMetadata.cardinality = _cardinality;
    }

    /* ============ External Functions ============ */

    /// @inheritdoc IDrawBuffer
    function getBufferCardinality() external view override returns (uint32) {
        return bufferMetadata.cardinality;
    }

    /// @inheritdoc IDrawBuffer
    function getDraw(uint32 drawId) external view override returns (IDrawBeacon.Draw memory) {
        return drawRingBuffer[_drawIdToDrawIndex(bufferMetadata, drawId)];
    }

    /// @inheritdoc IDrawBuffer
    function getDraws(uint32[] calldata _drawIds)
        external
        view
        override
        returns (IDrawBeacon.Draw[] memory)
    {
        IDrawBeacon.Draw[] memory draws = new IDrawBeacon.Draw[](_drawIds.length);
        DrawRingBufferLib.Buffer memory buffer = bufferMetadata;

        for (uint256 index = 0; index < _drawIds.length; index++) {
            draws[index] = drawRingBuffer[_drawIdToDrawIndex(buffer, _drawIds[index])];
        }

        return draws;
    }

    /// @inheritdoc IDrawBuffer
    function getDrawCount() external view override returns (uint32) {
        DrawRingBufferLib.Buffer memory buffer = bufferMetadata;

        if (buffer.lastDrawId == 0) {
            return 0;
        }

        uint32 bufferNextIndex = buffer.nextIndex;

        if (drawRingBuffer[bufferNextIndex].timestamp != 0) {
            return buffer.cardinality;
        } else {
            return bufferNextIndex;
        }
    }

    /// @inheritdoc IDrawBuffer
    function getNewestDraw() external view override returns (IDrawBeacon.Draw memory) {
        return _getNewestDraw(bufferMetadata);
    }

    /// @inheritdoc IDrawBuffer
    function getOldestDraw() external view override returns (IDrawBeacon.Draw memory) {
        // oldest draw should be next available index, otherwise it's at 0
        DrawRingBufferLib.Buffer memory buffer = bufferMetadata;
        IDrawBeacon.Draw memory draw = drawRingBuffer[buffer.nextIndex];

        if (draw.timestamp == 0) {
            // if draw is not init, then use draw at 0
            draw = drawRingBuffer[0];
        }

        return draw;
    }

    /// @inheritdoc IDrawBuffer
    function pushDraw(IDrawBeacon.Draw memory _draw)
        external
        override
        onlyManagerOrOwner
        returns (uint32)
    {
        return _pushDraw(_draw);
    }

    /// @inheritdoc IDrawBuffer
    function setDraw(IDrawBeacon.Draw memory _newDraw) external override onlyOwner returns (uint32) {
        DrawRingBufferLib.Buffer memory buffer = bufferMetadata;
        uint32 index = buffer.getIndex(_newDraw.drawId);
        drawRingBuffer[index] = _newDraw;
        emit DrawSet(_newDraw.drawId, _newDraw);
        return _newDraw.drawId;
    }

    /* ============ Internal Functions ============ */

    /**
     * @notice Convert a Draw.drawId to a Draws ring buffer index pointer.
     * @dev    The getNewestDraw.drawId() is used to calculate a Draws ID delta position.
     * @param _drawId Draw.drawId
     * @return Draws ring buffer index pointer
     */
    function _drawIdToDrawIndex(DrawRingBufferLib.Buffer memory _buffer, uint32 _drawId)
        internal
        pure
        returns (uint32)
    {
        return _buffer.getIndex(_drawId);
    }

    /**
     * @notice Read newest Draw from the draws ring buffer.
     * @dev    Uses the lastDrawId to calculate the most recently added Draw.
     * @param _buffer Draw ring buffer
     * @return IDrawBeacon.Draw
     */
    function _getNewestDraw(DrawRingBufferLib.Buffer memory _buffer)
        internal
        view
        returns (IDrawBeacon.Draw memory)
    {
        return drawRingBuffer[_buffer.getIndex(_buffer.lastDrawId)];
    }

    /**
     * @notice Push Draw onto draws ring buffer history.
     * @dev    Push new draw onto draws list via authorized manager or owner.
     * @param _newDraw IDrawBeacon.Draw
     * @return Draw.drawId
     */
    function _pushDraw(IDrawBeacon.Draw memory _newDraw) internal returns (uint32) {
        DrawRingBufferLib.Buffer memory _buffer = bufferMetadata;
        drawRingBuffer[_buffer.nextIndex] = _newDraw;
        bufferMetadata = _buffer.push(_newDraw.drawId);

        emit DrawSet(_newDraw.drawId, _newDraw);

        return _newDraw.drawId;
    }
}
