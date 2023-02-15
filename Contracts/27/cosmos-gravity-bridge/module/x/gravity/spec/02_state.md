<!--
order: 2
-->

# State

## Params

Params is a module-wide configuration structure that stores system parameters
and defines overall functioning of the staking module.

- Params: `Paramsspace("gravity") -> legacy_amino(params)`

```proto
message Params {
  option (gogoproto.stringer) = false;

  // a random 32 byte value to prevent signature reuse, for example if the
  // cosmos validators decided to use the same Ethereum keys for another chain
  // also running Gravity we would not want it to be possible to play a deposit
  // from chain A back on chain B's Gravity. This value IS USED ON ETHEREUM so
  // it must be set in your genesis.json before launch and not changed after
  // deploying Gravity
  string gravity_id                  = 1;

  // the code hash of a known good version of the Gravity contract
  // solidity code. This can be used to verify the correct version
  // of the contract has been deployed. This is a reference value for
  // goernance action only it is never read by any Gravity code
  string contract_source_hash        = 2;

  // These reference values may be used by future Gravity client implemetnations
  // to allow for saftey features or convenience features like the Gravity address
  // in your relayer. A relayer would require a configured Gravity address if
  // governance had not set the address on the chain it was relaying for.
  //
  // the address of the bridge contract on the Ethereum side, this is a
  // reference value for governance only and is not actually used by any
  // Gravity code
  string bridge_ethereum_address     = 4;

  // the unique identifier of the Ethereum chain, this is a reference value
  // only and is not actually used by any Gravity code
  uint64 bridge_chain_id             = 5;

  // These values represent the time in blocks that a validator has to submit
  // a signature for a batch or valset, or to submit a claim for a particular
  // attestation nonce. In the case of attestations this clock starts when the
  // attestation is created, but only allows for slashing once the event has passed
  uint64 signed_valsets_window       = 6;
  uint64 signed_batches_window       = 7;
  uint64 signed_claims_window        = 8;

  // This is the 'target' value for when batches time out, this is a target becuase
  // Ethereum is a probabalistic chain and you can't say for sure what the block
  // frequency is ahead of time.
  uint64 target_batch_timeout        = 10;

  // These values are the average Cosmos block time and Ethereum block time repsectively
  // and they are used to copute what the target batch timeout is. It is important that
  // governance updates these in case of any major, prolonged change in the time it takes
  // to produce a block
  uint64 average_block_time          = 11;
  uint64 average_ethereum_block_time = 12;

  // The slashing fractions for the various gravity related slashing conditions. The first three
  // refer to not submitting a particular message, the fourth for submitting a different claim
  // for the same Ethereum event
  bytes  slash_fraction_valset       = 13 [
    (gogoproto.customtype) = "github.com/cosmos/cosmos-sdk/types.Dec",
    (gogoproto.nullable)   = false
  ];
  bytes slash_fraction_batch = 14 [
    (gogoproto.customtype) = "github.com/cosmos/cosmos-sdk/types.Dec",
    (gogoproto.nullable)   = false
  ];
  bytes slash_fraction_claim = 15 [
    (gogoproto.customtype) = "github.com/cosmos/cosmos-sdk/types.Dec",
    (gogoproto.nullable)   = false
  ];
  bytes slash_fraction_conflicting_claim = 16 [
    (gogoproto.customtype) = "github.com/cosmos/cosmos-sdk/types.Dec",
    (gogoproto.nullable)   = false
  ];
  uint64 unbond_slashing_valsets_window = 17;
  bytes slash_fraction_bad_eth_signature = 18 [
    (gogoproto.customtype) = "github.com/cosmos/cosmos-sdk/types.Dec",
    (gogoproto.nullable)   = false
  ];
}
```

### OutgoingTxBatch

Stored in two possible ways, first with a height and second without (unsafe). Unsafe is used for testing and export and import of state.

| key                                                                | Value                            | Type                    | Encoding         |
| ------------------------------------------------------------------ | -------------------------------- | ----------------------- | ---------------- |
| `[]byte{0xa} + []byte(tokenContract) + nonce (big endian encoded)` | A batch of outgoing transactions | `types.OutgoingTxBatch` | Protobuf encoded |

```proto
message OutgoingTxBatch {
  // The batch_nonce is an incrementing nonce which is assigned to a batch on creation.
  // The Gravity.sol Ethereum contract stores the last executed batch nonce for each token type
  // and it will only execute batches with a lower nonce. Note that the nonce sequence is
  // PER TOKEN, i.e. GRT tokens could have a last executed nonce of 3002 while DAI tokens had a nonce of 4556
  // This property is important for creating batches that are profitable to submit, which is covered in greater
  // detail in the [state transitions spec](03_state_transitions.md)
  uint64                      batch_nonce    = 1;
  // The batch_timeout is an Ethereum block at which this batch will no longer be executed by Gravity.sol. This
  // allows us to cancel batches that we know have timed out, releasing their transactions to be included in a new batch
  // or cancelled by their sender.
  uint64                      batch_timeout  = 2;
  // These are the transactions sending tokens to destinations on Ethereum.
  repeated OutgoingTransferTx transactions   = 3;
  // This is the token contract of the tokens that are being sent in this batch.
  string                      token_contract = 4;
  // The Cosmos block height that this batch was created. This is used in slashing.
  uint64                      block          = 5;
}
```

### Valset

This is the validator set of the bridge.

Stored in two possible ways, first with a height and second without (unsafe). Unsafe is used for testing and export and import of state.

| key                                        | Value         | Type           | Encoding         |
| ------------------------------------------ | ------------- | -------------- | ---------------- |
| `[]byte{0x2} + nonce (big endian encoded)` | Validator set | `types.Valset` | Protobuf encoded |

```proto
// Valset is the Ethereum Bridge Multsig Set, each gravity validator also
// maintains an ETH key to sign messages, these are used to check signatures on
// ETH because of the significant gas savings
message Valset {
  uint64                   nonce   = 1;
  repeated BridgeValidator members = 2;
  uint64                   height  = 3;
}
```

### ValsetNonce

The latest validator set nonce, this value is updated on every write.

| key            | Value | Type     | Encoding               |
| -------------- | ----- | -------- | ---------------------- |
| `[]byte{0xf6}` | Nonce | `uint64` | encoded via big endian |

### SlashedValeSetNonce

The latest validator set slash nonce. This is used to track which validator set needs to be slashed and which already has been.

| Key            | Value | Type   | Encoding               |
| -------------- | ----- | ------ | ---------------------- |
| `[]byte{0xf5}` | Nonce | uint64 | encoded via big endian |

### Validator Set Confirmation

When a validator signs over a validator set this is considered a `valSetConfirmation`, these are saved via the current nonce and the orchestrator address.

| Key                                         | Value                  | Type                     | Encoding         |
| ------------------------------------------- | ---------------------- | ------------------------ | ---------------- |
| `[]byte{0x3} + (nonce + []byte(AccAddress)` | Validator Confirmation | `types.MsgValsetConfirm` | Protobuf encoded |

```proto
// MsgValsetConfirm
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

### ConfirmBatch

When a validator confirms a batch it is added to the confirm batch store. It is stored using the orchestrator, token contract and nonce as the key.

| Key                                                                 | Value                        | Type                    | Encoding         |
| ------------------------------------------------------------------- | ---------------------------- | ----------------------- | ---------------- |
| `[]byte{0xe1} + []byte(tokenContract) + nonce + []byte(AccAddress)` | Validator Batch Confirmation | `types.MsgConfirmBatch` | Protobuf encoded |

```proto
// MsgConfirmBatch
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

### OrchestratorValidator

When a validator would like to delegate their voting power to another key. The value is stored using the orchestrator address as the key

| Key                                 | Value                                        | Type     | Encoding         |
| ----------------------------------- | -------------------------------------------- | -------- | ---------------- |
| `[]byte{0xe8} + []byte(AccAddress)` | Orchestrator address assigned by a validator | `[]byte` | Protobuf encoded |

### EthAddress

A validator has an associated counter chain address.

| Key                                | Value                                    | Type     | Encoding         |
| ---------------------------------- | ---------------------------------------- | -------- | ---------------- |
| `[]byte{0x1} + []byte(ValAddress)` | Ethereum address assigned by a validator | `[]byte` | Protobuf encoded |

### OutgoingLogicCall

When another module requests a logic call to be executed on Ethereum it is stored in a store within the gravity module.

| Key                                                                  | Value                                                | Type                      | Encoding         |
| -------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------- | ---------------- |
| `[]byte{0xde} + []byte(invalidationId) + nonce (big endian encoded)` | A user created logic call to be sent to the Ethereum | `types.OutgoingLogicCall` | Protobuf encoded |

```proto
message OutgoingLogicCall {
  // This is the address of the logic contract that Gravity.sol will call
  string              logic_contract_address = 3;
  // This is the content of the function call on the logic contract. It is formatted
  // as an Ethereum function call which can be passed to .call() and contains the function
  // name and arguments.
  bytes               payload                = 4;
  // The timeout is an Ethereum block at which this logic call will no longer be executed by Gravity.sol. This
  // allows the calling module to cancel logic calls that we know have timed out.
  uint64              timeout                = 5;
  // These are ERC20 transfers to the logic contract that take place before the logic call is made. This is useful
  // if the logic contract implements logic that deals with tokens.
  repeated ERC20Token transfers              = 1;
  // These are fees that go to the relayer of the logic call.
  repeated ERC20Token fees                   = 2;
  // The invalidation_id and invalidation_nonce provide a way for the calling module to implement a variety of
  // replay protection/invalidation strategies. The rules are simple: When a logic call is submitted to the
  // Gravity.sol contract, it will not be executed if a previous logic call with the same invalidation_id
  // and an equal or higher invalidation_nonce was executed previously. To use a strategy where a submitted logic
  // call invalidates all earlier unsubmitted logic calls, the calling module would simply keep the invalidation_id
  // the same and increment the invalidation_nonce. To implement a strategy where logic calls do not invalidate each other
  // at all, and are only invalidated by timing out, the calling module would increment the invalidation_id with each call.
  // To implement a strategy identical to the one used by this module for transaction batches, the calling module would set the
  // invalidation_id to the token contract, and increment the invalidation_nonce.
  bytes               invalidation_id        = 6;
  uint64              invalidation_nonce     = 7;
}
```

### ConfirmLogicCall

When a logic call is executed validators confirm the execution.

| Key                                                                                       | Value                                       | Type                        | Encoding         |
| ----------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------- | ---------------- |
| `[]byte{0xae} + []byte(invalidationId) + nonce (big endian encoded) + []byte(AccAddress)` | Confirmation of execution of the logic call | `types.MsgConfirmLogicCall` | Protobuf encoded |

```proto
// MsgConfirmLogicCall
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

### OutgoingTx

Sets an outgoing transactions into the applications transaction pool to be included into a batch.

| Key                                     | Value                                              | Type                       | Encoding         |
| --------------------------------------- | -------------------------------------------------- | -------------------------- | ---------------- |
| `[]byte{0x6} + id (big endian encoded)` | User created transaction to be included in a batch | `types.OutgoingTransferTx` | Protobuf encoded |

```proto
// OutgoingTransferTx represents an individual send from gravity to ETH
message OutgoingTransferTx {
  uint64     id           = 1;
  string     sender       = 2;
  string     dest_address = 3;
  ERC20Token erc20_token  = 4;
  ERC20Token erc20_fee    = 5;
}
```

### IDS

### SlashedBlockHeight

Represents the latest slashed block height. There is always only a singe value stored.

| Key            | Value                                   | Type     | Encoding           |
| -------------- | --------------------------------------- | -------- | ------------------ |
| `[]byte{0xf7}` | Latest height a batch slashing occurred | `uint64` | Big endian encoded |

### TokenContract & Denom

A denom that is originally from a counter chain will be from a contract. The toke contract and denom are stored in two ways. First, the denom is used as the key and the value is the token contract. Second, the contract is used as the key, the value is the denom the token contract represents.

| Key                            | Value                  | Type     | Encoding              |
| ------------------------------ | ---------------------- | -------- | --------------------- |
| `[]byte{0xf3} + []byte(denom)` | Token contract address | `[]byte` | stored in byte format |

| Key                                    | Value                                   | Type     | Encoding              |
| -------------------------------------- | --------------------------------------- | -------- | --------------------- |
| `[]byte{0xf4} + []byte(tokenContract)` | Latest height a batch slashing occurred | `[]byte` | stored in byte format |

### LastEventNonce

The last observed event nonce. This is set when `TryAttestation()` is called. There is always only a single value held in this store.

| Key            | Value                     | Type     | Encoding           |
| -------------- | ------------------------- | -------- | ------------------ |
| `[]byte{0xf2}` | Last observed event nonce | `uint64` | Big endian encoded |

### LastObservedEthereumHeight

This is the last observed height on ethereum. There will always only be a single value stored in this store.

| Key            | Value                         | Type     | Encoding           |
| -------------- | ----------------------------- | -------- | ------------------ |
| `[]byte{0xf9}` | Last observed Ethereum Height | `uint64` | Big endian encoded |

### Attestation

This is a record of all the votes for a given claim (Ethereum event).

| Key                                                                 | Value                                 | Type                | Encoding         |
| ------------------------------------------------------------------- | ------------------------------------- | ------------------- | ---------------- |
| `[]byte{0x5} + eventNonce (big endian encoded) + []byte(claimHash)` | Attestation of occurred events/claims | `types.Attestation` | Protobuf encoded |

```proto
// Attestation is an aggregate of `claims` that eventually becomes `observed` by
// all orchestrators
message Attestation {
  // This field stores whether the Attestation has had its event applied to the Cosmos state. This happens when
  // enough (usually >2/3s) of the validator power votes that they saw the event on Ethereum.
  // For example, once a DepositClaim has modified the token balance of the account that it was deposited to,
  // this boolean will be set to true.
  bool observed = 1;
  // This is an array of the addresses of the validators which have voted that they saw the event on Ethereum.
  repeated string votes = 2;
  // This is the Cosmos block height that this event was first observed by a validator.
  uint64 height = 3;
  // The claim is the Ethereum event that this attestation is recording votes for.
  google.protobuf.Any claim = 4;
}
```

### Valset

This is a record of the Cosmos validator set at a given moment. Can be sent to the Gravity.sol contract to update the signer set.

| Key                                 | Value                      | Type           | Encoding         |
| ----------------------------------- | -------------------------- | -------------- | ---------------- |
| `[]byte{0x5} + uint64 valset nonce` | Validator set for Ethereum | `types.Valset` | Protobuf encoded |

```proto
message Valset {
  // This nonce is incremented for each subsequent valset produced by the Gravity module.
  // The Gravity.sol contract will only accept a valset with a higher nonce than the last
  // executed Valset.
  uint64 nonce = 1;
  // The validators in the valset.
  repeated BridgeValidator members = 2;
  // TODO: what is this for?
  uint64 height = 3;
}
```
