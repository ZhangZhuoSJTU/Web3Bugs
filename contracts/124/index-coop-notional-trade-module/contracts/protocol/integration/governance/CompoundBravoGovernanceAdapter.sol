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
 * @title CompoundBravoGovernanceAdapter
 * @author Set Protocol
 *
 * Governance adapter for Compound Bravo governance system that returns data for voting, delegating and making proposals
 */
contract CompoundBravoGovernanceAdapter {

    /* ============ Constants ============ */

    // Signature of the propose function in Compound Governor Bravo. This is used to encode the calldata for the propose function
    string public constant PROPOSE_SIGNATURE = "propose(address[],uint256[],string[],bytes[],string)";
    
    // Signature of the delegate function in Compound Governor Bravo
    string public constant DELEGATE_SIGNATURE = "delegate(address)";

    address public constant ZERO_ADDRESS = 0x0000000000000000000000000000000000000000;

    /* ============ State Variables ============ */

    // Address of governance token
    address public immutable governanceToken;

    // Address of Compound Governor Bravo contract
    address public immutable governorBravo;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _governorBravo    Address of Governor Bravo contract
     * @param _governanceToken  Address of governance token
     */
    constructor(address _governorBravo, address _governanceToken) public {
        governorBravo = _governorBravo;
        governanceToken = _governanceToken;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Generates the calldata to vote on a proposal. Bytes data paramater is unused in Compound
     *
     * @param _proposalId           ID of the proposal to vote on
     * @param _support              Boolean indicating whether to support proposal
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of ETH (Set to 0)
     * @return bytes                Propose calldata
     */
    function getVoteCalldata(uint256 _proposalId, bool _support, bytes memory /* _data */) external view returns (address, uint256, bytes memory) {
        // castVote(uint256 _proposalId, uint8 supportNumber)
        uint8 supportNumber = _support ? 1 : 0;
        bytes memory callData = abi.encodeWithSignature("castVote(uint256,uint8)", _proposalId, supportNumber);

        return (governorBravo, 0, callData);
    }

    /**
     * Generates the calldata to delegate votes to another ETH address. Self and zero address allowed, which is equivalent to registering and revoking in Compound
     * like governance systems.
     *
     * @param _delegatee            Address of the delegatee
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of ETH (Set to 0)
     * @return bytes                Propose calldata
     */
    function getDelegateCalldata(address _delegatee) external view returns (address, uint256, bytes memory) {
        // delegate(address _delegatee)
        bytes memory callData = abi.encodeWithSignature(DELEGATE_SIGNATURE, _delegatee);

        return (governanceToken, 0, callData);
    }

    /**
     * Generates the calldata to register for voting. This is equivalent to delegating to the SetToken address in Compound.
     *
     * @param _setToken             Address of SetToken
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of ETH (Set to 0)
     * @return bytes                Propose calldata
     */
    function getRegisterCalldata(address _setToken) external view returns (address, uint256, bytes memory) {
        // delegate(address _delegatee)
        bytes memory callData = abi.encodeWithSignature(DELEGATE_SIGNATURE, _setToken);

        return (governanceToken, 0, callData);
    }

    /**
     * Generates the calldata to revoke voting. This is equivalent to delegating to the zero address in Compound.
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of ETH (Set to 0)
     * @return bytes                Propose calldata
     */
    function getRevokeCalldata() external view returns (address, uint256, bytes memory) {
        // delegate(address _delegatee)
        bytes memory callData = abi.encodeWithSignature(DELEGATE_SIGNATURE, ZERO_ADDRESS);

        return (governanceToken, 0, callData);
    }

    /**
     * Generates the calldata to create a new proposal
     *
     * @param _proposalData         Byte data containing data about the proposal
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of ETH (Set to 0)
     * @return bytes                Propose calldata
     */
    function getProposeCalldata(bytes memory _proposalData) external view returns (address, uint256, bytes memory) {
        // Decode proposal data
        (
            address[] memory targets,
            uint256[] memory values,
            string[] memory signatures,
            bytes[] memory calldatas,
            string memory description
        ) = abi.decode(_proposalData, (address[],uint256[],string[],bytes[],string));

        // propose(address[],uint256[],string[],bytes[],string)
        bytes memory callData = abi.encodeWithSignature(PROPOSE_SIGNATURE, targets, values, signatures, calldatas, description);

        return (governorBravo, 0, callData);
    }
}
