// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IGovernorAlpha.sol";
import "./interfaces/IGovernanceAddressProvider.sol";
import "../libraries/WadRayMath.sol";

contract GovernorAlpha is IGovernorAlpha {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  /// @notice The maximum number of actions that can be included in a proposal
  function proposalMaxOperations() public pure returns (uint256) {
    return 10;
  } // 10 actions

  IGovernanceAddressProvider public a;

  /// @notice The address of the Governor Guardian
  address public guardian;

  /// @notice The total number of proposals
  uint256 public proposalCount;

  /// @notice The official record of all proposals ever proposed
  mapping(uint256 => Proposal) public proposals;

  /// @notice The latest proposal for each proposer
  mapping(address => uint256) public latestProposalIds;

  constructor(IGovernanceAddressProvider _addresses, address _guardian) public {
    require(address(_addresses) != address(0));
    require(address(_guardian) != address(0));

    a = _addresses;
    guardian = _guardian;
  }

  function propose(
    address[] memory targets,
    uint256[] memory values,
    string[] memory signatures,
    bytes[] memory calldatas,
    string memory description,
    uint256 endTime
  ) public override returns (uint256) {
    uint256 votingDuration = endTime.sub(block.timestamp);
    require(votingDuration >= a.parallel().config().minVotingPeriod(), "Proposal end-time too early");
    require(votingDuration <= a.parallel().config().maxVotingPeriod(), "Proposal end-time too late");

    require(
      a.votingEscrow().balanceOfAt(msg.sender, endTime) > proposalThreshold(),
      "GovernorAlpha::propose: proposer votes below proposal threshold"
    );
    require(
      targets.length == values.length && targets.length == signatures.length && targets.length == calldatas.length,
      "GovernorAlpha::propose: proposal function information arity mismatch"
    );
    require(targets.length != 0, "GovernorAlpha::propose: must provide actions");
    require(targets.length <= proposalMaxOperations(), "GovernorAlpha::propose: too many actions");

    uint256 latestProposalId = latestProposalIds[msg.sender];
    if (latestProposalId != 0) {
      ProposalState proposersLatestProposalState = state(latestProposalId);
      require(
        proposersLatestProposalState != ProposalState.Active,
        "GovernorAlpha::propose: one live proposal per proposer, found an already active proposal"
      );
    }

    proposalCount++;
    Proposal memory newProposal = Proposal({
      id: proposalCount,
      proposer: msg.sender,
      eta: 0,
      targets: targets,
      values: values,
      signatures: signatures,
      calldatas: calldatas,
      startTime: block.timestamp,
      endTime: endTime,
      forVotes: 0,
      againstVotes: 0,
      canceled: false,
      executed: false
    });

    proposals[newProposal.id] = newProposal;
    latestProposalIds[newProposal.proposer] = newProposal.id;

    emit ProposalCreated(
      newProposal.id,
      msg.sender,
      targets,
      values,
      signatures,
      calldatas,
      block.timestamp,
      endTime,
      description
    );
    return newProposal.id;
  }

  function queue(uint256 proposalId) public override {
    require(
      state(proposalId) == ProposalState.Succeeded,
      "GovernorAlpha::queue: proposal can only be queued if it is succeeded"
    );
    Proposal storage proposal = proposals[proposalId];
    uint256 eta = block.timestamp.add(a.timelock().delay());
    for (uint256 i = 0; i < proposal.targets.length; i++) {
      _queueOrRevert(proposal.targets[i], proposal.values[i], proposal.signatures[i], proposal.calldatas[i], eta);
    }
    proposal.eta = eta;
    emit ProposalQueued(proposalId, eta);
  }

  function execute(uint256 proposalId) public payable override {
    require(
      state(proposalId) == ProposalState.Queued,
      "GovernorAlpha::execute: proposal can only be executed if it is queued"
    );
    Proposal storage proposal = proposals[proposalId];
    proposal.executed = true;
    for (uint256 i = 0; i < proposal.targets.length; i++) {
      a.timelock().executeTransaction{ value: proposal.values[i] }(
        proposal.targets[i],
        proposal.values[i],
        proposal.signatures[i],
        proposal.calldatas[i],
        proposal.eta
      );
    }
    emit ProposalExecuted(proposalId);
  }

  function cancel(uint256 proposalId) public override {
    ProposalState state = state(proposalId);
    require(state != ProposalState.Executed, "GovernorAlpha::cancel: cannot cancel executed proposal");

    Proposal storage proposal = proposals[proposalId];
    require(msg.sender == guardian, "Only Guardian can cancel");

    proposal.canceled = true;
    for (uint256 i = 0; i < proposal.targets.length; i++) {
      a.timelock().cancelTransaction(
        proposal.targets[i],
        proposal.values[i],
        proposal.signatures[i],
        proposal.calldatas[i],
        proposal.eta
      );
    }

    emit ProposalCanceled(proposalId);
  }

  function castVote(uint256 proposalId, bool support) public override {
    require(state(proposalId) == ProposalState.Active, "GovernorAlpha::_castVote: voting is closed");
    Proposal storage proposal = proposals[proposalId];
    Receipt storage receipt = proposal.receipts[msg.sender];
    require(receipt.hasVoted == false, "GovernorAlpha::_castVote: voter already voted");
    uint256 votes = a.votingEscrow().balanceOfAt(msg.sender, proposal.endTime);

    if (support) {
      proposal.forVotes = proposal.forVotes.add(votes);
    } else {
      proposal.againstVotes = proposal.againstVotes.add(votes);
    }

    receipt.hasVoted = true;
    receipt.support = support;
    receipt.votes = votes;

    emit VoteCast(msg.sender, proposalId, support, votes);
  }

  // solhint-disable-next-line private-vars-leading-underscore
  function __acceptAdmin() public {
    require(msg.sender == guardian, "GovernorAlpha::__acceptAdmin: sender must be gov guardian");
    a.timelock().acceptAdmin();
  }

  // solhint-disable-next-line private-vars-leading-underscore
  function __abdicate() public {
    require(msg.sender == guardian, "GovernorAlpha::__abdicate: sender must be gov guardian");
    guardian = address(0);
  }

  // solhint-disable-next-line private-vars-leading-underscore
  function __queueSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public {
    require(msg.sender == guardian, "GovernorAlpha::__queueSetTimelockPendingAdmin: sender must be gov guardian");
    a.timelock().queueTransaction(
      address(a.timelock()),
      0,
      "setPendingAdmin(address)",
      abi.encode(newPendingAdmin),
      eta
    );
  }

  // solhint-disable-next-line private-vars-leading-underscore
  function __executeSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta) public {
    require(msg.sender == guardian, "GovernorAlpha::__executeSetTimelockPendingAdmin: sender must be gov guardian");
    a.timelock().executeTransaction(
      address(a.timelock()),
      0,
      "setPendingAdmin(address)",
      abi.encode(newPendingAdmin),
      eta
    );
  }

  /// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
  function quorumVotes() public view override returns (uint256) {
    return a.votingEscrow().stakingToken().totalSupply().wadMul(a.parallel().config().votingQuorum());
  }

  /// @notice The number of votes required in order for a voter to become a proposer
  function proposalThreshold() public view override returns (uint256) {
    return a.votingEscrow().stakingToken().totalSupply().wadMul(a.parallel().config().proposalThreshold());
  }

  function getActions(uint256 proposalId)
    public
    view
    override
    returns (
      address[] memory targets,
      uint256[] memory values,
      string[] memory signatures,
      bytes[] memory calldatas
    )
  {
    Proposal storage p = proposals[proposalId];
    return (p.targets, p.values, p.signatures, p.calldatas);
  }

  function getReceipt(uint256 proposalId, address voter) public view override returns (Receipt memory) {
    return proposals[proposalId].receipts[voter];
  }

  function state(uint256 proposalId) public view override returns (ProposalState) {
    require(proposalCount >= proposalId && proposalId > 0, "GovernorAlpha::state: invalid proposal id");
    Proposal storage proposal = proposals[proposalId];
    if (proposal.canceled) {
      return ProposalState.Canceled;
    } else if (block.timestamp <= proposal.endTime) {
      return ProposalState.Active;
    } else if (proposal.forVotes <= proposal.againstVotes || proposal.forVotes < quorumVotes()) {
      return ProposalState.Defeated;
    } else if (proposal.eta == 0) {
      return ProposalState.Succeeded;
    } else if (proposal.executed) {
      return ProposalState.Executed;
    } else if (block.timestamp >= a.timelock().GRACE_PERIOD().add(proposal.endTime)) {
      return ProposalState.Expired;
    } else {
      return ProposalState.Queued;
    }
  }

  function _queueOrRevert(
    address target,
    uint256 value,
    string memory signature,
    bytes memory data,
    uint256 eta
  ) internal {
    require(
      !a.timelock().queuedTransactions(keccak256(abi.encode(target, value, signature, data, eta))),
      "GovernorAlpha::_queueOrRevert: proposal action already queued at eta"
    );
    a.timelock().queueTransaction(target, value, signature, data, eta);
  }
}
