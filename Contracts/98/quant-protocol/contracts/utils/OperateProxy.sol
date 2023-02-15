// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "../interfaces/IOperateProxy.sol";

/// @title Contract to be used by the Controller to make unprivileged external calls
/// @author Rolla
contract OperateProxy is IOperateProxy {
    /// @inheritdoc IOperateProxy
    function callFunction(address callee, bytes memory data) external override {
        require(
            callee != address(0),
            "OperateProxy: cannot make function calls to the zero address"
        );

        (bool success, bytes memory returnData) = address(callee).call(data);
        require(success, "OperateProxy: low-level call failed");
        emit FunctionCallExecuted(tx.origin, returnData);
    }
}
