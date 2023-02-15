// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "../../governance/interfaces/IGovernanceAddressProvider.sol";

interface IBaseDistributor {
  event PayeeAdded(address account, uint256 shares);
  event TokensReleased(uint256 newTokens, uint256 releasedAt);

  /**
    Public function to release the accumulated new MIMO tokens to the payees.
    @dev anyone can call this.
  */
  function release() external;

  /**
    Updates the payee configuration to a new one.
    @dev will release existing fees before the update.
    @param _payees Array of payees
    @param _shares Array of shares for each payee
  */
  function changePayees(address[] memory _payees, uint256[] memory _shares) external;

  function totalShares() external view returns (uint256);

  function shares(address) external view returns (uint256);

  function a() external view returns (IGovernanceAddressProvider);

  function mintableTokens() external view returns (uint256);

  /**
    Get current configured payees.
    @return array of current payees.
  */
  function getPayees() external view returns (address[] memory);
}
