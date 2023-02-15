// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

import {PausableUpgradeable} from "openzeppelin-contracts-upgradeable/security/PausableUpgradeable.sol";
import "../interfaces/citadel/IGac.sol";

/**
 * @title Global Access Control Managed - Base Class
 * @notice allows inheriting contracts to leverage global access control permissions conveniently, as well as granting contract-specific pausing functionality
 */
contract GlobalAccessControlManaged is PausableUpgradeable {
    IGac public gac;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");

    /// =======================
    /// ===== Initializer =====
    /// =======================

    /**
     * @notice Initializer
     * @dev this is assumed to be used in the initializer of the inhereiting contract
     * @param _globalAccessControl global access control which is pinged to allow / deny access to permissioned calls by role
     */
    function __GlobalAccessControlManaged_init(address _globalAccessControl)
        public
        onlyInitializing
    {
        __Pausable_init_unchained();
        gac = IGac(_globalAccessControl);
    }

    /// =====================
    /// ===== Modifiers =====
    /// =====================

    // @dev only holders of the given role on the GAC can call
    modifier onlyRole(bytes32 role) {
        require(gac.hasRole(role, msg.sender), "GAC: invalid-caller-role");
        _;
    }

    // @dev only holders of any of the given set of roles on the GAC can call
    modifier onlyRoles(bytes32[] memory roles) {
        bool validRoleFound = false;
        for (uint256 i = 0; i < roles.length; i++) {
            bytes32 role = roles[i];
            if (gac.hasRole(role, msg.sender)) {
                validRoleFound = true;
                break;
            }
        }
        require(validRoleFound, "GAC: invalid-caller-role");
        _;
    }

    // @dev only holders of the given role on the GAC can call, or a specified address
    // @dev used to faciliate extra contract-specific permissioned accounts
    modifier onlyRoleOrAddress(bytes32 role, address account) {
        require(
            gac.hasRole(role, msg.sender) || msg.sender == account,
            "GAC: invalid-caller-role-or-address"
        );
        _;
    }

    /// @dev can be pausable by GAC or local flag
    modifier gacPausable() {
        require(!gac.paused(), "global-paused");
        require(!paused(), "local-paused");
        _;
    }

    /// ================================
    /// ===== Permissioned actions =====
    /// ================================

    function pause() external {
        require(gac.hasRole(PAUSER_ROLE, msg.sender));
        _pause();
    }

    function unpause() external {
        require(gac.hasRole(UNPAUSER_ROLE, msg.sender));
        _unpause();
    }
}
