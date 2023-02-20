/*
    Copyright 2020 Set Labs Inc.

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
 * @title AaveGovernanceAdapter
 * @author Set Protocol
 *
 * Governance adapter for Aave governance that returns data for voting
 */
contract AaveGovernanceAdapter {

    /* ============ Constants ============ */

    // 1 is a vote for in AAVE
    uint256 public constant VOTE_FOR = 1;

    // 2 represents a vote against in AAVE
    uint256 public constant VOTE_AGAINST = 2;

    /* ============ State Variables ============ */

    // Address of Aave proto governance contract
    address public immutable aaveProtoGovernance;

    // Address of Aave token
    address public immutable aaveToken;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _aaveProtoGovernance    Address of AAVE proto governance contract
     * @param _aaveToken              Address of AAVE token
     */
    constructor(address _aaveProtoGovernance, address _aaveToken) public {
        aaveProtoGovernance = _aaveProtoGovernance;
        aaveToken = _aaveToken;
    }

    /* ============ External Getter Functions ============ */

    /**
     * Generates the calldata to vote on a proposal. If byte data is empty, then vote using AAVE token, otherwise, vote using the asset passed
     * into the function
     *
     * @param _proposalId           ID of the proposal to vote on
     * @param _support              Boolean indicating whether to support proposal
     * @param _data                 Byte data containing the asset to vote with
     *
     * @return address              Target contract address
     * @return uint256              Total quantity of ETH (Set to 0)
     * @return bytes                Propose calldata
     */
    function getVoteCalldata(uint256 _proposalId, bool _support, bytes memory _data) external view returns (address, uint256, bytes memory) {
        uint256 voteValue = _support ? VOTE_FOR : VOTE_AGAINST;
        address asset = _data.length == 0 ? aaveToken : abi.decode(_data, (address));

        // submitVoteByVoter(uint256 _proposalId, uint256 _vote, IERC20 _asset)
        bytes memory callData = abi.encodeWithSignature("submitVoteByVoter(uint256,uint256,address)", _proposalId, voteValue, asset);

        return (aaveProtoGovernance, 0, callData);
    }

    /**
     * Reverts as AAVE currently does not have a delegation mechanism in governance
     */
    function getDelegateCalldata(address /* _delegatee */) external pure returns (address, uint256, bytes memory) {
        revert("No delegation available in AAVE governance");
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

    /**
     * Reverts as creating a proposal is only available to AAVE genesis team
     */
    function getProposeCalldata(bytes memory /* _proposalData */) external pure returns (address, uint256, bytes memory) {
        revert("Creation of new proposal only available to AAVE genesis team");
    }
}
