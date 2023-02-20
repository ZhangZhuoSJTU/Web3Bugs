// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import { IDrawBeacon } from "@pooltogether/v4-core/contracts/interfaces/IDrawBeacon.sol";
import { IDrawBuffer } from "@pooltogether/v4-core/contracts/interfaces/IDrawBuffer.sol";

import { ISingleMessageDispatcher } from "./interfaces/ISingleMessageDispatcher.sol";

/**
 * @title PoolTogether V4 DrawDispatcher
 * @author PoolTogether Inc Team
 * @notice The DrawDispatcher smart contract relies on ERC-5164 to dispatch draws from Ethereum to another L1 or L2
 *         where Chainlink VRF 2.0 may not be available to compute draws.
 */
contract DrawDispatcher {
    /**
     * @notice Emitted when the `draw` has been dispatched.
     * @param dispatcher Address of the dispatcher on Ethereum that dispatched the draw
     * @param toChainId ID of the receiving chain
     * @param drawExecutor Address of the DrawExecutor on the receiving chain that will push the draw onto the DrawBuffer
     * @param draw Draw that was dispatched
     */
    event DrawDispatched(
        ISingleMessageDispatcher indexed dispatcher,
        uint256 indexed toChainId,
        address indexed drawExecutor,
        IDrawBeacon.Draw draw
    );

    /**
     * @notice Emitted when the `draws` have been dispatched.
     * @param dispatcher Address of the dispatcher on Ethereum that dispatched the draws
     * @param toChainId ID of the receiving chain
     * @param drawExecutor Address of the DrawExecutor on the receiving chain that will push the draws onto the DrawBuffer
     * @param draws Draws that were dispatched
     */
    event DrawsDispatched(
        ISingleMessageDispatcher indexed dispatcher,
        uint256 indexed toChainId,
        address indexed drawExecutor,
        IDrawBeacon.Draw[] draws
    );

    /// @notice DrawBuffer from which draws are retrieved.
    IDrawBuffer public immutable drawBuffer;

    /**
     * @notice DrawDispatcher constructor.
     * @param _drawBuffer Address of the DrawBuffer from which draws are retrieved
     */
    constructor(IDrawBuffer _drawBuffer) {
        require(address(_drawBuffer) != address(0), "DD/drawBuffer-not-zero-address");

        drawBuffer = _drawBuffer;
    }

    /**
     * @notice Retrieves and dispatch the newest recorded draw.
     * @param _dispatcher Address of the dispatcher on Ethereum that will be used to dispatch the draw
     * @param _toChainId ID of the receiving chain
     * @param _drawExecutor Address of the DrawExecutor on the receiving chain that will push the draw onto the DrawBuffer
     */
    function dispatchNewestDraw(
        ISingleMessageDispatcher _dispatcher,
        uint256 _toChainId,
        address _drawExecutor
    ) external {
        IDrawBeacon.Draw memory _newestDraw = drawBuffer.getNewestDraw();
        _dispatchDraw(_dispatcher, _toChainId, _drawExecutor, _newestDraw);
    }

    /**
     * @notice Retrieves and dispatch draw.
     * @dev Will revert if the draw does not exist.
     * @param _dispatcher Address of the dispatcher on Ethereum that will be used to dispatch the draw
     * @param _toChainId ID of the receiving chain
     * @param _drawExecutor Address of the DrawExecutor on the receiving chain that will push the draw onto the DrawBuffer
     * @param _drawId Id of the draw to dispatch
     */
    function dispatchDraw(
        ISingleMessageDispatcher _dispatcher,
        uint256 _toChainId,
        address _drawExecutor,
        uint32 _drawId
    ) external {
        require(_drawId > 0, "DD/drawId-gt-zero");

        IDrawBeacon.Draw memory _draw = drawBuffer.getDraw(_drawId);
        _dispatchDraw(_dispatcher, _toChainId, _drawExecutor, _draw);
    }

    /**
     * @notice Retrieves and dispatch draws.
     * @dev `_drawIds` must be ordered in ascending and contiguous order.
     * @dev Will revert if one of the draw does not exist.
     * @param _dispatcher Address of the dispatcher on Ethereum that will be used to dispatch the draw
     * @param _toChainId ID of the receiving chain
     * @param _drawExecutor Address of the DrawExecutor on the receiving chain that will push the draw onto the DrawBuffer
     * @param _drawIds Array of draw ids to dispatch
     */
    function dispatchDraws(
        ISingleMessageDispatcher _dispatcher,
        uint256 _toChainId,
        address _drawExecutor,
        uint32[] calldata _drawIds
    ) external {
        IDrawBeacon.Draw[] memory _draws = drawBuffer.getDraws(_drawIds);

        _dispatchMessage(
            _dispatcher,
            _toChainId,
            _drawExecutor,
            abi.encodeWithSignature("pushDraws((uint256,uint32,uint64,uint64,uint32)[])", _draws)
        );

        emit DrawsDispatched(_dispatcher, _toChainId, _drawExecutor, _draws);
    }

    /**
     * @notice Dispatch the passed `draw`.
     * @param _dispatcher Address of the dispatcher on Ethereum that will be used to dispatch the draw
     * @param _toChainId ID of the receiving chain
     * @param _drawExecutor Address of the DrawExecutor on the receiving chain that will push the draw onto the DrawBuffer
     * @param _draw Draw to dispatch
     */
    function _dispatchDraw(
        ISingleMessageDispatcher _dispatcher,
        uint256 _toChainId,
        address _drawExecutor,
        IDrawBeacon.Draw memory _draw
    ) internal {
        _dispatchMessage(
            _dispatcher,
            _toChainId,
            _drawExecutor,
            abi.encodeWithSignature("pushDraw((uint256,uint32,uint64,uint64,uint32))", _draw)
        );

        emit DrawDispatched(_dispatcher, _toChainId, _drawExecutor, _draw);
    }

    /**
     * @notice Dispatch encoded call.
     * @param _dispatcher Address of the dispatcher on Ethereum that will dispatch the call
     * @param _toChainId ID of the receiving chain
     * @param _drawExecutor Address of the DrawExecutor on the receiving chain that will receive the call
     * @param _data Calldata to dispatch
     */
    function _dispatchMessage(
        ISingleMessageDispatcher _dispatcher,
        uint256 _toChainId,
        address _drawExecutor,
        bytes memory _data
    ) internal {
        require(address(_dispatcher) != address(0), "DD/dispatcher-not-zero-address");
        require(_drawExecutor != address(0), "DD/drawExecutor-not-zero-address");

        _dispatcher.dispatchMessage(_toChainId, _drawExecutor, _data);
    }
}
