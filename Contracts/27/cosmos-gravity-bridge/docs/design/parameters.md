# Gravity parameters

This document describes and advises chain operators on configuring Gravity's parameters
the default parameters can be found in [genesis.go](/module/x/gravity/keeper/genesis.go)

## gravity_id

a random 32 byte value to prevent signature reuse, for example if the
cosmos validators decided to use the same Ethereum keys for another chain
also running Gravity we would not want it to be possible to play a deposit
from chain A back on chain B's Gravity. This value IS USED ON ETHEREUM so
it must be set in your genesis.json before launch and not changed after
deploying Gravity. Changing this value after deploying Gravity will result
in the bridge being non-functional. To recover just set it back to the original
value the contract was deployed with.

## contract_hash

the code hash of a known good version of the Gravity contract
solidity code. This can be used to verify the correct version
of the contract has been deployed. This is a reference value for
governance action only it is never read by any Gravity code

## bridge_ethereum_address

is address of the bridge contract on the Ethereum side, this is a
reference value for governance only and is not actually used by any
Gravity code.

In the future the relayer may attempt to use this value rather than require
the user to set this value themselves in the settings.

## bridge_chain_id

the unique identifier of the Ethereum chain, this is a reference value
only and is not actually used by any Gravity code

These reference values may be used by future Gravity client implementations
to allow for consistency checks.

## Signing windows

signed_valsets_window
signed_batches_window
signed_claims_window

These values represent the time in blocks that a validator has to submit
a signature for a batch or valset, or to submit a claim for a particular
attestation nonce.

In the case of attestations this clock starts when the
attestation is created, but only allows for slashing once the event has passed.
Note that that claims slashing is not currently enabled see [slashing spec](/spec/slashing-spec.md)

## target_batch_timeout

This is the 'target' value for when batches time out, this is a target because
Ethereum is a probabilistic chain and you can't say for sure what the block
frequency is ahead of time.

## Ethereum timing

average_block_time
average_ethereum_block_time

These values are the average Cosmos block time and Ethereum block time respectively
and they are used to compute what the target batch timeout is. It is important that
governance updates these in case of any major, prolonged change in the time it takes
to produce a block

## Slash fractions

slash_fraction_valset
slash_fraction_batch
slash_fraction_claim
slash_fraction_conflicting_claim

The slashing fractions for the various gravity related slashing conditions. The first three
refer to not submitting a particular message, the third for failing to submit a claim and the last for submitting a different claim than other validators.

Note that claim slashing is currently disabled as outlined in the [slashing spec](/spec/slashing-spec.md)
