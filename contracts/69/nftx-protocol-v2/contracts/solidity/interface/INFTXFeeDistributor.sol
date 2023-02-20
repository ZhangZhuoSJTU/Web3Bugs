// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface INFTXFeeDistributor {
  
  struct FeeReceiver {
    uint256 allocPoint;
    address receiver;
    bool isContract;
  }

  function nftxVaultFactory() external returns (address);
  function lpStaking() external returns (address);
  function treasury() external returns (address);
  function defaultTreasuryAlloc() external returns (uint256);
  function defaultLPAlloc() external returns (uint256);
  function allocTotal(uint256 vaultId) external returns (uint256);
  function specificTreasuryAlloc(uint256 vaultId) external returns (uint256);

  // Write functions.
  function __FeeDistributor__init__(address _lpStaking, address _treasury) external;
  function rescueTokens(address token) external;
  function distribute(uint256 vaultId) external;
  function addReceiver(uint256 _vaultId, uint256 _allocPoint, address _receiver, bool _isContract) external;
  function initializeVaultReceivers(uint256 _vaultId) external;
  function changeMultipleReceiverAlloc(
    uint256[] memory _vaultIds, 
    uint256[] memory _receiverIdxs, 
    uint256[] memory allocPoints
  ) external;

  function changeMultipleReceiverAddress(
    uint256[] memory _vaultIds, 
    uint256[] memory _receiverIdxs, 
    address[] memory addresses, 
    bool[] memory isContracts
  ) external;
  function changeReceiverAlloc(uint256 _vaultId, uint256 _idx, uint256 _allocPoint) external;
  function changeReceiverAddress(uint256 _vaultId, uint256 _idx, address _address, bool _isContract) external;
  function removeReceiver(uint256 _vaultId, uint256 _receiverIdx) external;

  // Configuration functions.
  function setTreasuryAddress(address _treasury) external;
  function setDefaultTreasuryAlloc(uint256 _allocPoint) external;
  function setSpecificTreasuryAlloc(uint256 _vaultId, uint256 _allocPoint) external;
  function setLPStakingAddress(address _lpStaking) external;
  function setNFTXVaultFactory(address _factory) external;
  function setDefaultLPAlloc(uint256 _allocPoint) external;
} 