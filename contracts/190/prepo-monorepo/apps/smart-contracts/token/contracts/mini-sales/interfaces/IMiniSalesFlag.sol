// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

interface IMiniSalesFlag {
  function setSaleStarted(bool newSaleStarted) external;

  function hasSaleStarted() external view returns (bool);
}
