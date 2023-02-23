// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

/**
 * @title INexus
 * @dev Basic interface for interacting with the Nexus i.e. SystemKernel
 */
interface INexus {
  function governor() external view returns (address);

  function getModule(bytes32 key) external view returns (address);

  function proposeModule(bytes32 _key, address _addr) external;

  function cancelProposedModule(bytes32 _key) external;

  function acceptProposedModule(bytes32 _key) external;

  function acceptProposedModules(bytes32[] calldata _keys) external;

  function requestLockModule(bytes32 _key) external;

  function cancelLockModule(bytes32 _key) external;

  function lockModule(bytes32 _key) external;
}
