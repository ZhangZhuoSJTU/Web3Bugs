# Functioning of the Gravity.sol contract

The Gravity contract locks assets on Ethereum to facilitate a Tendermint blockchain creating synthetic versions of those assets. It is designed to be used alongside software on the Tendermint blockchain, but this article focuses on the Ethereum side.

Usage example:

- You send 25 DAI to the Gravity contract, specifying which address on the Tendermint chain should recieve the syntehtic DAI.
- Validators on the Tendermint chain see that this has happened and mint 25 synthetic DAI for the address you specified on the Tendermint chain.
- You send the 25 synthetic DAI to Jim on the Tendermint chain.
- Jim sends the synthetic DAI to Gravity module on the Tendermint chain, specifying which Ethereum address should receive it.
- The Tendermint validators burn the synthetic DAI on the Tendermint chain and unlock 25 DAI for Jim on Ethereum

## Security model

The Gravity contract is basically a multisig with a few tweaks. Even though it is designed to be used with a consensus process on Tendermint, the Gravity contract itself encodes nothing about this consensus process. There are three main operations- updateValset, submitBatch, and sendToCosmos. 
- updateValset updates the signers on the multisig, and their relative powers. This mirrors the validator set on the Tendermint chain, so that all the Tendermint validators are signers, in proportion to their staking power on the Tendermint chain. An updateValset transaction must be signed by 2/3's of the current valset to be accepted.
- submitBatch is used to submit a batch of transactions unlocking and transferring tokens to Ethereum addresses. It is used to send tokens from Cosmos to Ethereum. The batch must be signed by 2/3's of the current valset.
- sendToCosmos is used to send tokens onto the Tendermint chain. It simply locks the tokens in the contract and emits an event which is picked up by the Tendermint validators.

### updateValset

A valset consists of a list of validator's Ethereum addresses, their voting power, and a nonce for the entire valset. UpdateValset takes a new valset, the current valset, and the signatures of the current valset over the new valset. The valsets and the signatures are currently broken into separate arrays because it is not possible to pass arrays of structs into Solidity external functions. Because of this, UpdateValset first does a few checks to make sure that all the arrays that make up a valset are the same length.

Then, it checks the supplied current valset against the saved checkpoint. This requires some explanation. Because valsets contain over 100 validators, storing these all on the Ethereum blockchain each time would be quite expensive. Because of this, we only store a hash of the current valset, then let the caller supply the actual addresses, powers, and nonce of the valset. We call this hash the checkpoint. This is done with the function makeCheckpoint.

Once we are sure that the valset supplied by the caller is the correct one, we check that the new valset nonce is higher than current valset nonce. This ensures that old valsets cannot be submitted because their nonce is too low. Note: the only thing we check from the new valset is the nonce. The rest of the new valset is passed in the arguments to this method, but it is only used recreate the checkpoint of the new valset. If we didn't check the nonce, it would be possible to pass in the checkpoint directly.

Now, we make a checkpoint from the submitted new valset, using makeCheckpoint again. In addition to be used as a checkpoint later on, we first use it as a digest to check the current valset's signature over the new valset. We use checkValidatorSignatures to do this.

CheckValidatorSignatures takes a valset, an array of signatures, a hash, and a power threshold. It checks that the powers of all the validators that have signed the hash add up to the threshold. This is how we know that the new valset has been approved by at least 2/3s of the current valset. We iterate over the current valset and the array of signatures, which should be the same length. For each validator, we first check if the signature is all zeros. This signifies that it was not possible to obtain the signature of a given validator. If this is the case, we just skip to the next validator in the list. Since we only need 2/3s of the signatures, it is not required that every validator sign every time, and skipping them stops any validator from being able to stop the bridge.

If we have a signature for a validator, we verify it, throwing an error if there is something wrong. We also increment a cumulativePower counter with the validator's power. Once this is over the threshold, we break out of the loop, and the signatures have been verified! If the loop ends without the threshold being met, we throw an error. Because of the way we break out of the loop once the threshold has been met, if the valset is sorted by descending power, we can usually skip evaluating the majority of signatures. To take advantage of this gas savings, it is important that valsets be produced by the validators in descending order of power.

At this point, all of the checks are complete, and it's time to update the valset! This is a bit anticlimactic, since all we do is save the new checkpoint over the old one. An event is also emitted.

### submitBatch

This is how the bridge transfers tokens from addresses on the Tendermint chain to addresses on the Ethereum chain. The Cosmos validators sign batches of transactions that are submitted to the contract. Each transaction has a destination address, an amount, a nonce, and a fee for whoever submitted the batch.

We start with some of the same checks that are done in UpdateValset- checking that the lengths of the arrays match up, and checking the supplied current valset against the checkpoint.

We also check the batches nonce against the state_lastBatchNonces mapping. This stores a nonce for each ERC20 handled by Gravity. The purpose of this nonce is to ensure that old batches cannot be submitted. It is also used on the Tendermint chain to clean up old batches that were never submitted and whose nonce is now too low to ever submit.

We check the current validator's signatures over the hash of the transaction batch, using the same method used above to check their signatures over a new valset.

Now we are ready to make the transfers. We iterate over all the transactions in the batch and do the transfers. We also add up the fees and transfer them to msg.sender.

### sendToCosmos

This is used to transfer tokens from an Ethereum address to a Tendermint address. It is extremely simple, because everything really happens on the Tendermint side. The transferred tokens are locked in the contract, then an event is emitted. The Tendermint validators see this event and mint tokens on the Tendermint side.

## Events

We emit 3 different events, each of which has a distinct purpose. 2 of these events contain a field called _eventNonce, which is used by the Tendermint chain to ensure that the events are not out of order. This is incremented each time one of the events is emitted.

### TransactionBatchExecutedEvent

This contains information about a batch that has been successfully processed. It contains the batch nonce and the ERC20 token. The Tendermint chain can identify the batch from this information. It also contains the _eventNonce.

### SendToCosmosEvent

This is emitted every time someone sends tokens to the contract to be bridged to the Tendermint chain. It contains all information neccesary to credit the tokens to the correct Cosmos account, as well as the _eventNonce.

### ValsetUpdatedEvent

This is emitted whenever the valset is updated. It does not contain the _eventNonce, since it is never brought into the Tendermint state. It is used by relayers when they call submitBatch or updateValset, so that they can include the correct validator signatures with the transaction.