# Gravity messages

This is a reference document for Gravity message types. For code reference and exact
arguments see the [proto definitions](/module/proto/gravity/v1/msgs.proto)

## User messages

These are messages sent on the Cosmos side of the bridge by users. See [minting and locking](/docs/design/mint-lock.md) for a more
detailed summary of the entire deposit and withdraw process.

### SendToEth

SendToEth allows the user to specify a Ethereum destination, a token to send to Ethereum and a fee denominated in that same token
to pay the relayer. Note that this transaction will contain two fees. One fee amount to submit to the Cosmos chain, that can be paid
in any token and one fee amount for the Ethereum relayer that must be paid in the same token that is being bridged.

### CancelSendToEth

CancelSendToEth allows a user to retrieve a transaction that is in the batch pool but has not yet been packaged into a transaction batch
by a relayer running [RequestBatch](/docs/design/messages.md/###RequestBatch). For more details on this process see the [batch creation spec](/spec/batch-creation-spec.md)

## Relayer Messages

These are messages run by relayers. Relayers are unpermissioned and simply work to move things from Cosmos to Ethereum.

### RequestBatch

Relayers use `QueryPendingSendToEth` in [query.proto](/module/proto/gravity/v1/query.proto) to query the potential fees for a batch of each
token type. When they find a batch that they wish to relay they send in a RequestBatch message and the Gravity module creates a batch.

This then triggers the Ethereum Signers to send in ConfirmBatch messages, which the signatures required to submit the batch to the Ethereum chain.

At this point any relayer can package these signatures up into a transaction and send them to Ethereum.

As noted above this message is unpermissioned and it is safe to allow anyone to call this message at any time thanks to the rules described in the [batch creation spec](/spec/batch-creation-spec.md)

## Oracle Messages

All validators run two processes in addition to their Cosmos node. An Ethereum oracle and Ethereum signer, these are bundled into a single Orchestrator binary for ease of use.
for further reference on this process see the [design overview](/docs/design/overview.md), [oracle design](/docs/design/oracle.md), and [minting and locking](/docs/design/mint-lock.md)

The oracle observes the Ethereum chain for events from the [Gravity.sol](/solidity/contracts/Gravity.sol) contract before submitting them as messages to the Cosmos chain.

### DepositClaim

claim representing a `SendToCosmosEvent` from [Gravity.sol](/solidity/contracts/Gravity.sol). When this passes the oracle vote tokens will be issued to a Cosmos account.

### WithdrawClaim

claim representing a `TransactionBatchExecutedEvent` from [Gravity.sol](/solidity/contracts/Gravity.sol). When this passes the oracle vote the batch in state is cleaned up and tokens are burned/locked.

### ValsetUpdateClaim

claim representing a `ValsetUpdatedEvent` from [Gravity.sol](/solidity/contracts/Gravity.sol). When this passes the oracle vote reward amounts are tallied and minted.

### ERC20DeployedClaim

claim representing a `ERC20DeployedEvent` from [Gravity.sol](/solidity/contracts/Gravity.sol). When this passes the oracle vote it is checked for accuracy and adopted or rejected as the ERC20 representation of a Cosmos asset

### LogicCallExecutedClaim

claim representing a `LogicCallEvent` from [Gravity.sol](/solidity/contracts/Gravity.sol). When this passes the oracle vote the logic call in state is cleaned up and tokens are burned/locked.

## Ethereum Signer messages

All validators run two processes in addition to their Cosmos node. An Ethereum oracle and Ethereum signer, these are bundled into a single Orchestrator binary for ease of use.
for further reference on this process see the [design overview](/docs/design/overview.md), [eth signer design](/docs/design/ethereum-signing.md), and [minting and locking](/docs/design/mint-lock.md)

The Ethereum signer watches several [query endpoints](/module/proto/gravity/v1/query.proto) and it's only job is to submit a signature for anything that appears on those endpoints. For this reason the validator must provide a secure RPC to a Cosmos node following chain consensus. Or they risk being tricked into signing the wrong thing.

### ConfirmBatch

Submits an Ethereum signature over a batche appearing in the `LastPendingBatchRequestByAddr` query

### ConfirmLogicCall

Submits an Ethereum signature over a batche appearing in the `LastPendingLogicCallByAddr` query

### ValsetConfirm

Submits an Ethereum signature over a batche appearing in the `LastPendingValsetRequestByAddr` query

## Validator Messages

These are messages sent directly using the validators message key.

### SetOrchestratorAddress

This message sets the Orchestrator delegate keys described in the [design overview](/docs/design/overview.md)
