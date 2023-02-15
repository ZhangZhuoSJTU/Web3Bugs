![Gravity Bridge](./gravity-bridge.svg)

Gravity bridge is Cosmos <-> Ethereum bridge designed to run on the [Cosmos SDK blockchains](https://github.com/cosmos/cosmos-sdk) like the [Cosmos Hub](https://github.com/cosmos/gaia) focused on maximum design simplicity and efficiency.

Gravity is currently can transfer ERC20 assets originating on Cosmos or Ethereum to and from Ethereum, as well as move Cosmos assets to Ethereum as ERC20 representations.

## Documentation

### High level documentation

To understand Gravity at a high level, read [this blog post](https://blog.althea.net/how-gravity-works/). It is accessible and more concise than the rest of these docs, but does not cover every detail.

### Code documentation

This documentation lives with the code it references and helps to understand the functions and data structures involved. This is useful if you are reviewing or working on the code.

[Solidity Ethereum contract documentation](https://github.com/althea-net/cosmos-gravity-bridge/blob/main/solidity/contracts/contract-explanation.md)

[Go Cosmos module documentation](https://github.com/althea-net/cosmos-gravity-bridge/tree/main/module/x/gravity/spec)

### Specs

These specs cover specific areas of the bridge that a lot of thought went into. They explore the tradeoffs involved and decisions made.

[slashing-spec](/spec/slashing-spec.md)

[batch-creation-spec](/spec/batch-creation-spec.md)

[valset-creation-spec](/spec/valset-creation-spec.md)

### Design docs

These are mid-level docs which go into the most detail on various topics relating to the bridge.

[design overview](/docs/design/overview.md)

[Bootstrapping the bridge](/docs/design/bootstrapping.md)

[Minting and locking tokens in Gravity](/docs/design/mint-lock.md)

[Oracle design](/docs/design/oracle.md)

[Ethereum signing](/docs/design/ethereum-signing.md)

[Messages](/docs/design/messages.md)

[Parameters](/docs/design/parameters.md)

[Incentives](/docs/design/incentives.md)

[arbitrary logic](/docs/design/arbitrary-logic.md)

[relaying semantics](/docs/design/relaying-semantics.md)

### Developer Guide

To contribute to Gravity, refer to these guides.

[Development environment setup](/docs/developer/environment-setup.md)

[Code structure](/docs/developer/code-structure.md)

[Adding integration tests](/docs/developer/modifying-integration-tests.md)

[Security hotspots](/docs/developer/hotspots.md)

## Status

Gravity bridge is under development and will be undergoing audits soon. Instructions for deployment and use are provided in the hope that they will be useful.

It is your responsibility to understand the financial, legal, and other risks of using this software. There is no guarantee of functionality or safety. You use Gravity bridge entirely at your own risk.

You can keep up with the latest development by watching our [public standups](https://www.youtube.com/playlist?list=PL1MwlVJloJeyeE23-UmXeIx2NSxs_CV4b) feel free to join yourself and ask questions.

- Solidity Contract
  - [x] Multiple ERC20 support
  - [x] Tested with 100+ validators
  - [x] Unit tests for every throw condition
  - [x] Audit for assets originating on Ethereum
  - [x] Support for issuing Cosmos assets on Ethereum
- Cosmos Module
  - [x] Basic validator set syncing
  - [x] Basic transaction batch generation
  - [x] Ethereum -> Cosmos Token issuing
  - [x] Cosmos -> Ethereum Token issuing
  - [x] Bootstrapping
  - [x] Genesis file save/load
  - [x] Validator set syncing edge cases
  - [x] Slashing
  - [x] Relaying edge cases
  - [x] Transaction batch edge cases
  - [x] Support for issuing Cosmos assets on Ethereum
  - [ ] Audit
- Orchestrator / Relayer
  - [x] Validator set update relaying
  - [x] Ethereum -> Cosmos Oracle
  - [x] Transaction batch relaying
  - [ ] Tendermint KMS support
  - [ ] Audit

## The design of Gravity Bridge

- Trust in the integrity of the Gravity bridge is anchored on the Cosmos side. The signing of fraudulent validator set updates and transaction batches meant for the Ethereum contract is punished by slashing on the Cosmos chain. If you trust the Cosmos chain, you can trust the Gravity bridge operated by it, as long as it is operated within certain parameters.
- It is mandatory for peg zone validators to maintain a trusted Ethereum node. This removes all trust and game theory implications that usually arise from independent relayers, once again dramatically simplifying the design.

## Key design Components

- A highly efficient way of mirroring Cosmos validator voting onto Ethereum. The Gravity solidity contract has validator set updates costing ~500,000 gas ($2 @ 20gwei), tested on a snapshot of the Cosmos Hub validator set with 125 validators. Verifying the votes of the validator set is the most expensive on chain operation Gravity has to perform. Our highly optimized Solidity code provides enormous cost savings. Existing bridges incur more than double the gas costs for signature sets as small as 8 signers.
- Transactions from Cosmos to ethereum are batched, batches have a base cost of ~500,000 gas ($2 @ 20gwei). Batches may contain arbitrary numbers of transactions within the limits of ERC20 sends per block, allowing for costs to be heavily amortized on high volume bridges.

## Operational parameters ensuring security

- There must be a validator set update made on the Ethereum contract by calling the `updateValset` method at least once every Cosmos unbonding period (usually 2 weeks). This is because if there has not been an update for longer than the unbonding period, the validator set stored by the Ethereum contract could contain validators who cannot be slashed for misbehavior.
- Cosmos full nodes do not verify events coming from Ethereum. These events are accepted into the Cosmos state based purely on the signatures of the current validator set. It is possible for the validators with >2/3 of the stake to put events into the Cosmos state which never happened on Ethereum. In this case observers of both chains will need to "raise the alarm". We have built this functionality into the relayer.
