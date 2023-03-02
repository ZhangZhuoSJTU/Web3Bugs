//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/TimelockController.sol";

contract Timelock is TimelockController {
    constructor(address[] memory _proposers, address[] memory _executors, uint256 _time) TimelockController(_time, _proposers, _executors, address(0)) {}
}
