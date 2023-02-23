// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

/**
 * @notice This contract enables inheriting contracts to grant, accept,
 * renounce and revoke access to role or admin role of any
 * SafeAccessControlEnumerable contract.
 * @dev All non-view methods must be overridden in the inheriting contract
 * with suitable access controls to prevent anyone from calling them.
 */
interface ISafeAccessControlEnumerableCaller {
  /**
   * @notice Nominates a role to be a role admin of a
   * SafeAccessControlEnumerable contract.
   * @dev Only callable by a member of the role's current role admin.
   * @param safeAccessControlContract Address of the contract to be called
   * @param role The role a role admin is to be nominated for
   * @param adminRoleNominee The role admin to be nominated
   */
  function setRoleAdminNominee(
    address safeAccessControlContract,
    bytes32 role,
    bytes32 adminRoleNominee
  ) external;

  /**
   * @notice Accepts a role admin nomination for a SafeAccessControlEnumerable
   * contract.
   * @dev Only callable by a member of the role admin nominee.
   * @param safeAccessControlContract Address of the contract to be called
   * @param role The role for which role admin nomination is to be accepted
   */
  function acceptRoleAdmin(address safeAccessControlContract, bytes32 role) external;

  /**
   * @notice Nominates an address to be a member of a role for a
   * SafeAccessControlEnumerable contract.
   * @dev Only callable by a member of the role's current role admin.
   * @param safeAccessControlContract Address of the contract to be called
   * @param role The role for which an account is to be nominated
   * @param account Address of the account to be nominated
   */
  function grantRole(
    address safeAccessControlContract,
    bytes32 role,
    address account
  ) external;

  /**
   * @notice Accepts a role nomination for a SafeAccessControlEnumerable
   * contract.
   * @dev Only callable by the role nominee.
   * @param safeAccessControlContract Address of the contract to be called
   * @param role The role of the nomination to be accepted
   */
  function acceptRole(address safeAccessControlContract, bytes32 role) external;

  /**
   * @notice Allows `account` to renounce their current role for a given
   * SafeAccessControlEnumerable contract.
   * @param safeAccessControlContract Address of the contract to be called
   * @param role The role for which access is to be renounced
   * @param account Address that is renouncing their role
   */
  function renounceRole(
    address safeAccessControlContract,
    bytes32 role,
    address account
  ) external;

  /**
   * @notice Revokes access of an account to a role of a
   * SafeAccessControlEnumerable contract.
   * @dev Only callable by a member of the role's current role admin.
   * @param safeAccessControlContract Address of the contract to be called
   * @param role The role for which an account's access is to be revoked
   * @param account Address for which membership is to be revoked
   */
  function revokeRole(
    address safeAccessControlContract,
    bytes32 role,
    address account
  ) external;

  /**
   * @notice Revokes role nomination for a SafeAccessControlEnumerable
   * contract.
   * @dev Only callable by a member of the role's current role admin.
   * @param safeAccessControlContract Address of the contract to be called
   * @param role The role of the nomination to be revoked
   * @param account Address for which nomination is to be revoked
   */
  function revokeNomination(
    address safeAccessControlContract,
    bytes32 role,
    address account
  ) external;
}
