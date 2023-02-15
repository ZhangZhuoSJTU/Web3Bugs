// SPDX-License-Identifier: MIT

pragma solidity 0.6.8;

// Author: 0xKiwi.

import "../token/IERC20Upgradeable.sol";
import "../util/OwnableUpgradeable.sol";

contract MockStakingProvider is OwnableUpgradeable{

  bool changed;
  
  constructor() public {
    __Ownable_init();
  }

  function stakingTokenForVaultToken(address _vaultToken) external view returns (address) {
    return changed ? address(1) :_vaultToken;
  }

  function setChanged(bool _changed) external onlyOwner {
    changed = _changed;
  }

  function nameForStakingToken(address _vaultToken) external view returns (string memory) {
    string memory symbol = IERC20Upgradeable(_vaultToken).symbol();
    return string(abi.encodePacked("based", symbol));
  }

}