# Ethereum signing

As outlined in the [overview](/docs/design/overview.md) the [Gravity.sol](/solidity/contracts/Gravity.sol) contract acts as a weighted powers multisig for the funds sorted in the bridge. Effectively producing a situation where the validator set of the Cosmos chain owns all the funds in the bridge in a multisig that replicates their stake weighted voting power on Cosmos.

## Delegate Addresses

This document outlines the Ethereum signatures, all contract calls on [Gravity.sol](/solidity/contracts/Gravity.sol) accept an array of signatures provided by a validator set stored in the contract.

Validators make these signatures with their `Delegate Ethereum address` this is an Ethereum address set by the validator using the [SetOrchestratorAddress](/docs/design/messages.md/###SetOrchestratorAddress) message. The validator signs over this Ethereum address, as well as a Cosmos address for [oracle](/docs/design/oracle.md) operations and submits it to the chain to register these addresses for use in the Ethereum signer and oracle subsystems.

The `Delegate Ethereum address` then represents that validator on the Ethereum blockchain and will be added as a signing member of the multisig with a weighted voting power as close as possible to the Cosmos voting power.

## Signing flow

Validators run an external process called an `Ethereum Signer` this process is required because we can not yet insert this sort of simple signature logic into CosmosSdk based chains without significant modification to Tendermint. This may be possible in the future with [modifications to Tendermint](https://github.com/tendermint/tendermint/issues/6066).

It should be noted that both [GRAVSLASH-02](/spec/slashing-spec.md) and [GRAVSLASH-03](/spec/slashing-spec.md) could be eliminated with no loss of security if it where possible to perform the Ethereum signatures inside the consensus code. This is a pretty limited feature addition to Tendermint that would make Gravity far less prone to slashing.

Until such a change is provided the signing flow works as follows.

1. The Gravity module produces a `ValidatorSetRequest`, `BatchRequest`, or `LogicCallRequest`. These requests are placed into the store and act as coordination points for signatures
1. `Ethereum Signer` processes query these requests and perform a signature with the `Delegate Ethereum Address`
1. The `Ethereum Signer` submits the signature as a [transaction](/docs/design/ethereum-signing.md##Ethereum-Signer-Message)
1. The Gravity module verifies that the signature is made with the correct key and over the correct data before storing it
1. `Relayers` now query these signatures and assemble them into an Ethereum contract call to submit to [Gravity.sol](/solidity/contracts/Gravity.sol)
1. The message is submitted and executed on the Ethereum chain
