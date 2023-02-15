# Dex Manager Facet

## How It Works

The DEX Manager Facet is used to approve/unapprove DEX addresses for use in the [LibSwap](./LibSwap.md) library. It reads and writes from the global storage defined in [LibStorage](./LibStorage.md).

Facets that use swapping inherit from the `Swapper.sol` contract which checks the whitelist before making any swaps.
