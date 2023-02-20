<!--
order: 4
-->

# Messages

In this section we describe the processing of the gravity messages and the corresponding updates to the state. All created/modified state objects specified by each message are defined within the [state](./02_state_transitions.md) section.

### MsgSetOrchestratorAddress

Allows validators to delegate their voting responsibilities to a given key. This Key can be used to authenticate oracle claims.

```proto
// this message allows validators to delegate their voting responsibilities
// to a given key. This key is then used as an optional authentication method
// for sigining oracle claims
message MsgSetOrchestratorAddress {
  // The validator field is a cosmosvaloper1... string (i.e. sdk.ValAddress)
  // that references a validator in the active set
  string validator    = 1;
  // The orchestrator field is a cosmos1... string  (i.e. sdk.AccAddress) that
  // references the key that is being delegated to
  string orchestrator = 2;
  // This is a hex encoded 0x Ethereum public key that will be used by this validator
  // on Ethereum
  string eth_address  = 3;
}
```

This message is expected to fail if:

- The validator address is incorrect.
  - The address is empty (`""`)
  - Not a length of 20
  - Bech32 decoding fails
- The orchestrator address is incorrect.
  - The address is empty (`""`)
  - Not a length of 20
  - Bech32 decoding fails
- The ethereum address is incorrect.
  - The address is empty (`""`)
  - Not a length of 42
  - Does not start with 0x
- The validator is not present in the validator set.

### MsgValsetConfirm

When the gravity daemon witnesses a complete validator set within the gravity module, the validator submits a signature of a message containing the entire validator set.

+++ https://github.com/althea-net/cosmos-gravity-bridge/blob/main/module/proto/gravity/v1/msgs.proto#L79-84

This message is expected to fail if:

- If the validator set is not present.
- The signature is encoded incorrectly.
- Signature verification of the ethereum key fails.
- If the signature submitted has already been submitted previously.
- The validator address is incorrect.
  - The address is empty (`""`)
  - Not a length of 20
  - Bech32 decoding fails

### MsgSendToEth

When a user wants to bridge an asset to an EVM. If the token has originated from the cosmos chain it will be held in a module account. If the token is originally from ethereum it will be burned on the cosmos side.

> Note: this message will later be removed when it is included in a batch.

```proto
// This is the message that a user calls when they want to bridge an asset
// it will later be removed when it is included in a batch and successfully
// submitted tokens are removed from the users balance immediately
message MsgSendToEth {
  string                   sender   = 1;
  string                   eth_dest = 2;
  // the coin to send across the bridge, note the restriction that this is a
  // single coin not a set of coins that is normal in other Cosmos messages
  cosmos.base.v1beta1.Coin amount   = 3 [
    (gogoproto.nullable) = false
  ];
  // the fee paid for the bridge, distinct from the fee paid to the chain to
  // actually send this message in the first place. So a successful send has
  // two layers of fees for the user
  cosmos.base.v1beta1.Coin bridge_fee = 4 [
    (gogoproto.nullable) = false
  ];
}
```

This message will fail if:

- The sender address is incorrect.
  - The address is empty (`""`)
  - Not a length of 20
  - Bech32 decoding fails
- The denom is not supported.
- If the token is cosmos originated
  - The sending of the token to the module account fails
- If the token is non-cosmos-originated.
  - If sending to the module account fails
  - If burning of the token fails

### MsgRequestBatch

When enough transactions have been added into a batch, a user or validator can call send this message in order to send a batch of transactions across the bridge.

```proto
// this is a message anyone can send that requests a batch of transactions to
// send across the bridge be created for whatever block height this message is
// included in. This acts as a coordination point, the handler for this message
// looks at the AddToOutgoingPool tx's in the store and generates a batch, also
// available in the store tied to this message. The validators then grab this
// batch, sign it, submit the signatures with a MsgConfirmBatch before a relayer
// can finally submit the batch
// -------------
message MsgRequestBatch {
  string sender = 1;
  string denom  = 2;
}
```

This message will fail if:

- The denom is not supported.
- Failure to build a batch of transactions.
- If the orchestrator address is not present in the validator set

### MsgConfirmBatch

When a `MsgRequestBatch` is observed, validators need to sign batch request to signify this is not a maliciously created batch and to avoid getting slashed.

```proto
// When validators observe a MsgRequestBatch they form a batch by ordering
// transactions currently in the txqueue in order of highest to lowest fee,
// cutting off when the batch either reaches a hardcoded maximum size (to be
// decided, probably around 100) or when transactions stop being profitable
// (TODO determine this without nondeterminism) This message includes the batch
// as well as an Ethereum signature over this batch by the validator
// -------------
message MsgConfirmBatch {
  uint64 nonce          = 1;
  string token_contract = 2;
  string eth_signer     = 3;
  string orchestrator   = 4;
  string signature      = 5;
}
```

This message will fail if:

- The batch does not exist
- If checkpoint generation fails
- If a none validator address or delegated address
- If the counter chain address is empty or incorrect.
- If counter chain address fails signature validation
- If the signature was already presented in a previous message

### MsgConfirmLogicCall

When a logic call request has been made, it needs to be confirmed by the bridge validators. Each validator has to submit a confirmation of the logic call being executed.

```proto
// When validators observe a MsgRequestBatch they form a batch by ordering
// transactions currently in the txqueue in order of highest to lowest fee,
// cutting off when the batch either reaches a hardcoded maximum size (to be
// decided, probably around 100) or when transactions stop being profitable
// (TODO determine this without nondeterminism) This message includes the batch
// as well as an Ethereum signature over this batch by the validator
// -------------
message MsgConfirmLogicCall {
  string invalidation_id    = 1;
  uint64 invalidation_nonce = 2;
  string eth_signer         = 3;
  string orchestrator       = 4;
  string signature          = 5;
}
```

This message will fail if:

- The id encoding is incorrect
- The outgoing logic call which is confirmed can not be found
- Invalid checkpoint generation
- Signature decoding failed
- The address calling this function is not a validator or its delegated key
- The counter chain address is incorrect or empty
- Counter party signature verification failed
- A duplicate signature is observed

### MsgValsetConfirm

When a `Valset` is created by the Gravity module, validators sign it with their Ethereum keys, and send the signatures to the Gravity module using this message.

```proto
// this is the message sent by the validators when they wish to submit their
// signatures over the validator set at a given block height. A validator must
// first call MsgSetEthAddress to set their Ethereum address to be used for
// signing. Then someone (anyone) must make a ValsetRequest, the request is
// essentially a messaging mechanism to determine which block all validators
// should submit signatures over. Finally validators sign the validator set,
// powers, and Ethereum addresses of the entire validator set at the height of a
// ValsetRequest and submit that signature with this message.
//
// If a sufficient number of validators (66% of voting power) (A) have set
// Ethereum addresses and (B) submit ValsetConfirm messages with their
// signatures it is then possible for anyone to view these signatures in the
// chain store and submit them to Ethereum to update the validator set
// -------------
message MsgValsetConfirm {
  uint64 nonce        = 1;
  string orchestrator = 2;
  string eth_address  = 3;
  string signature    = 4;
}
```

This message is expected to fail if:

- If the validator set is not present.
- The signature is encoded incorrectly.
- Signature verification of the ethereum key fails.
- If the signature submitted has already been submitted previously.
- The validator address is incorrect.
  - The address is empty (`""`)
  - Not a length of 20
  - Bech32 decoding fails

### MsgDepositClaim

When a message to deposit funds into the gravity contract is created a event will be omitted and observed a message will be submitted confirming the deposit.

```proto
// When more than 66% of the active validator set has
// claimed to have seen the deposit enter the ethereum blockchain coins are
// issued to the Cosmos address in question
// -------------
message MsgDepositClaim {
  uint64 event_nonce    = 1;
  uint64 block_height   = 2;
  string token_contract = 3;
  string amount         = 4 [
    (gogoproto.customtype) = "github.com/cosmos/cosmos-sdk/types.Int",
    (gogoproto.nullable)   = false
  ];
  string ethereum_sender = 5;
  string cosmos_receiver = 6;
  string orchestrator    = 7;
}
```

This message will fail if:

- The validator is unknown
- The validator is not in the active set
- If the creation of attestation fails

### MsgWithdrawClaim

When a user requests a withdrawal from the gravity contract a event will omitted by the counter party chain. This event will be observed by a bridge validator and submitted to the gravity module.

```proto
// WithdrawClaim claims that a batch of withdrawal
// operations on the bridge contract was executed.
message MsgWithdrawClaim {
  uint64 event_nonce    = 1;
  uint64 block_height   = 2;
  uint64 batch_nonce    = 3;
  string token_contract = 4;
  string orchestrator   = 5;
}
```

This message will fail if:

- The validator is unknown
- The validator is not in the active set
- If the creation of attestation fails

### MsgERC20DeployedClaim

This message allows the cosmos chain to learn information about the denom from the counter party chain.

```proto
// ERC20DeployedClaim allows the Cosmos module
// to learn about an ERC20 that someone deployed
// to represent a Cosmos asset
message MsgERC20DeployedClaim {
  uint64 event_nonce    = 1;
  uint64 block_height   = 2;
  string cosmos_denom   = 3;
  string token_contract = 4;
  string name           = 5;
  string symbol         = 6;
  uint64 decimals       = 7;
  string orchestrator   = 8;
}
```

This message will fail if:

- The validator is unknown
- The validator is not in the active set
- If the creation of attestation fails

### MsgLogicCallExecutedClaim

This informs the chain that a logic call has been executed. This message is submitted by bridge validators when they observe a event containing details around the logic call.

```proto
// This informs the Cosmos module that a logic
// call has been executed
message MsgLogicCallExecutedClaim {
  uint64 event_nonce        = 1;
  uint64 block_height       = 2;
  bytes  invalidation_id    = 3;
  uint64 invalidation_nonce = 4;
  string orchestrator       = 5;
}
```

This message will fail if:

- The validator submitting the claim is unknown
- The validator is not in the active set
- Creation of attestation has failed.

### MsgValsetUpdatedClaim

// TODO_JNT: work with justin to describe what this is and isnt used for

```proto
// This informs the Cosmos module that a validator
// set has been updated.
message MsgValsetUpdatedClaim {
  uint64 event_nonce               = 1;
  uint64 valset_nonce              = 2;
  uint64 block_height              = 3;
  repeated BridgeValidator members = 4;
  string orchestrator              = 6;
}
```

### MsgCancelSendToEth

// TODO_JNT: work on defining when this fails etc

```proto
// This call allows the sender (and only the sender)
// to cancel a given MsgSendToEth and recieve a refund
// of the tokens
message MsgCancelSendToEth {
  uint64 transaction_id = 1;
  string sender         = 2;
}
```

### MsgSubmitBadSignatureEvidence

// TODO_JNT: work on defining when this fails etc

```proto
// This call allows anyone to submit evidence that a
// validator has signed a valset, batch, or logic call that never
// existed. Subject contains the batch, valset, or logic call.
message MsgSubmitBadSignatureEvidence {
  google.protobuf.Any subject   = 1;
  string              signature = 2;
}
```
