# Althea Gravity Bridge Contest

- $100,000 USDC (+ tokens) main award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-08-althea-gravity-bridge-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts August 26 00:00 UTC
- Ends September 8 23:59 UTC

| Glossary         |                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gravity bridge   | a cross chain bridge between [Cosmos-SDK](https://github.com/cosmos/cosmos-sdk/) and EVM based blockchains                                                               |
| Gravity Contract | The Gravity Bridge [Solidity contract](https://github.com/althea-net/cosmos-gravity-bridge/blob/main/solidity/contracts/Gravity.sol) that holds bridge funds on Ethereum |
| Gravity module   | The [Cosmos-SDK module](https://docs.cosmos.network/master/building-modules/intro.html) which makes up the SDK chain side of the bridge                                  |
| Orchestrator     | A special process run only by the validators of the Cosmos-SDK chain. Performing Oracle functions and producing Ethereum signatures                                      |
| Relayer          | A permissionless role that submits signatures from the validators to Ethereum as transactions                                                                            |

# Contest Scope

Gravity Bridge is a cross chain bridge between [Cosmos-SDK](https://github.com/cosmos/cosmos-sdk/) and EVM based chains.

The Gravity Bridge offers the ability to send funds from Ethereum to Cosmos and back, as well as the ability to deploy ERC20 representations of Cosmos based assets on Ethereum and transfer them bi-directionally as well.

Gravity is a complete system, made up of the Cosmos SDK 'module', a Solidity contract, and associated relaying/oracle code. This means the scope of this audit is quite large, covering the complete system across three programming languages.

# Code

**The commit hash `92d0e12cea813305e6472851beeb80bd2eaf858d` of the repo [github.com/althea-net/cosmos-gravity-bridge](https://github.com/althea-net/cosmos-gravity-bridge/) describes the exact code under audit.**

This helpful [link](https://github.com/althea-net/cosmos-gravity-bridge/tree/92d0e12cea813305e6472851beeb80bd2eaf858d) allows you to browse code specifically from this hash and you may find it useful when linking or otherwise referring to findings.

In addition to the code above, there is a smart contract for the Ethereum side of the bridge:

### [Gravity.sol](https://github.com/althea-net/cosmos-gravity-bridge/blob/92d0e12cea813305e6472851beeb80bd2eaf858d/solidity/contracts/Gravity.sol) (611 sloc)

The purpose of this contract is to store a representation of the Cosmos validator set and allow updates to that validator set, as well as deposits and withdraws to and from the contract. The events emitted by this contract are used by the oracle component of the bridge to perform actions on the Cosmos side of the bridge.

As part of a storage optimization the full validator set and voting power is not stored, only it's hash. The client submitting transactions must provide this data when it submits a transaction, this is a dramatic reduction in cost that makes updating validator sets with hundreds of thousands of frequently changing members cost feasible.

# Docs

The [Gravity Bridge developer guide](https://github.com/althea-net/cosmos-gravity-bridge/tree/92d0e12cea813305e6472851beeb80bd2eaf858d#developer-guide) covers:

- how to setup your development environment
- a detailed walkthrough of [how the bridge works](https://github.com/althea-net/cosmos-gravity-bridge/blob/92d0e12cea813305e6472851beeb80bd2eaf858d/docs/developer/code-structure.md)
- a useful list of [hotspots or key areas in the code where problems can be found](https://github.com/althea-net/cosmos-gravity-bridge/blob/92d0e12cea813305e6472851beeb80bd2eaf858d/docs/developer/hotspots.md)

All contributions are welcome! Gravity bridge is a complex system but you don't need to understand the entire flow and all three languages to contribute. Using the [hotspots](https://github.com/althea-net/cosmos-gravity-bridge/blob/92d0e12cea813305e6472851beeb80bd2eaf858d/docs/developer/hotspots.md) list as a guide anyone with Go and Rust know-how can get started.
