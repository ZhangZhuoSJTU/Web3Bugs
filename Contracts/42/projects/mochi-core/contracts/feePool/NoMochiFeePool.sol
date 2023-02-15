// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "../interfaces/IFeePool.sol";
import "../interfaces/IMochiEngine.sol";

contract NoMochiFeePool is IFeePool {
    IMochiEngine public immutable engine;
    address public withdrawer;

    constructor(address _withdrawer, address _engine) {
        engine = IMochiEngine(_engine);
        withdrawer = _withdrawer;
    }

    function updateReserve() external override {
        // no-op
    }

    function withdraw() external {
        engine.usdm().transfer(
            withdrawer,
            engine.usdm().balanceOf(address(this))
        );
    }

    function changeWithdrawer(address _withdrawer) external {
        require(msg.sender == engine.governance(), "!gov");
        withdrawer = _withdrawer;
    }
}
