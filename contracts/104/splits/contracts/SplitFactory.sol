// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {ProxyVault} from '@chestrnft/royalty-vault/contracts/ProxyVault.sol';
import {SplitProxy} from './SplitProxy.sol';
import {IRoyaltyVault} from '@chestrnft/royalty-vault/interfaces/IRoyaltyVault.sol';
import {ICoreCollection} from '../interfaces/ICoreCollection.sol';

contract SplitFactory is Ownable {
  /**** Immutable storage ****/

  address public immutable splitter;
  address public immutable royaltyVault;

  /**** Mmutable storage ****/
  // Gets set within the block, and then deleted.

  bytes32 public merkleRoot;
  address public splitAsset;
  address public royaltyAsset;
  address public splitterProxy;
  uint256 public platformFee;
  address public platformFeeRecipient;

  mapping(string => address) public splits;

  /**** Events ****/

  event SplitCreated(address indexed splitter, string splitId);

  event VaultCreated(
    address indexed vault,
    address indexed splitter,
    uint256 platformFee,
    address platformFeeRecipient
  );

  event VaultAssignedToCollection(
    address indexed vault,
    address indexed splitter,
    address indexed collectionContract
  );

  // ---------------- MODIFIER ----------------

  modifier onlyAvailableSplit(string memory _splitId) {
    require(
      splits[_splitId] == address(0),
      'SplitFactory : Split ID already in use'
    );
    _;
  }

  /**
   * @dev Constructor
   * @param _splitter The address of the Splitter contract.
   */
  constructor(address _splitter, address _royaltyVault) {
    splitter = _splitter;
    royaltyVault = _royaltyVault;
    platformFee = 500; // 5%
    platformFeeRecipient = 0x70388C130222eae55a0527a2367486bF5D12d6e7;
  }

  // ---------------- EXTERNAL ----------------

  /**
   * @dev Deploys a new SplitProxy and initializes collection's royalty vault.
   * @param _merkleRoot The merkle root of the asset.
   * @param _splitAsset The address of the asset to split.
   * @param _collectionContract The address of the collection contract.
   * @param _splitId The split identifier.
   */
  function createSplit(
    bytes32 _merkleRoot,
    address _splitAsset,
    address _collectionContract,
    string memory _splitId
  ) external onlyAvailableSplit(_splitId) returns (address splitProxy) {
    require(
      ICoreCollection(_collectionContract).owner() == msg.sender,
      'Transaction sender is not collection owner'
    );
    merkleRoot = _merkleRoot;
    splitAsset = _splitAsset;
    royaltyAsset = _splitAsset;

    splitProxy = createSplitProxy(_splitId);
    address vault = createVaultProxy(splitProxy);

    ICoreCollection(_collectionContract).setRoyaltyVault(vault);
    emit VaultAssignedToCollection(vault, splitter, _collectionContract);
  }

  /**
   * @dev Deploys a new SplitProxy.
   * @param _merkleRoot The merkle root of the asset.
   * @param _splitAsset The address of the asset to split.
   * @param _splitId The split identifier.
   */
  function createSplit(
    bytes32 _merkleRoot,
    address _splitAsset,
    string memory _splitId
  ) external onlyAvailableSplit(_splitId) returns (address splitProxy) {
    merkleRoot = _merkleRoot;
    splitAsset = _splitAsset;
    royaltyAsset = _splitAsset;

    splitProxy = createSplitProxy(_splitId);
    createVaultProxy(splitProxy);
  }

  /**
   * @dev Set Platform fee for collection contract.
   * @param _platformFee Platform fee in scaled percentage. (5% = 200)
   * @param _vault vault address.
   */
  function setPlatformFee(address _vault, uint256 _platformFee)
    external
    onlyOwner
  {
    IRoyaltyVault(_vault).setPlatformFee(_platformFee);
  }

  /**
   * @dev Set Platform fee recipient for collection contract.
   * @param _vault vault address.
   * @param _platformFeeRecipient Platform fee recipient.
   */
  function setPlatformFeeRecipient(
    address _vault,
    address _platformFeeRecipient
  ) external onlyOwner {
    require(_vault != address(0), 'Invalid vault');
    require(
      _platformFeeRecipient != address(0),
      'Invalid platform fee recipient'
    );
    IRoyaltyVault(_vault).setPlatformFeeRecipient(_platformFeeRecipient);
  }

  // ---------------- PRIVATE ----------------

  /**
   * @dev Creates a new SplitProxy.
   */
  function createSplitProxy(string memory _splitId)
    private
    returns (address splitProxy)
  {
    splitProxy = address(
      new SplitProxy{salt: keccak256(abi.encode(merkleRoot))}()
    );

    splits[_splitId] = splitProxy;

    emit SplitCreated(splitProxy, _splitId);

    delete merkleRoot;
    delete splitAsset;
  }

  function createVaultProxy(address splitProxy)
    private
    returns (address vault)
  {
    splitterProxy = splitProxy;
    vault = address(new ProxyVault{salt: keccak256(abi.encode(splitProxy))}());
    delete splitterProxy;
    delete royaltyAsset;
    emit VaultCreated(vault, splitProxy, platformFee, platformFeeRecipient);
  }
}
