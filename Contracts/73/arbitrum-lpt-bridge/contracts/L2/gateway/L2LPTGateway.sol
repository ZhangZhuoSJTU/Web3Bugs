//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ControlledGateway} from "../../ControlledGateway.sol";
import {L2ArbitrumMessenger} from "./L2ArbitrumMessenger.sol";
import {IL2LPTGateway} from "./IL2LPTGateway.sol";
import {IL1LPTGateway} from "../../L1/gateway/IL1LPTGateway.sol";

interface Mintable {
    function mint(address _to, uint256 _amount) external;

    function burn(address _from, uint256 _amount) external;
}

interface IL2LPTDataCache {
    function increaseL2SupplyFromL1(uint256 _amount) external;

    function decreaseL2SupplyFromL1(uint256 _amount) external;
}

/**
 * @title L1LPTGateway
 * @notice Manages inbound and outbound transfers of LPT between Arbitrum Rollup and L1
 * @dev the contract can be paused by the governor which will prevent any outbound transfers
 * but pausing the contract does not affect inbound transfers (tokens coming from L1)
 */
contract L2LPTGateway is IL2LPTGateway, ControlledGateway, L2ArbitrumMessenger {
    address public immutable l2Router;
    address public immutable l2LPTDataCache;

    address public l1Counterpart;

    constructor(
        address _l2Router,
        address _l1Lpt,
        address _l2Lpt,
        address _l2LPTDataCache
    ) ControlledGateway(_l1Lpt, _l2Lpt) {
        l2Router = _l2Router;
        l2LPTDataCache = _l2LPTDataCache;
    }

    /**
     * @notice Sets address of companion L1LPTGateway
     * @dev Only address with the governor role is allowed to change the value of l1Counterpart
     * @param _l1Counterpart L1 Address of the counterpart
     */
    function setCounterpart(address _l1Counterpart)
        external
        onlyRole(GOVERNOR_ROLE)
    {
        l1Counterpart = _l1Counterpart;
    }

    /**
     * @notice Burns L2 tokens and sends a message to L1
     * The tokens will be received on L1 only after the wait period (7 days) is over
     * @dev no additional callhook data is allowed
     * @param _l1Token L1 Address of LPT
     * @param _to Recepient address on L1
     * @param _amount Amount of tokens to burn
     * @param _data Contains sender and additional data to send to L1
     * @return res ID of the withdraw tx
     */
    function outboundTransfer(
        address _l1Token,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) public override whenNotPaused returns (bytes memory res) {
        require(_l1Token == l1Lpt, "TOKEN_NOT_LPT");

        (address from, bytes memory extraData) = parseOutboundData(_data);
        require(extraData.length == 0, "CALL_HOOK_DATA_NOT_ALLOWED");

        Mintable(l2Lpt).burn(from, _amount);
        IL2LPTDataCache(l2LPTDataCache).decreaseL2SupplyFromL1(_amount);

        uint256 id = sendTxToL1(
            from,
            l1Counterpart,
            getOutboundCalldata(_l1Token, from, _to, _amount, extraData)
        );

        // we don't need to track exitNums (b/c we have no fast exits) so we always use 0
        emit WithdrawalInitiated(_l1Token, from, _to, id, 0, _amount);

        return abi.encode(id);
    }

    /**
     * @notice Receives token amount from L1 and mints the equivalent tokens to the receiving address
     * @dev can only accept txs coming directly from L1 LPT Gateway
     * data param is unused because no additional data is allowed from L1
     * @param _l1Token L1 Address of LPT
     * @param _from Address of the sender on L1
     * @param _to Recepient address on L2
     * @param _amount Amount of tokens transferred
     */
    function finalizeInboundTransfer(
        address _l1Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata // data -- unused
    ) external override onlyL1Counterpart(l1Counterpart) {
        require(_l1Token == l1Lpt, "TOKEN_NOT_LPT");

        Mintable(l2Lpt).mint(_to, _amount);
        IL2LPTDataCache(l2LPTDataCache).increaseL2SupplyFromL1(_amount);

        emit DepositFinalized(_l1Token, _from, _to, _amount);
    }

    /**
     * @notice Decodes calldata required for migration of tokens
     * @dev extraData can be left empty
     * @param data Encoded callhook data
     * @return from Sender of the tx
     * @return extraData Any other data sent to L1
     */
    function parseOutboundData(bytes memory data)
        internal
        view
        returns (address from, bytes memory extraData)
    {
        if (msg.sender == l2Router) {
            (from, extraData) = abi.decode(data, (address, bytes));
        } else {
            from = msg.sender;
            extraData = data;
        }
    }

    /**
     * @notice returns address of L1 LPT Gateway
     */
    function counterpartGateway() external view override returns (address) {
        return l1Counterpart;
    }

    /**
     * @notice returns address of L2 version of LPT
     */
    function calculateL2TokenAddress(address l1Token)
        external
        view
        override
        returns (address)
    {
        if (l1Token != l1Lpt) {
            return address(0);
        }

        return l2Lpt;
    }

    /**
     * @notice Creates calldata required to send tx to L1
     * @dev encodes the target function with its params which
     * will be called on L1 when the message is received on L1
     */
    function getOutboundCalldata(
        address token,
        address from,
        address to,
        uint256 amount,
        bytes memory data
    ) public pure returns (bytes memory outboundCalldata) {
        outboundCalldata = abi.encodeWithSelector(
            IL1LPTGateway.finalizeInboundTransfer.selector,
            token,
            from,
            to,
            amount,
            abi.encode(0, data) // we don't need to track exitNums (b/c we have no fast exits) so we always use 0
        );

        return outboundCalldata;
    }
}
