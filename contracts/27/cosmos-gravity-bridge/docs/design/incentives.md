# Incentives

This document covers all the incentivization systems in Gravity bridge.

## Validators

Currently validators in Gravity have only one carrot. The extra activity brought to the chain by a functioning bridge.

There are on the other hand a lot of negative incentives (sticks) that the validators must watch out for. These are outlined in the [slashing spec](/spec/slashing-spec.md).

One negative incentive that is not covered under slashing is the cost of submitting oracle submissions and signatures. Currently these operations are not incentivized, but still cost the validators fees to submit. This isn't an issue considering the low activity on most Cosmos based chains at the moment. But an active Ethereum bridge and dex may change that issue very quickly.

Some positive incentives for correctly participating in the operation of the bridge should be under consideration. In addition to eliminating the fees for mandatory submissions.

## Relaying rewards

Relaying rewards cover all messages that need to be submitted to Ethereum from Cosmos. This includes Validator set updates, transaction batches, and arbitrary logic calls. Keep in mind that these messages cost a variable amount of money based on wildly changing Ethereum gas prices and it's not unreasonable for a single batch to cost over a million gas.

A major design decision for our relayer rewards was to always issue them on the Ethereum chain. This has downsides, namely some strange behavior in the case of validator set update rewards.

But the upsides are undeniable, because the Ethereum messages pay `msg.sender` any existing bot in the Ethereum ecosystem will pick them up and try to submit them. This makes the relaying market much more competitive and less prone to cabal like behavior.

For a detailed look at how exactly all rewards are paid out see the [minting and locking](/docs/design/mint-lock.md##Relaying-rewards) design documentation.
