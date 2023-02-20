// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import "../AaveV3YieldSource.sol";

contract AaveV3YieldSourceHarness is AaveV3YieldSource {
  constructor(
    IAToken _aToken,
    IRewardsController _rewardsController,
    IPoolAddressesProviderRegistry _poolAddressesProviderRegistry,
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    address _owner
  )
    AaveV3YieldSource(
      _aToken,
      _rewardsController,
      _poolAddressesProviderRegistry,
      _name,
      _symbol,
      _decimals,
      _owner
    )
  {}

  function mint(address account, uint256 amount) public returns (bool) {
    _mint(account, amount);
    return true;
  }

  function tokenToShares(uint256 tokens) external view returns (uint256) {
    return _tokenToShares(tokens);
  }

  function sharesToToken(uint256 shares) external view returns (uint256) {
    return _sharesToToken(shares);
  }

  function tokenAddress() external view returns (address) {
    return _tokenAddress();
  }

  function poolProvider() external view returns (IPoolAddressesProvider) {
    return _poolProvider();
  }

  function pool() external view returns (IPool) {
    return _pool();
  }
}
