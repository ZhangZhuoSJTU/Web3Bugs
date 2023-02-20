// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;


contract Scratchpad {

    int56[][] public observations;

    constructor( int56[][] memory _observations ) {

        uint len = _observations.length;
        for (uint i = 0; i < len; i++) observations.push(_observations[i]);

        // immutables
    }

    function include_observations ( int56[][] calldata _observations ) external {

        uint len = _observations.length;
        for (uint i = 0; i < len; i++) observations.push(_observations[i]);

    }

}
