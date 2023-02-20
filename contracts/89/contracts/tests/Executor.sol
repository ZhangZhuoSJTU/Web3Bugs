// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract Executor is AccessControl {
    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function execute(address[] calldata targets, bytes[] memory data)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        bool success;
        bytes memory returnData;
        require(targets.length == data.length, "INVALID_INPUT");
        for (uint i = 0; i < targets.length; i++) {
            (success, returnData) = targets[i].call(data[i]);
            require(success, string(returnData));
        }
    }
}
