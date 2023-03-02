// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/MetaContext.sol";

contract MetaContextTest is MetaContext {

    address public msgSender;
    uint256 public value;

    bytes public msgData;

    function getMsgSender(uint256 _value) external returns (address) {
        msgSender = _msgSender();
        value = _value;
        return msgSender;
    }

    function getMsgData() external returns (bytes memory) {
        msgData = _msgData();
        return msgData;
    }
}