// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// Author: 0xKiwi.

import "./util/OwnableUpgradeable.sol";
import "./token/IERC20Upgradeable.sol";
import "./token/IERC20Metadata.sol";

contract StakingTokenProvider is OwnableUpgradeable {

  address public uniLikeExchange;
  address public defaultPairedToken;
  string public defaultPrefix;
  mapping(address => address) public pairedToken;
  mapping(address => string) public pairedPrefix;

  event NewDefaultPaired(address oldPaired, address newPaired);
  event NewPairedTokenForVault(address vaultToken, address oldPairedtoken, address newPairedToken);

  // This is an address provder to allow us to abstract out what liquidity 
  // our vault tokens should be paired with. 
  function __StakingTokenProvider_init(address _uniLikeExchange, address _defaultPairedtoken, string memory _defaultPrefix) public initializer {
    __Ownable_init();
    require(_uniLikeExchange != address(0), "Cannot be address(0)");
    require(_defaultPairedtoken != address(0), "Cannot be address(0)");
    uniLikeExchange = _uniLikeExchange;
    defaultPairedToken = _defaultPairedtoken;
    defaultPrefix = _defaultPrefix;
  }

  function setPairedTokenForVaultToken(address _vaultToken, address _newPairedToken, string calldata _newPrefix) external onlyOwner {
    require(_newPairedToken != address(0), "Cannot be address(0)");
    emit NewPairedTokenForVault(_vaultToken, pairedToken[_vaultToken], _newPairedToken);
    pairedToken[_vaultToken] = _newPairedToken;
    pairedPrefix[_vaultToken] = _newPrefix;
  }

  function setDefaultPairedToken(address _newDefaultPaired, string calldata _newDefaultPrefix) external onlyOwner {
    emit NewDefaultPaired(defaultPairedToken, _newDefaultPaired);
    defaultPairedToken = _newDefaultPaired;
    defaultPrefix = _newDefaultPrefix;
  }

  function stakingTokenForVaultToken(address _vaultToken) external view returns (address) {
    address _pairedToken = pairedToken[_vaultToken];
    if (_pairedToken == address(0)) {
      _pairedToken = defaultPairedToken;
    }
    return pairFor(uniLikeExchange, _vaultToken, _pairedToken);
  }

  function nameForStakingToken(address _vaultToken) external view returns (string memory) {
    string memory _pairedPrefix = pairedPrefix[_vaultToken];
    if (bytes(_pairedPrefix).length == 0) {
      _pairedPrefix = defaultPrefix;
    }
    address _pairedToken = pairedToken[_vaultToken];
    if (_pairedToken == address(0)) {
      _pairedToken = defaultPairedToken;
    }

    string memory symbol1 = IERC20Metadata(_vaultToken).symbol();
    string memory symbol2 = IERC20Metadata(_pairedToken).symbol();
    return string(abi.encodePacked(_pairedPrefix, symbol1, symbol2));
  }

  function pairForVaultToken(address _vaultToken, address _pairedToken) external view returns (address) {
    return pairFor(uniLikeExchange, _vaultToken, _pairedToken);
  }
  
  // returns sorted token addresses, used to handle return values from pairs sorted in this order
  function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
      require(tokenA != tokenB, 'UniswapV2Library: IDENTICAL_ADDRESSES');
      (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
      require(token0 != address(0), 'UniswapV2Library: ZERO_ADDRESS');
  }

  // calculates the CREATE2 address for a pair without making any external calls
  function pairFor(address factory, address tokenA, address tokenB) internal pure returns (address pair) {
      (address token0, address token1) = sortTokens(tokenA, tokenB);
      pair = address(uint160(uint256(keccak256(abi.encodePacked(
              hex'ff',
              factory,
              keccak256(abi.encodePacked(token0, token1)),
              hex'e18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303' // init code hash
      )))));
  }
}