# Gravity bridge relaying semantics

This document is designed to assist developers in implementing alternate Gravity relayers. The two major components of the Orchestrator which interact with Ethereum. The Gravity bridge has been designed for increased efficiency, not for ease of use. This means there are many implicit requirements of these external binaries which this document does it's best to make explicit.

The Gravity `orchestrator` is described in [overview.md](/docs/design/overview.md) it's a combination of three distinct roles that need to be performed by external binaries in the Gravity bridge. This document highlights the requirements of the `relayer` which is one of those roles included in the `orchestrator`.

## Semantics for Validator set update relaying

### Sorting and Ordering of the Validator set and signatures

When updating the validator set in the Gravity contract you must provide a copy of the old validator set. This _MUST_ only be taken from the last ValsetUpdated event on the Ethereum chain.

Providing the old validator set is part of a storage optimization, instead of storing the entire validator set in Ethereum storage it is instead provided by each caller and stored in the much cheaper Ethereum event queue. No sorting of any kind is performed in the Gravity contract, meaning the list of validators and their new signatures must be submitted in exactly the same order as the last call.

For the purpose of normal operation this requirement can be shortened to 'sort the validators by descending power, and by Eth address bytes where power is equal'. Since the Cosmos module produces the validator sets they should always come in order. It is not possible for the relayer to change this order since it is part of the signature. But a change in this sorting method on the Gravity module side would halt valset updates and essentially decouple the bridge unless your implementation is smart enough to take a look at the last submitted order rather than blindly following sorting.

### Deciding what Validator set to relay

The Cosmos chain simply produces a stream of validator sets, it does not make any judgement on how they are relayed. It's up to the relayer implementation to determine how to optimize the gas costs of this relaying operation.

For example lets say we had validator sets `A, B, C, and D` each is created when there is a 5% power difference between the last Gravity validator set snapshot in the store and the currently active validator set.

5% is an arbitrary constant. The specific value chosen here is a tradeoff made by the chain between how up to date the Ethereum validator set is and the cost to keep it updated. The higher this value is the lower the portion of the voting validator set is needed to highjack the bridge in the worst case. If we made a new validator set update every block 66% would need to collude, the 5% change threshold means 61% of the total voting power colluding in a given validator set may be able to steal the funds in the bridge.

```
A -> B -> C -> D
     5%  10%   15%
```

The relayer should iterate over the event history for the Gravity Ethereum contract, it will determine that validator set A is currently in the Gravity bridge. It can choose to either relay validator sets B, C and then D or simply submit validator set D. Provided all validators have signed D it has more than 66% voting power and can pass on it's own. Without paying potentially several hundred dollars more in EThereum to relay the intermediate sets.

Performing this check locally somehow, before submitting transactions, is essential to a cost effective relayer implementation. You can either use a local Ethereum signing implementation and sum the powers and signatures yourself, or you can simply use the `eth_call()` Ethereum RPC to simulate the call on your EThereum node.

Note that `eth_call()` often has funny gotchas. All calls fail on Geth based implementations if you don't have any Ethereum to pay for gas, while on Parity based implementations your gas inputs are mostly ignored and an accurate gas usage is returned.

## Semantics for transaction batch relaying

In order to submit a transaction batch you also need to submit the last set of validators and their powers as outlined in [the validator set section](#sorting-and-ordering-of-the-validator-set-and-signatures). This is to facilitate the same storage optimization mentioned there.

### Deciding what batch to relay

Making a decision about which batch to relay is very different from deciding which validator set to relay. Batch relaying is primarily motivated by fees, not by a desire to maintain the integrity of the bridge. So the decision mostly comes down to fee computation, this is further complicated by the concept of 'batch requests'. Which is an unpermissioned transaction that requests the Gravity module generate a new batch for a specific token type.

Batch requests are designed to allow the user to withdraw their tokens from the send to Ethereum tx pool at any time up until a relayer shows interest in actually relaying them. While transactions are in the pool there's no risk of a double spend if the user is allowed to withdraw them by sending a MsgCancelSendToEth. Once the transaction enters a batch due to a 'request batch' that is no longer the case and the users funds must remain locked until the Oracle informs the Gravity module that the batch containing the users tokens has become somehow invalid to submit or has been executed on Ethereum.

A relayer uses the query endpoint `BatchFees` to iterate over the send to Eth tx pool for each token type, the relayer can then observe the price for the ERC20 tokens being relayed on a dex and compute the gas cost of executing the batch (via `eth_call()`) as well as the gas cost of liquidating the earnings on a dex if desired. Once a relayer determines that a batch is good and profitable it can send a `MsgRequestBatch` and the batch will be created for the relayer to relay.

There are also existing batches, which the relayer should also judge for profitability and make an attempt at relaying using much the same method.
