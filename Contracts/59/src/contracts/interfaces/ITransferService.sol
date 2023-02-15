pragma solidity >=0.6.6;

interface ITransferService {
  function verifyTransfer(address, address, uint256) external view returns (bool, string memory);
  function numberOfVerifiers() external view returns (uint256);
  function addVerifier(address, address) external;
  function removeVerifier(address) external;
}
