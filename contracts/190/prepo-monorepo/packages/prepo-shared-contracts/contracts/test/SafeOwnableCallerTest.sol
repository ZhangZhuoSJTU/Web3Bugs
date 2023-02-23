// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "../SafeOwnableCaller.sol";
import "../SafeOwnable.sol";

contract SafeOwnableCallerTest is SafeOwnableCaller, SafeOwnable {
  function transferOwnership(address _safeOwnableContract, address _nominee) public virtual override onlyOwner {
    ISafeOwnable(_safeOwnableContract).transferOwnership(_nominee);
  }

  function acceptOwnership(address _safeOwnableContract) public virtual override onlyOwner {
    ISafeOwnable(_safeOwnableContract).acceptOwnership();
  }

  function renounceOwnership(address _safeOwnableContract) public virtual override onlyOwner {
    ISafeOwnable(_safeOwnableContract).renounceOwnership();
  }
}
