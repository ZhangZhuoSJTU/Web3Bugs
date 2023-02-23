// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

//TODO: add all natspecs at the end
interface IPregenesisPoints {
  function setShop(address newShop) external;

  function setMerkleTreeRoot(bytes32 newRoot) external;

  function mint(address to, uint256 amount) external;

  function burn(address account, uint256 amount) external;

  function claim(uint256 amount, bytes32[] memory proof) external;

  function getShop() external view returns (address);

  function getMerkleTreeRoot() external view returns (bytes32);

  function hasClaimed(address account) external view returns (bool);
}
