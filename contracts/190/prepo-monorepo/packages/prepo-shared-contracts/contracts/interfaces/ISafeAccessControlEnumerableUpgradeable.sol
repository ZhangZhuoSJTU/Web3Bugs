// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "@openzeppelin/contracts-upgradeable/access/IAccessControlEnumerableUpgradeable.sol";

/**
 * @notice An extension of OpenZeppelin's
 * `AccessControlEnumerableUpgradeable.sol` contract that requires an
 * address/role to initially be nominated, and then accepted, before the role
 * or admin role is granted.
 * @dev Inheriting contract must call `__SafeAccessControlEnumerable_init()`
 * within their own externally exposed `initializer`.
 */
interface ISafeAccessControlEnumerableUpgradeable is IAccessControlEnumerableUpgradeable {
  /**
   * @dev Emitted via `setRoleAdminNominee()` and `acceptRoleAdmin()`.
   * @param role The role an admin was nominated for
   * @param newRoleAdminNominee The role nominated as the new admin
   */
  event RoleAdminNomineeUpdate(bytes32 role, bytes32 newRoleAdminNominee);

  /**
   * @dev Emitted via `grantRole`, `acceptRole`, and `revokeNomination`.
   * @param role The role that an address's nomination status was changed for
   * @param account The nominee whose nomination status was changed
   * @param nominated Whether the address was nominated
   */
  event RoleNomineeUpdate(bytes32 role, address account, bool nominated);

  /**
   * @notice Nominates a role to be a role admin.
   * @dev Only callable by a member of the role's current role admin.
   * @param role The role a role admin is to be nominated for
   * @param adminRoleNominee The role admin to be nominated
   */
  function setRoleAdminNominee(bytes32 role, bytes32 adminRoleNominee) external;

  /**
   * @notice Accepts a role admin nomination.
   * @dev Only callable by a member of the role admin nominee.
   * @param role The role a role admin nomination is to be accepted for
   */
  function acceptRoleAdmin(bytes32 role) external;

  /**
   * @notice Accepts a role nomination.
   * @dev Only callable by the role nominee.
   * @param role The role of the nomination to be accepted
   */
  function acceptRole(bytes32 role) external;

  /**
   * @notice Revokes a role nomination.
   * @dev Only callable by a member of the role's current role admin.
   * @param role The role of the nomination to be revoked
   * @param account The address of the nomination to be revoked
   */
  function revokeNomination(bytes32 role, address account) external;

  /**
   * @param role The role to retrieve a role admin nominee for
   * @return The current role admin nominee of `role`
   */
  function getRoleAdminNominee(bytes32 role) external view returns (bytes32);

  /**
   * @param role The role to retrieve nomination status for
   * @param account The address to retrieve nomination status for
   * @return Whether `account` is nominated for `role`
   */
  function isNominated(bytes32 role, address account) external view returns (bool);
}
