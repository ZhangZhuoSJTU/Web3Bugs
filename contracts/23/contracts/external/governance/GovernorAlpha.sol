// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "interfaces/notional/INoteERC20.sol";
import "@openzeppelin/contracts/access/TimelockController.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title Notional Governor Alpha
 * Fork of Compound Governor Alpha at commit hash
 * https://github.com/compound-finance/compound-protocol/commit/9bcff34a5c9c76d51e51bcb0ca1139588362ef96
 */
contract GovernorAlpha is TimelockController {
    /// @notice The name of this contract
    string public constant name = "Notional Governor Alpha";

    /// @notice The address of the Notional governance token
    INoteERC20 public immutable note;

    /// @notice The maximum number of actions that can be included in a proposal
    uint8 public constant PROPOSAL_MAX_OPERATIONS = 10;

    /// @notice The minimum voting period in blocks, about 1 day assuming 13 second blocks. Ensures that proposals will always have
    /// time to be voted on.
    uint32 public constant MIN_VOTING_PERIOD_BLOCKS = 6700;

    /// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a proposal to succeed
    uint96 public quorumVotes;

    /// @notice The number of votes required in order for a voter to become a proposer
    uint96 public proposalThreshold;

    /// @notice The delay before voting on a proposal may take place, once proposed
    uint32 public votingDelayBlocks;

    /// @notice The duration of voting on a proposal, in blocks
    uint32 public votingPeriodBlocks;

    /// @notice The address of the Governor Guardian
    address public guardian;

    /// @notice The total number of proposals
    uint256 public proposalCount;

    struct Proposal {
        // Unique id for looking up a proposal
        uint256 id;
        // The timestamp at which voting begins: holders must delegate their votes prior to this block
        uint32 startBlock;
        // The timestamp at which voting ends: votes must be cast prior to this block
        uint32 endBlock;
        // Current number of votes in favor of this proposal
        uint96 forVotes;
        // Current number of votes in opposition to this proposal
        uint96 againstVotes;
        // Creator of the proposal
        address proposer;
        // Flag marking whether the proposal has been canceled
        bool canceled;
        // Flag marking whether the proposal has been executed
        bool executed;
        // Hash of the operation to reduce storage cost
        bytes32 operationHash;
    }

    // Ballot receipt record for a voter
    struct Receipt {
        // Whether or not a vote has been cast
        bool hasVoted;
        // Whether or not the voter supports the proposal
        bool support;
        // The number of votes the voter had, which were cast
        uint96 votes;
    }

    // Possible states that a proposal may be in
    enum ProposalState {Pending, Active, Canceled, Defeated, Succeeded, Queued, Executed}

    /// @notice The official record of all proposals ever proposed
    mapping(uint256 => Proposal) public proposals;

    /// @notice Receipts of ballots for the entire set of voters
    mapping(uint256 => mapping(address => Receipt)) public receipts;

    /// @notice The latest proposal for each proposer
    mapping(address => uint256) public latestProposalIds;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the ballot struct uComp by the contract
    bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId,bool support)");

    /// @notice An event emitted when a new proposal is created
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        address[] targets,
        uint256[] values,
        bytes[] calldatas,
        uint256 startBlock,
        uint256 endBlock
    );

    /// @notice An event emitted when a vote has been cast on a proposal
    event VoteCast(address indexed voter, uint256 indexed proposalId, bool support, uint256 votes);

    /// @notice An event emitted when a proposal has been canceled
    event ProposalCanceled(uint256 indexed id);

    /// @notice An event emitted when a proposal has been queued in the Timelock
    event ProposalQueued(uint256 indexed id, uint256 eta);

    /// @notice An event emitted when a proposal has been executed in the Timelock
    event ProposalExecuted(uint256 indexed id);

    /// @notice An event emitted when amount of quorum votes required is updated
    event UpdateQuorumVotes(uint96 newQuorumVotes);

    /// @notice An event emitted when a new proposal threshold has been set
    event UpdateProposalThreshold(uint96 newProposalThreshold);

    /// @notice An event emitted when a new voting delay in blocks has been set
    event UpdateVotingDelayBlocks(uint32 newVotingDelayBlocks);

    /// @notice An event emitted when a new voting period in blocks has been set
    event UpdateVotingPeriodBlocks(uint32 newVotingPeriodBlocks);

    /// @notice Emitted when the guardian abdicates their role
    event Abdicate();

    /// @notice An event emitted when guardian is transferred
    event TransferGuardian(address newGuardian);
    
    /// @notice Initializes the GovernorAlpha with initial parameters
    /// @param quorumVotes_ initial quorum votes value
    /// @param proposalThreshold_ initial proposal threshold value
    /// @param votingDelayBlocks_ initial voting delay blocks value
    /// @param votingPeriodBlocks_ initial voting period blocks value
    /// @param note_ address of the NOTE token to get voting power
    /// @param guardian_ address of guardian
    /// @param minDelay_ initial minimum delay for timelock in seconds
    constructor(
        uint96 quorumVotes_,
        uint96 proposalThreshold_,
        uint32 votingDelayBlocks_,
        uint32 votingPeriodBlocks_,
        address note_,
        address guardian_,
        uint256 minDelay_
    ) TimelockController(minDelay_, new address[](0), new address[](0)) {
        require(Address.isContract(note_));

        quorumVotes = quorumVotes_;
        proposalThreshold = proposalThreshold_;
        votingDelayBlocks = votingDelayBlocks_;
        // Do not enforce MIN_VOTING_DELAY during constructor so that tests don't require a large number
        // of blocks for the voting period. During actual mainnet deployment this will be set to a reasonable value.
        votingPeriodBlocks = votingPeriodBlocks_;
        note = INoteERC20(note_);
        guardian = guardian_;

        // Only the external methods can be used to execute governance
        grantRole(PROPOSER_ROLE, address(this));
        grantRole(EXECUTOR_ROLE, address(this));
        revokeRole(TIMELOCK_ADMIN_ROLE, msg.sender);
    }

    /// @notice Proposes a new governance action
    /// @param targets an array of addresses to take actions on
    /// @param values an array of ether amounts to send to respective target address
    /// @param calldatas an array of calldata bytes to call respective target address with
    /// @dev emit:ProposalCreated
    /// @return newly created proposal id
    function propose(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas
    ) external returns (uint256) {
        uint256 blockNumber = block.number;
        require(blockNumber > 0 && blockNumber < type(uint32).max);

        require(
            note.getPriorVotes(msg.sender, blockNumber - 1) > proposalThreshold,
            "GovernorAlpha::propose: proposer votes below proposal threshold"
        );
        require(
            targets.length == values.length && targets.length == calldatas.length,
            "GovernorAlpha::propose: proposal function information arity mismatch"
        );
        require(targets.length != 0, "GovernorAlpha::propose: must provide actions");
        require(
            targets.length <= PROPOSAL_MAX_OPERATIONS,
            "GovernorAlpha::propose: too many actions"
        );

        {
            uint256 latestProposalId = latestProposalIds[msg.sender];
            if (latestProposalId != 0) {
                ProposalState proposersLatestProposalState = state(latestProposalId);
                require(
                    proposersLatestProposalState != ProposalState.Active,
                    "GovernorAlpha::propose: one live proposal per proposer, found an already active proposal"
                );
                require(
                    proposersLatestProposalState != ProposalState.Pending,
                    "GovernorAlpha::propose: one live proposal per proposer, found an already pending proposal"
                );
            }
        }

        uint256 newProposalId = proposalCount + 1;
        proposalCount = newProposalId;

        uint32 startBlock = _add32(uint32(blockNumber), votingDelayBlocks);
        uint32 endBlock = _add32(startBlock, votingPeriodBlocks);
        bytes32 operationHash = _computeHash(targets, values, calldatas, newProposalId);

        Proposal memory newProposal =
            Proposal({
                id: newProposalId,
                proposer: msg.sender,
                startBlock: startBlock,
                endBlock: endBlock,
                forVotes: 0,
                againstVotes: 0,
                canceled: false,
                executed: false,
                operationHash: operationHash
            });

        proposals[newProposal.id] = newProposal;
        latestProposalIds[newProposal.proposer] = newProposal.id;

        emit ProposalCreated(
            newProposal.id,
            msg.sender,
            targets,
            values,
            calldatas,
            startBlock,
            endBlock
        );
        return newProposal.id;
    }

    /// @dev Helper method required to clear the stack for hashing operations
    function _computeHash(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        uint256 proposalId
    ) private pure returns (bytes32) {
        return hashOperationBatch(targets, values, calldatas, bytes32(0), bytes32(proposalId));
    }

    /// @notice Adds a proposal to the timelock queue only after its vote has passed, `targets`,
    /// `values`, and `calldatas` provided must hash back to the original proposal. All proposals
    /// will automatically be delayed `getMinDelay()` seconds.
    /// @param proposalId unique identifier for the proposal
    /// @param targets an array of addresses to take actions on
    /// @param values an array of ether amounts to send to respective target address
    /// @param calldatas an array of calldata bytes to call respective target address with
    /// @dev emit:ProposalQueued emit:CallScheduled (per call)
    function queueProposal(
        uint256 proposalId,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas
    ) external {
        require(state(proposalId) == ProposalState.Succeeded, "Proposal must be success");
        bytes32 computedOperationHash = _computeHash(targets, values, calldatas, proposalId);
        {
            Proposal storage proposal = proposals[proposalId];
            require(computedOperationHash == proposal.operationHash, "Operation hash mismatch");
        }

        _scheduleBatch(targets, values, calldatas, proposalId);

        emit ProposalQueued(proposalId, getMinDelay());
    }

    /// @dev Required to clear the stack for calling the timelock controller
    function _scheduleBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        uint256 proposalId
    ) private {
        // NOTE: this will also emit events
        this.scheduleBatch(
            targets,
            values,
            calldatas,
            bytes32(0),
            bytes32(proposalId),
            getMinDelay()
        );
    }

    /// @notice Executes a proposal in the timelock queue after its delay has passed, `targets`,
    /// `values`, and `calldatas` provided must hash back to the original proposal.
    /// @param proposalId unique identifier for the proposal
    /// @param targets an array of addresses to take actions on
    /// @param values an array of ether amounts to send to respective target address
    /// @param calldatas an array of calldata bytes to call respective target address with
    /// @dev emit:ProposalExecuted emit:CallExecuted (per call)
    function executeProposal(
        uint256 proposalId,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas
    ) external payable {
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;

        bytes32 computedOperationHash = _computeHash(targets, values, calldatas, proposalId);
        require(computedOperationHash == proposal.operationHash, "Operation hash mismatch");
        // Execute batch will revert if the call has not been scheduled
        _executeBatch(targets, values, calldatas, proposalId);

        emit ProposalExecuted(proposalId);
    }

    /// @dev Helper function to clear the stack for the timelock controller call
    function _executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        uint256 proposalId
    ) private {
        this.executeBatch(targets, values, calldatas, bytes32(0), bytes32(proposalId));
    }

    /// @notice Cancels a proposal after it has been created. Can only be done if the proposer
    /// no longer has sufficient votes (i.e. they made a proposal and then sold their tokens) or
    /// by a guardian address if it exists.
    /// @param proposalId unique identifier for the proposal
    /// @dev emit:ProposalCanceled emit:Canceled
    function cancelProposal(uint256 proposalId) public {
        ProposalState proposalState = state(proposalId);
        require(proposalState != ProposalState.Executed, "Proposal already executed");

        Proposal storage proposal = proposals[proposalId];
        uint256 blockNumber = block.number;
        require(blockNumber > 0 && blockNumber <= type(uint32).max);
        require(
            msg.sender == guardian ||
                note.getPriorVotes(proposal.proposer, blockNumber - 1) < proposalThreshold,
            "GovernorAlpha::cancel: proposer above threshold"
        );

        proposal.canceled = true;
        // Removes the operation hash from the timelock controller if pending.
        if (isOperationPending(proposal.operationHash)) this.cancel(proposal.operationHash);

        emit ProposalCanceled(proposalId);
    }

    /// @notice Returns the voting receipt for a voter on a proposal
    /// @param proposalId unique identifier for the proposal
    /// @param voter address of the voter
    /// @return the voting receipt for the voter and proposal
    function getReceipt(uint256 proposalId, address voter) public view returns (Receipt memory) {
        return receipts[proposalId][voter];
    }

    /// @notice Returns the current state of a proposal
    /// @param proposalId unique identifier for the proposal
    /// @return ProposalState enum for the current state of the proposal
    function state(uint256 proposalId) public view returns (ProposalState) {
        require(
            proposalCount >= proposalId && proposalId > 0,
            "GovernorAlpha::state: invalid proposal id"
        );
        Proposal memory proposal = proposals[proposalId];
        uint256 blockNumber = block.number;
        require(blockNumber > 0 && blockNumber <= type(uint32).max);

        if (proposal.canceled) {
            return ProposalState.Canceled;
        } else if (blockNumber <= proposal.startBlock) {
            return ProposalState.Pending;
        } else if (blockNumber <= proposal.endBlock) {
            return ProposalState.Active;
        } else if (proposal.forVotes <= proposal.againstVotes || proposal.forVotes < quorumVotes) {
            return ProposalState.Defeated;
        } else if (proposal.executed) {
            return ProposalState.Executed;
        } else if (isOperationPending(proposal.operationHash)) {
            return ProposalState.Queued;
        } else if (
            proposal.forVotes > proposal.againstVotes &&
            proposal.forVotes > quorumVotes &&
            blockNumber > proposal.endBlock
        ) {
            return ProposalState.Succeeded;
        }
    }

    /// @notice Cast a vote for a proposal
    /// @param proposalId unique identifier for the proposal
    /// @param support true if votes are for the proposal, false if against
    /// @dev emit:VoteCast
    function castVote(uint256 proposalId, bool support) public {
        return _castVote(msg.sender, proposalId, support);
    }

    /// @notice Cast a vote for a proposal via signature
    /// @param proposalId unique identifier for the proposal
    /// @param support true if votes are for the proposal, false if against
    /// @param v signature component
    /// @param r signature component
    /// @param s signature component
    /// @dev emit:VoteCast
    function castVoteBySig(
        uint256 proposalId,
        bool support,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        bytes32 domainSeparator =
            keccak256(
                abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), _getChainId(), address(this))
            );
        bytes32 structHash = keccak256(abi.encode(BALLOT_TYPEHASH, proposalId, support));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        // ECDSA.recover will check if address is zero
        address signatory = ECDSA.recover(digest, v, r, s);
        return _castVote(signatory, proposalId, support);
    }

    /// @dev Registers a vote, calls the NOTE token to get the voting power for the voter
    function _castVote(
        address voter,
        uint256 proposalId,
        bool support
    ) internal {
        require(
            state(proposalId) == ProposalState.Active,
            "GovernorAlpha::_castVote: voting is closed"
        );
        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = receipts[proposalId][voter];
        require(receipt.hasVoted == false, "GovernorAlpha::_castVote: voter already voted");
        uint96 votes = note.getPriorVotes(voter, proposal.startBlock);
        // Short circuit if voter has no votes
        if (votes == 0) return;

        if (support) {
            proposal.forVotes = _add96(proposal.forVotes, votes);
        } else {
            proposal.againstVotes = _add96(proposal.againstVotes, votes);
        }

        receipt.hasVoted = true;
        receipt.support = support;
        receipt.votes = votes;

        emit VoteCast(voter, proposalId, support, votes);
    }

    /// @notice Updates the quorum votes required, can only be executed via a proposal
    /// @param newQuorumVotes new quorum votes required
    /// @dev emit:UpdateQuorumVotes
    function updateQuorumVotes(uint96 newQuorumVotes) external {
        require(msg.sender == address(this), "Unauthorized caller");
        quorumVotes = newQuorumVotes;
        emit UpdateQuorumVotes(newQuorumVotes);
    }

    /// @notice Updates the proposal threshold required, can only be executed via a proposal
    /// @param newProposalThreshold new proposal threshold
    /// @dev emit:UpdateProposalThreshold
    function updateProposalThreshold(uint96 newProposalThreshold) external {
        require(msg.sender == address(this), "Unauthorized caller");
        proposalThreshold = newProposalThreshold;
        emit UpdateProposalThreshold(newProposalThreshold);
    }

    /// @notice Updates the voting delay blocks required, can only be executed via a proposal
    /// @param newVotingDelayBlocks new voting delay blocks
    /// @dev emit:UpdateVotingDelayBlocks
    function updateVotingDelayBlocks(uint32 newVotingDelayBlocks) external {
        require(msg.sender == address(this), "Unauthorized caller");
        votingDelayBlocks = newVotingDelayBlocks;
        emit UpdateVotingDelayBlocks(newVotingDelayBlocks);
    }

    /// @notice Updates the voting period blocks required, can only be executed via a proposal
    /// @param newVotingPeriodBlocks new voting period blocks
    /// @dev emit:UpdateVotingPeriodBlocks
    function updateVotingPeriodBlocks(uint32 newVotingPeriodBlocks) external {
        require(msg.sender == address(this), "Unauthorized caller");
        require(newVotingPeriodBlocks >= MIN_VOTING_PERIOD_BLOCKS, "Below min voting period");
        votingPeriodBlocks = newVotingPeriodBlocks;
        emit UpdateVotingPeriodBlocks(newVotingPeriodBlocks);
    }

    /// @dev Hidden public method
    function __abdicate() external {
        require(msg.sender == guardian, "GovernorAlpha::__abdicate: sender must be gov guardian");
        guardian = address(0);
        emit Abdicate();
    }

    /// @notice Transfers guardian role to a new guardian
    /// @param newGuardian address to transfer role to
    function __transferGuardian(address newGuardian) external {
        require(
            msg.sender == guardian,
            "GovernorAlpha::__transferGuardian: sender must be gov guardian"
        );
        require(newGuardian != address(0), "Cannot transfer to zero address");

        guardian = newGuardian;
        emit TransferGuardian(newGuardian);
    }

    /// @dev Overflow check for adding votes
    function _add96(uint96 a, uint96 b) private pure returns (uint96) {
        uint96 c = a + b;
        require(c >= a, "addition overflow");
        return c;
    }

    /// @dev Overflow check for adding block numbers
    function _add32(uint32 a, uint32 b) private pure returns (uint32) {
        uint32 c = a + b;
        require(c >= a, "addition overflow");
        return c;
    }

    /// @dev Helper method for signature check
    function _getChainId() private pure returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
}
