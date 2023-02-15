# PoolTogether Micro Contest #1
- $18,000 USDC main award pot
- $2,000 USDC optimizations award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-07-pooltogether-micro-contest-1/submit)
- [Read our guidelines for more details](https://code423n4.com/compete)
- Starts July 29 00:00 UTC
- Ends July 31 23:59 UTC

# Contest Scope

This contest covers two additional yield sources for PoolTogether V3 prize pools: an mStable yield source and a swappable yield source.  The mStable yield source allows prize pools to use mStable as a yield source.  The swappable yield source allows governance to switch from one yield source to another.

| Contract | Description | Source Lines of Code | External Calls | Libraries |
|:------   |:------      |:------        |:------         |:------    | 
| [MStableYieldSource.sol](https://github.com/pooltogether/pooltogether-mstable/blob/0bcbd363936fadf5830e9c48392415695896ddb5/contracts/yield-source/MStableYieldSource.sol) | PoolTogether MStable Yield Source | ~75 |  [MStable SavingsContractV2](https://github.com/mstable/mStable-contracts/blob/master-v2/contracts/interfaces/ISavingsContract.sol) <br/> ERC20 token | OpenZeppelin SafeERC20 |
| [SwappableYieldSource.sol](https://github.com/pooltogether/swappable-yield-source/blob/89cf66a3e3f8df24a082e1cd0a0e80d08953049c/contracts/SwappableYieldSource.sol) | Meta yield source that allows governance to change yield sources | ~200 | [PoolTogether IYieldSource](https://github.com/pooltogether/yield-source-interface/blob/main/contracts/IYieldSource.sol) <br /> ERC20 token | OpenZeppelin Contracts <br /> [PoolTogether FixedPoint](https://github.com/pooltogether/fixed-point) |

# Areas of Concern

## mStable Interaction and Risks

- Are we interacting correctly with the mStable protocol?
- Are there fees or other risks that will impact the no-loss behaviour of the prize pool?
- Is it possible to be rugged?

## Swappable Yield Source Risks

- Will dust or balance inconsistencies lock funds?
- Under what conditions can it be rugged?

# Resources

[Documentation](https://docs.pooltogether.com/v/v3.3.0/protocol/overview)

[Developer Discord](https://discord.gg/D5cKnFGc)

## Architectural Walkthrough

<a href="https://www.youtube.com/watch?v=YW4z5IvO1-E" title="PoolTogether V3 Architecture Walkthough" target="_blank">
  <img src='./images/VIDEO_COVER.png' />
</a>
