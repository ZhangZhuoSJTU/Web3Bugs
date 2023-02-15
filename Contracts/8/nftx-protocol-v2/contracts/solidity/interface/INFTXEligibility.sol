pragma solidity 0.6.8;

interface INFTXEligibility {
  // Read functions.
  function name() external view returns (string memory);
  function finalized() external view returns (bool);
  function checkAllEligible(uint256[] calldata tokenIds) external view returns (bool);
  function checkAllIneligible(uint256[] calldata tokenIds) external view returns (bool);
  function checkIsEligible(uint256 tokenId) external view returns (bool);

  // Write functions.
  function __NFTXEligibility_init_bytes(bytes calldata configData) external;
  function beforeMintHook(uint256[] calldata tokenIds) external;
  function afterMintHook(uint256[] calldata tokenIds) external;
  function beforeRedeemHook(uint256[] calldata tokenIds) external;
  function afterRedeemHook(uint256[] calldata tokenIds) external;
}