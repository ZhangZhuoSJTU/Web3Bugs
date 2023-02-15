// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import { ITransactionManager } from "../Interfaces/ITransactionManager.sol";
import { ILiFi } from "../Interfaces/ILiFi.sol";
import { LibAsset, IERC20 } from "../Libraries/LibAsset.sol";
import { LibDiamond } from "../Libraries/LibDiamond.sol";
import "./Swapper.sol";

/**
 * @title NXTP (Connext) Facet
 * @author Li.Finance (https://li.finance)
 * @notice Provides functionality for bridging through NXTP (Connext)
 */
contract NXTPFacet is ILiFi, Swapper {
    /* ========== Storage ========== */

    bytes32 internal constant NAMESPACE = keccak256("com.lifi.facets.nxtp");
    struct Storage {
        ITransactionManager nxtpTxManager;
    }

    /* ========== Events ========== */

    event NXTPBridgeStarted(
        bytes32 indexed lifiTransactionId,
        bytes32 nxtpTransactionId,
        ITransactionManager.TransactionData txData
    );

    /* ========== Init ========== */

    function initNXTP(ITransactionManager _txMgrAddr) external {
        Storage storage s = getStorage();
        LibDiamond.enforceIsContractOwner();
        s.nxtpTxManager = _txMgrAddr;
    }

    /* ========== Public Bridge Functions ========== */

    /**
     * @notice This function starts a cross-chain transaction using the NXTP protocol
     * @param _lifiData data used purely for tracking and analytics
     * @param _nxtpData data needed to complete an NXTP cross-chain transaction
     */
    function startBridgeTokensViaNXTP(LiFiData memory _lifiData, ITransactionManager.PrepareArgs memory _nxtpData)
        public
        payable
    {
        // Ensure sender has enough to complete the bridge transaction
        address sendingAssetId = _nxtpData.invariantData.sendingAssetId;
        if (sendingAssetId == address(0)) require(msg.value == _nxtpData.amount, "ERR_INVALID_AMOUNT");
        else {
            uint256 _sendingAssetIdBalance = LibAsset.getOwnBalance(sendingAssetId);
            LibAsset.transferFromERC20(sendingAssetId, msg.sender, address(this), _nxtpData.amount);
            require(
                LibAsset.getOwnBalance(sendingAssetId) - _sendingAssetIdBalance == _nxtpData.amount,
                "ERR_INVALID_AMOUNT"
            );
        }

        // Start the bridge process
        _startBridge(_lifiData.transactionId, _nxtpData);

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
     * @notice This function performs a swap or multiple swaps and then starts a cross-chain transaction
     *         using the NXTP protocol.
     * @param _lifiData data used purely for tracking and analytics
     * @param _swapData array of data needed for swaps
     * @param _nxtpData data needed to complete an NXTP cross-chain transaction
     */
    function swapAndStartBridgeTokensViaNXTP(
        LiFiData memory _lifiData,
        LibSwap.SwapData[] calldata _swapData,
        ITransactionManager.PrepareArgs memory _nxtpData
    ) public payable {
        address sendingAssetId = _nxtpData.invariantData.sendingAssetId;
        uint256 _sendingAssetIdBalance = LibAsset.getOwnBalance(sendingAssetId);

        // Swap
        _executeSwaps(_lifiData, _swapData);

        uint256 _postSwapBalance = LibAsset.getOwnBalance(sendingAssetId) - _sendingAssetIdBalance;

        require(_postSwapBalance > 0, "ERR_INVALID_AMOUNT");

        _nxtpData.amount = _postSwapBalance;

        _startBridge(_lifiData.transactionId, _nxtpData);

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
     * @notice Completes a cross-chain transaction on the receiving chain using the NXTP protocol.
     * @param _lifiData data used purely for tracking and analytics
     * @param assetId token received on the receiving chain
     * @param receiver address that will receive the tokens
     * @param amount number of tokens received
     */
    function completeBridgeTokensViaNXTP(
        LiFiData memory _lifiData,
        address assetId,
        address receiver,
        uint256 amount
    ) public payable {
        if (LibAsset.isNativeAsset(assetId)) {
            require(msg.value == amount, "INVALID_ETH_AMOUNT");
        } else {
            require(msg.value == 0, "ETH_WITH_ERC");
            LibAsset.transferFromERC20(assetId, msg.sender, address(this), amount);
        }

        LibAsset.transferAsset(assetId, payable(receiver), amount);

        emit LiFiTransferCompleted(_lifiData.transactionId, assetId, receiver, amount, block.timestamp);
    }

    /**
     * @notice Performs a swap before completing a cross-chain transaction
     *         on the receiving chain using the NXTP protocol.
     * @param _lifiData data used purely for tracking and analytics
     * @param _swapData array of data needed for swaps
     * @param finalAssetId token received on the receiving chain
     * @param receiver address that will receive the tokens
     */
    function swapAndCompleteBridgeTokensViaNXTP(
        LiFiData memory _lifiData,
        LibSwap.SwapData[] calldata _swapData,
        address finalAssetId,
        address receiver
    ) public payable {
        uint256 startingBalance = LibAsset.getOwnBalance(finalAssetId);

        // Swap
        _executeSwaps(_lifiData, _swapData);

        uint256 postSwapBalance = LibAsset.getOwnBalance(finalAssetId);

        uint256 finalBalance;

        if (postSwapBalance > startingBalance) {
            finalBalance = postSwapBalance - startingBalance;
            LibAsset.transferAsset(finalAssetId, payable(receiver), finalBalance);
        }

        emit LiFiTransferCompleted(_lifiData.transactionId, finalAssetId, receiver, finalBalance, block.timestamp);
    }

    /* ========== Internal Functions ========== */

    function _startBridge(bytes32 _transactionId, ITransactionManager.PrepareArgs memory _nxtpData) internal {
        Storage storage s = getStorage();
        IERC20 sendingAssetId = IERC20(_nxtpData.invariantData.sendingAssetId);

        // Give Connext approval to bridge tokens
        LibAsset.approveERC20(IERC20(sendingAssetId), address(s.nxtpTxManager), _nxtpData.amount);

        uint256 value = LibAsset.isNativeAsset(address(sendingAssetId)) ? _nxtpData.amount : 0;

        // Initiate bridge transaction on sending chain
        ITransactionManager.TransactionData memory result = s.nxtpTxManager.prepare{ value: value }(_nxtpData);

        emit NXTPBridgeStarted(_transactionId, result.transactionId, result);
    }

    function getStorage() internal pure returns (Storage storage s) {
        bytes32 namespace = NAMESPACE;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            s.slot := namespace
        }
    }

    /* ========== Getter Functions ========== */

    /**
     * @notice show the NXTP transaction manager contract address
     */
    function getNXTPTransactionManager() external view returns (address) {
        Storage storage s = getStorage();
        return address(s.nxtpTxManager);
    }
}
