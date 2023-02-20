# Arbitrary logic functionality

Gravity includes the functionality to make arbitrary calls out to other Ethereum contracts. This can be used to allow the Cosmos chain to take actions on Ethereum. This functionality is very general. It can even be used to implement the core token transferring functionality of the bridge. However, there is one important caveat: these arbitrary logic contracts can transact with ERC20 tokens, but not any other kind of asset, such as ERC721. Interacting with non-ERC20 assets would require modifications to the core Gravity contract.

# Architecture

`SetOutgoingLogicCall`

Gravity offers a method which can be called by other modules to create an outgoing logic call. To use this method, a calling module must first assemble a logic call (more on this later). This is then submitted to the Gravity module with `SetOutgoingLogicCall`. From here, it is signed by the validators. Once it has enough signatures, a Gravity relayer will pick it up and submit it to the Gravity contract on Ethereum.

`OutgoingLogicCall`

`SetOutgoingLogicCall` takes an `OutgoingLogicCall` as an argument. Here is an explanation of its parameters:

```golang
// OutgoingLogicCall represents an individual logic call from Gravity to ETH
type OutgoingLogicCall struct {
	Transfers            []*ERC20Token `protobuf:"bytes,1,rep,name=transfers,proto3" json:"transfers,omitempty"`
	Fees                 []*ERC20Token `protobuf:"bytes,2,rep,name=fees,proto3" json:"fees,omitempty"`
	LogicContractAddress string        `protobuf:"bytes,3,opt,name=logic_contract_address,json=logicContractAddress,proto3" json:"logic_contract_address,omitempty"`
	Payload              []byte        `protobuf:"bytes,4,opt,name=payload,proto3" json:"payload,omitempty"`
	Timeout              uint64        `protobuf:"varint,5,opt,name=timeout,proto3" json:"timeout,omitempty"`
	InvalidationId       []byte        `protobuf:"bytes,6,opt,name=invalidation_id,json=invalidationId,proto3" json:"invalidation_id,omitempty"`
	InvalidationNonce    uint64        `protobuf:"varint,7,opt,name=invalidation_nonce,json=invalidationNonce,proto3" json:"invalidation_nonce,omitempty"`
}
```

- Transfers: These are tokens that are sent to the logic contract before it is executed. The contract can then take actions using the tokens. For example, Gravity could send the logic contract some Uniswap LP tokens that it would then use to redeem liquidity from Uniswap.
- Fees: These are tokens that will be paid by the core Gravity.sol contract to the Gravity relayer for executing the logic call. Fees are paid after the logic contract executes, so it is possible to pay the relayer with tokens that logic contract receives after executing, and then sends back to the core Gravity contract.
- LogicContractAddress: This is the address of the logic contract that the core Gravity contract calls to execute the arbitrary logic. NOTE: this could be the actual logic contract, or it could be a batching contract that calls the logic contract a number of times. Examples of this in the `/solidity/test` folder.
- Payload: This is the Ethereum abi encoded function call that will be executed on the logic contract. If you are using a batching middleware contract, then this abi encoded function call will itself contain an array of abi encoded function calls on the actual logic contract.
- Timeout: The logic call will not execute if the block timestamp on Ethereum is higher than the value of this timeout. 
- InvalidationId and InvalidationNonce: More on these below:


## Invalidation

`invalidation_id` and `invalidation_nonce` are used as replay protection in the Gravity arbitrary logic call functionality.

When a submitLogicCall transaction is submitted to the Ethereum contract, the contract checks uses `invalidation_id` to access a key in the invalidation mapping. The value at this key is checked against the supplied `invalidation_nonce`. The logic call is only allowed to go through if the supplied `invalidation_nonce` is higher.

This can be used to implement many different invalidation schemes:

### Easiest: timeout-only invalidation
If you don't know what this all means, when you send a logic call to the Gravity module from the Cosmos side, just set the `invalidation_id` to an incrementing integer that you keep track of in your module. Set the `invalidation_nonce` to zero each time. This will create a new entry in the invalidation mapping on Ethereum for each logic batch, providing replay protection, while allowing batches to be completely independent.

### Sequential invalidation
If you don't want it to be possible to submit an early logic call after a later logic call, you can instead set the `invalidation_id` to zero each time, and use an incrementing integer for the `invalidation_nonce`. This makes it so that any logic call that is successfully submitted will invalidate all previous logic calls.

### For example: Token based invalidation
In Gravity's core submitBatch functionality, we have batches of transactions for a given token invalidate earlier batches of that token, but not earlier batches of other tokens. To implement this on top of the submitLogicCall method, we would set the `invalidation_id` to the token address and keep an incrementing nonce for each token.
