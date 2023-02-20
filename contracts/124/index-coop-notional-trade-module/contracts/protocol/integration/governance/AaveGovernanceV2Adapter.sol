/*
    Copyright 2021 Set Labs Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    SPDX-License-Identifier: Apache License, Version 2.0
*/

pragma solidity 0.6.10;
pragma experimental "ABIEncoderV2";


/**
 * @title AaveGovernanceV2Adapter
 * @author Noah Citron
 *
 * Governance adapter for Aave governance that returns data for voting, delegating, and creating proposals
 */
contract AaveGovernanceV2Adapter {

    /* ============ Constants ============ */

    // Signature of delegate function
    string public constant DELEGATE_SIGNATURE = "delegate(address)";

    // Signature of vote function
    string public constant VOTE_SIGNATURE = "submitVote(uint256,bool)";

    // Signature of propose function
    string public constant PROPOSE_SIGNATURE = "create(address,address[],uint256[],string[],bytes[],bool[],bytes32)";

    /* ============ State Variables ============ */

    // Address of Aave proto governance contract
    address public immutable aaveGovernanceV2;

    // Address of the Aave token
    address public immutable aaveToken;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _aaveGovernanceV2    Address of AAVE Governance V2 contract
     */
    constructor(address _aaveGovernanceV2, address _aaveToken) public {
        aaveGovernanceV2 =  _aaveGovernanceV2;
        aaveToken = _aaveToken;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Generates the calldata to vote on a proposal.
     *
     * @param _proposalId           ID of the proposal to vote on
     * @param _support              Boolean indicating whether to support proposal
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of ETH (Set to 0)
     * @return bytes                Propose calldata
     */
    function getVoteCalldata(uint256 _proposalId, bool _support, bytes memory /* _data */) external view returns (address, uint256, bytes memory) {
        bytes memory callData = abi.encodeWithSignature(VOTE_SIGNATURE, _proposalId, _support);
        return (aaveGovernanceV2, 0, callData);
    }

    /**
     * Generates the calldata to delegate votes to another ETH address. Self and zero address allowed, which is equivalent to registering and revoking in Aave.
     *
     * @param _delegatee            Address of the delegatee
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of ETH (Set to 0)
     * @return bytes                Propose calldata
     */
    function getDelegateCalldata(address _delegatee) external view returns (address, uint256, bytes memory) {
        bytes memory callData = abi.encodeWithSignature(DELEGATE_SIGNATURE, _delegatee);
        return (aaveToken, 0, callData);
    }

    /**
     * Generates the calldata to create a new proposal.
     * The caller must have proposition power higher than PROPOSITION_THRESHOLD to create a proposal.
     * Executor is a contract deployed to validate proposal creation and voting.
     * There two types of proposals and each has it's own executor.
     * Critical proposals that affect governance consensus (long) and proposals affecting only protocol parameters (short).
     * https://docs.aave.com/developers/protocol-governance/governance#proposal-types
     *
     * @param _proposalData         Byte data containing data about the proposal
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of ETH (Set to 0)
     * @return bytes                Propose calldata
     */
    function getProposeCalldata(bytes memory _proposalData) external view returns (address, uint256, bytes memory) {
        (
            address executor,
            address[] memory targets,
            uint256[] memory values,
            string[] memory signatures,
            bytes[] memory calldatas,
            bool[] memory withDelegateCalls,
            bytes32 ipfsHash
        ) = abi.decode(_proposalData, (address,address[],uint256[],string[],bytes[],bool[],bytes32));

        bytes memory callData = abi.encodeWithSignature(
            PROPOSE_SIGNATURE,
            executor,
            targets,
            values,
            signatures,
            calldatas,
            withDelegateCalls,
            ipfsHash
        );

        return (aaveGovernanceV2, 0, callData);
    }

    /**
     * Reverts as AAVE currently does not have a register mechanism in governance
     */
    function getRegisterCalldata(address /* _setToken */) external pure returns (address, uint256, bytes memory) {
        revert("No register available in AAVE governance");
    }

    /**
     * Reverts as AAVE currently does not have a revoke mechanism in governance
     */
    function getRevokeCalldata() external pure returns (address, uint256, bytes memory) {
        revert("No revoke available in AAVE governance");
    }
}
