// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../interfaces/IBalancerVault.sol";

contract MockBalancerVault is IBalancerVault {
  address[2] public tokens;
  uint256[2] public balances;
  address public pool;

  constructor(address[2] memory _tokens, address _pool) public {
    tokens = _tokens;
    pool = _pool;
  }

  function setBalances(uint256[2] memory _balances) public {
    balances = _balances;
  }

  function getPool(bytes32 poolId) external view override returns (address, PoolSpecialization) {
    return (pool, IBalancerVault.PoolSpecialization.TWO_TOKEN);
  }

  function getPoolTokens(bytes32 poolId)
    external
    view
    override
    returns (
      address[] memory _tokens,
      uint256[] memory _balances,
      uint256
    )
  {
    _tokens = new address[](2);
    _tokens[0] = tokens[0];
    _tokens[1] = tokens[1];

    _balances = new uint256[](2);
    _balances[0] = balances[0];
    _balances[1] = balances[1];
  }
}
