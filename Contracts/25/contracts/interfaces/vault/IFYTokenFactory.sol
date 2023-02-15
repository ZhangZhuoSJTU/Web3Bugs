// SPDX-License-Identifier: MIT
pragma solidity >= 0.8.0;

import "./IOracle.sol";
import "./IJoin.sol";

interface IFYTokenFactory {
  event FYTokenCreated(address indexed fyToken, address indexed asset, uint32 indexed maturity);

  function createFYToken(
    bytes6 baseId,
    IOracle oracle,
    IJoin baseJoin,
    uint32 maturity,
    string memory name,
    string memory symbol
  ) external returns (address);
}
