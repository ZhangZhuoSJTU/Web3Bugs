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

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { IController } from "../../../interfaces/IController.sol";
import { IGovernanceAdapter } from "../../../interfaces/IGovernanceAdapter.sol";
import { Invoke } from "../../lib/Invoke.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";
import { ModuleBase } from "../../lib/ModuleBase.sol";


/**
 * @title GovernanceModule
 * @author Set Protocol
 *
 * A smart contract module that enables participating in governance of component tokens held in the SetToken.
 * Examples of intended protocols include Compound, Uniswap, and Maker governance.
 */
contract GovernanceModule is ModuleBase, ReentrancyGuard {
    using Invoke for ISetToken;

    /* ============ Events ============ */
    event ProposalVoted(
        ISetToken indexed _setToken,
        IGovernanceAdapter indexed _governanceAdapter,
        uint256 indexed _proposalId,
        bool _support
    );

    event VoteDelegated(
        ISetToken indexed _setToken,
        IGovernanceAdapter indexed _governanceAdapter,
        address _delegatee
    );

    event ProposalCreated(
        ISetToken indexed _setToken,
        IGovernanceAdapter indexed _governanceAdapter,
        bytes _proposalData
    );

    event RegistrationSubmitted(
        ISetToken indexed _setToken,
        IGovernanceAdapter indexed _governanceAdapter
    );

    event RegistrationRevoked(
        ISetToken indexed _setToken,
        IGovernanceAdapter indexed _governanceAdapter
    );

    /* ============ Constructor ============ */

    constructor(IController _controller) public ModuleBase(_controller) {}

    /* ============ External Functions ============ */

    /**
     * SET MANAGER ONLY. Delegate voting power to an Ethereum address. Note: for some governance adapters, delegating to self is
     * equivalent to registering and delegating to zero address is revoking right to vote.
     *
     * @param _setToken                 Address of SetToken
     * @param _governanceName           Human readable name of integration (e.g. COMPOUND) stored in the IntegrationRegistry
     * @param _delegatee                Address of delegatee
     */
    function delegate(
        ISetToken _setToken,
        string memory _governanceName,
        address _delegatee
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        IGovernanceAdapter governanceAdapter = IGovernanceAdapter(getAndValidateAdapter(_governanceName));

        (
            address targetExchange,
            uint256 callValue,
            bytes memory methodData
        ) = governanceAdapter.getDelegateCalldata(_delegatee);

        _setToken.invoke(targetExchange, callValue, methodData);

        emit VoteDelegated(_setToken, governanceAdapter, _delegatee);
    }

    /**
     * SET MANAGER ONLY. Create a new proposal for a specified governance protocol.
     *
     * @param _setToken                 Address of SetToken
     * @param _governanceName           Human readable name of integration (e.g. COMPOUND) stored in the IntegrationRegistry
     * @param _proposalData             Byte data of proposal to pass into governance adapter
     */
    function propose(
        ISetToken _setToken,
        string memory _governanceName,
        bytes memory _proposalData
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        IGovernanceAdapter governanceAdapter = IGovernanceAdapter(getAndValidateAdapter(_governanceName));

        (
            address targetExchange,
            uint256 callValue,
            bytes memory methodData
        ) = governanceAdapter.getProposeCalldata(_proposalData);

        _setToken.invoke(targetExchange, callValue, methodData);

        emit ProposalCreated(_setToken, governanceAdapter, _proposalData);
    }

    /**
     * SET MANAGER ONLY. Register for voting for the SetToken
     *
     * @param _setToken                 Address of SetToken
     * @param _governanceName           Human readable name of integration (e.g. COMPOUND) stored in the IntegrationRegistry
     */
    function register(
        ISetToken _setToken,
        string memory _governanceName
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        IGovernanceAdapter governanceAdapter = IGovernanceAdapter(getAndValidateAdapter(_governanceName));

        (
            address targetExchange,
            uint256 callValue,
            bytes memory methodData
        ) = governanceAdapter.getRegisterCalldata(address(_setToken));

        _setToken.invoke(targetExchange, callValue, methodData);

        emit RegistrationSubmitted(_setToken, governanceAdapter);
    }

    /**
     * SET MANAGER ONLY. Revoke voting for the SetToken
     *
     * @param _setToken                 Address of SetToken
     * @param _governanceName           Human readable name of integration (e.g. COMPOUND) stored in the IntegrationRegistry
     */
    function revoke(
        ISetToken _setToken,
        string memory _governanceName
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        IGovernanceAdapter governanceAdapter = IGovernanceAdapter(getAndValidateAdapter(_governanceName));

        (
            address targetExchange,
            uint256 callValue,
            bytes memory methodData
        ) = governanceAdapter.getRevokeCalldata();

        _setToken.invoke(targetExchange, callValue, methodData);

        emit RegistrationRevoked(_setToken, governanceAdapter);
    }

    /**
     * SET MANAGER ONLY. Cast vote for a specific governance token held in the SetToken. Manager specifies whether to vote for or against
     * a given proposal
     *
     * @param _setToken                 Address of SetToken
     * @param _governanceName           Human readable name of integration (e.g. COMPOUND) stored in the IntegrationRegistry
     * @param _proposalId               ID of the proposal to vote on
     * @param _support                  Boolean indicating whether to support proposal
     * @param _data                     Arbitrary bytes to be used to construct vote call data
     */
    function vote(
        ISetToken _setToken,
        string memory _governanceName,
        uint256 _proposalId,
        bool _support,
        bytes memory _data
    )
        external
        nonReentrant
        onlyManagerAndValidSet(_setToken)
    {
        IGovernanceAdapter governanceAdapter = IGovernanceAdapter(getAndValidateAdapter(_governanceName));

        (
            address targetExchange,
            uint256 callValue,
            bytes memory methodData
        ) = governanceAdapter.getVoteCalldata(
            _proposalId,
            _support,
            _data
        );

        _setToken.invoke(targetExchange, callValue, methodData);

        emit ProposalVoted(_setToken, governanceAdapter, _proposalId, _support);
    }

    /**
     * Initializes this module to the SetToken. Only callable by the SetToken's manager.
     *
     * @param _setToken             Instance of the SetToken to issue
     */
    function initialize(ISetToken _setToken) external onlySetManager(_setToken, msg.sender) onlyValidAndPendingSet(_setToken) {
        _setToken.initializeModule();
    }

    /**
     * Removes this module from the SetToken, via call by the SetToken.
     */
    function removeModule() external override {}
}