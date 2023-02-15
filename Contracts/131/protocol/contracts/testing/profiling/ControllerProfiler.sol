// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../Controller.sol";

contract ControllerProfiler {
    Controller public immutable controller;

    constructor(address _controller) {
        controller = Controller(_controller);
    }

    function profileIsAction() external {
        IAddressProvider addressProvider = controller.addressProvider();
        addressProvider.isAction(address(this));
        addressProvider.addAction(address(this));
        addressProvider.isAction(address(this));
        addressProvider.isAction(address(controller));
        addressProvider.addAction(address(this));
        addressProvider.isAction(address(this));
        addressProvider.isAction(address(controller));
    }

    function profilePoolAddingAndLpTokenGet(address pool, address token) external {
        IAddressProvider addressProvider = controller.addressProvider();
        addressProvider.addPool(pool);
        addressProvider.getPoolForToken(token);
        controller.removePool(pool);
    }
}
