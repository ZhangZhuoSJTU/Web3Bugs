// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import { ILiFi } from "../Interfaces/ILiFi.sol";
import { IHopBridge } from "../Interfaces/IHopBridge.sol";
import { LibAsset, IERC20 } from "../Libraries/LibAsset.sol";
import { LibDiamond } from "../Libraries/LibDiamond.sol";
import "./Swapper.sol";

/**
 * @title Hop Facet
 * @author Li.Finance (https://li.finance)
 * @notice Provides functionality for bridging through Hop
 */
contract HopFacet is ILiFi, Swapper {
    /* ========== Storage ========== */

    bytes32 internal constant NAMESPACE = keccak256("com.lifi.facets.hop");
    struct Storage {
        mapping(string => IHopBridge.BridgeConfig) hopBridges;
        uint256 hopChainId;
    }

    /* ========== Types ========== */

    struct HopData {
        string asset;
        address recipient;
        uint256 chainId;
        uint256 amount;
        uint256 bonderFee;
        uint256 amountOutMin;
        uint256 deadline;
        uint256 destinationAmountOutMin;
        uint256 destinationDeadline;
    }

    /* ========== Init ========== */

    function initHop(
        string[] memory _tokens,
        IHopBridge.BridgeConfig[] memory _bridgeConfigs,
        uint256 _chainId
    ) external {
        Storage storage s = getStorage();
        LibDiamond.enforceIsContractOwner();

        for (uint8 i; i < _tokens.length; i++) {
            s.hopBridges[_tokens[i]] = _bridgeConfigs[i];
        }
        s.hopChainId = _chainId;
    }

    /* ========== Public Bridge Functions ========== */

    /**
     * @notice Bridges tokens via Hop Protocol
     * @param _lifiData data used purely for tracking and analytics
     * @param _hopData data specific to Hop Protocol
     */
    function startBridgeTokensViaHop(LiFiData memory _lifiData, HopData calldata _hopData) public payable {
        address sendingAssetId = _bridge(_hopData.asset).token;

        if (sendingAssetId == address(0)) require(msg.value == _hopData.amount, "ERR_INVALID_AMOUNT");
        else {
            uint256 _sendingAssetIdBalance = LibAsset.getOwnBalance(sendingAssetId);
            LibAsset.transferFromERC20(sendingAssetId, msg.sender, address(this), _hopData.amount);
            require(
                LibAsset.getOwnBalance(sendingAssetId) - _sendingAssetIdBalance == _hopData.amount,
                "ERR_INVALID_AMOUNT"
            );
        }

        _startBridge(_hopData);

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
     * @notice Performs a swap before bridging via Hop Protocol
     * @param _lifiData data used purely for tracking and analytics
     * @param _swapData an array of swap related data for performing swaps before bridging
     * @param _hopData data specific to Hop Protocol
     */
    function swapAndStartBridgeTokensViaHop(
        LiFiData memory _lifiData,
        LibSwap.SwapData[] calldata _swapData,
        HopData memory _hopData
    ) public payable {
        address sendingAssetId = _bridge(_hopData.asset).token;

        uint256 _sendingAssetIdBalance = LibAsset.getOwnBalance(sendingAssetId);

        // Swap
        _executeSwaps(_lifiData, _swapData);

        uint256 _postSwapBalance = LibAsset.getOwnBalance(sendingAssetId) - _sendingAssetIdBalance;

        require(_postSwapBalance > 0, "ERR_INVALID_AMOUNT");

        _hopData.amount = _postSwapBalance;

        _startBridge(_hopData);

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
     * @dev Conatains the business logic for the bridge via Hop Protocol
     * @param _hopData data specific to Hop Protocol
     */
    function _startBridge(HopData memory _hopData) internal {
        Storage storage s = getStorage();
        address sendingAssetId = _bridge(_hopData.asset).token;

        address bridge;
        if (s.hopChainId == 1) {
            bridge = _bridge(_hopData.asset).bridge;
        } else {
            bridge = _bridge(_hopData.asset).ammWrapper;
        }

        // Do HOP stuff
        require(s.hopChainId != _hopData.chainId, "Cannot bridge to the same network.");

        // Give Hop approval to bridge tokens
        LibAsset.approveERC20(IERC20(sendingAssetId), bridge, _hopData.amount);

        uint256 value = LibAsset.isNativeAsset(address(sendingAssetId)) ? _hopData.amount : 0;

        if (s.hopChainId == 1) {
            // Ethereum L1
            IHopBridge(bridge).sendToL2{ value: value }(
                _hopData.chainId,
                _hopData.recipient,
                _hopData.amount,
                _hopData.destinationAmountOutMin,
                _hopData.destinationDeadline,
                address(0),
                0
            );
        } else {
            // L2
            // solhint-disable-next-line check-send-result
            IHopBridge(bridge).swapAndSend{ value: value }(
                _hopData.chainId,
                _hopData.recipient,
                _hopData.amount,
                _hopData.bonderFee,
                _hopData.amountOutMin,
                _hopData.deadline,
                _hopData.destinationAmountOutMin,
                _hopData.destinationDeadline
            );
        }
    }

    function _bridge(string memory _asset) internal view returns (IHopBridge.BridgeConfig memory) {
        Storage storage s = getStorage();
        return s.hopBridges[_asset];
    }

    function getStorage() internal pure returns (Storage storage s) {
        bytes32 namespace = NAMESPACE;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            s.slot := namespace
        }
    }
}
