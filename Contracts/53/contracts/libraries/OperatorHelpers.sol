// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "../interfaces/IOperatorSelector.sol";

/// @title Library to help the interaction with operators
library OperatorHelpers {
    /// @dev Build the calldata (with safe datas) and call the Operator
    /// @param _operator The operator address
    /// @param _commit True to call the commit operator function, false to call the revert function.
    /// @param _calldata Parameters of the operator (expect the 'self' parameter)
    /// @return success If the operator call is successful
    /// @return data The data from the call
    function callOperator(
        address _operator,
        bool _commit,
        bytes calldata _calldata
    ) internal returns (bool success, bytes memory data) {
        // The operator address needs to be the first parameter of the operator delegatecall.
        // We assume that the calldata given by the user are only the params, without the signature.
        // Parameters are concatenated and padded to 32 bytes.
        // We are concatenating the selector + operator address + given params
        bytes4 selector;
        if (_commit) {
            selector = IOperatorSelector(_operator).getCommitSelector();
        } else {
            selector = IOperatorSelector(_operator).getRevertSelector();
        }

        bytes memory safeCalldata = bytes.concat(selector, abi.encode(_operator), _calldata);

        (success, data) = _operator.delegatecall(safeCalldata);
    }

    /// @dev Get amounts and tokens from operator call by decoding data
    /// @param _data The bytes from the operator call
    /// @param _inputToken Input token expected to be used by the operator
    /// @param _outputToken Output token expected to be used by the operator
    /// @return amounts The amounts from the execution (used and received)
    ///         - amounts[0] : The amount of output token
    ///         - amounts[1] : The amount of input token USED by the operator (can be different than expected)
    /// @return tokens The tokens used and received from the execution
    ///         - tokens[0] : The output token from the operator execution
    ///         - tokens[1] : The token used as an input
    function decodeDataAndRequire(
        bytes memory _data,
        address _inputToken,
        address _outputToken
    ) internal returns (uint256[] memory amounts, address[] memory tokens) {
        (amounts, tokens) = abi.decode(_data, (uint256[], address[]));
        require(tokens[0] == _outputToken, "OperatorHelpers::getDecodeDataAndRequire: Wrong output token");
        require(tokens[1] == _inputToken, "OperatorHelpers::getDecodeDataAndRequire: Wrong input token");
    }
}
