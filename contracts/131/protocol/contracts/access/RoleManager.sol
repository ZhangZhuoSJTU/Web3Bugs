// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../interfaces/IAddressProvider.sol";
import "../../interfaces/IRoleManager.sol";

import "../../libraries/Roles.sol";
import "../../libraries/Errors.sol";
import "../../libraries/AddressProviderKeys.sol";
import "../../libraries/UncheckedMath.sol";

contract RoleManager is IRoleManager {
    using UncheckedMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    struct RoleData {
        mapping(address => bool) members;
        bytes32 adminRole;
    }
    mapping(bytes32 => RoleData) private _roles;
    mapping(bytes32 => EnumerableSet.AddressSet) private _roleMembers;

    IAddressProvider public immutable addressProvider;

    modifier onlyGovernance() {
        require(hasRole(Roles.GOVERNANCE, msg.sender), Error.UNAUTHORIZED_ACCESS);
        _;
    }

    constructor(IAddressProvider _addressProvider) {
        addressProvider = _addressProvider;
        _grantRole(Roles.GOVERNANCE, msg.sender);
    }

    function grantRole(bytes32 role, address account) external override onlyGovernance {
        _grantRole(role, account);
    }

    function addGovernor(address newGovernor) external override onlyGovernance {
        _grantRole(Roles.GOVERNANCE, newGovernor);
    }

    function renounceGovernance() external override onlyGovernance {
        require(getRoleMemberCount(Roles.GOVERNANCE) > 1, Error.CANNOT_REVOKE_ROLE);
        _revokeRole(Roles.GOVERNANCE, msg.sender);
    }

    function addGaugeZap(address zap) external override onlyGovernance {
        _grantRole(Roles.GAUGE_ZAP, zap);
    }

    function removeGaugeZap(address zap) external override onlyGovernance {
        revokeRole(Roles.GAUGE_ZAP, zap);
    }

    function hasAnyRole(
        bytes32 role1,
        bytes32 role2,
        address account
    ) external view returns (bool) {
        return hasRole(role1, account) || hasRole(role2, account);
    }

    function hasAnyRole(
        bytes32 role1,
        bytes32 role2,
        bytes32 role3,
        address account
    ) external view returns (bool) {
        return hasRole(role1, account) || hasRole(role2, account) || hasRole(role3, account);
    }

    function hasAnyRole(bytes32[] calldata roles, address account)
        external
        view
        virtual
        override
        returns (bool)
    {
        for (uint256 i; i < roles.length; i = i.uncheckedInc()) {
            if (hasRole(roles[i], account)) {
                return true;
            }
        }
        return false;
    }

    function getRoleMember(bytes32 role, uint256 index)
        external
        view
        virtual
        override
        returns (address)
    {
        if (role == Roles.ADDRESS_PROVIDER && index == 0) {
            return address(addressProvider);
        } else if (role == Roles.POOL_FACTORY && index == 0) {
            return addressProvider.getAddress(AddressProviderKeys._POOL_FACTORY_KEY);
        } else if (role == Roles.CONTROLLER && index == 0) {
            return addressProvider.getAddress(AddressProviderKeys._CONTROLLER_KEY);
        } else if (role == Roles.POOL) {
            return addressProvider.getPoolAtIndex(index);
        } else if (role == Roles.VAULT) {
            return addressProvider.getVaultAtIndex(index);
        }
        return _roleMembers[role].at(index);
    }

    function revokeRole(bytes32 role, address account) public onlyGovernance {
        require(role != Roles.GOVERNANCE, Error.CANNOT_REVOKE_ROLE);
        require(hasRole(role, account), Error.INVALID_ARGUMENT);
        _revokeRole(role, account);
    }

    function getRoleMemberCount(bytes32 role) public view virtual override returns (uint256) {
        if (
            role == Roles.ADDRESS_PROVIDER || role == Roles.POOL_FACTORY || role == Roles.CONTROLLER
        ) {
            return 1;
        }
        if (role == Roles.POOL) {
            return addressProvider.poolsCount();
        }
        if (role == Roles.VAULT) {
            return addressProvider.vaultsCount();
        }
        return _roleMembers[role].length();
    }

    function hasRole(bytes32 role, address account) public view virtual override returns (bool) {
        if (role == Roles.ADDRESS_PROVIDER) {
            return account == address(addressProvider);
        } else if (role == Roles.POOL_FACTORY) {
            return
                account == addressProvider.getAddress(AddressProviderKeys._POOL_FACTORY_KEY, false);
        } else if (role == Roles.CONTROLLER) {
            return
                account == addressProvider.getAddress(AddressProviderKeys._CONTROLLER_KEY, false);
        } else if (role == Roles.MAINTENANCE) {
            return _roles[role].members[account] || _roles[Roles.GOVERNANCE].members[account];
        } else if (role == Roles.POOL) {
            return addressProvider.isPool(account);
        } else if (role == Roles.VAULT) {
            return addressProvider.isVault(account);
        }
        return _roles[role].members[account];
    }

    function _grantRole(bytes32 role, address account) internal {
        _roles[role].members[account] = true;
        _roleMembers[role].add(account);
        emit RoleGranted(role, account, msg.sender);
    }

    function _revokeRole(bytes32 role, address account) internal {
        _roles[role].members[account] = false;
        _roleMembers[role].remove(account);
        emit RoleRevoked(role, account, msg.sender);
    }
}
