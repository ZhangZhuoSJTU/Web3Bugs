// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '../interfaces/IWETH9.sol';
import '../interfaces/ISavingsAccount.sol';

contract SavingsAccountEthUtils {
    IWETH9 public immutable weth;
    ISavingsAccount public immutable savingsAccount;

    constructor(address _weth, address _savingsAccount) {
        require(_weth != address(0), 'SAEU:C1');
        require(_savingsAccount != address(0), 'SAEU:C2');
        weth = IWETH9(_weth);
        savingsAccount = ISavingsAccount(_savingsAccount);
    }

    function depositEth(address _strategy, address _to) external payable {
        require(msg.value != 0, 'SAEU:DE1');
        _toWETHAndApprove(address(savingsAccount), msg.value);
        savingsAccount.deposit(address(weth), _strategy, _to, msg.value);
    }

    function _toWETHAndApprove(address _address, uint256 _amount) private {
        weth.deposit{value: _amount}();
        weth.approve(_address, _amount);
    }
}
