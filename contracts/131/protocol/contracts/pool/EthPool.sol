// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./LiquidityPool.sol";
import "../../interfaces/pool/IEthPool.sol";

contract EthPool is LiquidityPool, IEthPool {
    constructor(IController _controller) LiquidityPool(_controller) {}

    receive() external payable {}

    function initialize(string calldata name_, address vault_) external override returns (bool) {
        return _initialize(name_, vault_);
    }

    function getUnderlying() public pure override returns (address) {
        return address(0);
    }

    function _doTransferIn(address from, uint256 amount) internal override {
        require(msg.sender == from, Error.INVALID_SENDER);
        require(msg.value == amount, Error.INVALID_AMOUNT);
    }

    function _doTransferOut(address payable to, uint256 amount) internal override {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = to.call{value: amount}("");
        require(success, Error.FAILED_TRANSFER);
    }

    function _getBalanceUnderlying() internal view override returns (uint256) {
        return _getBalanceUnderlying(false);
    }

    function _getBalanceUnderlying(bool transferInDone) internal view override returns (uint256) {
        uint256 balance = address(this).balance;
        if (!transferInDone) {
            balance -= msg.value;
        }
        return balance;
    }
}
