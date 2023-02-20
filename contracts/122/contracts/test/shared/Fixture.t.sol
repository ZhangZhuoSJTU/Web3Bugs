// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

import "../mocks/MockWeth.sol";
import "../mocks/MockERC721.sol";
import "../mocks/MockERC20.sol";

import "src/Cally.sol";

abstract contract Fixture is Test {
    Cally internal c;
    MockERC721 internal bayc;
    MockERC20 internal link;
    MockWeth internal weth;

    address internal babe;
    address internal bob;
    string internal checkpointLabel;
    uint256 internal checkpointGasLeft;

    constructor() {
        bayc = new MockERC721("Mock Bored Ape Yacht Club", "MBAYC");
        link = new MockERC20("Mock Chainlink", "LINK", 18);
        weth = new MockWeth();

        c = new Cally();

        babe = address(0xbabe);
        vm.label(babe, "Babe");

        bob = address(0xb0b);
        vm.label(bob, "Bob");

        // make sure timestamp is not 0
        vm.warp(0xffff);
    }

    function startMeasuringGas(string memory label) internal virtual {
        checkpointLabel = label;
        checkpointGasLeft = gasleft();
    }

    function stopMeasuringGas() internal virtual {
        uint256 checkpointGasLeft2 = gasleft();

        // Subtract 100 to account for the warm SLOAD in startMeasuringGas.
        uint256 gasDelta = checkpointGasLeft - checkpointGasLeft2 - 20_000;

        console.log(string(abi.encodePacked(checkpointLabel, " Gas")), gasDelta);
    }
}
