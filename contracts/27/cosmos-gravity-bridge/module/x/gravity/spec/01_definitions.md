<!--
order: 1
-->


# Definitions

This section outlines terminology used throughout the spec and code.

### Operator

This is a person (or people) who control a Cosmos SDK validator node. This is also called `valoper` or "Validator Operator" in the Cosmos SDK staking section

### Counter Chain

A chain that utilizes an EVM. Some examples of this are Polygon, Ethereum, and Ethereum Classic.

### Relayer

This is a type of node that submits updates to the Gravity contract on the counter chain and vice versa. It earns fees from the transactions in a batch.

### Gravity Tx Pool

Is a transaction pool that exists in the chain store of Cosmos -> Ethereum transactions waiting to be placed into a transaction batch

### Transaction Batch

A transaction batch is a set of Ethereum transactions to be sent from the Gravity Ethereum contract at the same time. This helps reduce the costs of submitting a batch. Batches have a maximum size (currently around 100 transactions) and are only involved in the Cosmos -> Ethereum flow

### Gravity Batch Pool

Is a transaction pool like structure that exists in the chains to store, separate from the `Gravity Tx Pool` it stores transactions that have been placed in batches that are in the process of being signed or being submitted by the `Orchestrator Set`

### Observed 

Events on Ethereum are considered `Observed` when the `Eth Signers` of 66% of the active Cosmos validator set during a given block has submitted an oracle message attesting to seeing the event.

### Validator Set Delta

This is a term for the difference between the validator set currently in the Gravity Ethereum contract and the actual validator set on the Cosmos chain. Since the validator set may change every single block there is essentially guaranteed to be some nonzero `Validator set delta` at any given time.

### Claim

An Ethereum event signed and submitted to cosmos by a single `Orchestrator` instance.

### Attestation

Aggregate of claims that eventually becomes `observed` by all orchestrators.

### Voucher

Represents a bridged ETH token on the Cosmos side. Their denom is has a `gravity` prefix and a hash that is build from contract address and contract token. The denom is considered unique within the system.

### Counterpart

A `Voucher` which is the locked opposing chain token in the contract

### Logic Calls

A logic call refers to a created action for a smart contract interaction on the opposing chain. 
