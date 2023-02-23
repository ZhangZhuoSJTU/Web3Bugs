// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IMiniSalesFlag.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";

contract MiniSalesFlag is IMiniSalesFlag, SafeOwnable {
  bool private saleStarted;

  function setSaleStarted(bool _newSaleStarted) external override onlyOwner {
    saleStarted = _newSaleStarted;
  }

  function hasSaleStarted() external view override returns (bool) {
    return saleStarted;
  }
}
