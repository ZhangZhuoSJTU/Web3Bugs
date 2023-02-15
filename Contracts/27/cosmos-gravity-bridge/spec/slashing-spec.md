This file names and documents the various slashing conditions we use in Gravity.

## GRAVSLASH-01: Signing fake validator set or tx batch evidence

This slashing condition is intended to stop validators from signing over a validator set and nonce that has never existed on Cosmos. It works via an evidence mechanism, where anyone can submit a message containing the signature of a validator over a fake validator set. This is intended to produce the effect that if a cartel of validators is formed with the intention of submitting a fake validator set, one defector can cause them all to be slashed.

**Implementation considerations:**

The trickiest part of this slashing condition is determining that a validator set has never existed on Cosmos. To save space, we will need to clean up old validator sets. We could keep a mapping of validator set hash to true in the KV store, and use that to check if a validator set has ever existed. This is more efficient than storing the whole validator set, but its growth is still unbounded. It might be possible to use other cryptographic methods to cut down on the size of this mapping. It might be OK to prune very old entries from this mapping, but any pruning reduces the deterrence of this slashing condition.

The implemented version of this slashing condition stores a map of hashes for all past events, this is smaller than storing entire batches or validator sets and doesn't have to be accessed as frequently. A possible but not currently implemented efficiency optimization would be to remove hashes from this list after a given period. But this would require storing more metadata about each hash.

Currently automatic evidence submission is not implemented in the relayer. By the time a signature is visible on Ethereum it's already too late for slashing to prevent bridge highjacking or theft of funds. Furthermore since 66% of the validator set is required to perform this action anyways that same controlling majority could simply refuse the evidence. The most common case envisioned for this slashing condition is to break up a cabal of validators trying to take over the bridge by making it more difficult for them to trust one another and actually coordinate such a theft.

The theft would involve exchanging of slashable Ethereum signatures and open up the possibility of a manual submission of this message by any defector in the group.

Currently this is implemented as an ever growing array of hashes in state.

## GRAVSLASH-02: Failure to sign tx batch, or arbitrary logic call

This slashing condition is triggered when a validator does not sign a transaction batch or arbitrary logic call which is produced by the Gravity Cosmos module. This prevents two bad scenarios-

1. A validator simply does not bother to keep the correct binaries running on their system,
2. A cartel of >1/3 validators unbond and then refuse to sign updates, preventing any batches or logic calls from getting enough signatures to be submitted to the Gravity Ethereum contract.

## GRAVSLASH-03: Failure to sign validator set update

This slashing condition is triggered when a validator does not sign a validator set update or transaction batch which is produced by the Gravity Cosmos module. This prevents two bad scenarios-

1. A validator simply does not bother to keep the correct binaries running on their system,
2. A cartel of >1/3 validators unbond and then refuse to sign updates, preventing any validator set updates from getting enough signatures to be submitted to the Gravity Ethereum contract. If they prevent validator set updates for longer than the Cosmos unbonding period, they can no longer be punished for submitting fake validator set updates and tx batches (GRAVSLASH-01 and GRAVSLASH-03).

To deal with scenario 2, GRAVSLASH-03 will also need to slash validators who are no longer validating, but are still in the unbonding period for up to `UnbondSlashingValsetsWindow` blocks. This means that when a validator leaves the validator set, they will need to keep running their equipment for at least `UnbondSlashingValsetsWindow` blocks. This is unusual for a Cosmos chain, and may not be accepted by the validators.

The current value of `UnbondSlashingValsetsWindow` is 10,000 blocks, or about 12-14 hours. We have determined this to be a safe value based on the following logic. So long as every validator leaving the validator set signs at least one validator set update that they are not contained in then it is guaranteed to be possible for a relayer to produce a chain of validator set updates to transform the current state on the chain into the present state.

There is a segment of GRAVSLASH-03 `UnbondAttackSlashing` which is not yet implemented. This parameter will control the amount to slash validators during an unbonding attack. An unbonding attack is when +1/3 of the validator set unbonds during overlapping intervals. If this attack is successful the bridge will be permanently halted and all funds lost. If such an attack is ongoing slashing should be higher than the normal amount, perhaps as much as 100% of the stake of the unbonding validators. As mentioned sending exactly one validator set signature not including your own validator is sufficient to avoid any slashing while unbonding.

It should be noted that both GRAVSLASH-02 and GRAVSLASH-03 could be eliminated with no loss of security if it where possible to perform the Ethereum signatures inside the consensus code. This is a pretty limited feature addition to Tendermint that would make Gravity far less prone to slashing.

## GRAVSLASH-04: Submitting incorrect Eth oracle claim - INTENTIONALLY NOT IMPLEMENTED

The Ethereum oracle code (currently mostly contained in attestation.go), is a key part of Gravity. It allows the Gravity module to have knowledge of events that have occurred on Ethereum, such as deposits and executed batches. GRAVSLASH-03 is intended to punish validators who submit a claim for an event that never happened on Ethereum.

**Implementation considerations**

The only way we know whether an event has happened on Ethereum is through the Ethereum event oracle itself. So to implement this slashing condition, we slash validators who have submitted claims for a different event at the same nonce as an event that was observed by >2/3s of validators.

Although well-intentioned, this slashing condition is likely not advisable for most applications of Gravity. This is because it ties the functioning of the Cosmos chain which it is installed on to the correct functioning of the Ethereum chain. If there is a serious fork of the Ethereum chain, different validators behaving honestly may see different events at the same event nonce and be slashed through no fault of their own. Widespread unfair slashing would be very disruptive to the social structure of the Cosmos chain.

Maybe GRAVSLASH-03 is not necessary at all:

The real utility of this slashing condition is to make it so that, if >2/3 of the validators form a cartel to all submit a fake event at a certain nonce, some number of them can defect from the cartel and submit the real event at that nonce. If there are enough defecting cartel members that the real event becomes observed, then the remaining cartel members will be slashed by this condition. However, this would require >1/2 of the cartel members to defect in most conditions.

If not enough of the cartel defects, then neither event will be observed, and the Ethereum oracle will just halt. This is a much more likely scenario than one in which GRAVSLASH-04 is actually triggered.

Also, GRAVSLASH-04 will be triggered against the honest validators in the case of a successful cartel. This could act to make it easier for a forming cartel to threaten validators who do not want to join.

## GRAVSLASH-05: Failure to submit Eth oracle claims - INTENTIONALLY NOT IMPLEMENTED

This is similar to GRAVSLASH-04, but it is triggered against validators who do not submit an oracle claim that has been observed. In contrast to GRAVSLASH-04, GRAVSLASH-05 is intended to punish validators who stop participating in the oracle completely.

**Implementation considerations**

Unfortunately, GRAVSLASH-05 has the same downsides as GRAVSLASH-04 in that it ties the correct operation of the Cosmos chain to the Ethereum chain. Also, it likely does not incentivize much in the way of correct behavior. To avoid triggering GRAVSLASH-05, a validator simply needs to copy claims which are close to becoming observed. This copying of claims could be prevented by a commit-reveal scheme, but it would still be easy for a "lazy validator" to simply use a public Ethereum full node or block explorer, with similar effects on security. Therefore, the real usefulness of GRAVSLASH-04 is likely minimal

GRAVSLASH-05 also introduces significant risks. Mostly around forks on the Ethereum chain. For example recently OpenEthereum failed to properly handle the Berlin hardfork, the resulting node 'failure' was totally undetectable to automated tools. It didn't crash so there was no restart to perform, blocks where still being produced although extremely slowly. If this had occurred while Gravity was running with GRAVSLASH-05 active it would have caused those validators to be removed from the set. Possibly resulting in a very chaotic moment for the chain as dozens of validators where removed for little to no fault of their own.

Without GRAVSLASH-04 and GRAVSLASH-05, the Ethereum event oracle only continues to function if >2/3 of the validators voluntarily submit correct claims. Although the arguments against GRAVSLASH-04 and GRAVSLASH-05 are convincing, we must decide whether we are comfortable with this fact. Alternatively we must be comfortable with the Cosmos chain potentially halting entirely due to Ethereum generated factors. We should probably make it possible to enable or disable GRAVSLASH-04 and GRAVSLASH-05 in the chain's parameters.
