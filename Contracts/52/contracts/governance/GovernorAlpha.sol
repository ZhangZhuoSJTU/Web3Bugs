// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.9;
pragma experimental ABIEncoderV2;

import "../interfaces/governance/ITimelock.sol";
import "../interfaces/x-vader/IXVader.sol";

/**
 * @dev Implementation of {GovernorAlpha} contract.
 *
 * The GovernorAlpha contract allows creation of proposals by anyone
 * by depositing xVader (1000 xVader initially).
 *
 * Anyone can vote on the created proposals utilizing their xVader weight in
 * xVader contract.
 *
 * Only 1 proposal can be active at a time by a particular proposer.
 *
 * A proposal is queued when it succeeds and can be executed after a cool-off
 * time period specified by {delay} in the Timelock contract.
 *
 * A proposal can be cancelled by a {guardian} if it has not been already
 * executed.
 *
 * A proposal can be vetoed by {council} while its state is active/pending
 * and a proposal vetoed with success is also queued at the same time.
 */
contract GovernorAlpha {
    // The name of this contract
    string public constant name = "Vader Governor Alpha";

    // The address of the Vader Protocol Timelock
    ITimelock public timelock;

    // The address of the Governor Guardian
    address public guardian;

    // The total number of proposals
    uint256 public proposalCount;

    // address of xVader token
    IXVader public immutable xVader;

    // address of fee receiver
    address public feeReceiver;

    // amount of fee deducted when proposing proposal
    uint256 public feeAmount;

    // address of council that is allowed to veto on proposals
    address public council;

    /**
     * @dev {Proposal} struct contains parameters for a single proposal.
     * id: Unique id for looking up a proposal.
     * canceled: Flag marking whether the proposal has been canceled.
     * executed: Flag marking whether the proposal has been executed.
     * proposer: Creator of the proposal
     * eta: The timestamp that the proposal will be available for execution, set once the vote succeeds
     * targets: the ordered list of target addresses for calls to be made
     * values: The ordered list of values (i.e. msg.value) to be passed to the calls to be made
     * signatures: The ordered list of function signatures to be called
     * calldatas: The ordered list of calldata to be passed to each call
     * startBlock: startBlock: The block at which voting begins: holders must delegate their votes prior to this block
     * endBlock: The block at which voting ends: votes must be cast prior to this block
     * forVotes: Current number of votes in favor of this proposal
     * againstVotes: Current number of votes in opposition to this proposal
     * receipts: Receipts of ballots for the entire set of voters
     * vetoStatus: Veto status if the proposal has been vetoed by council in favor or against
     */
    struct Proposal {
        uint256 id;
        bool canceled;
        bool executed;
        address proposer;
        uint256 eta;
        address[] targets;
        uint256[] values;
        string[] signatures;
        bytes[] calldatas;
        uint256 startBlock;
        uint256 endBlock;
        uint224 forVotes;
        uint224 againstVotes;
        VetoStatus vetoStatus;
        mapping(address => Receipt) receipts;
    }

    /**
     * @dev {Receipt} struct contains parameters for a voter against a particular proposal
     * and is a ballot receipt record for a voter.
     *
     * hasVoted: Whether or not a vote has been casted
     * support: Whether or not the voter supports the proposal
     * votes: The number of votes the voter had, which were cast
     */
    struct Receipt {
        bool hasVoted;
        bool support;
        uint224 votes;
    }

    /**
     * @dev {VetoStatus} contains parameters representing if a proposal has been vetoed by council
     *
     * hasBeenVetoed: Whether proposal has been vetoed or not
     * support: Whether veto is in favor or against of proposal
     */
    struct VetoStatus {
        bool hasBeenVetoed;
        bool support;
    }

    // Possible states that a proposal may be in
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }

    // The official record of all proposals ever proposed
    mapping(uint256 => Proposal) public proposals;

    // The latest proposal for each proposer
    mapping(address => uint256) public latestProposalIds;

    // The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,uint256 chainId,address verifyingContract)"
        );

    // The EIP-712 typehash for the ballot struct used by the contract
    bytes32 public constant BALLOT_TYPEHASH =
        keccak256("Ballot(uint256 proposalId,bool support)");

    // An event emitted when a new proposal is created
    event ProposalCreated(
        uint256 id,
        address proposer,
        address[] targets,
        uint256[] values,
        string[] signatures,
        bytes[] calldatas,
        uint256 startBlock,
        uint256 endBlock,
        string description
    );

    // An event emitted when a vote has been cast on a proposal
    event VoteCast(
        address voter,
        uint256 proposalId,
        bool support,
        uint256 votes
    );

    // An event emitted when a proposal has been canceled
    event ProposalCanceled(uint256 id);

    // An event emitted when a proposal has been queued in the Timelock
    event ProposalQueued(uint256 id, uint256 eta);

    // An event emitted when a proposal has been executed in the Timelock
    event ProposalExecuted(uint256 id);

    // An event emitted when fee receiver is changed
    event FeeReceiverChanged(address oldFeeReceiver, address newFeeReceiver);

    // An event emitted when fee amount is changed
    event FeeAmountChanged(uint256 oldFeeAmount, uint256 newFeeAmount);

    // An event emitted when a proposal has been vetoed by the council
    event ProposalVetoed(uint256 proposalId, bool support);

    // An event emitted when council is changed
    event CouncilChanged(address oldCouncil, address newCouncil);

    /* ========== CONSTRUCTOR ========== */

    /**
     * @dev Initializes the contract's state setting xVader, fee receiver,
     * council and guardian addresses along with the fee amount.
     *
     * It performs sanity checks for the address type parameters against zero
     * address values.
     */
    constructor(
        address guardian_,
        address xVader_,
        address feeReceiver_,
        uint256 feeAmount_,
        address council_
    ) {
        require(
            xVader_ != address(0),
            "GovernorAlpha::constructor: xVader address is zero"
        );

        require(
            guardian_ != address(0) &&
                feeReceiver_ != address(0) &&
                council_ != address(0),
            "GovernorAlpha::constructor: guardian, feeReceiver or council cannot be zero"
        );

        guardian = guardian_;
        xVader = IXVader(xVader_);
        feeReceiver = feeReceiver_;
        feeAmount = feeAmount_;
        council = council_;

        emit FeeReceiverChanged(address(0), feeReceiver_);
        emit FeeAmountChanged(0, feeAmount_);
    }

    /* ========== VIEWS ========== */

    // The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
    function quorumVotes(uint256 blockNumber) public view returns (uint256) {
        return (xVader.getPastTotalSupply(blockNumber) * 4) / 100; // 4% of xVader's supply at the time of proposal creation.
    }

    // The maximum number of actions that can be included in a proposal
    function proposalMaxOperations() public pure returns (uint256) {
        return 10; // 10 actions
    }

    // The delay before voting on a proposal may take place, once proposed
    function votingDelay() public pure returns (uint256) {
        return 1; // 1 block
    }

    // The duration of voting on a proposal, in blocks
    function votingPeriod() public pure virtual returns (uint256) {
        return 17280; // ~3 days in blocks (assuming 15s blocks)
    }

    /**
     * @dev Returns the actions contained in a proposal with id {proposalId}.
     */
    function getActions(uint256 proposalId)
        public
        view
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

    /**
     * @dev Returns receipt of the {voter} against the proposal with id {proposalId}.
     */
    function getReceipt(uint256 proposalId, address voter)
        public
        view
        returns (Receipt memory)
    {
        return proposals[proposalId].receipts[voter];
    }

    /**
     * @dev Returns the current state of the proposal with id {proposalId}.
     *
     * Requirements:
     * - The {proposalId} should be greater than 0
     * - The {proposalId} should be less than or equal to {proposalCount}
     */
    function state(uint256 proposalId) public view returns (ProposalState) {
        require(
            proposalCount >= proposalId && proposalId > 0,
            "GovernorAlpha::state: invalid proposal id"
        );

        Proposal storage proposal = proposals[proposalId];
        if (proposal.canceled) return ProposalState.Canceled;

        if (proposal.vetoStatus.hasBeenVetoed) {
            // proposal has been vetoed
            uint256 _eta = proposal.eta;

            // proposal has been vetoed in favor, so considered succeeded
            if (proposal.vetoStatus.support && _eta == 0)
                return ProposalState.Succeeded;

            // proposal has been vetoed against, so considered defeated
            if (_eta == 0) return ProposalState.Defeated;
        } else {
            // proposal has not been vetoed, normal flow ensues
            if (block.number <= proposal.startBlock)
                return ProposalState.Pending;

            if (block.number <= proposal.endBlock) return ProposalState.Active;

            if (
                proposal.forVotes <= proposal.againstVotes ||
                proposal.forVotes < quorumVotes(proposal.startBlock)
            ) return ProposalState.Defeated;

            if (proposal.eta == 0) return ProposalState.Succeeded;
        }

        if (proposal.executed) return ProposalState.Executed;

        if (block.timestamp >= proposal.eta + timelock.GRACE_PERIOD())
            return ProposalState.Expired;

        return ProposalState.Queued;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @dev Sets timelock state variable. Contracts {GovernorAlpha} and
     * {Timelock} have circular dependencies upon each other and constructors
     * cannot be used to set them, hence this function is introduced to set
     * {Timelock} in {GovernorAlpha} after it has been deployed.
     *
     * Requirements:
     * - only guardian can call this function
     */
    function setTimelock(address _timelock) external onlyGuardian {
        require(
            _timelock != address(0),
            "GovernorAlpha::initTimelock: _timelock cannot be zero address"
        );
        timelock = ITimelock(_timelock);
    }

    /**
     * @dev Allows any to make a proposal by depositing {feeAmount} xVader.
     * It accepts targets along with the values, signature and calldatas
     * for the actions to perform if the proposal succeeds.
     *
     * Requirements:
     * - targets, values, signatures and calldatas arrays' lengths must be greater
     *   than zero, less than {proposalMaxOperations} and are the same.
     * - the caller must approve {feeAmount} xVader to this contract prior to call.
     * - the caller must not have an active/pending proposal.
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) public returns (uint256 proposalId) {
        require(
            targets.length == values.length &&
                targets.length == signatures.length &&
                targets.length == calldatas.length,
            "GovernorAlpha::propose: proposal function information arity mismatch"
        );
        require(
            targets.length != 0,
            "GovernorAlpha::propose: must provide actions"
        );
        require(
            targets.length <= proposalMaxOperations(),
            "GovernorAlpha::propose: too many actions"
        );

        xVader.transferFrom(msg.sender, feeReceiver, feeAmount);

        uint256 latestProposalId = latestProposalIds[msg.sender];
        if (latestProposalId != 0) {
            ProposalState proposersLatestProposalState = state(
                latestProposalId
            );
            require(
                proposersLatestProposalState != ProposalState.Active,
                "GovernorAlpha::propose: one live proposal per proposer, found an already active proposal"
            );
            require(
                proposersLatestProposalState != ProposalState.Pending,
                "GovernorAlpha::propose: one live proposal per proposer, found an already pending proposal"
            );
        }

        uint256 startBlock = block.number + votingDelay();
        uint256 endBlock = startBlock + votingPeriod();

        proposalId = ++proposalCount;
        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.targets = targets;
        newProposal.values = values;
        newProposal.signatures = signatures;
        newProposal.calldatas = calldatas;
        newProposal.startBlock = startBlock;
        newProposal.endBlock = endBlock;

        latestProposalIds[msg.sender] = proposalId;

        emit ProposalCreated(
            proposalId,
            msg.sender,
            targets,
            values,
            signatures,
            calldatas,
            startBlock,
            endBlock,
            description
        );
    }

    /**
     * @dev Queues a proposal by setting the hashes of its actions in {Timelock} contract.
     * It also determines 'eta' for the proposal by adding timestamp to {delay} in {Timelock}
     * and sets it against the proposal in question.
     *
     * Requirements:
     * - the proposal in question must have succeeded either through majority for-votes
     *   or has been vetoed in its favour.
     */
    function queue(uint256 proposalId) public {
        require(
            state(proposalId) == ProposalState.Succeeded,
            "GovernorAlpha::queue: proposal can only be queued if it is succeeded"
        );
        Proposal storage proposal = proposals[proposalId];
        uint256 eta = block.timestamp + timelock.delay();

        uint256 length = proposal.targets.length;
        for (uint256 i = 0; i < length; i++) {
            _queueOrRevert(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                eta
            );
        }
        proposal.eta = eta;
        emit ProposalQueued(proposalId, eta);
    }

    /**
     * @dev Executes a proposal after it has been queued and cool-off time has elapsed.
     * It sets the {executed} status of the proposal to 'true'.
     *
     * Requirements:
     * - the proposal in question must have been quened and cool-off time has elapsed
     * - none of the actions of the proposal revert upon execution
     */
    function execute(uint256 proposalId) public payable {
        require(
            state(proposalId) == ProposalState.Queued,
            "GovernorAlpha::execute: proposal can only be executed if it is queued"
        );
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;
        uint256 length = proposal.targets.length;
        for (uint256 i = 0; i < length; i++) {
            timelock.executeTransaction{value: proposal.values[i]}(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }
        emit ProposalExecuted(proposalId);
    }

    /**
     * @dev Casts vote by {msg.sender}.
     * It calls the internal function `_castVote` to perform vote casting.
     */
    function castVote(uint256 proposalId, bool support) public {
        return _castVote(msg.sender, proposalId, support);
    }

    /**
     * @dev Called by a relayer to cast vote by a message signer.
     *
     * Requirements:
     * - {signatory} retrieved must not be a zero address
     */
    function castVoteBySig(
        uint256 proposalId,
        bool support,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                getChainId(),
                address(this)
            )
        );

        bytes32 structHash = keccak256(
            abi.encode(BALLOT_TYPEHASH, proposalId, support)
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );

        address signatory = ecrecover(digest, v, r, s);

        require(
            signatory != address(0),
            "GovernorAlpha::castVoteBySig: invalid signature"
        );

        return _castVote(signatory, proposalId, support);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @dev Changes the {feeReceiver}.
     *
     * Requirements:
     * - only guardian can call
     */
    function changeFeeReceiver(address feeReceiver_) external onlyGuardian {
        emit FeeReceiverChanged(feeReceiver, feeReceiver_);
        feeReceiver = feeReceiver_;
    }

    /**
     * @dev Changes the {feeAmount}.
     *
     * Requirements:
     * - only guardian can call
     */
    function changeFeeAmount(uint256 feeAmount_) external onlyGuardian {
        emit FeeAmountChanged(feeAmount, feeAmount_);
        feeAmount = feeAmount_;
    }

    /**
     * @dev Allows vetoeing of a proposal in favor or against it.
     * It also queues a proposal if it has been vetoed in favor of it and.
     * sets the veto status of the proposal.
     *
     * Requirements:
     * - can only be called by {council}
     * - proposal being vetoed must be active or pending
     * - none of the actions in proposal being vetoed point to the contract
     *   itself. This to restrict council from vetoing a proposal intended
     *   to change council.
     */
    function veto(uint256 proposalId, bool support) external onlyCouncil {
        ProposalState _state = state(proposalId);
        require(
            _state == ProposalState.Active || _state == ProposalState.Pending,
            "GovernorAlpha::veto: Proposal can only be vetoed when active"
        );

        Proposal storage proposal = proposals[proposalId];
        address[] memory _targets = proposal.targets;
        for (uint256 i = 0; i < _targets.length; i++) {
            if (_targets[i] == address(this)) {
                revert(
                    "GovernorAlpha::veto: council cannot veto on proposal having action with address(this) as target"
                );
            }
        }

        VetoStatus storage _vetoStatus = proposal.vetoStatus;
        _vetoStatus.hasBeenVetoed = true;
        _vetoStatus.support = support;

        if (support) {
            queue(proposalId);
        }

        emit ProposalVetoed(proposalId, support);
    }

    /**
     * @dev Changes the {council}.
     *
     * Requirements:
     * - can only be called by {Timelock} contract through a non-vetoeable proposal
     */
    function changeCouncil(address council_) external onlyTimelock {
        emit CouncilChanged(council, council_);
        council = council_;
    }

    /**
     * @dev Cancels the proposal with id {proposalId}.
     * It also sets the {canceled} property of {Proposal} to `true` and
     * removes the proposal's corresponding actions from {Timelock} contract.
     *
     * Requirements:
     * - proposal must not be already executed
     */
    function cancel(uint256 proposalId) public onlyGuardian {
        ProposalState _state = state(proposalId);
        require(
            _state != ProposalState.Executed,
            "GovernorAlpha::cancel: cannot cancel executed proposal"
        );

        Proposal storage proposal = proposals[proposalId];
        proposal.canceled = true;
        uint256 length = proposal.targets.length;
        for (uint256 i = 0; i < length; i++) {
            timelock.cancelTransaction(
                proposal.targets[i],
                proposal.values[i],
                proposal.signatures[i],
                proposal.calldatas[i],
                proposal.eta
            );
        }

        emit ProposalCanceled(proposalId);
    }

    /**
     * @dev Calls {acceptAdmin} on {Timelock} contract and makes the current contract
     * the admin of {Timelock} contract.
     *
     * Requirements:
     * - only guardian can call it
     * - current contract must be the `pendingAdmin` in {Timelock} contract
     */
    function __acceptAdmin() public onlyGuardian {
        timelock.acceptAdmin();
    }

    /**
     * @dev Gives up the guardian role associated with the contract.
     *
     * Requirements:
     * - only callable by guardian
     */
    function __abdicate() public onlyGuardian {
        guardian = address(0);
    }

    /**
     * @dev Queues the transaction to set `pendingAdmin` in {Timelock}.
     *
     * Requirements:
     * - only callable by guardian
     */
    function __queueSetTimelockPendingAdmin(
        address newPendingAdmin,
        uint256 eta
    ) public onlyGuardian {
        timelock.queueTransaction(
            address(timelock),
            0,
            "setPendingAdmin(address)",
            abi.encode(newPendingAdmin),
            eta
        );
    }

    /**
     * @dev Executes the transaction to set `pendingAdmin` in {Timelock}.
     *
     * Requirements:
     * - only callable by guardian
     */
    function __executeSetTimelockPendingAdmin(
        address newPendingAdmin,
        uint256 eta
    ) public onlyGuardian {
        timelock.executeTransaction(
            address(timelock),
            0,
            "setPendingAdmin(address)",
            abi.encode(newPendingAdmin),
            eta
        );
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /**
     * @dev Queues a transaction in {Timelock}.
     *
     * Requirements:
     * - only callable by guardian
     * - transaction is not already queued in {Timelock}
     */
    function _queueOrRevert(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) internal {
        require(
            !timelock.queuedTransactions(
                keccak256(abi.encode(target, value, signature, data, eta))
            ),
            "GovernorAlpha::_queueOrRevert: proposal action already queued at eta"
        );
        timelock.queueTransaction(target, value, signature, data, eta);
    }

    /**
     * @dev Casts vote against proposal with id {proposalId}.
     * It gets the voting weight of voter from {xVader} token contract corresponding to
     * the blocknumber when proposal started and adds those votes to either
     * {forVotes} or {againstVotes} property of {Proposal} depending upon if
     * the voter is voting in favor of or against the proposal.
     *
     * Requirements:
     * - proposal being voted must be active
     * - voter has not already voted against the proposal
     */
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
        Receipt storage receipt = proposal.receipts[voter];

        require(
            !receipt.hasVoted,
            "GovernorAlpha::_castVote: voter already voted"
        );

        // optimistically casting to uint224 as xVader contract performs the checks for
        // votes to not overflow uint224.
        uint224 votes = uint224(xVader.getPastVotes(voter, proposal.startBlock));

        if (support) {
            proposal.forVotes = proposal.forVotes + votes;
        } else {
            proposal.againstVotes = proposal.againstVotes + votes;
        }

        receipt.hasVoted = true;
        receipt.support = support;
        receipt.votes = votes;

        emit VoteCast(voter, proposalId, support, votes);
    }

    // gets the chainid from current network
    function getChainId() internal view returns (uint256 chainId) {
        assembly {
            chainId := chainid()
        }
    }

    /* ========== PRIVATE FUNCTIONS ========== */

    // ensures only {guardian} is able to a particular function.
    function _onlyGuardian() private view {
        require(
            msg.sender == guardian,
            "GovernorAlpha::_onlyGuardian: only guardian can call"
        );
    }

    // ensures only {timelock} is able to a particular function.
    function _onlyTimelock() private view {
        require(
            msg.sender == address(timelock),
            "GovernorAlpha::_onlyTimelock: only timelock can call"
        );
    }

    // ensures only {council} is able to a particular function.
    function _onlyCouncil() private view {
        require(
            msg.sender == council,
            "GovernorAlpha::_onlyCouncil: only council can call"
        );
    }

    /* ========== MODIFIERS ========== */

    /**
     * @dev Throws if invoked by anyone else other than the {guardian}
     */
    modifier onlyGuardian() {
        _onlyGuardian();
        _;
    }

    /**
     * @dev Throws if invoked by anyone else other than the {timelock}
     */
    modifier onlyTimelock() {
        _onlyTimelock();
        _;
    }

    /**
     * @dev Throws if invoked by anyone else other than the {council}
     */
    modifier onlyCouncil() {
        _onlyCouncil();
        _;
    }
}
