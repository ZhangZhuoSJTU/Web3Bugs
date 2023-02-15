//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import {MerkleProof} from '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';

abstract contract ERC721Claimable {
  bytes32 private _merkleRoot;
  mapping(address => uint256) private _claimedAmount;

  // ---------------- MODIFIER ----------------

  modifier onlyValidRoot(bytes32 root) {
    require(root != bytes32(0), 'ERC721Claimable: Not valid root');
    _;
  }

  modifier onlyClaimableSet() {
    require(claimableSet(), 'ERC721Claimable: No claimable');
    _;
  }

  modifier onlyNotClaimableSet() {
    require(!claimableSet(), 'ERC721Claimable: Claimable is already set');
    _;
  }

  // ---------------- VIEW ----------------

  function claimableSet() public view returns (bool) {
    return getMerkleRoot() != bytes32(0);
  }

  function verifyProof(
    bytes32[] memory proof,
    bytes32 root,
    bytes32 leaf
  ) public pure returns (bool) {
    return MerkleProof.verify(proof, root, leaf);
  }

  function processProof(bytes32[] memory proof, bytes32 leaf)
    public
    pure
    returns (bytes32)
  {
    return MerkleProof.processProof(proof, leaf);
  }

  /**
   * @notice Verifies whether an address can claim tokens
   * @dev 
   * @param who Claimer address
   * @param claimableAmount Amount airdropped to claimer
   * @param claimedAmount Amount of tokens claimer wants to claim
   * @param merkleProof Proof
   */
  function canClaim(
    address who,
    uint256 claimableAmount,
    uint256 claimedAmount,
    bytes32[] calldata merkleProof
  ) public view returns (bool) {
    require(
      verifyProof(merkleProof, getMerkleRoot(), getNode(who, claimableAmount)),
      'ERC721Claimable: Invalid proof'
    );

    return _claimedAmount[who] + claimedAmount <= claimableAmount;
  }

  function getMerkleRoot() public view returns (bytes32) {
    return _merkleRoot;
  }

  // ---------------- INTERNAL ----------------

  function _setMerkelRoot(bytes32 root) internal {
    _merkleRoot = root;
  }

  function _claim(address claimer, uint256 claimedAmount) internal {
    _claimedAmount[claimer] += claimedAmount;
  }

  // ---------------- PRIVATE ----------------

  /**
   * @dev get Node hash of given data.
   * @param who {address} Membership contract address
   * @param claimableAmount {uint256} token id which claiming person owns
   * @return {bytes32} node hash
   */
  function getNode(address who, uint256 claimableAmount)
    private
    pure
    returns (bytes32)
  {
    return keccak256(abi.encodePacked(who, claimableAmount));
  }
}
