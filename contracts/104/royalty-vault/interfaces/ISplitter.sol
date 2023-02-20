// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface ISplitter {
    function incrementWindow(uint256 royaltyAmount) external returns (bool);
}
