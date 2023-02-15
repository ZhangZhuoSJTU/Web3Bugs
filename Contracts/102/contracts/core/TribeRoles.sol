// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

/**
 @title Tribe DAO ACL Roles
 @notice Holds a complete list of all roles which can be held by contracts inside Tribe DAO.
         Roles are broken up into 3 categories:
         * Major Roles - the most powerful roles in the Tribe DAO which should be carefully managed.
         * Admin Roles - roles with management capability over critical functionality. Should only be held by automated or optimistic mechanisms
         * Minor Roles - operational roles. May be held or managed by shorter optimistic timelocks or trusted multisigs.
 */
library TribeRoles {
    /*///////////////////////////////////////////////////////////////
                                 Major Roles
    //////////////////////////////////////////////////////////////*/

    /// @notice the ultimate role of Tribe. Controls all other roles and protocol functionality.
    bytes32 internal constant GOVERNOR = keccak256("GOVERN_ROLE");

    /// @notice the protector role of Tribe. Admin of pause, veto, revoke, and minor roles
    bytes32 internal constant GUARDIAN = keccak256("GUARDIAN_ROLE");

    /// @notice the role which can arbitrarily move PCV in any size from any contract
    bytes32 internal constant PCV_CONTROLLER = keccak256("PCV_CONTROLLER_ROLE");

    /// @notice can mint FEI arbitrarily
    bytes32 internal constant MINTER = keccak256("MINTER_ROLE");

    /*///////////////////////////////////////////////////////////////
                                 Admin Roles
    //////////////////////////////////////////////////////////////*/

    /// @notice can manage the majority of Tribe protocol parameters. Sets boundaries for MINOR_PARAM_ROLE.
    bytes32 internal constant PARAMETER_ADMIN = keccak256("PARAMETER_ADMIN");

    /// @notice manages the Collateralization Oracle as well as other protocol oracles.
    bytes32 internal constant ORACLE_ADMIN = keccak256("ORACLE_ADMIN_ROLE");

    /// @notice manages TribalChief incentives and related functionality.
    bytes32 internal constant TRIBAL_CHIEF_ADMIN =
        keccak256("TRIBAL_CHIEF_ADMIN_ROLE");

    /// @notice admin of PCVGuardian
    bytes32 internal constant PCV_GUARDIAN_ADMIN =
        keccak256("PCV_GUARDIAN_ADMIN_ROLE");

    /// @notice admin of all Minor Roles
    bytes32 internal constant MINOR_ROLE_ADMIN = keccak256("MINOR_ROLE_ADMIN");

    /// @notice admin of the Fuse protocol
    bytes32 internal constant FUSE_ADMIN = keccak256("FUSE_ADMIN");

    /// @notice capable of vetoing DAO votes or optimistic timelocks
    bytes32 internal constant VETO_ADMIN = keccak256("VETO_ADMIN");

    /// @notice capable of setting FEI Minters within global rate limits and caps
    bytes32 internal constant MINTER_ADMIN = keccak256("MINTER_ADMIN");

    /// @notice manages the constituents of Optimistic Timelocks, including Proposers and Executors
    bytes32 internal constant OPTIMISTIC_ADMIN = keccak256("OPTIMISTIC_ADMIN");

    /*///////////////////////////////////////////////////////////////
                                 Minor Roles
    //////////////////////////////////////////////////////////////*/

    /// @notice capable of poking existing LBP auctions to exchange tokens.
    bytes32 internal constant LBP_SWAP_ROLE = keccak256("SWAP_ADMIN_ROLE");

    /// @notice capable of engaging with Votium for voting incentives.
    bytes32 internal constant VOTIUM_ROLE = keccak256("VOTIUM_ADMIN_ROLE");

    /// @notice capable of changing parameters within non-critical ranges
    bytes32 internal constant MINOR_PARAM_ROLE = keccak256("MINOR_PARAM_ROLE");

    /// @notice capable of adding an address to multi rate limited
    bytes32 internal constant ADD_MINTER_ROLE = keccak256("ADD_MINTER_ROLE");

    /// @notice capable of changing PCV Deposit and Global Rate Limited Minter in the PSM
    bytes32 internal constant PSM_ADMIN_ROLE = keccak256("PSM_ADMIN_ROLE");
}
