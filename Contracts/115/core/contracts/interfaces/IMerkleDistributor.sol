// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

// Allows anyone to claim a token if they exist in a merkle root.
interface IMerkleDistributor {
  // This event is triggered whenever a call to #claim succeeds.
  event Claimed(uint256 index, address account, uint256 amount);

  // Claim the given amount of the token to the given address. Reverts if the inputs are invalid.
  function claim(
    uint256 index,
    address account,
    uint256 amount,
    bytes32[] calldata merkleProof
  ) external;

  // Returns the address of the token distributed by this contract.
  function token() external view returns (address);

  // Returns the merkle root of the merkle tree containing account balances available to claim.
  function merkleRoot() external view returns (bytes32);

  // Returns true if the index has been marked claimed.
  function isClaimed(uint256 index) external view returns (bool);

  // Returns the block timestamp when claims will end
  function endTime() external view returns (uint256);

  // Returns true if the claim period has not ended.
  function isActive() external view returns (bool);
}
