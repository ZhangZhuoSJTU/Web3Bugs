// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

contract AlwaysAccess {
    mapping(address => bool) private authorized;

    constructor(bool _authorized)
    public
    {
        authorized[msg.sender] = _authorized;
    }

    function setAuthorized(address _address, bool _authorized) external {
        authorized[_address] = _authorized;
    }

    function allowedVaults(address _address) external view returns (bool) {
        return authorized[_address];
    }

    function allowedControllers(address _address) external view returns (bool) {
        return authorized[_address];
    }

    function allowedStrategies(address _address) external view returns (bool) {
        return authorized[_address];
    }
}
