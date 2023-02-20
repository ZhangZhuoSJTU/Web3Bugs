// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

library DistributionTypes {
  struct AssetConfigInput {
    uint104 emissionPerSecond;
    uint256 totalStaked;
    address underlyingAsset;
  }

  struct UserStakeInput {
    address underlyingAsset;
    uint256 stakedByUser;
    uint256 totalStaked;
  }
}

interface IAaveDistributionManager {
  event AssetConfigUpdated(address indexed asset, uint256 emission);
  event AssetIndexUpdated(address indexed asset, uint256 index);
  event UserIndexUpdated(address indexed user, address indexed asset, uint256 index);
  event DistributionEndUpdated(uint256 newDistributionEnd);

  /**
   * @dev Sets the end date for the distribution
   * @param distributionEnd The end date timestamp
   **/
  function setDistributionEnd(uint256 distributionEnd) external;

  /**
   * @dev Gets the end date for the distribution
   * @return The end of the distribution
   **/
  function getDistributionEnd() external view returns (uint256);

  /**
   * @dev for backwards compatibility with the previous DistributionManager used
   * @return The end of the distribution
   **/
  function DISTRIBUTION_END() external view returns (uint256);

  /**
   * @dev Returns the data of an user on a distribution
   * @param user Address of the user
   * @param asset The address of the reference asset of the distribution
   * @return The new index
   **/
  function getUserAssetData(address user, address asset) external view returns (uint256);

  /**
   * @dev Returns the configuration of the distribution for a certain asset
   * @param asset The address of the reference asset of the distribution
   * @return The asset index, the emission per second and the last updated timestamp
   **/
  function getAssetData(address asset)
    external
    view
    returns (
      uint256,
      uint256,
      uint256
    );
}
