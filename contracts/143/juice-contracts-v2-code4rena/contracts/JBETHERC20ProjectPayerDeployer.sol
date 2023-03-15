// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './interfaces/IJBETHERC20ProjectPayerDeployer.sol';
import './JBETHERC20ProjectPayer.sol';

/** 
  @notice 
  Deploys project payer contracts.

  @dev
  Adheres to -
  IJBETHERC20ProjectPayerDeployer:  General interface for the methods in this contract that interact with the blockchain's state according to the protocol's rules.
*/
contract JBETHERC20ProjectPayerDeployer is IJBETHERC20ProjectPayerDeployer {
  //*********************************************************************//
  // ---------------------- external transactions ---------------------- //
  //*********************************************************************//

  /** 
    @notice 
    Allows anyone to deploy a new project payer contract.

    @param _defaultProjectId The ID of the project whose treasury should be forwarded the project payer contract's received payments.
    @param _defaultBeneficiary The address that'll receive the project's tokens when the project payer receives payments. 
    @param _defaultPreferClaimedTokens A flag indicating whether issued tokens from the project payer's received payments should be automatically claimed into the beneficiary's wallet. 
    @param _defaultMemo The memo that'll be forwarded with the project payer's received payments. 
    @param _defaultMetadata The metadata that'll be forwarded with the project payer's received payments. 
    @param _defaultPreferAddToBalance A flag indicating if received payments should call the `pay` function or the `addToBalance` function of a project.
    @param _directory A contract storing directories of terminals and controllers for each project.
    @param _owner The address that will own the project payer.

    @return projectPayer The project payer contract.
  */
  function deployProjectPayer(
    uint256 _defaultProjectId,
    address payable _defaultBeneficiary,
    bool _defaultPreferClaimedTokens,
    string memory _defaultMemo,
    bytes memory _defaultMetadata,
    bool _defaultPreferAddToBalance,
    IJBDirectory _directory,
    address _owner
  ) external override returns (IJBProjectPayer projectPayer) {
    // Deploy the project payer.
    projectPayer = new JBETHERC20ProjectPayer(
      _defaultProjectId,
      _defaultBeneficiary,
      _defaultPreferClaimedTokens,
      _defaultMemo,
      _defaultMetadata,
      _defaultPreferAddToBalance,
      _directory,
      _owner
    );

    emit DeployProjectPayer(
      projectPayer,
      _defaultProjectId,
      _defaultBeneficiary,
      _defaultPreferClaimedTokens,
      _defaultMemo,
      _defaultMetadata,
      _defaultPreferAddToBalance,
      _directory,
      _owner,
      msg.sender
    );
  }
}
