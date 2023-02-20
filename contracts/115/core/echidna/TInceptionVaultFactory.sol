//SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./TIVSetup.sol";

contract TInceptionVaultFactory is TIVSetup {
  constructor() public TIVSetup() {}

  /// @notice Checks that inceptionVaults cannot be deleted from mapping
  function echidna_inceptionVault_isListed() public view returns (bool) {
    for (uint256 i = 1; i <= _inceptionVaultFactory.inceptionVaultCount(); i++) {
      address owner = _inceptionVaultFactory.inceptionVaults(i).owner;
      return owner != address(0);
    }
  }

  /// @notice Checks that priceFeeds cannot be deleted from mapping
  function echidna_priceFeed_isListed() public view returns (bool) {
    for (uint8 i = 1; i <= _inceptionVaultFactory.priceFeedCount(); i++) {
      address priceFeed = _inceptionVaultFactory.priceFeeds(i);
      return _inceptionVaultFactory.priceFeedIds(priceFeed) != 0;
    }
  }
}
