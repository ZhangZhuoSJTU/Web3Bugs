// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import { LibAsset, IERC20 } from "../Libraries/LibAsset.sol";
import { ILiFi } from "../Interfaces/ILiFi.sol";
import { ICBridge } from "../Interfaces/ICBridge.sol";
import { LibDiamond } from "../Libraries/LibDiamond.sol";
import "./Swapper.sol";

/**
 * @title CBridge Facet
 * @author Li.Finance (https://li.finance)
 * @notice Provides functionality for bridging through CBridge
 */
contract CBridgeFacet is ILiFi, Swapper {
    /* ========== Storage ========== */

    bytes32 internal constant NAMESPACE = keccak256("com.lifi.facets.cbridge2");
    struct Storage {
        address cBridge;
        uint64 cBridgeChainId;
    }

    /* ========== Types ========== */

    struct CBridgeData {
        address receiver;
        address token;
        uint256 amount;
        uint64 dstChainId;
        uint64 nonce;
        uint32 maxSlippage;
    }

    /* ========== Init ========== */

    /**
     * @notice Initializes local variables for the CBridge facet
     * @param _cBridge address of the canonical CBridge router contract
     * @param _chainId chainId of this deployed contract
     */
    function initCbridge(address _cBridge, uint64 _chainId) external {
        Storage storage s = getStorage();
        LibDiamond.enforceIsContractOwner();
        s.cBridge = _cBridge;
        s.cBridgeChainId = _chainId;
        emit Inited(s.cBridge, s.cBridgeChainId);
    }

    /* ========== Public Bridge Functions ========== */

    /**
     * @notice Bridges tokens via CBridge
     * @param _lifiData data used purely for tracking and analytics
     * @param _cBridgeData data specific to CBridge
     */
    function startBridgeTokensViaCBridge(LiFiData memory _lifiData, CBridgeData calldata _cBridgeData) public payable {
        if (_cBridgeData.token != address(0)) {
            uint256 _fromTokenBalance = LibAsset.getOwnBalance(_cBridgeData.token);

            LibAsset.transferFromERC20(_cBridgeData.token, msg.sender, address(this), _cBridgeData.amount);

            require(
                LibAsset.getOwnBalance(_cBridgeData.token) - _fromTokenBalance == _cBridgeData.amount,
                "ERR_INVALID_AMOUNT"
            );
        } else {
            require(msg.value >= _cBridgeData.amount, "ERR_INVALID_AMOUNT");
        }

        _startBridge(_cBridgeData);

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
     * @notice Performs a swap before bridging via CBridge
     * @param _lifiData data used purely for tracking and analytics
     * @param _swapData an array of swap related data for performing swaps before bridging
     * @param _cBridgeData data specific to CBridge
     */
    function swapAndStartBridgeTokensViaCBridge(
        LiFiData memory _lifiData,
        LibSwap.SwapData[] calldata _swapData,
        CBridgeData memory _cBridgeData
    ) public payable {
        if (_cBridgeData.token != address(0)) {
            uint256 _fromTokenBalance = LibAsset.getOwnBalance(_cBridgeData.token);

            // Swap
            _executeSwaps(_lifiData, _swapData);

            uint256 _postSwapBalance = LibAsset.getOwnBalance(_cBridgeData.token) - _fromTokenBalance;

            require(_postSwapBalance > 0, "ERR_INVALID_AMOUNT");

            _cBridgeData.amount = _postSwapBalance;
        } else {
            uint256 _fromBalance = address(this).balance;

            // Swap
            _executeSwaps(_lifiData, _swapData);

            uint256 _postSwapBalance = address(this).balance - _fromBalance;

            require(_postSwapBalance > 0, "ERR_INVALID_AMOUNT");

            _cBridgeData.amount = _postSwapBalance;
        }

        _startBridge(_cBridgeData);

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

    /*
     * @dev Conatains the business logic for the bridge via CBridge
     * @param _cBridgeData data specific to CBridge
     */
    function _startBridge(CBridgeData memory _cBridgeData) internal {
        Storage storage s = getStorage();
        address bridge = _bridge();

        // Do CBridge stuff
        require(s.cBridgeChainId != _cBridgeData.dstChainId, "Cannot bridge to the same network.");

        if (LibAsset.isNativeAsset(_cBridgeData.token)) {
            ICBridge(bridge).sendNative(
                _cBridgeData.receiver,
                _cBridgeData.amount,
                _cBridgeData.dstChainId,
                _cBridgeData.nonce,
                _cBridgeData.maxSlippage
            );
        } else {
            // Give CBridge approval to bridge tokens
            LibAsset.approveERC20(IERC20(_cBridgeData.token), bridge, _cBridgeData.amount);
            // solhint-disable check-send-result
            ICBridge(bridge).send(
                _cBridgeData.receiver,
                _cBridgeData.token,
                _cBridgeData.amount,
                _cBridgeData.dstChainId,
                _cBridgeData.nonce,
                _cBridgeData.maxSlippage
            );
        }
    }

    /*
     * @dev Public view function for the CBridge router address
     * @returns the router address
     */
    function _bridge() internal view returns (address) {
        Storage storage s = getStorage();
        return s.cBridge;
    }

    /**
     * @dev fetch local storage
     */
    function getStorage() internal pure returns (Storage storage s) {
        bytes32 namespace = NAMESPACE;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            s.slot := namespace
        }
    }
}
