# Design Overview

This document covers a general overview of the Gravity bridge design process, more detailed documents for specific
things are listed below.

### Design docs

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

### Specs

[slashing-spec](/spec/slashing-spec.md)

[batch-creation-spec](/spec/batch-creation-spec.md)

[valset-creation-spec](/spec/valset-creation-spec.md)

## Workflow

The high-level workflow is:

Activation Steps:

- Bootstrap Cosmos SDK chain
- Deploy Ethereum contract

Token Transfer Steps:

- Transfer original ERC20 tokens from ETH to Cosmos
- Transfer pegged tokens from Cosmos to ETH
- Update Cosmos Validator set on ETH

The first two steps are done once, the other 3 repeated many times.

## Definitions

Words matter and we seek clarity in the terminology, so we can have clarity in our thinking and communication.
Key concepts that we mention below will be defined here:

- `Operator` - This is a person (or people) who control a Cosmos SDK validator node. This is also called `valoper` or "Validator Operator" in the Cosmos SDK staking section
- `Full Node` - This is an _Ethereum_ Full Node run by an Operator
- `Validator` - This is a Cosmos SDK Validating Node (signing blocks)
- `Eth Signer` (name WIP) - This is a separate binary controlled by an Operator that holds Ethereum private keys used for signing transactions used to move tokens between the two chains.
- `Oracle` (name WIP) - This is a separate binary controlled by an Operator that holds Cosmos SDK private keys used for bringing data from the Ethereum chain over to the Cosmos chain by submitting `Claims`, these claims aggregate into an `Attestation`
- `Orchestrator` - a single binary that combines the `Eth Signer`, `Oracle`, and `Relayer` for ease of use by the `Operator`
- `Relayer` - This is a type of node that submits updates to the Gravity contract on Ethereum. It earns fees from the transactions in a batch.
- `REST server` - This is the Cosmos SDK "REST Server" that runs on Port 1317, either on the validator node or another Cosmos SDK node controlled by the Operator
- `Ethereum RPC` - This is the JSON-RPC server for the Ethereum Full Node.
- `Validator Set` - The set of validators on the Cosmos SDK chain, along with their respective voting power. These are ed25519 public keys used to sign tendermint blocks.
- `Gravity Tx pool` - Is a transaction pool that exists in the chain store of Cosmos -> Ethereum transactions waiting to be placed into a transaction batch
- `Transaction batch` - A transaction batch is a set of Ethereum transactions to be sent from the Gravity Ethereum contract at the same time. This helps reduce the costs of submitting a batch. Batches have a maximum size (currently around 100 transactions) and are only involved in the Cosmos -> Ethereum flow
- `Gravity Batch pool` - Is a transaction pool like structure that exists in the chains to store, separate from the `Gravity Tx pool` it stores transactions that have been placed in batches that are in the process of being signed or being submitted by the `Orchestrator Set`
- `EthBlockDelay` - Is a agreed upon number of Ethereum blocks all oracle attestations are delayed by. No `Orchestrator` will attest to have seen an event occur on Ethereum until this number of blocks has elapsed as denoted by their trusted Ethereum full node. This should prevent short forks form causing disagreements on the Cosmos side. The current value being considered is 50 blocks.
- `Observed` - events on Ethereum are considered `Observed` when the `Eth Signers` of 66% of the active Cosmos validator set during a given block has submitted an oracle message attesting to seeing the event.
- `Validator set delta` - This is a term for the difference between the validator set currently in the Gravity Ethereum contract and the actual validator set on the Cosmos chain. Since the validator set may change every single block there is essentially guaranteed to be some nonzero `Validator set delta` at any given time.
- `Allowed validator set delta` - This is the maximum allowed `Validator set delta` this parameter is used to determine if the Gravity contract in MsgProposeGravityContract has a validator set 'close enough' to accept. It is also used to determine when validator set updates need to be sent. This is decided by a governance vote _before_ MsgProposeGravityContract can be sent.
- `Gravity ID` - This is a random 32 byte value required to be included in all Gravity signatures for a particular contract instance. It is passed into the contract constructor on Ethereum and used to prevent signature reuse when contracts may share a validator set or subsets of a validator set. This is also set by a governance vote _before_ MsgProposeGravityContract can be sent.
- `Gravity contract code hash` - This is the code hash of a known good version of the Gravity contract solidity code. It will be used to verify exactly which version of the bridge will be deployed.
- `Start Threshold` - This is the percentage of total voting power that must be online and participating in Gravity operations before a bridge can start operating.
- `Claim` (name WIP) - an Ethereum event signed and submitted to cosmos by a single `Orchestrator` instance
- `Attestation` (name WIP) - aggregate of claims that eventually becomes `observed` by all orchestrators
- `Voucher` - represent a bridged ETH token on the Cosmos side. Their denom is has a `gravity` prefix and a hash that is build from contract address and contract token. The denom is considered unique within the system.
- `Counterpart` - to a `Voucher` is the locked ETH token in the contract
- `Delegate keys` - when an `Operator` sets up the `Eth Signer` and `Oracle` they assign `Delegate Keys` by sending a message containing these keys using their `Validator` address. There is one delegate Ethereum key, used for signing messages on Ethereum and representing this `Validator` on Ethereum and one delegate Cosmos key that is used to submit `Oracle` messages.
- `Gravity Contract` - The `Gravity Contract` is the Ethereum contract that holds all of the Gravity bridge bunds on the Ethereum side. It contains a representation of the cosmos validator set using `Delegate Keys` and normalized powers. For example if a validator has 5% of the Cosmos chain validator power, their delegate key will have 5% of the voting power in the `Gravity Contract` these value are regularly updated to keep the Cosmos and Ethereum chain validator sets in sync.

The _Operator_ is the key unit of trust here. Each operator is responsible for maintaining 4 secure processes:

1. Cosmos SDK Validator - signing blocks
1. Fully synced Ethereum Full Node
1. `Eth Signer`, which signs things with the `Operator's` Eth keys and submits using [messages](/design/messages.md##Ethereum-Signer-messages) additional documentation [ethereum signing](/design/ethereum-signing.md)
1. `Eth Oracle`, which observes events from Ethereum full nodes and relays them using [messages](/design/messages##Oracle-messages) additional documentation [oracle](/design/oracle.md)

## Security Concerns

The **Validator Set** is the actual set of keys with stake behind them, which are slashed for double-signs or other
misbehavior. We typically consider the security of a chain to be the security of a _Validator Set_. This varies on
each chain, but is our gold standard. Even IBC offers no more security than the minimum of both involved Validator Sets.

The **Eth Signer** is a binary run alongside the main Cosmos daemon (`gaiad` or equivalent) by the validator set. It exists purely as a matter of code organization and is in charge of signing Ethereum transactions, as well as observing events on Ethereum and bringing them into the Cosmos state. It signs transactions bound for Ethereum with an Ethereum key, and signs over events coming from Ethereum with a Cosmos SDK key. We can add slashing conditions to any mis-signed message by any _Eth Signer_ run by the _Validator Set_ and be able to provide the same security as the _Valiator Set_, just a different module detecting evidence of malice and deciding how much to slash. If we can prove a transaction signed by any _Eth Signer_ of the _Validator Set_ was illegal or malicious, then we can slash on the Cosmos chain side and potentially provide 100% of the security of the _Validator Set_. Note that this also has access to the 3 week unbonding
period to allow evidence to slash even if they immediately unbond.

The **MultiSig Set** is a (possibly aged) mirror of the _Validator Set_ but with Ethereum keys, and stored on the Ethereum
contract. If we ensure the _MultiSig Set_ is updated much more often than the unbonding period (eg at least once per week),
then we can guarantee that all members of the _MultiSig Set_ have slashable atoms for misbehavior. However, in some extreme
cases of stake shifting, the _MultiSig Set_ and _Validator Set_ could get quite far apart, meaning there is
many of the members in the _MultiSig Set_ are no longer active validators and may not bother to transfer Eth messages.
Thus, to avoid censorship attacks/inactivity, we should also update this everytime there is a significant change
in the Validator Set (eg. > 3-5%). If we maintain those two conditions, the MultiSig Set should offer a similar level of
security as the Validator Set.

Slashing is documented in the [slashing spec](/spec/slashing-spec.md)
