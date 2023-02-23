// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

interface IStakingRewardsDistribution {
  event RewardClaim(
    address indexed user,
    uint256 amount,
    uint256 periodNumber
  );
  event RootUpdate(bytes32 indexed newRoot, uint256 newPeriodNumber);

  function setPPOStaking(address newPPOStaking) external;

  function setMerkleTreeRoot(bytes32 newRoot) external;

  function claim(
    address account,
    uint256 amount,
    bytes32[] memory proof
  ) external;

  function getPPOStaking() external view returns (address);

  function getMerkleTreeRoot() external view returns (bytes32);

  function getPeriodNumber() external view returns (uint256);

  function hasClaimed(address user) external view returns (bool);
}
