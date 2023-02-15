# Bootstrapping

This document describes the bootstrapping process for the Gravity bridge.

We assume the act of upgrading the Cosmos-based binary to have gravity module is already complete,
as approaches to that are discussed in many other places. Here we focus on the _activation_ step.

The [Gravity.sol](/solidity/contracts/Gravity.sol) contract can be initialized with the validator set from an active chain or from a Genesis file.

In a potentially contentious deployment scenario there may be an unlimited number of Gravity contracts deployed on Ethereum, each attempting to present themselves as the 'actual contract'.

In order to decide which contract is valid a governance vote setting the [bridge_ethereum_address](/docs/design/paramaters.md##bridge_ethereum_address) should be held. Once again in a contentious deployment scenario there may be many such votes going on in parallel.

During the voting process the validator set on the chain in question may change significantly. During the voting phase validators must run their `Ethereum Signer` but not their `Ethereum oracle` as there is no defined contract to relay events from.

It is the responsibility of each contract deployer to run at least one `relayer` directed at their contract. This will take the signatures produced by the `Ethereum Signer` and keep the validator set up to date during the voting period.

The `Ethereum oracle` implementation in this repo _should_, but does not currently (May 4th 2021), refer to the `bridge_ethereum_address` governance parameter and disable the `Ethereum oracle` functionality automatically until it is set.

It is very important that validators must run their `Ethereum Signer` from the moment the chain starts, as the Gravity module will be producing validator set updates and they will be subject to [slashing](/spec/slashing-spec.md) immediately.

Once the voting process is complete and the definitive Gravity contract address is set as a parameter bootstrapping is complete.
