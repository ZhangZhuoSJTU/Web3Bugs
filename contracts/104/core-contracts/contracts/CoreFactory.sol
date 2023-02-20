//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import {CoreProxy} from './CoreProxy.sol';
import './utils/structs/Collection.sol';
import {CoreCollection} from './CoreCollection.sol';
import {ICoreCollection} from '../interfaces/ICoreCollection.sol';

contract CoreFactory {
  struct Project {
    string id;
    address creator;
  }

  event NewProject(string id, address creator);
  event NewCollection(
    string collectionId,
    address collection,
    string projectId
  );

  address public immutable collection;
  address public immutable splitFactory;
  mapping(string => Project) public projects;
  mapping(string => address) public collections;

  constructor(address _collection, address _splitFactory) {
    collection = _collection;
    splitFactory = _splitFactory;
  }

  // ---------------- MODIFIER ----------------

  modifier onlyAvailableProject(string memory _projectId) {
    require(
      projects[_projectId].creator == address(0),
      'CoreFactory: Unavailable project id'
    );
    _;
  }

  modifier onlyProjectOwner(string memory _projectId) {
    require(
      projects[_projectId].creator == msg.sender,
      'CoreFactory: Not an owner of the project'
    );
    _;
  }

  modifier onlyAvailableCollection(string memory _collectionId) {
    require(
      collections[_collectionId] == address(0),
      'CoreFactory: Unavailable collection id'
    );
    _;
  }

  // ---------------- EXTERNAL ----------------

  /**
   * @notice Allows to create a project as well as deploy its collection(s)
   * For adding a collection to a project, use the addCollection() method.
   * @dev Projects have unique identifiers.
   * Collections are deployed using a proxy pattern. This is mainly for gas optimization purposes
   * and to support future contract upgrades.
   * Collections ownership are transferred to the caller.
   * @param _projectId Project id which is a unique identifier
   * @param _collections An array of Collection that needs to be deployed
   */
  function createProject(
    string memory _projectId,
    Collection[] memory _collections
  ) external onlyAvailableProject(_projectId) {
    require(
      _collections.length > 0,
      'CoreFactory: should have more at least one collection'
    );

    for (uint256 i; i < _collections.length; i++) {
      Collection memory _collection = _collections[i];
      address coreCollection = _createCollection(_collection);

      if (_collection.claimsMerkleRoot != bytes32(0)) {
        ICoreCollection(coreCollection).initializeClaims(
          _collection.claimsMerkleRoot
        );
      }

      emit NewCollection(_collection.id, coreCollection, _projectId);

      ICoreCollection(coreCollection).transferOwnership(msg.sender);
    }
    Project memory project;
    project.id = _projectId;
    project.creator = msg.sender;
    projects[_projectId] = project;

    emit NewProject(_projectId, msg.sender);
  }

  /**
   * @notice Allows to add a collection to a project
   * @dev Can only be called by project creator
   * Collection's ownership is transferred to the caller
   * @param _projectId Project id which is a unique identifier
   * @param _collection Collection that needs to be deployed
   */
  function addCollection(
    string memory _projectId,
    Collection memory _collection
  ) external onlyProjectOwner(_projectId) returns (address) {
    address coreCollection = _createCollection(_collection);

    if (_collection.claimsMerkleRoot != bytes32(0)) {
      ICoreCollection(coreCollection).initializeClaims(
        _collection.claimsMerkleRoot
      );
    }

    emit NewCollection(_collection.id, coreCollection, _projectId);

    ICoreCollection(coreCollection).transferOwnership(msg.sender);
    return coreCollection;
  }

  // ---------------- VIEW ----------------

  function getProject(string memory _projectId)
    external
    view
    returns (Project memory)
  {
    return projects[_projectId];
  }

  // ---------------- PRIVATE ----------------

  /**
   * @notice Instanciates/Deploys a collection
   * @param _collection Collection that needs to be deployed
   */
  function _createCollection(Collection memory _collection)
    private
    onlyAvailableCollection(_collection.id)
    returns (address)
  {
    address coreCollection = address(
      new CoreProxy{salt: keccak256(abi.encodePacked(_collection.id))}(
        collection
      )
    );

    ICoreCollection(coreCollection).initialize(
      _collection.name,
      _collection.symbol,
      _collection.baseURI,
      _collection.maxSupply,
      _collection.mintFee,
      _collection.payableToken,
      _collection.isForSale,
      splitFactory
    );

    collections[_collection.id] = coreCollection;
    return coreCollection;
  }
}
