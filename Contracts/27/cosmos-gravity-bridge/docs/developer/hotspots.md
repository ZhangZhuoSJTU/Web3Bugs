# Hotspots

This document contains a list of code Hotspots, these are places where I expect vulnerabilities to be found mostly focused around null pointer exceptions, parsing issues, or other vulnerabilities that focus on exploiting the logic and not the fundamental design of Gravity Bridge

## Ethereum Event Parser

The Orchestrator parses and relays events from Ethereum to the [oracle](/docs/design/oracle.md). Parsing those events is handled by a parser in [ethereum_events.rs](/orchestrator/gravity_utils/strc/types/ethereum_events.rs). While this parser has some unit tests it is not fuzz tested. Any possibility of incorrect parsing here may result in an attack where deposits are faked, or less severely, the bridge is halted due to Oracle disagreements.

## Attestation Executor

The attestation system in [attestation.go](/module/x/gravity/keeper/attestation.go) and [attestation_handler.go](/module/x/gravity/keeper/attestation_handler.go) manages [oracle](/docs/design/oracle.md) events, by aggregating a number of claims made by validators into a single 'attestation' covering a given event. This, as well as the `attestation_handler` logic that covers all possible Oracle events are good places to look for logic flaws.

## Endblocker Logic

Gravity bridge performs many tasks at the end of each block. The [EndBlocker](/module/x/gravity/abci.go) contains the code for each of those tasks. Including slashing, pruning, and generating new validator set snapshots for Ethereum.

## PowerDiff Function

The [valset creation spec](/spec/valset-creation-spec.md) is a good place to start for background here.

The [PowerDiff](/module/x/gravity/types/types.go) function determines the difference in normalized voting power between two validator set snapshots. Logic errors in this function could result in too many validator set updates being created, or too few.

## Remove from outgoing pool and refund

The [batch creation spec](/spec/batch-creation-spec.md) is a good place to start for background here.

[RemoveFromOutgoingPoolAndRefund](/module/x/gravity/keeper/pool.go) allows a user to refund any Gravity bridge withdraw that has been created, but not yet removed from the transaction pool to place into a batch. It is totally safe to issue this refund as before a batch has been formed there's no possible way their transaction could have executed on Ethereum. That being said allowing transactions that are into batches to call this function would result in a double spend.

## Build outgoing tx batch

The [batch creation spec](/spec/batch-creation-spec.md) is a good place to start for background here.

[BuildOutgoingTXBatch](/module/x/gravity/keeper/batch.go) builds transaction batches out of the on-chain transaction pool of withdraws to Ethereum. Transactions must successfully be removed from the index, included only once, and returned properly in `OutgoingTxBatchExecuted`

## Outgoing tx batch executed

The [batch creation spec](/spec/batch-creation-spec.md) is a good place to start for background here.

[OutgoingTxBatchExecuted](/module/x/gravity/keeper/batch.go) returns user transactions to the pool once the [attestation_handler](/module/x/gravity/keeper/attestation_handler.go) has processed an [oracle](/docs/design/oracle.md) event that would make it impossible for that batch to be executed.
