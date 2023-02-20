<img align="right" width="180" height="100" top="100" src="./assets/makerdao.png">

# Multicall • [![tests](https://github.com/mds1/multicall/actions/workflows/tests.yml/badge.svg)](https://github.com/mds1/multicall/actions/workflows/tests.yml) ![GitHub](https://img.shields.io/github/license/mds1/multicall)

Multicall aggregates results from multiple contract constant function calls.

This reduces the number of separate JSON RPC requests that need to be sent
(especially useful if using remote nodes like Infura), while also providing the
guarantee that all values returned are from the same block (like an atomic read)
and returning the block number the values are from (giving them important
context so that results from old blocks can be ignored if they're from an
out-of-date node).

There are three contracts in this repository:
- [`Multicall`](./src/Multicall.sol): The original contract containing an `aggregate` method to batch calls
- [`Multicall2`](./src/Multicall2.sol): The same as Multicall, but provides additional functions that allow calls within the batch to fail. Useful for situations where a call may fail depending on the state of the contract.
- [`Multicall3`](./src/Multicall3.sol): **This is the recommended version**. It's ABI is backwards compatible with Multicall and Multicall2, but it's cheaper to use (so you can fit more calls into a single request), and it adds an `aggregate3` method so you can specify whether calls are allowed to fail on a per-call basis. Additionally, it's deployed at every network on the same address.

These contracts can also be used to batch on-chain transactions. If using them
for this purpose, be aware these contracts are unaudited so use them at your own
risk. Additionally, make sure you understanding how `msg.sender` works when
calling vs. delegatecalling to a Multicall contract.

## Deployments

### Multicall3 Contract Addresses

Multicall3 contains the following improvements over prior multicall contracts:
- Cheaper to use: fit more calls into a single request before hitting the RPC's `eth_call` gas limit
- Backwards compatible: it can be dropped in to existing code by simply changing the address
- Uses the same, memorable deployment address on all networks

| Chain                   | Address                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Mainnet                 | [0xcA11bde05977b3631167028862bE2a173976CA11](https://etherscan.io/address/0xca11bde05977b3631167028862be2a173976ca11#code)                     |
| Kovan                   | [0xcA11bde05977b3631167028862bE2a173976CA11](https://kovan.etherscan.io/address/0xca11bde05977b3631167028862be2a173976ca11#code)               |
| Rinkeby                 | [0xcA11bde05977b3631167028862bE2a173976CA11](https://rinkeby.etherscan.io/address/0xca11bde05977b3631167028862be2a173976ca11#code)             |
| Görli                   | [0xcA11bde05977b3631167028862bE2a173976CA11](https://goerli.etherscan.io/address/0xca11bde05977b3631167028862be2a173976ca11#code)              |
| Ropsten                 | [0xcA11bde05977b3631167028862bE2a173976CA11](https://ropsten.etherscan.io/address/0xca11bde05977b3631167028862be2a173976ca11#code)             |
| Optimism                | [0xcA11bde05977b3631167028862bE2a173976CA11](https://optimistic.etherscan.io/address/0xca11bde05977b3631167028862be2a173976ca11#code)          |
| Optimism Kovan          | [0xcA11bde05977b3631167028862bE2a173976CA11](https://kovan-optimistic.etherscan.io/address/0xca11bde05977b3631167028862be2a173976ca11#code)    |
| Arbitrum                | [0xcA11bde05977b3631167028862bE2a173976CA11](https://arbiscan.io/address/0xca11bde05977b3631167028862be2a173976ca11#code)                      |
| Arbitrum Rinkeby        | [0xcA11bde05977b3631167028862bE2a173976CA11](https://testnet.arbiscan.io/address/0xca11bde05977b3631167028862be2a173976ca11#code)              |
| Polygon                 | [0xcA11bde05977b3631167028862bE2a173976CA11](https://polygonscan.com/address/0xca11bde05977b3631167028862be2a173976ca11#code)                  |
| Mumbai                  | [0xcA11bde05977b3631167028862bE2a173976CA11](https://mumbai.polygonscan.com/address/0xca11bde05977b3631167028862be2a173976ca11#code)           |
| Gnosis Chain (xDai)     | [0xcA11bde05977b3631167028862bE2a173976CA11](https://blockscout.com/xdai/mainnet/address/0xcA11bde05977b3631167028862bE2a173976CA11/contracts) |
| Avalanche               | [0xcA11bde05977b3631167028862bE2a173976CA11](https://snowtrace.io/address/0xcA11bde05977b3631167028862bE2a173976CA11#code)                     |
| Avalanche Fuji          | [0xcA11bde05977b3631167028862bE2a173976CA11](https://testnet.snowtrace.io/address/0xcA11bde05977b3631167028862bE2a173976CA11#code)             |
| Fantom Testnet          | [0xcA11bde05977b3631167028862bE2a173976CA11](https://testnet.ftmscan.com/address/0xcA11bde05977b3631167028862bE2a173976CA11#code)              |
| Fantom Opera            | [0xcA11bde05977b3631167028862bE2a173976CA11](https://ftmscan.com/address/0xcA11bde05977b3631167028862bE2a173976CA11#code)                      |
| BNB Smart Chain         | [0xcA11bde05977b3631167028862bE2a173976CA11](https://bscscan.com/address/0xcA11bde05977b3631167028862bE2a173976CA11#code)                      |
| BNB Smart Chain Testnet | [0xcA11bde05977b3631167028862bE2a173976CA11](https://testnet.bscscan.com/address/0xcA11bde05977b3631167028862bE2a173976CA11#code)              |

If there is a network Multicall3 is not yet deployed on, please open an issue
with a link to the block explorer. You can speed up the new deploy by sending
funds to cover the deploy cost to the deployer account: 0x05f32B3cC3888453ff71B01135B34FF8e41263F2

## Historical Deployments

Multicall3 is the recommended version for most use cases, but deployment addresses for
Multicalll and Multicall2 are retained below for posterity. The Multicall smart contract
was originally intended to be used with
[Multicall.js](https://github.com/makerdao/multicall.js)
in front-end dapps. However, that library has not been updated to work with Multicall2
and Multicall3, so it will likely only work for the original Multicall contract.

### Multicall Contract Addresses

The deployed [Multicall](https://github.com/mds1/multicall/blob/master/src/Multicall.sol) contract can be found in commit [`bb309a9`](https://github.com/mds1/multicall/commit/bb309a985379c40bdbbc9a8613501732ed98bb9c) or earlier. After that commit, the contract was updated to a more recent Solidity version (with minimal improvements), primarily for compatibility with the test suite.

| Chain    | Address                                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mainnet  | [0xeefba1e63905ef1d7acba5a8513c70307c1ce441](https://etherscan.io/address/0xeefba1e63905ef1d7acba5a8513c70307c1ce441#contracts)                      |
| Kovan    | [0x2cc8688c5f75e365aaeeb4ea8d6a480405a48d2a](https://kovan.etherscan.io/address/0x2cc8688c5f75e365aaeeb4ea8d6a480405a48d2a#contracts)                |
| Rinkeby  | [0x42ad527de7d4e9d9d011ac45b31d8551f8fe9821](https://rinkeby.etherscan.io/address/0x42ad527de7d4e9d9d011ac45b31d8551f8fe9821#contracts)              |
| Görli    | [0x77dca2c955b15e9de4dbbcf1246b4b85b651e50e](https://goerli.etherscan.io/address/0x77dca2c955b15e9de4dbbcf1246b4b85b651e50e#contracts)               |
| Ropsten  | [0x53c43764255c17bd724f74c4ef150724ac50a3ed](https://ropsten.etherscan.io/address/0x53c43764255c17bd724f74c4ef150724ac50a3ed#code)                   |
| xDai     | [0xb5b692a88bdfc81ca69dcb1d924f59f0413a602a](https://blockscout.com/poa/dai/address/0xb5b692a88bdfc81ca69dcb1d924f59f0413a602a)                      |
| Polygon  | [0x11ce4B23bD875D7F5C6a31084f55fDe1e9A87507](https://explorer-mainnet.maticvigil.com/address/0x11ce4B23bD875D7F5C6a31084f55fDe1e9A87507/contracts)   |
| Mumbai   | [0x08411ADd0b5AA8ee47563b146743C13b3556c9Cc](https://explorer-mumbai.maticvigil.com/address/0x08411ADd0b5AA8ee47563b146743C13b3556c9Cc/transactions) |
| Optimism | [0x187C0F98FEF80E87880Db50241D40551eDd027Bf](https://optimistic.etherscan.io/address/0x187C0F98FEF80E87880Db50241D40551eDd027Bf#code)                |
| Arbitrum | [0xB064Fe785d8131653eE12f3581F9A55F6D6E1ca3](https://arbiscan.io/address/0xB064Fe785d8131653eE12f3581F9A55F6D6E1ca3#code)                            |

### Multicall2 Contract Addresses

The deployed [Multicall2](https://github.com/mds1/multicall/blob/master/src/Multicall2.sol) contract can be found in commit [`bb309a9`](https://github.com/mds1/multicall/commit/bb309a985379c40bdbbc9a8613501732ed98bb9c) or earlier. After that commit, the contract was updated to a more recent Solidity version (with minimal improvements), primarily for compatibility with the test suite.

Multicall2 is the same as Multicall, but provides additional functions that allow calls within the batch to fail. Useful for situations where a call may fail depending on the state of the contract.

| Chain   | Address                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Mainnet | [0x5ba1e12693dc8f9c48aad8770482f4739beed696](https://etherscan.io/address/0x5ba1e12693dc8f9c48aad8770482f4739beed696#contracts)         |
| Kovan   | [0x5ba1e12693dc8f9c48aad8770482f4739beed696](https://kovan.etherscan.io/address/0x5ba1e12693dc8f9c48aad8770482f4739beed696#contracts)   |
| Rinkeby | [0x5ba1e12693dc8f9c48aad8770482f4739beed696](https://rinkeby.etherscan.io/address/0x5ba1e12693dc8f9c48aad8770482f4739beed696#contracts) |
| Görli   | [0x5ba1e12693dc8f9c48aad8770482f4739beed696](https://goerli.etherscan.io/address/0x5ba1e12693dc8f9c48aad8770482f4739beed696#contracts)  |
| Ropsten | [0x5ba1e12693dc8f9c48aad8770482f4739beed696](https://ropsten.etherscan.io/address/0x5ba1e12693dc8f9c48aad8770482f4739beed696#code)      |

### Third-Party Deployments

The following addresses have been submitted by external contributors and have not been vetted by Multicall maintainers.

| Chain       | Address                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| RSK Mainnet | [0x6c62bf5440de2cb157205b15c424bceb5c3368f5](https://explorer.rsk.co/address/0x6c62bf5440de2cb157205b15c424bceb5c3368f5)         |
| RSK Testnet | [0x9e469e1fc7fb4c5d17897b68eaf1afc9df39f103](https://explorer.testnet.rsk.co/address/0x9e469e1fc7fb4c5d17897b68eaf1afc9df39f103) |
| BSC Mainnet | [0x41263cba59eb80dc200f3e2544eda4ed6a90e76c](https://bscscan.com/address/0x41263cba59eb80dc200f3e2544eda4ed6a90e76c)             |
| BSC Testnet | [0xae11C5B5f29A6a25e955F0CB8ddCc416f522AF5C](https://testnet.bscscan.com/address/0xae11c5b5f29a6a25e955f0cb8ddcc416f522af5c)     |

## Development

This repo uses [Foundry](https://github.com/gakonst/foundry) for development and testing
and git submodules for dependency management.

Clone the repo and run `forge install` to install dependencies and `forge test` to run tests.

### Foundry Setup

If you don't have Foundry installed, run the command below to get `foundryup`, the Foundry toolchain installer:

```sh
curl -L https://foundry.paradigm.xyz | bash
```

Then, in a new terminal session or after reloading your `PATH`, run `foundryup` to get the latest `forge` and `cast` binaries.

To learn more about Foundry:
- Visit the [repo](https://github.com/gakonst/foundry)
- Check out the Foundry [book](https://onbjerg.github.io/foundry-book/)
- Learn advanced ways to use `foundryup` in the [foundryup package](https://github.com/gakonst/foundry/tree/master/foundryup)
- Check out the [awesome-foundry](https://github.com/crisgarner/awesome-foundry) repo

### Gas Golfing Tricks and Optimizations

Below is a list of some of the optimizations used by Multicall3's `aggregate3` and `aggregate3Value` methods:
- In for loops, array length is cached to avoid reading the length on each loop iteration
- In for loops, the counter is incremented within an `unchecked` block
- In for loops, the counter is incremented with the prefix increment (`++i`) instead of a postfix increment (`i++`)
- All revert strings fit within a single 32 byte slot
- Function parameters use `calldata` instead of `memory`
- Instead of requiring `call.allowFailure || result.success`, we use assembly's `or()` instruction to [avoid](https://twitter.com/transmissions11/status/1501645922266091524) a `JUMPI` and `iszero()` since it's cheaper to evaluate both conditions
- Methods are given a `payable` modifier which removes a check that `msg.value == 0` when calling a method
- Calldata and memory pointers are used to cache values so they are not read multiple times within a loop
- No block data (e.g. block number, hash, or timestamp) is returned by default, and is instead left up to the caller
- The value accumulator in `aggregate3Value` is within an `unchecked` block

Read more about Solidity gas optimization tips:
- [Generic writeup about common gas optimizations, etc.](https://gist.github.com/hrkrshnn/ee8fabd532058307229d65dcd5836ddc) by [Harikrishnan Mulackal](https://twitter.com/_hrkrshnn)
- [Yul (and Some Solidity) Optimizations and Tricks](https://hackmd.io/@gn56kcRBQc6mOi7LCgbv1g/rJez8O8st) by [ControlCplusControlV](https://twitter.com/controlcthenv)
