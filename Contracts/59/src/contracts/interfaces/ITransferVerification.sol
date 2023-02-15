pragma solidity >=0.6.6;

interface ITransferVerification {
  function verifyTransfer(address, address, uint256) external view returns (bool, string memory);
}
