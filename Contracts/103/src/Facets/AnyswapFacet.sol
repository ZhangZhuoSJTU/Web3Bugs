// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import { ILiFi } from "../Interfaces/ILiFi.sol";
import { IAnyswapRouter } from "../Interfaces/IAnyswapRouter.sol";
import { LibDiamond } from "../Libraries/LibDiamond.sol";
import { LibAsset, IERC20 } from "../Libraries/LibAsset.sol";
import { IAnyswapToken } from "../Interfaces/IAnyswapToken.sol";
import { LibDiamond } from "../Libraries/LibDiamond.sol";
import "./Swapper.sol";

/**
 * @title Anyswap Facet
 * @author Li.Finance (https://li.finance)
 * @notice Provides functionality for bridging through Multichain (Prev. AnySwap)
 */
contract AnyswapFacet is ILiFi, Swapper {
    /* ========== Types ========== */

    struct AnyswapData {
        address token;
        address router;
        uint256 amount;
        address recipient;
        uint256 toChainId;
    }

    /* ========== Public Bridge Functions ========== */

    /**
     * @notice Bridges tokens via Anyswap
     * @param _lifiData data used purely for tracking and analytics
     * @param _anyswapData data specific to Anyswap
     */
    function startBridgeTokensViaAnyswap(LiFiData memory _lifiData, AnyswapData calldata _anyswapData) public payable {
        address underlyingToken = IAnyswapToken(_anyswapData.token).underlying();
        if (_anyswapData.token != address(0) && underlyingToken != IAnyswapRouter(_anyswapData.router).wNATIVE()) {
            if (underlyingToken == address(0)) {
                underlyingToken = _anyswapData.token;
            }

            uint256 _fromTokenBalance = LibAsset.getOwnBalance(underlyingToken);
            LibAsset.transferFromERC20(underlyingToken, msg.sender, address(this), _anyswapData.amount);

            require(
                LibAsset.getOwnBalance(underlyingToken) - _fromTokenBalance == _anyswapData.amount,
                "ERR_INVALID_AMOUNT"
            );
        } else {
            require(msg.value == _anyswapData.amount, "ERR_INVALID_AMOUNT");
        }

        _startBridge(_anyswapData);

        emit LiFiTransferStarted(
            _lifiData.transactionId,
            _lifiData.integrator,
            _lifiData.referrer,
            _lifiData.sendingAssetId,
            _lifiData.receivingAssetId,
            _lifiData.receiver,
            _lifiData.amount,
            _lifiData.destinationChainId,
            block.timestamp
        );
    }

    /**
     * @notice Performs a swap before bridging via Anyswap
     * @param _lifiData data used purely for tracking and analytics
     * @param _swapData an array of swap related data for performing swaps before bridging
     * @param _anyswapData data specific to Anyswap
     */
    function swapAndStartBridgeTokensViaAnyswap(
        LiFiData memory _lifiData,
        LibSwap.SwapData[] calldata _swapData,
        AnyswapData memory _anyswapData
    ) public payable {
        address underlyingToken = IAnyswapToken(_anyswapData.token).underlying();
        if (_anyswapData.token != address(0) && underlyingToken != IAnyswapRouter(_anyswapData.router).wNATIVE()) {
            if (underlyingToken == address(0)) {
                underlyingToken = _anyswapData.token;
            }

            uint256 _fromTokenBalance = LibAsset.getOwnBalance(underlyingToken);

            // Swap
            _executeSwaps(_lifiData, _swapData);

            uint256 _postSwapBalance = LibAsset.getOwnBalance(underlyingToken) - _fromTokenBalance;

            require(_postSwapBalance > 0, "ERR_INVALID_AMOUNT");

            _anyswapData.amount = _postSwapBalance;
        } else {
            uint256 _fromBalance = address(this).balance;

            // Swap
            _executeSwaps(_lifiData, _swapData);

            require(address(this).balance - _fromBalance >= _anyswapData.amount, "ERR_INVALID_AMOUNT");

            uint256 _postSwapBalance = address(this).balance - _fromBalance;

            require(_postSwapBalance > 0, "ERR_INVALID_AMOUNT");

            _anyswapData.amount = _postSwapBalance;
        }

        _startBridge(_anyswapData);

        emit LiFiTransferStarted(
            _lifiData.transactionId,
            _lifiData.integrator,
            _lifiData.referrer,
            _lifiData.sendingAssetId,
            _lifiData.receivingAssetId,
            _lifiData.receiver,
            _lifiData.amount,
            _lifiData.destinationChainId,
            block.timestamp
        );
    }

    /* ========== Internal Functions ========== */

    /**
     * @dev Conatains the business logic for the bridge via Anyswap
     * @param _anyswapData data specific to Anyswap
     */
    function _startBridge(AnyswapData memory _anyswapData) internal {
        // Check chain id
        require(block.chainid != _anyswapData.toChainId, "Cannot bridge to the same network.");
        address underlyingToken = IAnyswapToken(_anyswapData.token).underlying();

        if (underlyingToken == IAnyswapRouter(_anyswapData.router).wNATIVE()) {
            IAnyswapRouter(_anyswapData.router).anySwapOutNative{ value: _anyswapData.amount }(
                _anyswapData.token,
                _anyswapData.recipient,
                _anyswapData.toChainId
            );
            return;
        }

        if (_anyswapData.token != address(0)) {
            // Has underlying token?
            if (underlyingToken != address(0)) {
                // Give Anyswap approval to bridge tokens
                LibAsset.approveERC20(IERC20(underlyingToken), _anyswapData.router, _anyswapData.amount);

                IAnyswapRouter(_anyswapData.router).anySwapOutUnderlying(
                    _anyswapData.token,
                    _anyswapData.recipient,
                    _anyswapData.amount,
                    _anyswapData.toChainId
                );
            } else {
                // Give Anyswap approval to bridge tokens
                LibAsset.approveERC20(IERC20(_anyswapData.token), _anyswapData.router, _anyswapData.amount);

                IAnyswapRouter(_anyswapData.router).anySwapOut(
                    _anyswapData.token,
                    _anyswapData.recipient,
                    _anyswapData.amount,
                    _anyswapData.toChainId
                );
            }
        }
    }
}
