// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./MockAddTokenPower.sol";

contract MockAngband {

    function executePower(address invoker) public {
        MockAddTokenPower(invoker).invoke();
    }
}