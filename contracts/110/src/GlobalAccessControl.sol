// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {IERC20Upgradeable} from "openzeppelin-contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol"; 
import {SafeERC20Upgradeable} from "openzeppelin-contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {PausableUpgradeable} from "openzeppelin-contracts-upgradeable/security/PausableUpgradeable.sol";
import {AccessControlEnumerableUpgradeable} from "openzeppelin-contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {EnumerableSetUpgradeable} from "openzeppelin-contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

/**
 * @title Badger Geyser
 @dev Tracks stakes and pledged tokens to be distributed, for use with 
 @dev BadgerTree merkle distribution system. An arbitrary number of tokens to 
 distribute can be specified.
 */

contract GlobalAccessControl is
    AccessControlEnumerableUpgradeable,
    PausableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    bytes32 public constant CONTRACT_GOVERNANCE_ROLE =
        keccak256("CONTRACT_GOVERNANCE_ROLE");
    bytes32 public constant TREASURY_GOVERNANCE_ROLE =
        keccak256("TREASURY_GOVERNANCE_ROLE");

    bytes32 public constant TECH_OPERATIONS_ROLE =
        keccak256("TECH_OPERATIONS_ROLE");
    bytes32 public constant POLICY_OPERATIONS_ROLE =
        keccak256("POLICY_OPERATIONS_ROLE");
    bytes32 public constant TREASURY_OPERATIONS_ROLE =
        keccak256("TREASURY_OPERATIONS_ROLE");

    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UNPAUSER_ROLE = keccak256("UNPAUSER_ROLE");

    bytes32 public constant BLOCKLIST_MANAGER_ROLE =
        keccak256("BLOCKLIST_MANAGER_ROLE");
    bytes32 public constant BLOCKLISTED_ROLE = keccak256("BLOCKLISTED_ROLE");

    bytes32 public constant CITADEL_MINTER_ROLE =
        keccak256("CITADEL_MINTER_ROLE");

    // Should the function transferFrom be disabled
    // NOTE: This is enforced at the contract level, the contract just allows the toggling of the bool
    bool public transferFromDisabled; // Set to true in initialize

    /// =======================
    /// ===== Initializer =====
    /// =======================

    /**
     * @notice Initializer
     * @param _initialContractGovernance Global access control
     */
    function initialize(address _initialContractGovernance)
        external
        initializer
    {
        __AccessControlEnumerable_init();
        __Pausable_init();

        // Set this for assumptions and clarity
        _setupRole(DEFAULT_ADMIN_ROLE, _initialContractGovernance);
        
        _setupRole(CONTRACT_GOVERNANCE_ROLE, _initialContractGovernance);

        // All roles are managed by CONTRACT_GOVERNANCE_ROLE
        _setRoleAdmin(CONTRACT_GOVERNANCE_ROLE, CONTRACT_GOVERNANCE_ROLE);
        _setRoleAdmin(POLICY_OPERATIONS_ROLE, CONTRACT_GOVERNANCE_ROLE);
        _setRoleAdmin(TREASURY_GOVERNANCE_ROLE, CONTRACT_GOVERNANCE_ROLE);
        _setRoleAdmin(PAUSER_ROLE, CONTRACT_GOVERNANCE_ROLE);
        _setRoleAdmin(UNPAUSER_ROLE, CONTRACT_GOVERNANCE_ROLE);
        _setRoleAdmin(BLOCKLIST_MANAGER_ROLE, CONTRACT_GOVERNANCE_ROLE);
        _setRoleAdmin(CITADEL_MINTER_ROLE, CONTRACT_GOVERNANCE_ROLE);
        _setRoleAdmin(KEEPER_ROLE, CONTRACT_GOVERNANCE_ROLE);

        // Add default admin role here to avoid governance mistakes
        _setRoleAdmin(DEFAULT_ADMIN_ROLE, CONTRACT_GOVERNANCE_ROLE);

        // BLOCKLIST is managed by BLOCKLIST_MANAGER
        _setRoleAdmin(BLOCKLISTED_ROLE, BLOCKLIST_MANAGER_ROLE);
    }

    /// ================================================
    /// ===== Permissioned Actions (various roles) =====
    /// ================================================

    function pause() external {
        require(hasRole(PAUSER_ROLE, msg.sender), "PAUSER_ROLE");
        _pause();
    }

    function unpause() external {
        require(hasRole(UNPAUSER_ROLE, msg.sender), "UNPAUSER_ROLE");
        _unpause();
    }

    /// @dev setup a new role via contract governance, without upgrade
    /// @dev note that no constant will be available on the contract here to search role, but we can delegate viewing to another contract
    /// TODO: Add string -> hash EnumerableSet to a new RoleRegistry contract for easy on-chain viewing.
    function initializeNewRole(
        bytes32 role,
        string memory roleString,
        bytes32 adminRole
    ) external {
        require(
            hasRole(CONTRACT_GOVERNANCE_ROLE, msg.sender),
            "CONTRACT_GOVERNANCE_ROLE"
        );
        require(
            keccak256(bytes(roleString)) == role,
            "Role string and role do not match"
        );
        _setRoleAdmin(role, adminRole);
    }
}
