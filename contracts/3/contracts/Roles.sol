// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Manage permissions of contracts
contract Roles is Ownable {
    mapping(address => mapping(uint256 => bool)) public roles;
    mapping(uint256 => address) public mainCharacters;

    constructor() Ownable() {
        // token activation from the get-go
        roles[msg.sender][9] = true;
    }

    function giveRole(uint256 role, address actor) external onlyOwner {
        roles[actor][role] = true;
    }

    function removeRole(uint256 role, address actor) external onlyOwner {
        roles[actor][role] = false;
    }

    function setMainCharacter(uint256 role, address actor) external onlyOwner {
        mainCharacters[role] = actor;
    }

    function getRole(uint256 role, address contr) external view returns (bool) {
        return roles[contr][role];
    }
}
