// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IUniswapPriceConverter {

  function assetToAssetThruRoute(
    address _tokenIn,
    uint256 _amountIn,
    address _tokenOut,
    uint32 _twapPeriod,
    address _routeThruToken,
    uint24[2] memory _poolFees
  ) external view returns (uint256 amountOut);
}