pragma solidity 0.6.8;

interface INFTXEligibilityManager {
  function nftxVaultFactory() external returns (address);
  function eligibilityImpl() external returns (address);

  function deployEligibility(uint256 vaultId, bytes calldata initData) external returns (address);
}