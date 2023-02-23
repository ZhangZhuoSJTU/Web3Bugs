// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "./interfaces/ISafeAccessControlEnumerableUpgradeable.sol";

abstract contract SafeAccessControlEnumerableUpgradeable is ISafeAccessControlEnumerableUpgradeable, AccessControlEnumerableUpgradeable {
  mapping(bytes32 => bytes32) private _roleToRoleAdminNominee;
  mapping(bytes32 => mapping(address => bool)) private _roleToAccountToNominated;

  function __SafeAccessControlEnumerable_init() internal onlyInitializing {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
  }

  function setRoleAdminNominee(bytes32 _role, bytes32 _roleAdminNominee) public virtual override onlyRole(getRoleAdmin(_role)) {
    _setRoleAdminNominee(_role, _roleAdminNominee);
  }

  function acceptRoleAdmin(bytes32 _role) public virtual override onlyRole(_roleToRoleAdminNominee[_role]) {
    _setRoleAdmin(_role, _roleToRoleAdminNominee[_role]);
    _setRoleAdminNominee(_role, 0x00);
  }

  function grantRole(bytes32 _role, address _account) public virtual override onlyRole(getRoleAdmin(_role)) {
    _setRoleNominee(_role, _account, true);
  }

  function acceptRole(bytes32 _role) public virtual override {
    require(_roleToAccountToNominated[_role][_msgSender()], "msg.sender != role nominee");
    _setRoleNominee(_role, _msgSender(), false);
    _grantRole(_role, _msgSender());
  }

  function revokeNomination(bytes32 _role, address _account) public virtual override onlyRole(getRoleAdmin(_role)) {
    _setRoleNominee(_role, _account, false);
  }

  function getRoleAdminNominee(bytes32 _role) public view virtual override returns (bytes32) {
    return _roleToRoleAdminNominee[_role];
  }

  function isNominated(bytes32 _role, address _account) public view virtual override returns (bool) {
    return _roleToAccountToNominated[_role][_account];
  }

  function _setRoleAdminNominee(bytes32 _role, bytes32 _newRoleAdminNominee) internal virtual {
    emit RoleAdminNomineeUpdate(_roleToRoleAdminNominee[_role], _newRoleAdminNominee);
    _roleToRoleAdminNominee[_role] = _newRoleAdminNominee;
  }

  function _setRoleNominee(
    bytes32 _role,
    address _account,
    bool _nominationStatus
  ) internal virtual {
    _roleToAccountToNominated[_role][_account] = _nominationStatus;
    emit RoleNomineeUpdate(_role, _account, _nominationStatus);
  }

  /**
   * @dev This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
   */
  uint256[50] private __gap;
}
