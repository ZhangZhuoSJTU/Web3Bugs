// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.7.4;
pragma abicoder v2;

import {IAaveGovernanceV2} from "./IAaveGovernanceV2.sol";
import {
    IExecutorWithTimelock
} from "./IExecutorWithTimelock.sol";

interface IGovernanceV2Helper {
    struct ProposalStats {
        uint256 totalVotingSupply;
        uint256 minimumQuorum;
        uint256 minimumDiff;
        uint256 executionTimeWithGracePeriod;
        uint256 proposalCreated;
        uint256 id;
        address creator;
        IExecutorWithTimelock executor;
        address[] targets;
        uint256[] values;
        string[] signatures;
        bytes[] calldatas;
        bool[] withDelegatecalls;
        uint256 startBlock;
        uint256 endBlock;
        uint256 executionTime;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool canceled;
        address strategy;
        bytes32 ipfsHash;
        IAaveGovernanceV2.ProposalState proposalState;
    }

    struct Power {
        uint256 votingPower;
        address delegatedAddressVotingPower;
        uint256 propositionPower;
        address delegatedAddressPropositionPower;
    }

    function getProposals(
        uint256 skip,
        uint256 limit,
        IAaveGovernanceV2 governance
    ) external virtual view returns (ProposalStats[] memory proposalsStats);

    function getProposal(uint256 id, IAaveGovernanceV2 governance)
        external
        virtual
        view
        returns (ProposalStats memory proposalStats);

    function getTokensPower(address user, address[] memory tokens)
        external
        virtual
        view
        returns (Power[] memory power);
}
