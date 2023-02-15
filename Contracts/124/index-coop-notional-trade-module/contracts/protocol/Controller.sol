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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { AddressArrayUtils } from "../lib/AddressArrayUtils.sol";


/**
 * @title Controller
 * @author Set Protocol
 *
 * Contract that houses state for approvals and system contracts such as added Sets,
 * modules, factories, resources (like price oracles), and protocol fee configurations.
 */
contract Controller is Ownable {
    using AddressArrayUtils for address[];

    /* ============ Events ============ */

    event FactoryAdded(address indexed _factory);
    event FactoryRemoved(address indexed _factory);
    event FeeEdited(address indexed _module, uint256 indexed _feeType, uint256 _feePercentage);
    event FeeRecipientChanged(address _newFeeRecipient);
    event ModuleAdded(address indexed _module);
    event ModuleRemoved(address indexed _module);
    event ResourceAdded(address indexed _resource, uint256 _id);
    event ResourceRemoved(address indexed _resource, uint256 _id);
    event SetAdded(address indexed _setToken, address indexed _factory);
    event SetRemoved(address indexed _setToken);

    /* ============ Modifiers ============ */

    /**
     * Throws if function is called by any address other than a valid factory.
     */
    modifier onlyFactory() {
        require(isFactory[msg.sender], "Only valid factories can call");
        _;
    }

    modifier onlyInitialized() {
        require(isInitialized, "Contract must be initialized.");
        _;
    }

    /* ============ State Variables ============ */

    // List of enabled Sets
    address[] public sets;
    // List of enabled factories of SetTokens
    address[] public factories;
    // List of enabled Modules; Modules extend the functionality of SetTokens
    address[] public modules;
    // List of enabled Resources; Resources provide data, functionality, or
    // permissions that can be drawn upon from Module, SetTokens or factories
    address[] public resources;

    // Mappings to check whether address is valid Set, Factory, Module or Resource
    mapping(address => bool) public isSet;
    mapping(address => bool) public isFactory;
    mapping(address => bool) public isModule;
    mapping(address => bool) public isResource;

    // Mapping of modules to fee types to fee percentage. A module can have multiple feeTypes
    // Fee is denominated in precise unit percentages (100% = 1e18, 1% = 1e16)
    mapping(address => mapping(uint256 => uint256)) public fees;

    // Mapping of resource ID to resource address, which allows contracts to fetch the correct
    // resource while providing an ID
    mapping(uint256 => address) public resourceId;

    // Recipient of protocol fees
    address public feeRecipient;

    // Return true if the controller is initialized
    bool public isInitialized;

    /* ============ Constructor ============ */

    /**
     * Initializes the initial fee recipient on deployment.
     *
     * @param _feeRecipient          Address of the initial protocol fee recipient
     */
    constructor(address _feeRecipient) public {
        feeRecipient = _feeRecipient;
    }

    /* ============ External Functions ============ */

    /**
     * Initializes any predeployed factories, modules, and resources post deployment. Note: This function can
     * only be called by the owner once to batch initialize the initial system contracts.
     *
     * @param _factories             List of factories to add
     * @param _modules               List of modules to add
     * @param _resources             List of resources to add
     * @param _resourceIds           List of resource IDs associated with the resources
     */
    function initialize(
        address[] memory _factories,
        address[] memory _modules,
        address[] memory _resources,
        uint256[] memory _resourceIds
    )
        external
        onlyOwner
    {
        require(!isInitialized, "Controller is already initialized");
        require(_resources.length == _resourceIds.length, "Array lengths do not match.");

        factories = _factories;
        modules = _modules;
        resources = _resources;

        // Loop through and initialize isModule, isFactory, and isResource mapping
        for (uint256 i = 0; i < _factories.length; i++) {
            require(_factories[i] != address(0), "Zero address submitted.");
            isFactory[_factories[i]] = true;
        }
        for (uint256 i = 0; i < _modules.length; i++) {
            require(_modules[i] != address(0), "Zero address submitted.");
            isModule[_modules[i]] = true;
        }

        for (uint256 i = 0; i < _resources.length; i++) {
            require(_resources[i] != address(0), "Zero address submitted.");
            require(resourceId[_resourceIds[i]] == address(0), "Resource ID already exists");
            isResource[_resources[i]] = true;
            resourceId[_resourceIds[i]] = _resources[i];
        }

        // Set to true to only allow initialization once
        isInitialized = true;
    }

    /**
     * PRIVILEGED FACTORY FUNCTION. Adds a newly deployed SetToken as an enabled SetToken.
     *
     * @param _setToken               Address of the SetToken contract to add
     */
    function addSet(address _setToken) external onlyInitialized onlyFactory {
        require(!isSet[_setToken], "Set already exists");

        isSet[_setToken] = true;

        sets.push(_setToken);

        emit SetAdded(_setToken, msg.sender);
    }

    /**
     * PRIVILEGED GOVERNANCE FUNCTION. Allows governance to remove a Set
     *
     * @param _setToken               Address of the SetToken contract to remove
     */
    function removeSet(address _setToken) external onlyInitialized onlyOwner {
        require(isSet[_setToken], "Set does not exist");

        sets = sets.remove(_setToken);

        isSet[_setToken] = false;

        emit SetRemoved(_setToken);
    }

    /**
     * PRIVILEGED GOVERNANCE FUNCTION. Allows governance to add a factory
     *
     * @param _factory               Address of the factory contract to add
     */
    function addFactory(address _factory) external onlyInitialized onlyOwner {
        require(!isFactory[_factory], "Factory already exists");

        isFactory[_factory] = true;

        factories.push(_factory);

        emit FactoryAdded(_factory);
    }

    /**
     * PRIVILEGED GOVERNANCE FUNCTION. Allows governance to remove a factory
     *
     * @param _factory               Address of the factory contract to remove
     */
    function removeFactory(address _factory) external onlyInitialized onlyOwner {
        require(isFactory[_factory], "Factory does not exist");

        factories = factories.remove(_factory);

        isFactory[_factory] = false;

        emit FactoryRemoved(_factory);
    }

    /**
     * PRIVILEGED GOVERNANCE FUNCTION. Allows governance to add a module
     *
     * @param _module               Address of the module contract to add
     */
    function addModule(address _module) external onlyInitialized onlyOwner {
        require(!isModule[_module], "Module already exists");

        isModule[_module] = true;

        modules.push(_module);

        emit ModuleAdded(_module);
    }

    /**
     * PRIVILEGED GOVERNANCE FUNCTION. Allows governance to remove a module
     *
     * @param _module               Address of the module contract to remove
     */
    function removeModule(address _module) external onlyInitialized onlyOwner {
        require(isModule[_module], "Module does not exist");

        modules = modules.remove(_module);

        isModule[_module] = false;

        emit ModuleRemoved(_module);
    }

    /**
     * PRIVILEGED GOVERNANCE FUNCTION. Allows governance to add a resource
     *
     * @param _resource               Address of the resource contract to add
     * @param _id                     New ID of the resource contract
     */
    function addResource(address _resource, uint256 _id) external onlyInitialized onlyOwner {
        require(!isResource[_resource], "Resource already exists");

        require(resourceId[_id] == address(0), "Resource ID already exists");

        isResource[_resource] = true;

        resourceId[_id] = _resource;

        resources.push(_resource);

        emit ResourceAdded(_resource, _id);
    }

    /**
     * PRIVILEGED GOVERNANCE FUNCTION. Allows governance to remove a resource
     *
     * @param _id               ID of the resource contract to remove
     */
    function removeResource(uint256 _id) external onlyInitialized onlyOwner {
        address resourceToRemove = resourceId[_id];

        require(resourceToRemove != address(0), "Resource does not exist");

        resources = resources.remove(resourceToRemove);

        delete resourceId[_id];

        isResource[resourceToRemove] = false;

        emit ResourceRemoved(resourceToRemove, _id);
    }

    /**
     * PRIVILEGED GOVERNANCE FUNCTION. Allows governance to add a fee to a module
     *
     * @param _module               Address of the module contract to add fee to
     * @param _feeType              Type of the fee to add in the module
     * @param _newFeePercentage     Percentage of fee to add in the module (denominated in preciseUnits eg 1% = 1e16)
     */
    function addFee(address _module, uint256 _feeType, uint256 _newFeePercentage) external onlyInitialized onlyOwner {
        require(isModule[_module], "Module does not exist");

        require(fees[_module][_feeType] == 0, "Fee type already exists on module");

        fees[_module][_feeType] = _newFeePercentage;

        emit FeeEdited(_module, _feeType, _newFeePercentage);
    }

    /**
     * PRIVILEGED GOVERNANCE FUNCTION. Allows governance to edit a fee in an existing module
     *
     * @param _module               Address of the module contract to edit fee
     * @param _feeType              Type of the fee to edit in the module
     * @param _newFeePercentage     Percentage of fee to edit in the module (denominated in preciseUnits eg 1% = 1e16)
     */
    function editFee(address _module, uint256 _feeType, uint256 _newFeePercentage) external onlyInitialized onlyOwner {
        require(isModule[_module], "Module does not exist");

        require(fees[_module][_feeType] != 0, "Fee type does not exist on module");

        fees[_module][_feeType] = _newFeePercentage;

        emit FeeEdited(_module, _feeType, _newFeePercentage);
    }

    /**
     * PRIVILEGED GOVERNANCE FUNCTION. Allows governance to edit the protocol fee recipient
     *
     * @param _newFeeRecipient      Address of the new protocol fee recipient
     */
    function editFeeRecipient(address _newFeeRecipient) external onlyInitialized onlyOwner {
        require(_newFeeRecipient != address(0), "Address must not be 0");

        feeRecipient = _newFeeRecipient;

        emit FeeRecipientChanged(_newFeeRecipient);
    }

    /* ============ External Getter Functions ============ */

    function getModuleFee(
        address _moduleAddress,
        uint256 _feeType
    )
        external
        view
        returns (uint256)
    {
        return fees[_moduleAddress][_feeType];
    }

    function getFactories() external view returns (address[] memory) {
        return factories;
    }

    function getModules() external view returns (address[] memory) {
        return modules;
    }

    function getResources() external view returns (address[] memory) {
        return resources;
    }

    function getSets() external view returns (address[] memory) {
        return sets;
    }

    /**
     * Check if a contract address is a module, Set, resource, factory or controller
     *
     * @param  _contractAddress           The contract address to check
     */
    function isSystemContract(address _contractAddress) external view returns (bool) {
        return (
            isSet[_contractAddress] ||
            isModule[_contractAddress] ||
            isResource[_contractAddress] ||
            isFactory[_contractAddress] ||
            _contractAddress == address(this)
        );
    }
}
