// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IAction {
    /**
     * @return the total amount of ETH (in wei) required to cover gas
     */
    function getEthRequiredForGas(address payer) external view returns (uint256);

    function addUsableToken(address token) external returns (bool);

    function getUsableTokens() external view returns (address[] memory);

    function isUsable(address token) external view returns (bool);

    function getActionFee() external view returns (uint256);

    function getFeeHandler() external view returns (address);

    function executeActionFee() external returns (uint256);

    function executeFeeHandler() external returns (address);
}
