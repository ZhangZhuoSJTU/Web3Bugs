// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma abicoder v2;

import {IVotingStrategy} from '../interfaces/IVotingStrategy.sol';
import {IExecutorWithTimelock} from '../interfaces/IExecutorWithTimelock.sol';
import {IProposalValidator} from '../interfaces/IProposalValidator.sol';
import {IGovernanceStrategy} from '../interfaces/IGovernanceStrategy.sol';
import {IAaveGovernanceV2} from '../interfaces/IAaveGovernanceV2.sol';
import {Ownable} from '../dependencies/open-zeppelin/Ownable.sol';
import {SafeMath} from '../dependencies/open-zeppelin/SafeMath.sol';
import {isContract, getChainId} from '../misc/Helpers.sol';

/**
 * @title Governance V2 contract
 * @dev Main point of interaction with Aave protocol's governance
 * - Create a Proposal
 * - Cancel a Proposal
 * - Queue a Proposal
 * - Execute a Proposal
 * - Submit Vote to a Proposal
 * Proposal States : Pending => Active => Succeeded(/Failed) => Queued => Executed(/Expired)
 *                   The transition to "Canceled" can appear in multiple states
 * @author Aave
 **/
contract AaveGovernanceV2 is Ownable, IAaveGovernanceV2 {
  using SafeMath for uint256;

  address private _governanceStrategy;
  uint256 private _votingDelay;

  uint256 private _proposalsCount;
  mapping(uint256 => Proposal) private _proposals;
  mapping(address => bool) private _authorizedExecutors;

  address private _guardian;

  bytes32 public constant DOMAIN_TYPEHASH = keccak256(
    'EIP712Domain(string name,uint256 chainId,address verifyingContract)'
  );
  bytes32 public constant VOTE_EMITTED_TYPEHASH = keccak256('VoteEmitted(uint256 id,bool support)');
  string public constant NAME = 'Aave Governance v2';

  modifier onlyGuardian() {
    require(msg.sender == _guardian, 'ONLY_BY_GUARDIAN');
    _;
  }

  constructor(
    address governanceStrategy,
    uint256 votingDelay,
    address guardian,
    address[] memory executors
  ) {
    _setGovernanceStrategy(governanceStrategy);
    _setVotingDelay(votingDelay);
    _guardian = guardian;

    authorizeExecutors(executors);
  }

  struct CreateVars {
    uint256 startBlock;
    uint256 endBlock;
    uint256 previousProposalsCount;
  }

  /**
   * @dev Creates a Proposal (needs to be validated by the Proposal Validator)
   * @param executor The ExecutorWithTimelock contract that will execute the proposal
   * @param targets list of contracts called by proposal's associated transactions
   * @param values list of value in wei for each propoposal's associated transaction
   * @param signatures list of function signatures (can be empty) to be used when created the callData
   * @param calldatas list of calldatas: if associated signature empty, calldata ready, else calldata is arguments
   * @param withDelegatecalls boolean, true = transaction delegatecalls the taget, else calls the target
   * @param ipfsHash IPFS hash of the proposal
   **/
  function create(
    IExecutorWithTimelock executor,
    address[] memory targets,
    uint256[] memory values,
    string[] memory signatures,
    bytes[] memory calldatas,
    bool[] memory withDelegatecalls,
    bytes32 ipfsHash
  ) external override returns (uint256) {
    require(targets.length != 0, 'INVALID_EMPTY_TARGETS');
    require(
      targets.length == values.length &&
        targets.length == signatures.length &&
        targets.length == calldatas.length &&
        targets.length == withDelegatecalls.length,
      'INCONSISTENT_PARAMS_LENGTH'
    );

    require(isExecutorAuthorized(address(executor)), 'EXECUTOR_NOT_AUTHORIZED');

    require(
      IProposalValidator(address(executor)).validateCreatorOfProposal(
        this,
        msg.sender,
        block.number - 1
      ),
      'PROPOSITION_CREATION_INVALID'
    );

    CreateVars memory vars;

    vars.startBlock = block.number.add(_votingDelay);
    vars.endBlock = vars.startBlock.add(IProposalValidator(address(executor)).VOTING_DURATION());

    vars.previousProposalsCount = _proposalsCount;

    Proposal storage newProposal = _proposals[vars.previousProposalsCount];
    newProposal.id = vars.previousProposalsCount;
    newProposal.creator = msg.sender;
    newProposal.executor = executor;
    newProposal.targets = targets;
    newProposal.values = values;
    newProposal.signatures = signatures;
    newProposal.calldatas = calldatas;
    newProposal.withDelegatecalls = withDelegatecalls;
    newProposal.startBlock = vars.startBlock;
    newProposal.endBlock = vars.endBlock;
    newProposal.strategy = _governanceStrategy;
    newProposal.ipfsHash = ipfsHash;
    _proposalsCount++;

    emit ProposalCreated(
      vars.previousProposalsCount,
      msg.sender,
      executor,
      targets,
      values,
      signatures,
      calldatas,
      withDelegatecalls,
      vars.startBlock,
      vars.endBlock,
      _governanceStrategy,
      ipfsHash
    );

    return newProposal.id;
  }

  /**
   * @dev Cancels a Proposal.
   * - Callable by the _guardian with relaxed conditions, or by anybody if the conditions of
   *   cancellation on the executor are fulfilled
   * @param proposalId id of the proposal
   **/
  function cancel(uint256 proposalId) external override {
    ProposalState state = getProposalState(proposalId);
    require(
      state != ProposalState.Executed &&
        state != ProposalState.Canceled &&
        state != ProposalState.Expired,
      'ONLY_BEFORE_EXECUTED'
    );

    Proposal storage proposal = _proposals[proposalId];
    require(
      msg.sender == _guardian ||
        IProposalValidator(address(proposal.executor)).validateProposalCancellation(
          this,
          proposal.creator,
          block.number - 1
        ),
      'PROPOSITION_CANCELLATION_INVALID'
    );
    proposal.canceled = true;
    for (uint256 i = 0; i < proposal.targets.length; i++) {
      proposal.executor.cancelTransaction(
        proposal.targets[i],
        proposal.values[i],
        proposal.signatures[i],
        proposal.calldatas[i],
        proposal.executionTime,
        proposal.withDelegatecalls[i]
      );
    }

    emit ProposalCanceled(proposalId);
  }

  /**
   * @dev Queue the proposal (If Proposal Succeeded)
   * @param proposalId id of the proposal to queue
   **/
  function queue(uint256 proposalId) external override {
    require(getProposalState(proposalId) == ProposalState.Succeeded, 'INVALID_STATE_FOR_QUEUE');
    Proposal storage proposal = _proposals[proposalId];
    uint256 executionTime = block.timestamp.add(proposal.executor.getDelay());
    for (uint256 i = 0; i < proposal.targets.length; i++) {
      _queueOrRevert(
        proposal.executor,
        proposal.targets[i],
        proposal.values[i],
        proposal.signatures[i],
        proposal.calldatas[i],
        executionTime,
        proposal.withDelegatecalls[i]
      );
    }
    proposal.executionTime = executionTime;

    emit ProposalQueued(proposalId, executionTime, msg.sender);
  }

  /**
   * @dev Execute the proposal (If Proposal Queued)
   * @param proposalId id of the proposal to execute
   **/
  function execute(uint256 proposalId) external payable override {
    require(getProposalState(proposalId) == ProposalState.Queued, 'ONLY_QUEUED_PROPOSALS');
    Proposal storage proposal = _proposals[proposalId];
    proposal.executed = true;
    for (uint256 i = 0; i < proposal.targets.length; i++) {
      proposal.executor.executeTransaction{value: proposal.values[i]}(
        proposal.targets[i],
        proposal.values[i],
        proposal.signatures[i],
        proposal.calldatas[i],
        proposal.executionTime,
        proposal.withDelegatecalls[i]
      );
    }
    emit ProposalExecuted(proposalId, msg.sender);
  }

  /**
   * @dev Function allowing msg.sender to vote for/against a proposal
   * @param proposalId id of the proposal
   * @param support boolean, true = vote for, false = vote against
   **/
  function submitVote(uint256 proposalId, bool support) external override {
    return _submitVote(msg.sender, proposalId, support);
  }

  /**
   * @dev Function to register the vote of user that has voted offchain via signature
   * @param proposalId id of the proposal
   * @param support boolean, true = vote for, false = vote against
   * @param v v part of the voter signature
   * @param r r part of the voter signature
   * @param s s part of the voter signature
   **/
  function submitVoteBySignature(
    uint256 proposalId,
    bool support,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external override {
    bytes32 digest = keccak256(
      abi.encodePacked(
        '\x19\x01',
        keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(NAME)), getChainId(), address(this))),
        keccak256(abi.encode(VOTE_EMITTED_TYPEHASH, proposalId, support))
      )
    );
    address signer = ecrecover(digest, v, r, s);
    require(signer != address(0), 'INVALID_SIGNATURE');
    return _submitVote(signer, proposalId, support);
  }

  /**
   * @dev Set new GovernanceStrategy
   * Note: owner should be a timelocked executor, so needs to make a proposal
   * @param governanceStrategy new Address of the GovernanceStrategy contract
   **/
  function setGovernanceStrategy(address governanceStrategy) external override onlyOwner {
    _setGovernanceStrategy(governanceStrategy);
  }

  /**
   * @dev Set new Voting Delay (delay before a newly created proposal can be voted on)
   * Note: owner should be a timelocked executor, so needs to make a proposal
   * @param votingDelay new voting delay in terms of blocks
   **/
  function setVotingDelay(uint256 votingDelay) external override onlyOwner {
    _setVotingDelay(votingDelay);
  }

  /**
   * @dev Add new addresses to the list of authorized executors
   * @param executors list of new addresses to be authorized executors
   **/
  function authorizeExecutors(address[] memory executors) public override onlyOwner {
    for (uint256 i = 0; i < executors.length; i++) {
      _authorizeExecutor(executors[i]);
    }
  }

  /**
   * @dev Remove addresses to the list of authorized executors
   * @param executors list of addresses to be removed as authorized executors
   **/
  function unauthorizeExecutors(address[] memory executors) public override onlyOwner {
    for (uint256 i = 0; i < executors.length; i++) {
      _unauthorizeExecutor(executors[i]);
    }
  }

  /**
   * @dev Let the guardian abdicate from its priviledged rights
   **/
  function __abdicate() external override onlyGuardian {
    _guardian = address(0);
  }

  /**
   * @dev Getter of the current GovernanceStrategy address
   * @return The address of the current GovernanceStrategy contracts
   **/
  function getGovernanceStrategy() external view override returns (address) {
    return _governanceStrategy;
  }

  /**
   * @dev Getter of the current Voting Delay (delay before a created proposal can be voted on)
   * Different from the voting duration
   * @return The voting delay in number of blocks
   **/
  function getVotingDelay() external view override returns (uint256) {
    return _votingDelay;
  }

  /**
   * @dev Returns whether an address is an authorized executor
   * @param executor address to evaluate as authorized executor
   * @return true if authorized
   **/
  function isExecutorAuthorized(address executor) public view override returns (bool) {
    return _authorizedExecutors[executor];
  }

  /**
   * @dev Getter the address of the guardian, that can mainly cancel proposals
   * @return The address of the guardian
   **/
  function getGuardian() external view override returns (address) {
    return _guardian;
  }

  /**
   * @dev Getter of the proposal count (the current number of proposals ever created)
   * @return the proposal count
   **/
  function getProposalsCount() external view override returns (uint256) {
    return _proposalsCount;
  }

  /**
   * @dev Getter of a proposal by id
   * @param proposalId id of the proposal to get
   * @return the proposal as ProposalWithoutVotes memory object
   **/
  function getProposalById(uint256 proposalId)
    external
    view
    override
    returns (ProposalWithoutVotes memory)
  {
    Proposal storage proposal = _proposals[proposalId];
    ProposalWithoutVotes memory proposalWithoutVotes = ProposalWithoutVotes({
      id: proposal.id,
      creator: proposal.creator,
      executor: proposal.executor,
      targets: proposal.targets,
      values: proposal.values,
      signatures: proposal.signatures,
      calldatas: proposal.calldatas,
      withDelegatecalls: proposal.withDelegatecalls,
      startBlock: proposal.startBlock,
      endBlock: proposal.endBlock,
      executionTime: proposal.executionTime,
      forVotes: proposal.forVotes,
      againstVotes: proposal.againstVotes,
      executed: proposal.executed,
      canceled: proposal.canceled,
      strategy: proposal.strategy,
      ipfsHash: proposal.ipfsHash
    });

    return proposalWithoutVotes;
  }

  /**
   * @dev Getter of the Vote of a voter about a proposal
   * Note: Vote is a struct: ({bool support, uint248 votingPower})
   * @param proposalId id of the proposal
   * @param voter address of the voter
   * @return The associated Vote memory object
   **/
  function getVoteOnProposal(uint256 proposalId, address voter)
    external
    view
    override
    returns (Vote memory)
  {
    return _proposals[proposalId].votes[voter];
  }

  /**
   * @dev Get the current state of a proposal
   * @param proposalId id of the proposal
   * @return The current state if the proposal
   **/
  function getProposalState(uint256 proposalId) public view override returns (ProposalState) {
    require(_proposalsCount >= proposalId, 'INVALID_PROPOSAL_ID');
    Proposal storage proposal = _proposals[proposalId];
    if (proposal.canceled) {
      return ProposalState.Canceled;
    } else if (block.number <= proposal.startBlock) {
      return ProposalState.Pending;
    } else if (block.number <= proposal.endBlock) {
      return ProposalState.Active;
    } else if (!IProposalValidator(address(proposal.executor)).isProposalPassed(this, proposalId)) {
      return ProposalState.Failed;
    } else if (proposal.executionTime == 0) {
      return ProposalState.Succeeded;
    } else if (proposal.executed) {
      return ProposalState.Executed;
    } else if (proposal.executor.isProposalOverGracePeriod(this, proposalId)) {
      return ProposalState.Expired;
    } else {
      return ProposalState.Queued;
    }
  }

  function _queueOrRevert(
    IExecutorWithTimelock executor,
    address target,
    uint256 value,
    string memory signature,
    bytes memory callData,
    uint256 executionTime,
    bool withDelegatecall
  ) internal {
    require(
      !executor.isActionQueued(
        keccak256(abi.encode(target, value, signature, callData, executionTime, withDelegatecall))
      ),
      'DUPLICATED_ACTION'
    );
    executor.queueTransaction(target, value, signature, callData, executionTime, withDelegatecall);
  }

  function _submitVote(
    address voter,
    uint256 proposalId,
    bool support
  ) internal {
    require(getProposalState(proposalId) == ProposalState.Active, 'VOTING_CLOSED');
    Proposal storage proposal = _proposals[proposalId];
    Vote storage vote = proposal.votes[voter];

    require(vote.votingPower == 0, 'VOTE_ALREADY_SUBMITTED');

    uint256 votingPower = IVotingStrategy(proposal.strategy).getVotingPowerAt(
      voter,
      proposal.startBlock
    );

    if (support) {
      proposal.forVotes = proposal.forVotes.add(votingPower);
    } else {
      proposal.againstVotes = proposal.againstVotes.add(votingPower);
    }

    vote.support = support;
    vote.votingPower = uint248(votingPower);

    emit VoteEmitted(proposalId, voter, support, votingPower);
  }

  function _setGovernanceStrategy(address governanceStrategy) internal {
    _governanceStrategy = governanceStrategy;

    emit GovernanceStrategyChanged(governanceStrategy, msg.sender);
  }

  function _setVotingDelay(uint256 votingDelay) internal {
    _votingDelay = votingDelay;

    emit VotingDelayChanged(votingDelay, msg.sender);
  }

  function _authorizeExecutor(address executor) internal {
    _authorizedExecutors[executor] = true;
    emit ExecutorAuthorized(executor);
  }

  function _unauthorizeExecutor(address executor) internal {
    _authorizedExecutors[executor] = false;
    emit ExecutorUnauthorized(executor);
  }
}