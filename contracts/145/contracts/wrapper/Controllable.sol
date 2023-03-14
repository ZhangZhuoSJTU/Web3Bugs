//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Controllable is Ownable {
    mapping(address=>bool) public controllers;

    event ControllerChanged(address indexed controller, bool active);

    function setController(address controller, bool active) onlyOwner() public {
        controllers[controller] = active;
        emit ControllerChanged(controller, active);
    }

    modifier onlyController() {
        require(controllers[msg.sender], "Controllable: Caller is not a controller");
        _;
    }
}
