// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

contract MockVerification {
    mapping(address => mapping(address => bool)) public isUser;

    function addUser(address _user, address _verifier) external {
        isUser[_user][_verifier] = true;
    }

    function removeUser(address _user, address _verifier) external {
        delete isUser[_user][_verifier];
    }
}
