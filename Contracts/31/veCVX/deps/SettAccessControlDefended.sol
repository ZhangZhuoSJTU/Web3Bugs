// SPDX-License-Identifier: MIT
pragma solidity ^0.6.11;

import "./SettAccessControl.sol";

/*
    Add ability to prevent unwanted contract access to Sett permissions
*/
contract SettAccessControlDefended is SettAccessControl {
    mapping(address => bool) public approved;

    function approveContractAccess(address account) external {
        _onlyGovernance();
        approved[account] = true;
    }

    function revokeContractAccess(address account) external {
        _onlyGovernance();
        approved[account] = false;
    }

    function _defend() internal view returns (bool) {
        require(
            approved[msg.sender] || msg.sender == tx.origin,
            "Access denied for caller"
        );
    }

    uint256[50] private __gap;
}
