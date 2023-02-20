// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./IManager.sol";

interface IConverter {
    function manager() external view returns (IManager);
    function convert(
        address _input,
        address _output,
        uint256 _inputAmount,
        uint256 _estimatedOutput
    ) external returns (uint256 _outputAmount);
    function expected(
        address _input,
        address _output,
        uint256 _inputAmount
    ) external view returns (uint256 _outputAmount);
}
