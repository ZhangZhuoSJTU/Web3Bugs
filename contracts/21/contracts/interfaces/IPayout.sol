// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/// @title Sherlock Payout Controller
/// @author Evert Kors
/// @notice This contract is used for doing payouts
/// @dev Contract is meant to be included as a facet in the diamond
/// @dev Storage library is used
interface IPayout {
  /// @notice Returns the governance address able to do payouts
  /// @return Payout governance address
  function getGovPayout() external view returns (address);

  /// @notice Set initial payout governance address
  /// @param _govPayout The address of the payout governance
  /// @dev Diamond deployer - GovDev - is able to call this function
  function setInitialGovPayout(address _govPayout) external;

  /// @notice Transfer the payout governance
  /// @param _govPayout New address for the payout governance
  function transferGovPayout(address _govPayout) external;

  /// @notice Send `_tokens` to `_payout`
  /// @param _payout Account to receive payout
  /// @param _tokens Tokens to be paid out
  /// @param _firstMoneyOut Amount used from first money out
  /// @param _amounts Amount used staker balance
  /// @param _unallocatedSherX Amount of unallocated SHERX used
  /// @param _exclude Token excluded from payout
  function payout(
    address _payout,
    IERC20[] memory _tokens,
    uint256[] memory _firstMoneyOut,
    uint256[] memory _amounts,
    uint256[] memory _unallocatedSherX,
    address _exclude
  ) external;
}
