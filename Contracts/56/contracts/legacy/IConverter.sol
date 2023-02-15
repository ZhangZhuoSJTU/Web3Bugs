// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase
// solhint-disable var-name-mixedcase

pragma solidity 0.6.12;

interface IConverter {
    function token() external view returns (address _share);
    function convert(
        address _input,
        address _output,
        uint _inputAmount
    ) external returns (uint _outputAmount);
    function convert_rate(
        address _input,
        address _output,
        uint _inputAmount
    ) external view returns (uint _outputAmount);
    function convert_stables(
        uint[3] calldata amounts
    ) external returns (uint _shareAmount); // 0: DAI, 1: USDC, 2: USDT
    function calc_token_amount(
        uint[3] calldata amounts,
        bool deposit
    ) external view returns (uint _shareAmount);
    function calc_token_amount_withdraw(
        uint _shares,
        address _output
    ) external view returns (uint _outputAmount);
    function setStrategy(address _strategy, bool _status) external;
}
