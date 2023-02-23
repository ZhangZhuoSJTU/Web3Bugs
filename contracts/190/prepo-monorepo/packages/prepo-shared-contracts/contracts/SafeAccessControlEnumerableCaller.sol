// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/ISafeAccessControlEnumerable.sol";
import "./interfaces/ISafeAccessControlEnumerableCaller.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

abstract contract SafeAccessControlEnumerableCaller is ISafeAccessControlEnumerableCaller {
  function setRoleAdminNominee(
    address _safeAccessControlContract,
    bytes32 _role,
    bytes32 _adminRoleNominee
  ) public virtual override;

  function acceptRoleAdmin(address _safeAccessControlContract, bytes32 _role) public virtual override;

  function grantRole(
    address _safeAccessControlContract,
    bytes32 _role,
    address _account
  ) public virtual override;

  function acceptRole(address _safeAccessControlContract, bytes32 _role) public virtual override;

  function renounceRole(
    address _safeAccessControlContract,
    bytes32 _role,
    address _account
  ) public virtual override;

  function revokeRole(
    address _safeAccessControlContract,
    bytes32 _role,
    address _account
  ) public virtual override;

  function revokeNomination(
    address _safeAccessControlContract,
    bytes32 _role,
    address _account
  ) public virtual override;
}
