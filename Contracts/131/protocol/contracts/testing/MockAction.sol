// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../interfaces/actions/IAction.sol";
import "../../interfaces/IGasBank.sol";

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract MockAction is IAction {
    using EnumerableSet for EnumerableSet.AddressSet;
    mapping(address => uint256) private _totalGasRegistered;

    EnumerableSet.AddressSet private _usableTokens;

    receive() external payable {}

    function setEthRequiredForGas(address payer, uint256 amount) external {
        _totalGasRegistered[payer] = amount;
    }

    function withdrawFromGasBank(
        IGasBank bank,
        address account,
        uint256 amount
    ) external {
        bank.withdrawFrom(account, payable(address(this)), amount);
    }

    function addUsableToken(address token) external override returns (bool) {
        return _usableTokens.add(token);
    }

    function getEthRequiredForGas(address payer) external view override returns (uint256) {
        return _totalGasRegistered[payer];
    }

    function getUsableTokens() external pure returns (address[] memory) {
        return new address[](0);
    }

    function isUsable(address) external pure returns (bool) {
        return false;
    }

    function getActionFee() external pure returns (uint256) {
        return 0;
    }

    function getFeeHandler() external pure returns (address) {
        return address(0);
    }

    function executeActionFee() external pure returns (uint256) {
        return 0;
    }

    function executeFeeHandler() external pure returns (address) {
        return address(0);
    }
}
