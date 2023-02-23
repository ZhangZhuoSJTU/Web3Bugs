// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;
import {ImmutableModule} from "../shared/ImmutableModule.sol";
import {INexus} from "../interfaces/INexus.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title  GovernedMinterRole
 * @author OpenZeppelin (forked from @openzeppelin/contracts/access/roles/MinterRole.sol)
 *         Update 2021/08/19 MinterRole.sol has been removed, AccessControl.sol is used instead.
 * @dev    Forked from OpenZeppelin 'MinterRole' with changes:
 *          - `addMinter` modified from `onlyMinter` to `onlyGovernor`
 *          - `removeMinter` function added, callable by `onlyGovernor`
 */
abstract contract GovernedMinterRole is ImmutableModule, AccessControl {
  event MinterAdded(address indexed account);
  event MinterRemoved(address indexed account);

  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

  constructor(address _nexus) ImmutableModule(_nexus) {
    _setupRole(DEFAULT_ADMIN_ROLE, INexus(_nexus).governor());
  }

  modifier onlyMinter() {
    require(
      isMinter(msg.sender),
      "MinterRole: caller does not have the Minter role"
    );
    _;
  }

  function isMinter(address account) public view returns (bool) {
    return hasRole(MINTER_ROLE, account);
  }

  function addMinter(address account) public onlyGovernor {
    _addMinter(account);
  }

  function removeMinter(address account) public onlyGovernor {
    _removeMinter(account);
  }

  function renounceMinter() public onlyMinter {
    _renounceMinter(msg.sender);
  }

  function _addMinter(address account) internal {
    grantRole(MINTER_ROLE, account);
    emit MinterAdded(account);
  }

  function _removeMinter(address account) internal {
    revokeRole(MINTER_ROLE, account);
    emit MinterRemoved(account);
  }

  function _renounceMinter(address account) internal {
    renounceRole(MINTER_ROLE, account);
    emit MinterRemoved(account);
  }
}
