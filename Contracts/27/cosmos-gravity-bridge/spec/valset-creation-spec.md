## Validator set creation

In Gravity when we talk about a `valset` we mean a `validator set update` which is a series of ethereum addresses with attached normalized powers used to represent the Cosmos validator set in the Gravity Ethereum contract. Since the Cosmos validator set can and will change frequently.

Validator set creation is a critical part of the Gravity system. The goal is to produce and sign enough validator sets that no matter which one is in the Ethereum contract there is an unbroken chain of correctly signed state updates (greater than 66% of the previous voting power) to sync the Ethereum contract with the current Cosmos validator set.

The key to understanding valset creation is to understand that it is _absolutely impossible_ for either side be fully synced with the other. The Cosmos chain has finality, but produces blocks so much faster than Ethereum that the validator set could change completely an arbitrary number of times between Ethereum blocks. In the other direction Ethereum does not have finality, so there is a significant block delay before the Cosmos chain can know what occurred on Ethereum. It's because of these fundamental restrictions that we focus on continuity of produced validator sets rather than determining what the 'last state on Ethereum' is.

We generate a validator set update for a given percentage of power change. Note that power change is computed in a normalized fashion, whereas Cosmos power exits relative to some changing total power value. So for example if the total power on Cosmos increased 10% due purely to inflation the power in the Gravity bridge contract would not change at all, as all validators would inflate equally barring slashing or some other event.

Currently a 5% power change threshold has been selected somewhat arbitrarily. A survey of power on the hub says that a power change of less than 1% a week is common, but as a general number for all Cosmos zones it may be a little too conservative. This should probably be broken out into a parameter and changed as required by the active validator set.

The main consideration when setting this parameter is that your security is reduced, instead of requiring 66% of validators to execute a message on Ethereum, you may need up to 66% + power change percentage of the current active validator set. Of course the ideal case is to generate validator sets on every power change of any kind, but this is infeasible both from a signature submission perspective (submitting hundreds of messages per block to handle signatures is infeasible) but also infeasible from a cost standpoint.

### When are validator sets created

1. If there are no valset requests, create a new one
2. If there is at least one validator who started unbonding in current block. (we persist last unbonded block height in hooks.go)
   This will make sure the unbonding validator has to provide an attestation to a new Valset
   that excludes him before he completely Unbonds. Otherwise he will be slashed
3. If power change between validators of CurrentValset and latest valset request is > 5%
