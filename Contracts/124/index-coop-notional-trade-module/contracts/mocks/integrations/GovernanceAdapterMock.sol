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
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title GovernanceAdapterMock
 * @author Set Protocol
 *
 * Governance Adapter that doubles as a mock governance contract as well.
 */
contract GovernanceAdapterMock {
    address public delegatee;
    mapping(uint256 => bool) public proposalToVote;
    mapping(uint256 => bool) public proposalCreated;

    /* ============ Constructor ============ */

    constructor(uint256 _initialProposal) public {
        proposalCreated[_initialProposal] = true;
    }

    /* ============ Governance Functions ============ */

    function createProposal(uint256 _proposalId) external {
        proposalCreated[_proposalId] = true;
    }

    function castVote(uint256 _proposalId, bool _support) external {
        proposalToVote[_proposalId] = _support;
    }

    function delegate(address _delegatee) external {
        delegatee = _delegatee;
    }

    /* ============ Adapter Functions ============ */

    function getVoteCalldata(
        uint256 _proposalId,
        bool _support,
        bytes memory /* _data */
    )
        external
        view 
        returns(address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature("castVote(uint256,bool)", _proposalId, _support);
        return (address(this), 0, callData);
    }

    function getProposeCalldata(bytes memory _proposalData)
        external
        view 
        returns(address, uint256, bytes memory)
    {
        (uint256 proposalId) = abi.decode(_proposalData, (uint256));

        bytes memory callData = abi.encodeWithSignature("createProposal(uint256)", proposalId);
        return (address(this), 0, callData);
    }

    function getDelegateCalldata(address _delegatee) external view returns(address, uint256, bytes memory) {
        bytes memory callData = abi.encodeWithSignature("delegate(address)", _delegatee);
        return (address(this), 0, callData);
    }

    function getRegisterCalldata(address _setToken) external view returns(address, uint256, bytes memory) {
        bytes memory callData = abi.encodeWithSignature("delegate(address)", _setToken);
        return (address(this), 0, callData);
    }

    function getRevokeCalldata() external view returns(address, uint256, bytes memory) {
        bytes memory callData = abi.encodeWithSignature("delegate(address)", address(0));
        return (address(this), 0, callData);
    }
}