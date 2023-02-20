// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IMerkleDistributor.sol";

contract MerkleDistributor is IMerkleDistributor, Ownable {
  address public immutable override token;
  bytes32 public immutable override merkleRoot;
  uint256 public immutable override endTime;

  // This is a packed array of booleans.
  mapping(uint256 => uint256) private _claimedBitMap;

  constructor(
    address _token,
    bytes32 _merkleRoot,
    uint256 _endTime
  ) public {
    token = _token;
    merkleRoot = _merkleRoot;
    require(block.timestamp < _endTime, "Invalid endTime");
    endTime = _endTime;
  }

  /** @dev Modifier to check that claim period is active.*/
  modifier whenActive() {
    require(isActive(), "Claim period has ended");
    _;
  }

  function claim(
    uint256 _index,
    address _account,
    uint256 _amount,
    bytes32[] calldata merkleProof
  ) external override whenActive {
    require(!isClaimed(_index), "Drop already claimed");

    // Verify the merkle proof.
    bytes32 node = keccak256(abi.encodePacked(_index, _account, _amount));
    require(MerkleProof.verify(merkleProof, merkleRoot, node), "Invalid proof");

    // Mark it claimed and send the token.
    _setClaimed(_index);
    require(IERC20(token).transfer(_account, _amount), "Transfer failed");

    emit Claimed(_index, _account, _amount);
  }

  function isClaimed(uint256 _index) public view override returns (bool) {
    uint256 claimedWordIndex = _index / 256;
    uint256 claimedBitIndex = _index % 256;
    uint256 claimedWord = _claimedBitMap[claimedWordIndex];
    uint256 mask = (1 << claimedBitIndex);
    return claimedWord & mask == mask;
  }

  function isActive() public view override returns (bool) {
    return block.timestamp < endTime;
  }

  function recoverERC20(address _tokenAddress, uint256 _tokenAmount) public onlyOwner {
    IERC20(_tokenAddress).transfer(owner(), _tokenAmount);
  }

  function _setClaimed(uint256 _index) private {
    uint256 claimedWordIndex = _index / 256;
    uint256 claimedBitIndex = _index % 256;
    _claimedBitMap[claimedWordIndex] = _claimedBitMap[claimedWordIndex] | (1 << claimedBitIndex);
  }
}
