// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.7.4;
pragma abicoder v2;

import {IAaveGovernanceV2} from "./IAaveGovernanceV2.sol";

interface IProposalValidator {
    /**
     * @dev Called to validate a proposal (e.g when creating new proposal in Governance)
     * @param governance Governance Contract
     * @param user Address of the proposal creator
     * @param blockNumber Block Number against which to make the test (e.g proposal creation block -1).
     * @return boolean, true if can be created
     **/
    function validateCreatorOfProposal(
        IAaveGovernanceV2 governance,
        address user,
        uint256 blockNumber
    ) external view returns (bool);

    /**
     * @dev Called to validate the cancellation of a proposal
     * @param governance Governance Contract
     * @param user Address of the proposal creator
     * @param blockNumber Block Number against which to make the test (e.g proposal creation block -1).
     * @return boolean, true if can be cancelled
     **/
    function validateProposalCancellation(
        IAaveGovernanceV2 governance,
        address user,
        uint256 blockNumber
    ) external view returns (bool);

    /**
     * @dev Returns whether a user has enough Proposition Power to make a proposal.
     * @param governance Governance Contract
     * @param user Address of the user to be challenged.
     * @param blockNumber Block Number against which to make the challenge.
     * @return true if user has enough power
     **/
    function isPropositionPowerEnough(
        IAaveGovernanceV2 governance,
        address user,
        uint256 blockNumber
    ) external view returns (bool);

    /**
     * @dev Returns the minimum Proposition Power needed to create a proposition.
     * @param governance Governance Contract
     * @param blockNumber Blocknumber at which to evaluate
     * @return minimum Proposition Power needed
     **/
    function getMinimumPropositionPowerNeeded(
        IAaveGovernanceV2 governance,
        uint256 blockNumber
    ) external view returns (uint256);

    /**
     * @dev Returns whether a proposal passed or not
     * @param governance Governance Contract
     * @param proposalId Id of the proposal to set
     * @return true if proposal passed
     **/
    function isProposalPassed(IAaveGovernanceV2 governance, uint256 proposalId)
        external
        view
        returns (bool);

    /**
     * @dev Check whether a proposal has reached quorum, ie has enough FOR-voting-power
     * Here quorum is not to understand as number of votes reached, but number of for-votes reached
     * @param governance Governance Contract
     * @param proposalId Id of the proposal to verify
     * @return voting power needed for a proposal to pass
     **/
    function isQuorumValid(IAaveGovernanceV2 governance, uint256 proposalId)
        external
        view
        returns (bool);

    /**
     * @dev Check whether a proposal has enough extra FOR-votes than AGAINST-votes
     * FOR VOTES - AGAINST VOTES > VOTE_DIFFERENTIAL * voting supply
     * @param governance Governance Contract
     * @param proposalId Id of the proposal to verify
     * @return true if enough For-Votes
     **/
    function isVoteDifferentialValid(
        IAaveGovernanceV2 governance,
        uint256 proposalId
    ) external view returns (bool);

    /**
     * @dev Calculates the minimum amount of Voting Power needed for a proposal to Pass
     * @param votingSupply Total number of oustanding voting tokens
     * @return voting power needed for a proposal to pass
     **/
    function getMinimumVotingPowerNeeded(uint256 votingSupply)
        external
        view
        returns (uint256);

    /**
     * @dev Get proposition threshold constant value
     * @return the proposition threshold value (100 <=> 1%)
     **/
    function PROPOSITION_THRESHOLD() external view returns (uint256);

    /**
     * @dev Get voting duration constant value
     * @return the voting duration value in seconds
     **/
    function VOTING_DURATION() external view returns (uint256);

    /**
     * @dev Get the vote differential threshold constant value
     * to compare with % of for votes/total supply - % of against votes/total supply
     * @return the vote differential threshold value (100 <=> 1%)
     **/
    function VOTE_DIFFERENTIAL() external view returns (uint256);

    /**
     * @dev Get quorum threshold constant value
     * to compare with % of for votes/total supply
     * @return the quorum threshold value (100 <=> 1%)
     **/
    function MINIMUM_QUORUM() external view returns (uint256);

    /**
     * @dev precision helper: 100% = 10000
     * @return one hundred percents with our chosen precision
     **/
    function ONE_HUNDRED_WITH_PRECISION() external view returns (uint256);
}
