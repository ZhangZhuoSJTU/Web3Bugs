// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import './IJBFundingCycleBallot.sol';

interface IJBReconfigurationBufferBallot is IJBFundingCycleBallot {
  event Finalize(
    uint256 indexed projectId,
    uint256 indexed configuration,
    JBBallotState indexed ballotState,
    address caller
  );

  function finalState(uint256 _projectId, uint256 _configuration)
    external
    view
    returns (JBBallotState);

  function fundingCycleStore() external view returns (IJBFundingCycleStore);

  function finalize(uint256 _projectId, uint256 _configured) external returns (JBBallotState);
}
