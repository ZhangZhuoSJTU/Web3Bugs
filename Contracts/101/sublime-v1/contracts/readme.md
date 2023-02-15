# PriceOracle

```solidity
function getLatestPrice(address num, address den) external view override returns (uint256, uint256);
```

The price oracle contract uses Chain link protocol to fetch the latest price of an asset relative to another asset. As a fallback for chainlink, Uniswap is used as the oracle.

For the price oracle to work, first the chain link feed addresses for those assets need to be set by the admin. Thus the price oracle will only work for configured assets.