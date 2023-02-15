# LibSwap

## Description

A library used to perform multiple swaps given an array of DEX addresses and calldata. This makes it very flexible
but also dangerous in that it allows arbitrary calls to any contract. The `swap` function should not be used
without additional security checks (e.g. whitelisting of allowed DEXs).
