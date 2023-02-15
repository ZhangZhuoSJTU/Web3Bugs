pragma solidity ^0.5.16;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";

import "../interfaces/IGovernanceParamsProvider.sol";
import "../interfaces/IAssetVotingWeightProvider.sol";
import "../interfaces/IProposalExecutor.sol";
import "../interfaces/IAaveProtoGovernance.sol";


/// @title AaveProtoGovernance
/// @author Aave
/// @notice Smart contract containing voting logic and registering voting proposals.
///  - Allows to granular resolution per proposal
///  - Fixes the voting logic
///  - Keeps all the data related with all the proposals
///  - Allows voters to submit, override or cancel votes directly
///  - Allows relayers to submit, override or cancel votes on behalf of voters
///  - Once the voting and validation periods finish, executes a DELEGATECALL to the proposalExecutor of the
///    corresponding proposal
///  - The creation of a new proposal can only be triggered by an account with a certain amount of AavePropositionPower
contract AaveProtoGovernance is IAaveProtoGovernance {
    using SafeMath for uint256;
    using ECDSA for bytes32;

    struct Voter {
        /// @notice Vote with 0 always as abstain.
        ///  In a YES/NO scenario, YES would be 1, NO would be 2
        uint256 vote;
        /// @notice Weight of the asset coming from the IAssetVotingWeightProvider
        uint256 weight;
        /// @notice Asset balance used to vote
        uint256 balance;
        /// @notice The nonce of the voter address, to protect agains vote replay attacks
        //  It is increased in 1 unit on both voting and cancel vote of an user. When the
        //  user vote overrides his previous vote, it is double increased
        uint256 nonce;
        /// @notice Address of the asset using to vote, locked in the voter address
        IERC20 asset;
    }

    struct Proposal {
        /// @notice Hashed type of the proposal, for example keccak256(UPGRADE_ADDRESS_PROPOSAL)
        bytes32 proposalType;
        /// @notice Count of the current units of votes accumulated until the current moment (each time somebody votes + 1)
        uint256 totalVotes;
        /// @notice Threshold required calculated offchain from the aggregated total supply of the whitelisted
        ///  assets multiplied by the voting weight of each asset
        ///  Example: With 2 whitelisted tokens with 1 and 2 as respective voting weights and 10 000 and 20 000
        ///  respective total supplies, the aggregated voting power would be (10000 * 1) + (20000 * 2) = 50000,
        ///  so a threshold equivalent to the 50% of total voting power would be 25000
        uint256 threshold;
        /// @notice Variable to control how many changes to Voting state are allowed
        /// (both initially from Initializing and from Validating every time the threshold is crossed down
        ///  due to double votes)
        uint256 maxMovesToVotingAllowed;
        /// @notice Current amount of times the proposal went to Voting state
        uint256 movesToVoting;
        /// @notice Minimum number of blocks the proposal needs to be in Voting before being able to change to
        /// Validating
        uint256 votingBlocksDuration;
        /// @notice Minimum number of blocks the proposal needs to be in Validating before being able to be executed
        uint256 validatingBlocksDuration;
        /// @notice Block number where the current status started
        uint256 currentStatusInitBlock;
        /// @notice Block number when the proposal was created
        uint256 initProposalBlock;
        /// @notice Mapping choice id => voting power accumulated in the choice
        mapping(uint256 => uint256) votes;
        /// @notice Mapping of voters: Voting Wallet address => vote information
        mapping(address => Voter) voters;
        /// @notice Smart contract in charge of .execute() a certain payload
        address proposalExecutor;
        /// @notice Status of the proposal
        ProposalStatus proposalStatus;
    }

    /// @notice State Machine
    ///  - Initializing: temporary state during the newProposal() execution, before changing to Voting.
    ///  - Voting: Once newProposal() execution finishes. Voters are able to vote or cancel their votes.
    ///  - Validating: After the voting period ends and the proposal threshold gets crossed by one of the
    ///      allowed choices. During this period, everybody is be able to call challengeVoters() in order
    ///      to invalidate votes result of double-voting attacks. If the threshold is crossed down at any point,
    ///      the state changes again to Voting. The validating period will have a defined time
    ///      length, after which (since the point where the proposal was moved from Voting status)
    ///      the resolveProposal() function could be called
    ///  - Executed: After the proposal is resolved
    enum ProposalStatus {Initializing, Voting, Validating, Executed}

    event ProposalCreated(
        uint256 indexed proposalId,
        bytes32 indexed ipfsHash,
        bytes32 indexed proposalType,
        uint256 propositionPowerOfCreator,
        uint256 threshold,
        uint256 maxMovesToVotingAllowed,
        uint256 votingBlocksDuration,
        uint256 validatingBlocksDuration,
        address proposalExecutor
    );
    event StatusChangeToVoting(uint256 indexed proposalId, uint256 movesToVoting);
    event StatusChangeToValidating(uint256 indexed proposalId);
    event StatusChangeToExecuted(uint256 indexed proposalId);
    event VoteEmitted(
        uint256 indexed proposalId,
        address indexed voter,
        uint256 indexed vote,
        IERC20 asset,
        uint256 weight,
        uint256 balance
    );
    event VoteCancelled(
        uint256 indexed proposalId,
        address indexed voter,
        uint256 indexed vote,
        IERC20 asset,
        uint256 weight,
        uint256 balance,
        uint256 proposalStatusBefore
    );
    event YesWins(uint256 indexed proposalId, uint256 abstainVotingPower, uint256 yesVotingPower, uint256 noVotingPower);
    event NoWins(uint256 indexed proposalId, uint256 abstainVotingPower, uint256 yesVotingPower, uint256 noVotingPower);
    event AbstainWins(uint256 indexed proposalId, uint256 abstainVotingPower, uint256 yesVotingPower, uint256 noVotingPower);

    /// @notice 0: Abstain, 1: YES, 2: NO
    uint256 public constant COUNT_CHOICES = 2;

    /// @notice Taking as reference the LEND token supply, a minimum of 13M of LEND token (1% of supply)
    //  on the AssetVotingWeightProvider) can be set as threshold in a new proposal
    uint256 public constant MIN_THRESHOLD = 13000000 ether;

    /// @notice Minimum number of blocks for a proposal's votingBlocksDuration and validatingBlocksDuration
    uint256 public constant MIN_STATUS_DURATION = 1660;  // ~6h with 13s blocktime

    /// @notice Minimum for a proposal's maxMovesToVotingAllowed
    uint256 public constant MIN_MAXMOVESTOVOTINGALLOWED = 2;

    /// @notice Maximum for a proposal's maxMovesToVotingAllowed
    uint256 public constant MAX_MAXMOVESTOVOTINGALLOWED = 6;

    /// @notice Smart contract holding the global parameters needed in this AaveProtoGovernance
    IGovernanceParamsProvider private govParamsProvider;

    Proposal[] private proposals;

    constructor(IGovernanceParamsProvider _govParamsProvider) public {
        govParamsProvider = _govParamsProvider;
    }

    /// @notice Fallback function, not allowing transfer of ETH
    function() external payable {
        revert("ETH_TRANSFER_NOT_ALLOWED");
    }

    /// @notice Registers a new proposal
    ///  - Allowed only for holders of aavePropositionPower with more than 100/propositionPowerThreshold % of the total supply
    ///  - It sets the proposalStatus of the proposal to Voting
    /// @param _proposalType Hashed type of the proposal
    /// @param _ipfsHash bytes32-formatted IPFS hash, removed the first 2 bytes of the multihash (multihash identifier)
    /// @param _threshold Threshold required calculated offchain from the aggregated total supply of the whitelisted
    ///                 assets multiplied by the voting weight of each asset
    /// @param _proposalExecutor Smart contract in charge of .execute() a certain payload
    /// @param _votingBlocksDuration Minimum number of blocks the proposal needs to be in Voting before being able
    ///                              to change to Validating
    /// @param _validatingBlocksDuration Minimum number of blocks the proposal needs to be in Validating before being
    ///                                  able to be executed
    /// @param _maxMovesToVotingAllowed Variable to control how many changes to Voting state are allowed
    function newProposal(
        bytes32 _proposalType,
        bytes32 _ipfsHash,
        uint256 _threshold,
        address _proposalExecutor,
        uint256 _votingBlocksDuration,
        uint256 _validatingBlocksDuration,
        uint256 _maxMovesToVotingAllowed
    ) external {
        IERC20 _propositionPower = govParamsProvider.getPropositionPower();
        uint256 _propositionPowerOfCreator = _propositionPower.balanceOf(msg.sender);

        // Creation of block to avoid "Stack too deep"
        {
            uint256 _propositionPowerTotalSupply = _propositionPower.totalSupply();
            require(_propositionPowerTotalSupply > 0 &&
                _propositionPowerOfCreator >= _propositionPowerTotalSupply.div(govParamsProvider.getPropositionPowerThreshold()),
            "INVALID_PROPOSITION_POWER_BALANCE");
            require(_threshold >= MIN_THRESHOLD, "INVALID_THRESHOLD");
            require(_votingBlocksDuration >= MIN_STATUS_DURATION, "INVALID_VOTING_BLOCKS_DURATION");
            require(_validatingBlocksDuration >= MIN_STATUS_DURATION, "INVALID_VALIDATING_BLOCKS_DURATION");
            require(_maxMovesToVotingAllowed >= MIN_MAXMOVESTOVOTINGALLOWED &&
                _maxMovesToVotingAllowed <= MAX_MAXMOVESTOVOTINGALLOWED,
            "INVALID_MAXVOTESTOVOTINGALLOWED");
        }

        uint256 _proposalId = proposals.push(Proposal({
            proposalType: _proposalType,
            totalVotes: 0,
            threshold: _threshold,
            maxMovesToVotingAllowed: _maxMovesToVotingAllowed,
            movesToVoting: 0,
            votingBlocksDuration: _votingBlocksDuration,
            validatingBlocksDuration: _validatingBlocksDuration,
            currentStatusInitBlock: 0,
            initProposalBlock: block.number,
            proposalExecutor: _proposalExecutor,
            proposalStatus: ProposalStatus.Initializing
        })).sub(1);

        internalMoveToVoting(_proposalId);

        emit ProposalCreated(
            _proposalId,
            _ipfsHash,
            _proposalType,
            _propositionPowerOfCreator,
            _threshold,
            _maxMovesToVotingAllowed,
            _votingBlocksDuration,
            _validatingBlocksDuration,
            _proposalExecutor
        );
    }

    /// @notice Verifies the consistency of the action's params and their correct signature
    function verifyParamsConsistencyAndSignature(
        bytes32 _paramsHashByRelayer,
        bytes32 _paramsHashBySigner,
        bytes memory _signature,
        address _signer
    ) public pure {
        require(_paramsHashBySigner == _paramsHashByRelayer, "INCONSISTENT_HASHES");
        require(_signer == _paramsHashByRelayer.toEthSignedMessageHash().recover(_signature), "SIGNATURE_NOT_VALID");
    }

    /// @notice Verifies the nonce of a voter on a proposal
    /// @param _proposalId The id of the proposal
    /// @param _voter The address of the voter
    /// @param _relayerNonce The nonce submitted by the relayer
    function verifyNonce(uint256 _proposalId, address _voter, uint256 _relayerNonce) public view {
        Proposal storage _proposal = proposals[_proposalId];
        require(_proposal.voters[_voter].nonce.add(1) == _relayerNonce, "INVALID_NONCE");
    }

    /// @notice Validates an action submitted by a relayer
    /// @param _paramsHashByRelayer Hash of the params of the action, hashed by the relayer on-chain
    /// @param _paramsHashBySigner Hash of the params of the action, hashed by the signer off-chain, received by the relayer
    /// @param _signature Signature of the hashed params by the signer, created by the signer offchain, received by the relayer
    /// @param _signer The address of the signer
    /// @param _proposalId The id of the proposal
    /// @param _relayerNonce The nonce by the relayer
    function validateRelayAction(
        bytes32 _paramsHashByRelayer,
        bytes32 _paramsHashBySigner,
        bytes memory _signature,
        address _signer,
        uint256 _proposalId,
        uint256 _relayerNonce)
    public view {
        verifyParamsConsistencyAndSignature(_paramsHashByRelayer, _paramsHashBySigner, _signature, _signer);
        verifyNonce(_proposalId, _signer, _relayerNonce);
    }

    /// @notice Internal function to change proposalStatus to Voting
    /// @param _proposalId The id of the proposal
    function internalMoveToVoting(uint256 _proposalId) internal {
        Proposal storage _proposal = proposals[_proposalId];
        _proposal.proposalStatus = ProposalStatus.Voting;
        _proposal.currentStatusInitBlock = block.number;
        _proposal.movesToVoting++;
        emit StatusChangeToVoting(_proposalId, _proposal.movesToVoting);
    }

    /// @notice Internal function to change proposalStatus from Voting to Validating
    /// @param _proposalId The id of the proposal
    function internalMoveToValidating(uint256 _proposalId) internal {
        Proposal storage _proposal = proposals[_proposalId];
        _proposal.proposalStatus = ProposalStatus.Validating;
        _proposal.currentStatusInitBlock = block.number;
        emit StatusChangeToValidating(_proposalId);
    }

    /// @notice Internal function to change proposalStatus from Validating to Executed
    ///  once the proposal is resolved
    /// @param _proposalId The id of the proposal
    function internalMoveToExecuted(uint256 _proposalId) internal {
        Proposal storage _proposal = proposals[_proposalId];
        _proposal.proposalStatus = ProposalStatus.Executed;
        emit StatusChangeToExecuted(_proposalId);
    }

    /// @notice Function called by a voter to submit his vote directly
    function submitVoteByVoter(uint256 _proposalId, uint256 _vote, IERC20 _asset) external {
        internalSubmitVote(_proposalId, _vote, msg.sender, _asset);
    }

    /// @notice Function called by any address relaying signed vote params from another wallet.
    //   Initially this relayer is thought to be a "hot" wallet of the voter,
    ///  allowing this way to keep the voting asset funds in a "cold" wallet, create an offline
    ///  signature with it and forwarding everything to the "hot" wallet to submit.
    ///  This function is completely opened, as the nonce + signature methods protects against
    ///  any malicious actor.
    function submitVoteByRelayer(
        uint256 _proposalId,
        uint256 _vote,
        address _voter,
        IERC20 _asset,
        uint256 _nonce,
        bytes calldata _signature,
        bytes32 _paramsHashByVoter)
    external {
        validateRelayAction(
            keccak256(abi.encodePacked(_proposalId, _vote, _voter, _asset, _nonce)),
            _paramsHashByVoter,
            _signature,
            _voter,
            _proposalId,
            _nonce);
        internalSubmitVote(_proposalId, _vote, _voter, _asset);
    }

    /// @notice Function called by a voter to cancel his vote directly
    /// @param _proposalId The id of the proposal
    function cancelVoteByVoter(uint256 _proposalId) external {
        Proposal storage _proposal = proposals[_proposalId];
        require(_proposal.proposalStatus == ProposalStatus.Voting, "VOTING_STATUS_REQUIRED");
        internalCancelVote(_proposalId, msg.sender);
    }

    /// @notice Same logic as submitVoteByRelayer, but to cancel a current vote by a _voter
    /// @param _proposalId The id of the proposal
    /// @param _nonce The current nonce of the voter in the proposal
    /// @param _voter The address of the voter
    /// @param _signature The signature of the tx, created by the voter and sent to the relayer
    /// @param _paramsHashByVoter Params hash to validate against the signature
    function cancelVoteByRelayer(
        uint256 _proposalId,
        address _voter,
        uint256 _nonce,
        bytes calldata _signature,
        bytes32 _paramsHashByVoter)
    external {
        Proposal storage _proposal = proposals[_proposalId];
        require(_proposal.proposalStatus == ProposalStatus.Voting, "VOTING_STATUS_REQUIRED");
        validateRelayAction(
            keccak256(abi.encodePacked(_proposalId, _voter, _nonce)),
            _paramsHashByVoter,
            _signature,
            _voter,
            _proposalId,
            _nonce);
        internalCancelVote(_proposalId, _voter);
    }

    /// @notice Internal function to submit a vote. This function is called from
    ///  the external voting functions, by relayers and directly by voters
    ///  - If the voter has already voted, override the vote with the new one
    ///  - The vote is only allowed if the _asset is whitelisted in the assetVotingWeightProvider
    ///  - The _vote needs to be amongst the valid voting choices
    ///  - The _voter voter address needs to have _asset amount locked
    /// @param _proposalId The id of the proposal
    /// @param _vote A value between 0 and COUNT_CHOICES (included)
    /// @param _asset The asset locked in the _voter address, used to vote
    /// @param _voter the voter address, original signer of the transaction
    function internalSubmitVote(uint256 _proposalId, uint256 _vote, address _voter, IERC20 _asset) internal {
        Proposal storage _proposal = proposals[_proposalId];
        require(_proposal.proposalStatus == ProposalStatus.Voting, "VOTING_STATUS_REQUIRED");
        uint256 _assetVotingWeight = govParamsProvider.getAssetVotingWeightProvider().getVotingWeight(_asset);
        require(_assetVotingWeight != 0, "ASSET_NOT_LISTED");
        require(_vote <= COUNT_CHOICES, "INVALID_VOTE_PARAM");
        uint256 _voterAssetBalance = _asset.balanceOf(_voter);
        require(_voterAssetBalance > 0, "INVALID_VOTER_BALANCE");

        // If the voter is replacing a previous vote, cancel the previous one first, to avoid double counting
        if (address(_proposal.voters[_voter].asset) != address(0)) {
            internalCancelVote(_proposalId, _voter);
        }

        uint256 _assetWeight = _assetVotingWeight;
        uint256 _votingPower = _voterAssetBalance.mul(_assetWeight);
        _proposal.totalVotes = _proposal.totalVotes.add(1);
        _proposal.votes[_vote] = _votingPower.add(_proposal.votes[_vote]);
        Voter storage voter = _proposal.voters[_voter];
        voter.vote = _vote;
        voter.weight = _assetWeight;
        voter.balance = _voterAssetBalance;
        voter.asset = _asset;
        voter.nonce = voter.nonce.add(1);

        emit VoteEmitted(_proposalId, _voter, _vote, voter.asset, _assetWeight, _voterAssetBalance);

        tryToMoveToValidating(_proposalId);
    }

    /// @notice Function to move to Validating the proposal in the case the last vote action
    ///  was done before the required votingBlocksDuration passed
    /// @param _proposalId The id of the proposal
    function tryToMoveToValidating(uint256 _proposalId) public {
        Proposal storage _proposal = proposals[_proposalId];
        require(_proposal.proposalStatus == ProposalStatus.Voting, "VOTING_STATUS_REQUIRED");
        if (_proposal.currentStatusInitBlock.add(_proposal.votingBlocksDuration) <= block.number) {
            for (uint256 i = 0; i <= COUNT_CHOICES; i++) {
                if (_proposal.votes[i] > _proposal.threshold) {
                    internalMoveToValidating(_proposalId);
                    return;
                }
            }
        }
    }

    /// @notice Internal fuction to cancel a vote. This function is called from
    ///  the external cancel vote functions (by relayers and directly by voters),
    ///  from challengeVoters() and from internalSubmitVote()
    /// @param _proposalId The id of the proposal
    /// @param _voter the voter address, original signer of the transaction
    function internalCancelVote(uint256 _proposalId, address _voter) internal {
        Proposal storage _proposal = proposals[_proposalId];
        Voter storage voter = _proposal.voters[_voter];
        Voter memory _cachedVoter = voter;

        require(_cachedVoter.balance > 0, "VOTER_WITHOUT_VOTE");

        _proposal.votes[_cachedVoter.vote] = _proposal.votes[_cachedVoter.vote].sub(
            _cachedVoter.balance.mul(
                _cachedVoter.weight
            )
        );
        _proposal.totalVotes = _proposal.totalVotes.sub(1);
        voter.weight = 0;
        voter.balance = 0;
        voter.vote = 0;
        voter.asset = IERC20(address(0));
        voter.nonce = voter.nonce.add(1);
        emit VoteCancelled(
            _proposalId,
            _voter,
            _cachedVoter.vote,
            _cachedVoter.asset,
            _cachedVoter.weight,
            _cachedVoter.balance,
            uint256(_proposal.proposalStatus)
        );
    }

    /// @notice Called during the Validating period in order to cancel invalid votes
    ///  where the voter was trying a double-voting attack
    /// @param _proposalId The id of the proposal
    /// @param _voters List of voters to challenge
    function challengeVoters(uint256 _proposalId, address[] calldata _voters) external {

        Proposal storage _proposal = proposals[_proposalId];
        require(_proposal.proposalStatus == ProposalStatus.Validating, "VALIDATING_STATUS_REQUIRED");

        for (uint256 i = 0; i < _voters.length; i++) {
            address _voterAddress = _voters[i];
            Voter memory _voter = _proposal.voters[_voterAddress];
            uint256 _voterAssetBalance = _voter.asset.balanceOf(_voterAddress);
            if (_voterAssetBalance < _voter.balance) {
                internalCancelVote(_proposalId, _voterAddress);
            }
        }

        if (_proposal.movesToVoting < _proposal.maxMovesToVotingAllowed &&
            _proposal.votes[getLeadingChoice(_proposalId)] < _proposal.threshold) {
            internalMoveToVoting(_proposalId);
        }
    }

    /// @notice Function to resolve a proposal
    ///  - It only validates that the state is correct and the validating minimum blocks have passed,
    ///    as at that point, the % of the leading option doesn't matter
    ///  - If the resolution is YES, do a DELEGATECALL to the execute() of the proposalExecutor of the proposal
    ///  - If the resolution is ABSTAIN or NO, just change the state to Executed
    /// @param _proposalId The id of the proposal
    function resolveProposal(uint256 _proposalId) external {
        Proposal storage _proposal = proposals[_proposalId];

        require(_proposal.proposalStatus == ProposalStatus.Validating, "VALIDATING_STATUS_REQUIRED");
        require(_proposal.currentStatusInitBlock.add(_proposal.validatingBlocksDuration) <= block.number, "NOT_ENOUGH_BLOCKS_IN_VALIDATING");
        require(_proposal.initProposalBlock.add(getLimitBlockOfProposal(_proposalId)) >= block.number, "BLOCK_ABOVE_THE_PROPOSAL_LIMIT");

        uint256 _leadingChoice = getLeadingChoice(_proposalId);

        if (_leadingChoice == 1) {
            (bool _success,) = _proposal.proposalExecutor.delegatecall(abi.encodeWithSignature("execute()"));
            require(_success, "resolveProposal(). DELEGATECALL_REVERTED");
            emit YesWins(_proposalId, _proposal.votes[0], _proposal.votes[1], _proposal.votes[2]);
        } else if (_leadingChoice == 2) {
            emit NoWins(_proposalId, _proposal.votes[0], _proposal.votes[1], _proposal.votes[2]);
        } else {
            emit AbstainWins(_proposalId, _proposal.votes[0], _proposal.votes[1], _proposal.votes[2]);
        }
        internalMoveToExecuted(_proposalId);
    }

    /// @notice Return the limit block of the proposal from where it will not be possible to resolve it anymore
    ///  - The double of the sum(voting blocks, validating blocks) multiplied by the maxMovesToVotingAllowed
    /// @param _proposalId The id of the proposal
    /// @return uint256 The limit block number
    function getLimitBlockOfProposal(uint256 _proposalId) public view returns(uint256 _limitBlockProposal) {
        Proposal memory _proposal = proposals[_proposalId];
        uint256 _maxMovesToVotingAllowed = _proposal.maxMovesToVotingAllowed;
        uint256 _votingBlocksDuration = _proposal.votingBlocksDuration;
        uint256 _validatingBlocksDuration = _proposal.validatingBlocksDuration;
        _limitBlockProposal = _maxMovesToVotingAllowed.mul(2).mul(
            _votingBlocksDuration.add(_validatingBlocksDuration)
        );
    }

    /// @notice Gets the current leading choice in votes
    /// @param _proposalId The id of the proposal
    /// @return uint256 The numeric reference of the choice
    function getLeadingChoice(uint256 _proposalId) public view returns(uint256) {
        uint256 _leadingChoice = 0;
        uint256 _tempCandidate = 0;
        Proposal storage _proposal = proposals[_proposalId];
        for (uint256 i = 0; i <= COUNT_CHOICES; i++) {
            if (_proposal.votes[i] > _tempCandidate) {
                _leadingChoice = i;
                _tempCandidate = _proposal.votes[i];
            }
        }
        return _leadingChoice;
    }

    /// @notice Get the basic data of a proposal
    /// @param _proposalId The id of the proposal
    /// @return Proposal The basic data of the proposal
    function getProposalBasicData(uint256 _proposalId) external view returns(
        uint256 _totalVotes,
        uint256 _threshold,
        uint256 _maxMovesToVotingAllowed,
        uint256 _movesToVoting,
        uint256 _votingBlocksDuration,
        uint256 _validatingBlocksDuration,
        uint256 _currentStatusInitBlock,
        uint256 _initProposalBlock,
        uint256 _proposalStatus,
        address _proposalExecutor,
        bytes32 _proposalType
    ) {
        require(_proposalId < proposals.length, "INVALID_PROPOSAL_ID");
        Proposal storage _proposal = proposals[_proposalId];
        _totalVotes = _proposal.totalVotes;
        _threshold = _proposal.threshold;
        _maxMovesToVotingAllowed = _proposal.maxMovesToVotingAllowed;
        _movesToVoting = _proposal.movesToVoting;
        _votingBlocksDuration = _proposal.votingBlocksDuration;
        _validatingBlocksDuration = _proposal.validatingBlocksDuration;
        _currentStatusInitBlock = _proposal.currentStatusInitBlock;
        _initProposalBlock = _proposal.initProposalBlock;
        _proposalStatus = uint256(_proposal.proposalStatus);
        _proposalExecutor = _proposal.proposalExecutor;
        _proposalType = _proposal.proposalType;
    }

    /// @notice Get the voting data of a voter on a particular proposal
    /// @param _proposalId The id of the proposal
    /// @param _voterAddress _voterAddress The address of the voter
    /// @return Voter The data of the voter
    function getVoterData(uint256 _proposalId, address _voterAddress) external view returns(
        uint256 _vote,
        uint256 _weight,
        uint256 _balance,
        uint256 _nonce,
        IERC20 _asset
    ) {
        require(_proposalId < proposals.length, "INVALID_PROPOSAL_ID");
        Voter storage _voter = proposals[_proposalId].voters[_voterAddress];
        _vote = _voter.vote;
        _weight = _voter.weight;
        _balance = _voter.balance;
        _nonce = _voter.nonce;
        _asset = _voter.asset;
    }

    /// @notice Get the total votes-related data of a proposal
    /// @param _proposalId The id of the proposal
    /// @return uint256[3] The array with the accumulated voting power for every choice (ABSTAIN, YES, NO)
    function getVotesData(uint256 _proposalId) external view returns(uint256[3] memory) {
        require(_proposalId < proposals.length, "INVALID_PROPOSAL_ID");
        Proposal storage _proposal = proposals[_proposalId];
        uint256[3] memory _votes = [_proposal.votes[0],_proposal.votes[1],_proposal.votes[2]];
        return _votes;
    }

    /// @notice Return the address of the govParamsProvider
    /// @return address The address of the govParamsProvider
    function getGovParamsProvider() external view returns(address _govParamsProvider) {
        return address(govParamsProvider);
    }

}