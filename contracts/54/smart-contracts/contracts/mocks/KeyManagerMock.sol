// SPDX-License-Identifier: MIT
pragma solidity >=0.5.17 <0.8.5;


import '../PublicLock.sol';

contract KeyManagerMock is
  PublicLock
{

  function isKeyManager(
    uint _tokenId,
    address _keyManager
  ) external view
    returns (bool)
  {
    return(_isKeyManager(_tokenId, _keyManager));
  }

}