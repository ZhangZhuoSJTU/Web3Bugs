# Code structure intro

This document goes over at a high level how the code in this repo is organized
and comes together to form a functioning bridge. We will frequently link to spec or
design documentation, when we do you should take a detour to read it.

Gravity bridge is a large codebase with many components, so this document focuses on end to end flows providing touchpoints along the entire path across all the components.

## Deposit from Ethereum To Cosmos

This covers the complete flow, with code links, for a deposit. This is covered conceptually in [minting and locking](/docs/design/mint-lock.md) as well as [Oracle](/docs/design/oracle.md) which you should read first.

A user on Ethereum calls the [gravity.sol](/solidity/contracts/Gravity.sol) contract with a `sendToCosmos` function call. This call includes the destination and amount to bridge.

This fires a `SendToCosmosEvent`, this event is then parsed by the `eth_oracle_main_loop` in the [Orchestrator](/orchestrator/orchestrator/src/main_loop.rs) which is calling [check_for_events](/orchestrator/orchestrator/src/ethereum_event_watcher.rs) every few seconds, gathering data from the operators Ethereum node. These events are parsed from Ethereum ABI encoded responses using the parser in [gravity_utils](/orchestrator/gravity_utils/src/types/ethereum_events.rs).

Once the event has been interpreted it must be submitted to the Oracle. Near the bottom of [check_for_events](/orchestrator/orchestrator/src/ethereum_event_watcher.rs) we start to format these for submission.

As a requirement of the oracle events must be submitted in order, so if a validator has submitted event 5, they must submit event 6 next. They can not resubmit event 5 or submit event 7. Since we're getting the events statelessly there is logic to [get_last_event_nonce_for_validator](/orchestrator/cosmos_gravity/src/query.rs) and use this to filter.

Finally we perform the last step of this process in the Orchestrator [send_ethereum_claims](/orchestrator/cosmos_gravity/src/send.rs). This submits the ordered events to Cosmos, many events in a single message to increase efficiency.

From here we step into the Go codebase where you'll find claim message types in [msgs.go](/module/x/gravity/types/msgs.go) and [msg_server.go](/module/x/gravity/keeper/msg_server.go) But these only add the claim to the store after checking validity.

Claims are added to the store with a function called [Attest](/module/x/gravity/keeper/attestation.go). This only checks that the submission is valid and stores the submission. This either creates or adds to an `Attestation`. You can think of the `Attestation` as 'a potential event that might have happened' whereas a `claim` is simply something that one validator said. Multiple `claims` are aggregated into a single `Attestation` if they are making the same `claim`. For example that event nonce 50 is a deposit to address x for value y.

At the end of every block the [EndBlocker](/module/x/gravity/abci.go) runs. In it the function [attestationTally](/module/x/gravity/abci.go) we loop overall `Attestations` and call [TryAttestation](/module/x/gravity/keeper/attestation.go). This function loops over every `claim` and determines if the validators making these claims sum to greater than 66% of the current voting power. If that's the case the `Attestation` is executed by the [AttestationHandler](/module/x/gravity/keeper/attestation_handler.go).

The [AttestationHandler](/module/x/gravity/keeper/attestation_handler.go) contains a case for every possible state change required by the oracle and mints, burns, or processes an event as required. In this case we only care about MsgSendToCosmosClaim.

Here we determine if the deposited coin is Cosmos Originated, at which point we should unlock the Cosmos token we locked into the bank module and send it to the user. If it is Ethereum originated we mint and issue to the user a representative token.

## Withdraw from Cosmos to Ethereum

This covers the complete flow, including code links, for a withdraw. This is covered conceptually in [minting and locking](/docs/design/mint-lock.md), [Ethereum signing](/docs/design/ethereum-signing.md), and [batch creation spec](/spec/batch-creation-spec.md) which you should read first.

First a user on the Cosmos chain calls [MsgSendToEth](/module/proto/gravity/v1/msgs.proto). This message will contain two fees. One fee for the Cosmos transaction, and another fee for the bridge.

By the time we handle the send in [msg_server.go](/module/x/gravity/keeper/msg_server.go) the Cosmos chain tx fee has already been handled. [ValidateBasic](/module/x/gravity/types/msgs.go) verifies that the bridge fee is the same as the bridge asset being sent to Ethereum. As covered in [minting and locking](/docs/design/mint-lock.md) this is so that the relayers can be rewarded on the Ethereum side of the bridge.

Once the message has passed basic verification it moves into the TxPool [AddToOutgoingPool](/module/x/gravity/keeper/pool.go). There is a pool of transactions waiting to go to Ethereum for every ERC20 token type on the bridge. The reasoning for this is to allow for much lower withdraw costs. Think 200k gas versus 12k gas per withdraw for a 100 withdraw batch.

As covered in the [batch creation spec](/spec/batch-creation-spec.md) transactions will wait in this pool until one of two things happens.

The user may call [MsgCancelSendToEth](/module/proto/gravity/v1/msgs.proto) which will remove the transaction from the pool and refund the user. In [msg_server.go](/module/x/gravity/keeper/msg_server.go) we call [RemoveFromOutgoingPoolAndRefund](/module/x/gravity/keeper/pool.go).

Alternatively a relayer using the [BatchFees](/module/proto/gravity/v1/query.proto) query endpoint may decide to call [MsgRequestBatch](/module/proto/gravity/v1/msgs.proto). Note automatic execution of request batch is not currently implemented and is in issue #305

RequestBatch in [msg_server.go](/module/x/gravity/keeper/msg_server.go) calls [BuildOutgoingTXBatch](/module/x/gravity/keeper/batch.go) which implements the protocol defined in the [batch creation spec](/spec/batch-creation-spec.md). Creating a batch of up to `OutgoingTxBatchSize` number of withdraws in order of descending fee amounts.

Now the resulting batch is made available to [Ethereum signers](/docs/design/ethereum-signing.md) via the [LastPendingBatchRequestByAddr](/module/proto/gravity/v1/query.proto) endpoint. The [LastPendingBatchRequestsByAddr](/module/x/gravity/keeper/grpc_query.go) endpoint looks up for the Ethereum signer what batches it has not yet signed that it must sign to avoid slashing see [slashing spec](/spec/slashing-spec.md).

The [eth_signer_main_loop](/orchestrator/orchestrator/src/main_loop.rs) essentially just queries three of these endpoints (one for each type of signature) and submits signatures via [MsgConfirmBatch](/module/proto/gravity/v1/msgs.proto). Which is handled in [msg_server.go](/module/x/gravity/keeper/msg_server.go).

The MsgConfirmBatch handler loads the tx batch and verifies that the Ethereum signature is from the correct address, over the correct batch, and not already submitted in `confirmHandlerCommon` (also in msg_server.go).

At this point the batch is ready to execute and any relayer may relay it to Ethereum.

In the [relayer_main_loop](/orchestrator/relayer/src/main_loop.rs) the query endpoint [OutgoingTxBatches](/module/proto/gravity/v1/query.proto) implemented in [grpc_query.go](/module/x/gravity/keeper/grpc_query.go) lists the last 100 outgoing tx batches. The relayer then calls [BatchConfirms](/module/proto/gravity/v1/query.proto) which returns all the signatures for the given batch.

Now the challenge is to take these signatures and prepare them for submission to Ethereum. This is a non-trivial task.
See [relaying semantics doc](/docs/design/relaying-semantics.md).

[get_batches_and_signatures](/orchestrator/relayer/src/batch_relaying.rs) calls a function [order_sigs](/orchestrator/gravity_utils/src/types/valsets.rs) which takes the latest validator set on Ethereum as well as the array of signatures and prepares them for submission.

All power in [gravity.sol](/solidity/contracts/Gravity.sol) is normalized such that total voting power is `2^64`, this allows `order_sigs` to determine if enough voting power has voted for a given batch to be valid. This local simulation approach helps debug problems and is much faster than simply trying to simulate the transaction using the Ethereum RPC.

Finally [should_relay_batch](/orchestrator/relayer/src/batch_relaying.rs) is called. This takes the batch + signatures confirmed in the previous step and simulates it's ETH cost to execute and compares that value to the value of the reward on UniswapV3. If the relayer would lose money relaying the batch it does not do so.

Once all these steps and checks have been passed [send_eth_transaction_batch](/orchestrator/ethereum_gravity/src/submit_batch.rs) is called.

`submitBatch` in [gravity.sol](/solidity/contracts/Gravity.sol) verifies the signatures and executes the sends before emitting a `TransactionBatchExecutedEvent`

this event is then parsed by the `eth_oracle_main_loop` and the rest of the oracle procedure has been documented in [Deposit from Ethereum To Cosmos](#deposit-from-ethereum-to-cosmos)

Picking back up at the [AttestationHandler](/module/x/gravity/keeper/attestation_handler.go) the case for a `MsgBatchSendToEthClaim` calls [OutgoingTxBatchExecuted](/module/x/gravity/keeper/batch.go). This purges batches that can no longer execute (lower nonce than the batch that has executed) and frees their transactions for the creation of new batches or `MsgCancelSendToEth` according to the [batch creation spec](/spec/batch-creation-spec.md)

## Validator Set Update

This is covered conceptually in the [valset creation spec](/spec/valset-creation-spec.md), [Ethereum signing](/docs/design/ethereum-signing.md) as well as [relaying-semantics](/docs/design/relaying-semantics.md) which you should read before this.

One of the biggest challenges in the operation of the Gravity bridge is keeping the validator set mirrored in the [gravity.sol](/solidity/contracts/Gravity.sol) contract. The validator set update process is kicked off in the [EndBlocker](/module/x/gravity/abci.go) at the end of every block.

Specifically `createValsets` this function retrieves the current validator set as well as the last generated validator set snapshot from the store. Using a function [PowerDiff](/module/x/gravity/types/types.go) it determines if the current voting power has changed more than 5% since the last snapshot was created. If so a new validator set snapshot is created.

Once the new validator set snapshot is created it is available to [Ethereum signers](/docs/design/ethereum-signing.md) via [LastPendingValsetRequestByAddr](/module/proto/gravity/v1/query.proto) endpoint. The [LastPendingValsetRequestsByAddr](/module/x/gravity/keeper/grpc_query.go) endpoint looks up for the Ethereum signer what validator set snapshots it has not yet signed that it must sign to avoid slashing see [slashing spec](/spec/slashing-spec.md).

The [eth_signer_main_loop](/orchestrator/orchestrator/src/main_loop.rs) essentially just queries three of these endpoints (one for each type of signature) and submits signatures via [MsgValsetConfirm](/module/proto/gravity/v1/msgs.proto). Which is handled in [msg_server.go](/module/x/gravity/keeper/msg_server.go).

The `MsgValsetConfirm` handler loads the tx batch and verifies that the Ethereum signature is from the correct address, over the correct valset, and not already submitted in `confirmHandlerCommon` (also in msg_server.go).

At this point the valset is ready to execute and any relayer may relay it to Ethereum.

The relaying is described in [Withdraw from Cosmos to Ethereum](#withdraw-from-cosmos-to-ethereum) with some minor differences in described in relaying semantics and an implementation in [valset_relaying.rs](/orchestrator/relayer/src/valset_relaying.rs).

Upon execution in the [gravity.sol](/solidity/contracts/Gravity.sol) `updateValset` endpoint the validator set will be updated, emitting a `ValsetUpdatedEvent`.

this event is then parsed by the `eth_oracle_main_loop` and the rest of the oracle procedure has been documented in [Deposit from Ethereum To Cosmos](#deposit-from-ethereum-to-cosmos)

Picking back up at the [AttestationHandler](/module/x/gravity/keeper/attestation_handler.go) the case for ValsetUpdatedEvents is used to progress batch timeouts where required, and valset pruning.

## Validator Set Rewards

TODO

## ERC20 representation deployment

TODO
