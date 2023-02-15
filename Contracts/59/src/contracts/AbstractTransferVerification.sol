pragma solidity >=0.6.6;

import "./Permissions.sol";

/// @title AbstractTransferVerification
/// @author 0xScotch <scotch@malt.money>
/// @notice Implements a single method that can block a particular transfer
abstract contract AbstractTransferVerification is Permissions {
  function verifyTransfer(address from, address to, uint256 amount) public view virtual returns (bool, string memory) {
    return (true, "");
  }
}
