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

import { IController } from "../interfaces/IController.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IntegrationRegistry
 * @author Set Protocol
 *
 * The IntegrationRegistry holds state relating to the Modules and the integrations they are connected with.
 * The state is combined into a single Registry to allow governance updates to be aggregated to one contract.
 */
contract IntegrationRegistry is Ownable {

    /* ============ Events ============ */

    event IntegrationAdded(address indexed _module, address indexed _adapter, string _integrationName);
    event IntegrationRemoved(address indexed _module, address indexed _adapter, string _integrationName);
    event IntegrationEdited(
        address indexed _module,
        address _newAdapter,
        string _integrationName
    );

    /* ============ State Variables ============ */

    // Address of the Controller contract
    IController public controller;

    // Mapping of module => integration identifier => adapter address
    mapping(address => mapping(bytes32 => address)) private integrations;

    /* ============ Constructor ============ */

    /**
     * Initializes the controller
     *
     * @param _controller          Instance of the controller
     */
    constructor(IController _controller) public {
        controller = _controller;
    }

    /* ============ External Functions ============ */

    /**
     * GOVERNANCE FUNCTION: Add a new integration to the registry
     *
     * @param  _module       The address of the module associated with the integration
     * @param  _name         Human readable string identifying the integration
     * @param  _adapter      Address of the adapter contract to add
     */
    function addIntegration(
        address _module,
        string memory _name,
        address _adapter
    )
        public
        onlyOwner
    {
        bytes32 hashedName = _nameHash(_name);
        require(controller.isModule(_module), "Must be valid module.");
        require(integrations[_module][hashedName] == address(0), "Integration exists already.");
        require(_adapter != address(0), "Adapter address must exist.");

        integrations[_module][hashedName] = _adapter;

        emit IntegrationAdded(_module, _adapter, _name);
    }

    /**
     * GOVERNANCE FUNCTION: Batch add new adapters. Reverts if exists on any module and name
     *
     * @param  _modules      Array of addresses of the modules associated with integration
     * @param  _names        Array of human readable strings identifying the integration
     * @param  _adapters     Array of addresses of the adapter contracts to add
     */
    function batchAddIntegration(
        address[] memory _modules,
        string[] memory _names,
        address[] memory _adapters
    )
        external
        onlyOwner
    {
        // Storing modules count to local variable to save on invocation
        uint256 modulesCount = _modules.length;

        require(modulesCount > 0, "Modules must not be empty");
        require(modulesCount == _names.length, "Module and name lengths mismatch");
        require(modulesCount == _adapters.length, "Module and adapter lengths mismatch");

        for (uint256 i = 0; i < modulesCount; i++) {
            // Add integrations to the specified module. Will revert if module and name combination exists
            addIntegration(
                _modules[i],
                _names[i],
                _adapters[i]
            );
        }
    }

    /**
     * GOVERNANCE FUNCTION: Edit an existing integration on the registry
     *
     * @param  _module       The address of the module associated with the integration
     * @param  _name         Human readable string identifying the integration
     * @param  _adapter      Address of the adapter contract to edit
     */
    function editIntegration(
        address _module,
        string memory _name,
        address _adapter
    )
        public
        onlyOwner
    {
        bytes32 hashedName = _nameHash(_name);

        require(controller.isModule(_module), "Must be valid module.");
        require(integrations[_module][hashedName] != address(0), "Integration does not exist.");
        require(_adapter != address(0), "Adapter address must exist.");

        integrations[_module][hashedName] = _adapter;

        emit IntegrationEdited(_module, _adapter, _name);
    }

    /**
     * GOVERNANCE FUNCTION: Batch edit adapters for modules. Reverts if module and
     * adapter name don't map to an adapter address
     *
     * @param  _modules      Array of addresses of the modules associated with integration
     * @param  _names        Array of human readable strings identifying the integration
     * @param  _adapters     Array of addresses of the adapter contracts to add
     */
    function batchEditIntegration(
        address[] memory _modules,
        string[] memory _names,
        address[] memory _adapters
    )
        external
        onlyOwner
    {
        // Storing name count to local variable to save on invocation
        uint256 modulesCount = _modules.length;

        require(modulesCount > 0, "Modules must not be empty");
        require(modulesCount == _names.length, "Module and name lengths mismatch");
        require(modulesCount == _adapters.length, "Module and adapter lengths mismatch");

        for (uint256 i = 0; i < modulesCount; i++) {
            // Edits integrations to the specified module. Will revert if module and name combination does not exist
            editIntegration(
                _modules[i],
                _names[i],
                _adapters[i]
            );
        }
    }

    /**
     * GOVERNANCE FUNCTION: Remove an existing integration on the registry
     *
     * @param  _module       The address of the module associated with the integration
     * @param  _name         Human readable string identifying the integration
     */
    function removeIntegration(address _module, string memory _name) external onlyOwner {
        bytes32 hashedName = _nameHash(_name);
        require(integrations[_module][hashedName] != address(0), "Integration does not exist.");

        address oldAdapter = integrations[_module][hashedName];
        delete integrations[_module][hashedName];

        emit IntegrationRemoved(_module, oldAdapter, _name);
    }

    /* ============ External Getter Functions ============ */

    /**
     * Get integration adapter address associated with passed human readable name
     *
     * @param  _module       The address of the module associated with the integration
     * @param  _name         Human readable adapter name
     *
     * @return               Address of adapter
     */
    function getIntegrationAdapter(address _module, string memory _name) external view returns (address) {
        return integrations[_module][_nameHash(_name)];
    }

    /**
     * Get integration adapter address associated with passed hashed name
     *
     * @param  _module       The address of the module associated with the integration
     * @param  _nameHash     Hash of human readable adapter name
     *
     * @return               Address of adapter
     */
    function getIntegrationAdapterWithHash(address _module, bytes32 _nameHash) external view returns (address) {
        return integrations[_module][_nameHash];
    }

    /**
     * Check if adapter name is valid
     *
     * @param  _module       The address of the module associated with the integration
     * @param  _name         Human readable string identifying the integration
     *
     * @return               Boolean indicating if valid
     */
    function isValidIntegration(address _module, string memory _name) external view returns (bool) {
        return integrations[_module][_nameHash(_name)] != address(0);
    }

    /* ============ Internal Functions ============ */

    /**
     * Hashes the string and returns a bytes32 value
     */
    function _nameHash(string memory _name) internal pure returns(bytes32) {
        return keccak256(bytes(_name));
    }
}