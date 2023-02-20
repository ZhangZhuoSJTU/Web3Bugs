// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IFactory} from "../factory/IFactory.sol";
import {IInstanceRegistry} from "../factory/InstanceRegistry.sol";
import {ProxyFactory} from "../factory/ProxyFactory.sol";

import {IUniversalVault} from "./Visor.sol";

/// @title VisorFactory
contract VisorFactory is Ownable, IFactory, IInstanceRegistry, ERC721 {

    bytes32[] public names;
    mapping(bytes32=>address) public templates;
    bytes32 public activeTemplate;

    mapping(address=>address[]) public userIndex;

    event TemplateAdded(bytes32 indexed name, address indexed template);
    event TemplateActive(bytes32 indexed name, address indexed template);

    constructor() ERC721("VISOR", "VISOR") {}

    function addTemplate(bytes32 name, address template) public onlyOwner {
        require(templates[name] == address(0), "Template already exists");
        templates[name] = template;
        if(names.length == 0) {
          activeTemplate = name;
          emit TemplateActive(name, template);
        }
        names.push(name);
        emit TemplateAdded(name, template);
    }

    function setActive(bytes32 name) public onlyOwner {
      require(templates[name] != address(0), "Template does not exist");
      activeTemplate = name;
      emit TemplateActive(name, templates[name]);
    }

    /* registry functions */

    function isInstance(address instance) external view override returns (bool validity) {
        return ERC721._exists(uint256(instance));
    }

    function instanceCount() external view override returns (uint256 count) {
        return ERC721.totalSupply();
    }

    function instanceAt(uint256 index) external view override returns (address instance) {
        return address(ERC721.tokenByIndex(index));
    }

    /* factory functions */

    function createSelected(bytes32 name) public returns (address vault) {
        // create clone and initialize
        vault = ProxyFactory._create(
            templates[name],
            abi.encodeWithSelector(IUniversalVault.initialize.selector)
        );

        // mint nft to caller
        ERC721._safeMint(msg.sender, uint256(vault));
        userIndex[msg.sender].push(vault);

        // emit event
        emit InstanceAdded(vault);

        // explicit return
        return vault;
    }

    function createSelected2(bytes32 name, bytes32 salt) public returns (address vault) {
        // create clone and initialize
        vault = ProxyFactory._create2(
            templates[name],
            abi.encodeWithSelector(IUniversalVault.initialize.selector),
            salt
        );

        // mint nft to caller
        ERC721._safeMint(msg.sender, uint256(vault));
        userIndex[msg.sender].push(vault);

        // emit event
        emit InstanceAdded(vault);

        // explicit return
        return vault;
    }

    function create(bytes calldata) external override returns (address vault) {
        return create();
    }

    function create2(bytes calldata, bytes32 salt) external override returns (address vault) {
        return create2(salt);
    }

    function create() public returns (address vault) {
        // create clone and initialize
        vault = ProxyFactory._create(
            templates[activeTemplate],
            abi.encodeWithSelector(IUniversalVault.initialize.selector)
        );

        // mint nft to caller
        ERC721._safeMint(msg.sender, uint256(vault));
        userIndex[msg.sender].push(vault);

        // emit event
        emit InstanceAdded(vault);

        // explicit return
        return vault;
    }

    function create2(bytes32 salt) public returns (address vault) {
        // create clone and initialize
        vault = ProxyFactory._create2(
            templates[activeTemplate],
            abi.encodeWithSelector(IUniversalVault.initialize.selector),
            salt
        );

        // mint nft to caller
        ERC721._safeMint(msg.sender, uint256(vault));
        userIndex[msg.sender].push(vault);

        // emit event
        emit InstanceAdded(vault);

        // explicit return
        return vault;
    }

    /* getter functions */

    function nameCount() public view returns(uint256) {
        return names.length;
    }

    function vaultCount(address user) public view returns(uint256) {
        return userIndex[user].length;
    }

    function getUserVault(address user, uint256 index) public view returns (address) {
        return userIndex[user][index];
    }

    function getTemplate() external view returns (address) {
        return templates[activeTemplate];
    }
}
