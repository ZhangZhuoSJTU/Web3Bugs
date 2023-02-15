// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "../OZ/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title Defines a role for Foundation operator accounts.
 * @dev Wraps a role from OpenZeppelin's AccessControl for easy integration.
 */
abstract contract OperatorRole is Initializable, AccessControlUpgradeable {
  bytes32 private constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

  /**
   * @notice Adds the account to the list of approved operators.
   * @dev Only callable by admins as enforced by `grantRole`.
   * @param account The address to be approved.
   */
  function grantOperator(address account) external {
    grantRole(OPERATOR_ROLE, account);
  }

  /**
   * @notice Removes the account from the list of approved operators.
   * @dev Only callable by admins as enforced by `grantRole`.
   * @param account The address to be removed from the approved list.
   */
  function revokeOperator(address account) external {
    revokeRole(OPERATOR_ROLE, account);
  }

  /**
   * @notice Returns one of the operator by index.
   * @param index The index of the operator to return from 0 to getOperatorMemberCount() - 1.
   * @return account The address of the operator.
   */
  function getOperatorMember(uint256 index) external view returns (address account) {
    return getRoleMember(OPERATOR_ROLE, index);
  }

  /**
   * @notice Checks how many accounts have been granted operator access.
   * @return count The number of accounts with operator access.
   */
  function getOperatorMemberCount() external view returns (uint256 count) {
    return getRoleMemberCount(OPERATOR_ROLE);
  }

  /**
   * @notice Checks if the account provided is an operator.
   * @param account The address to check.
   * @return approved True if the account is an operator.
   */
  function isOperator(address account) external view returns (bool approved) {
    return hasRole(OPERATOR_ROLE, account);
  }
}
