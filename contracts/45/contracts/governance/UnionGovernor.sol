//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/compatibility/GovernorCompatibilityBravo.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesComp.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";

contract UnionGovernor is GovernorCompatibilityBravo, GovernorVotesComp, GovernorTimelockControl {
    uint256 public proposalCount;
    mapping(address => uint256) public latestProposalIds;

    constructor(ERC20VotesComp _token, TimelockController _timelock)
        Governor("Union Governor")
        GovernorVotesComp(_token)
        GovernorTimelockControl(_timelock)
    // solhint-disable-next-line no-empty-blocks
    {

    }

    function votingDelay() public pure virtual override returns (uint256) {
        return 6575; // 1 day
    }

    function votingPeriod() public pure virtual override returns (uint256) {
        return 46027; // 1 week
    }

    function proposalThreshold() public pure virtual override returns (uint256) {
        return 50000e18;
    }

    function quorum(uint256 blockNumber) public view override returns (uint256) {
        return (token.getPastTotalSupply(blockNumber) * 4e16) / 1e18; //4%
    }

    function getVotes(address account, uint256 blockNumber)
        public
        view
        override(IGovernor, GovernorVotesComp)
        returns (uint256)
    {
        return super.getVotes(account, blockNumber);
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, IGovernor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(IGovernor, Governor, GovernorCompatibilityBravo) returns (uint256) {
        _checkUserLatestProposal();
        proposalCount++;
        uint256 proposalId = hashProposal(targets, values, calldatas, keccak256(bytes(description)));
        latestProposalIds[_msgSender()] = proposalId;
        return super.propose(targets, values, calldatas, description);
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) public override(GovernorCompatibilityBravo) returns (uint256) {
        //Will execute propose(address[] memory targets,uint256[] memory values,bytes[] memory calldatas,string memory description).No additional processing logic is required
        return super.propose(targets, values, signatures, calldatas, description);
    }

    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 weight
    ) internal override(Governor, GovernorCompatibilityBravo) {
        return super._countVote(proposalId, account, support, weight);
    }

    function _quorumReached(uint256 proposalId)
        internal
        view
        override(Governor, GovernorCompatibilityBravo)
        returns (bool)
    {
        return super._quorumReached(proposalId);
    }

    function _voteSucceeded(uint256 proposalId)
        internal
        view
        override(Governor, GovernorCompatibilityBravo)
        returns (bool)
    {
        return super._voteSucceeded(proposalId);
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor, IERC165, GovernorTimelockControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _checkUserLatestProposal() private view {
        uint256 latestProposalId = latestProposalIds[_msgSender()];
        if (latestProposalId != 0) {
            ProposalState proposersLatestProposalState = state(latestProposalId);
            require(proposersLatestProposalState != ProposalState.Active, "Governor: found an already active proposal");
            require(
                proposersLatestProposalState != ProposalState.Pending,
                "Governor: found an already pending proposal"
            );
        }
    }
}
