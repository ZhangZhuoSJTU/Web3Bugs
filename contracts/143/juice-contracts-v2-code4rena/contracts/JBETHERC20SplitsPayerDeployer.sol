// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './interfaces/IJBETHERC20SplitsPayerDeployer.sol';
import './JBETHERC20SplitsPayer.sol';

/** 
  @notice 
  Deploys splits payer contracts.

  @dev
  Adheres to -
  IJBETHERC20SplitsPayerDeployer:  General interface for the methods in this contract that interact with the blockchain's state according to the protocol's rules.
*/
contract JBETHERC20SplitsPayerDeployer is IJBETHERC20SplitsPayerDeployer {
  //*********************************************************************//
  // ---------------------- external transactions ---------------------- //
  //*********************************************************************//

  /** 
    @notice 
    Allows anyone to deploy a new splits payer contract.

    @param _defaultSplitsProjectId The ID of project for which the default splits are stored.
    @param _defaultSplitsDomain The splits domain to payout when this contract receives direct payments.
    @param _defaultSplitsGroup The splits group to payout when this contract receives direct payments.
    @param _splitsStore A contract that stores splits for each project.
    @param _defaultProjectId The ID of the project whose treasury should be forwarded the splits payer contract's received payment leftovers after distributing to the default splits group.
    @param _defaultBeneficiary The address that'll receive the project's tokens when the splits payer receives payments. 
    @param _defaultPreferClaimedTokens A flag indicating whether issued tokens from the splits payer's received payments should be automatically claimed into the beneficiary's wallet. 
    @param _defaultMemo The memo that'll be forwarded with the splits payer's received payments. 
    @param _defaultMetadata The metadata that'll be forwarded with the splits payer's received payments. 
    @param _defaultPreferAddToBalance A flag indicating if received payments should call the `pay` function or the `addToBalance` function of a project.
    @param _owner The address that will own the splits payer.

    @return splitsPayer The splits payer contract.
  */
  function deploySplitsPayer(
    uint256 _defaultSplitsProjectId,
    uint256 _defaultSplitsDomain,
    uint256 _defaultSplitsGroup,
    IJBSplitsStore _splitsStore,
    uint256 _defaultProjectId,
    address payable _defaultBeneficiary,
    bool _defaultPreferClaimedTokens,
    string memory _defaultMemo,
    bytes memory _defaultMetadata,
    bool _defaultPreferAddToBalance,
    address _owner
  ) external override returns (IJBSplitsPayer splitsPayer) {
    // Deploy the splits payer.
    splitsPayer = new JBETHERC20SplitsPayer(
      _defaultSplitsProjectId,
      _defaultSplitsDomain,
      _defaultSplitsGroup,
      _splitsStore,
      _defaultProjectId,
      _defaultBeneficiary,
      _defaultPreferClaimedTokens,
      _defaultMemo,
      _defaultMetadata,
      _defaultPreferAddToBalance,
      _owner
    );

    emit DeploySplitsPayer(
      splitsPayer,
      _defaultSplitsProjectId,
      _defaultSplitsDomain,
      _defaultSplitsGroup,
      _splitsStore,
      _defaultProjectId,
      _defaultBeneficiary,
      _defaultPreferClaimedTokens,
      _defaultMemo,
      _defaultMetadata,
      _defaultPreferAddToBalance,
      _owner,
      msg.sender
    );
  }
}
