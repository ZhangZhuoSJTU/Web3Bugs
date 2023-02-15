// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.0;

import "interfaces/notional/NotionalProxy.sol";

// Contract to test safe transfer behavior.
contract MockTransferOperator {
    // bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))
    bytes4 internal constant ERC1155_ACCEPTED = 0xf23a6e61;
    // bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))
    bytes4 internal constant ERC1155_BATCH_ACCEPTED = 0xbc197c81;

    NotionalProxy immutable notionalProxy;

    // Keep values from last received contract.
    bool public shouldReject;

    bytes public lastData;
    address public lastOperator;
    address public lastFrom;
    uint256 public lastId;
    uint256 public lastValue;

    constructor(NotionalProxy notional_) {
        notionalProxy = notional_;
    }

    function initiateTransfer(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external {
        notionalProxy.safeTransferFrom(from, to, id, amount, data);
    }

    function initiateBatchTransfer(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external {
        notionalProxy.safeBatchTransferFrom(from, to, ids, amounts, data);
    }

    function setShouldReject(bool _value) public {
        shouldReject = _value;
    }

    function onERC1155Received(
        address _operator,
        address _from,
        uint256 _id,
        uint256 _value,
        bytes calldata _data
    ) external returns (bytes4) {
        lastOperator = _operator;
        lastFrom = _from;
        lastId = _id;
        lastValue = _value;
        lastData = _data;
        if (shouldReject == true) {
            return 0;
        } else {
            return ERC1155_ACCEPTED;
        }
    }

    function onERC1155BatchReceived(
        address _operator,
        address _from,
        uint256[] calldata _ids,
        uint256[] calldata _values,
        bytes calldata _data
    ) external returns (bytes4) {
        lastOperator = _operator;
        lastFrom = _from;
        lastId = _ids[0];
        lastValue = _values[0];
        lastData = _data;
        if (shouldReject == true) {
            return 0;
        } else {
            return ERC1155_BATCH_ACCEPTED;
        }
    }

    // ERC165 interface support
    function supportsInterface(bytes4 interfaceID) external pure returns (bool) {
        return
            interfaceID == 0x01ffc9a7 || // ERC165
            interfaceID == 0x4e2312e0; // ERC1155_ACCEPTED ^ ERC1155_BATCH_ACCEPTED;
    }
}
