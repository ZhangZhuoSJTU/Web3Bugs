// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import {GovernableProxy} from "./proxy/GovernableProxy.sol";

contract AccessControlDefendedBase {
    mapping (address => bool) public approved;
    mapping(address => uint256) public blockLock;

    modifier defend() {
        require(msg.sender == tx.origin || approved[msg.sender], "ACCESS_DENIED");
        _;
    }

    modifier blockLocked() {
        require(approved[msg.sender] || blockLock[msg.sender] < block.number, "BLOCK_LOCKED");
        _;
    }

    function _lockForBlock(address account) internal {
        blockLock[account] = block.number;
    }

    function _approveContractAccess(address account) internal {
        approved[account] = true;
    }

    function _revokeContractAccess(address account) internal {
        approved[account] = false;
    }
}

contract AccessControlDefended is GovernableProxy, AccessControlDefendedBase {
    uint256[50] private __gap;

    function approveContractAccess(address account) external onlyGovernance {
        _approveContractAccess(account);
    }

    function revokeContractAccess(address account) external onlyGovernance {
        _revokeContractAccess(account);
    }
}
