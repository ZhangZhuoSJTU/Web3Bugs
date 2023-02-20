// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

contract LendingPoolAaveMock {
  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  ) public pure {
    return ();
  }

  function withdraw(
    address asset,
    uint256 amount,
    address to
  ) public pure returns (uint256) {
    return (abi.decode("", (uint256)));
  }
}
