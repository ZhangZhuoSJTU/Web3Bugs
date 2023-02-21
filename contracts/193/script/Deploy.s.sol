// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/Caviar.sol";

contract DeployScript is Script {
    using stdJson for string;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        Caviar c = new Caviar();

        console.log("caviar:", address(c));
    }
}
