// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/ISafeOwnable.sol";
import "./interfaces/ISafeOwnableCaller.sol";

abstract contract SafeOwnableCaller is ISafeOwnableCaller {
  function transferOwnership(address _safeOwnableContract, address _nominee) public virtual override;

  function acceptOwnership(address _safeOwnableContract) public virtual override;

  function renounceOwnership(address _safeOwnableContract) public virtual override;
}
