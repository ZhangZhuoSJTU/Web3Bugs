// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "./IPermissions.sol";

/// @title Access control module for Core
/// @author Fei Protocol
contract Permissions is IPermissions, AccessControlEnumerable {
    bytes32 public constant override BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant override MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant override PCV_CONTROLLER_ROLE =
        keccak256("PCV_CONTROLLER_ROLE");
    bytes32 public constant override GOVERN_ROLE = keccak256("GOVERN_ROLE");
    bytes32 public constant override GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    constructor() {
        // Appointed as a governor so guardian can have indirect access to revoke ability
        _setupGovernor(address(this));

        _setRoleAdmin(MINTER_ROLE, GOVERN_ROLE);
        _setRoleAdmin(BURNER_ROLE, GOVERN_ROLE);
        _setRoleAdmin(PCV_CONTROLLER_ROLE, GOVERN_ROLE);
        _setRoleAdmin(GOVERN_ROLE, GOVERN_ROLE);
        _setRoleAdmin(GUARDIAN_ROLE, GOVERN_ROLE);
    }

    modifier onlyGovernor() {
        require(
            isGovernor(msg.sender),
            "Permissions: Caller is not a governor"
        );
        _;
    }

    modifier onlyGuardian() {
        require(
            isGuardian(msg.sender),
            "Permissions: Caller is not a guardian"
        );
        _;
    }

    /// @notice creates a new role to be maintained
    /// @param role the new role id
    /// @param adminRole the admin role id for `role`
    /// @dev can also be used to update admin of existing role
    function createRole(bytes32 role, bytes32 adminRole)
        external
        override
        onlyGovernor
    {
        _setRoleAdmin(role, adminRole);
    }

    /// @notice grants minter role to address
    /// @param minter new minter
    function grantMinter(address minter) external override onlyGovernor {
        grantRole(MINTER_ROLE, minter);
    }

    /// @notice grants burner role to address
    /// @param burner new burner
    function grantBurner(address burner) external override onlyGovernor {
        grantRole(BURNER_ROLE, burner);
    }

    /// @notice grants controller role to address
    /// @param pcvController new controller
    function grantPCVController(address pcvController)
        external
        override
        onlyGovernor
    {
        grantRole(PCV_CONTROLLER_ROLE, pcvController);
    }

    /// @notice grants governor role to address
    /// @param governor new governor
    function grantGovernor(address governor) external override onlyGovernor {
        grantRole(GOVERN_ROLE, governor);
    }

    /// @notice grants guardian role to address
    /// @param guardian new guardian
    function grantGuardian(address guardian) external override onlyGovernor {
        grantRole(GUARDIAN_ROLE, guardian);
    }

    /// @notice revokes minter role from address
    /// @param minter ex minter
    function revokeMinter(address minter) external override onlyGovernor {
        revokeRole(MINTER_ROLE, minter);
    }

    /// @notice revokes burner role from address
    /// @param burner ex burner
    function revokeBurner(address burner) external override onlyGovernor {
        revokeRole(BURNER_ROLE, burner);
    }

    /// @notice revokes pcvController role from address
    /// @param pcvController ex pcvController
    function revokePCVController(address pcvController)
        external
        override
        onlyGovernor
    {
        revokeRole(PCV_CONTROLLER_ROLE, pcvController);
    }

    /// @notice revokes governor role from address
    /// @param governor ex governor
    function revokeGovernor(address governor) external override onlyGovernor {
        revokeRole(GOVERN_ROLE, governor);
    }

    /// @notice revokes guardian role from address
    /// @param guardian ex guardian
    function revokeGuardian(address guardian) external override onlyGovernor {
        revokeRole(GUARDIAN_ROLE, guardian);
    }

    /// @notice revokes a role from address
    /// @param role the role to revoke
    /// @param account the address to revoke the role from
    function revokeOverride(bytes32 role, address account)
        external
        override
        onlyGuardian
    {
        require(
            role != GOVERN_ROLE,
            "Permissions: Guardian cannot revoke governor"
        );

        // External call because this contract is appointed as a governor and has access to revoke
        this.revokeRole(role, account);
    }

    /// @notice checks if address is a minter
    /// @param _address address to check
    /// @return true _address is a minter
    // only virtual for testing mock override
    function isMinter(address _address)
        external
        view
        virtual
        override
        returns (bool)
    {
        return hasRole(MINTER_ROLE, _address);
    }

    /// @notice checks if address is a burner
    /// @param _address address to check
    /// @return true _address is a burner
    // only virtual for testing mock override
    function isBurner(address _address)
        external
        view
        virtual
        override
        returns (bool)
    {
        return hasRole(BURNER_ROLE, _address);
    }

    /// @notice checks if address is a controller
    /// @param _address address to check
    /// @return true _address is a controller
    // only virtual for testing mock override
    function isPCVController(address _address)
        external
        view
        virtual
        override
        returns (bool)
    {
        return hasRole(PCV_CONTROLLER_ROLE, _address);
    }

    /// @notice checks if address is a governor
    /// @param _address address to check
    /// @return true _address is a governor
    // only virtual for testing mock override
    function isGovernor(address _address)
        public
        view
        virtual
        override
        returns (bool)
    {
        return hasRole(GOVERN_ROLE, _address);
    }

    /// @notice checks if address is a guardian
    /// @param _address address to check
    /// @return true _address is a guardian
    // only virtual for testing mock override
    function isGuardian(address _address)
        public
        view
        virtual
        override
        returns (bool)
    {
        return hasRole(GUARDIAN_ROLE, _address);
    }

    function _setupGovernor(address governor) internal {
        _setupRole(GOVERN_ROLE, governor);
    }
}
