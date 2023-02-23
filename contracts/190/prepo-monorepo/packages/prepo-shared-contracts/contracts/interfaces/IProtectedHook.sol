// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

// TODO: remove in favor of SafeMultiOwnable
interface IProtectedHook {
  event AllowedContractChange(address newAllowedContract);

  function setAllowedContract(address newAllowedContract) external;

  function getAllowedContract() external view returns (address);
}
