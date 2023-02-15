<!--
order: 6
-->

# Events

The gravity module emits the following events:

## EndBlocker

| Type                         | Attribute Key                 | Attribute Value                 |
|------------------------------|-------------------------------|---------------------------------|
| outgoing_logic_call_canceled | module                        | gravity                           |
| outgoing_logic_call_canceled | logic_call_invalidation_id    | {logic_call_invalidation_id}    |
| outgoing_logic_call_canceled | logic_call_invalidation_nonce | {logic_call_invalidation_nonce} |

| Type                    | Attribute Key   | Attribute Value   |
|-------------------------|-----------------|-------------------|
| multisig_update_request | module          | gravity             |
| multisig_update_request | bridge_contract | {bridge_contract} |
| multisig_update_request | bridge_chain_id | {bridge_chain_id} |
| multisig_update_request | multisig_id     | {multisig_id}     |
| multisig_update_request | nonce           | {nonce}           |

| Type                         | Attribute Key   | Attribute Value   |
|------------------------------|-----------------|-------------------|
| outgoing_logic_call_canceled | module          | gravity             |
| outgoing_logic_call_canceled | bridge_contract | {bridge_contract} |
| outgoing_logic_call_canceled | bridge_chain_id | {bridge_chain_id} |
| outgoing_logic_call_canceled | batch_id        | {batch_id}        |
| outgoing_logic_call_canceled | nonce           | {nonce}           |

| Type        | Attribute Key    | Attribute Value    |
|-------------|------------------|--------------------|
| observation | module           | gravity              |
| observation | attestation_type | {attestation_type} |
| observation | bridge_contract  | {bridge_contract}  |
| observation | bridge_chain_id  | {bridge_chain_id}  |
| observation | attestation_id   | {attestation_id}   |
| observation | attestation_id   | {attestation_id}   |
| observation | nonce            | {nonce}            |
  
## Service Messages

### Msg/ValsetConfirm

| Type    | Attribute Key        | Attribute Value    |
|---------|----------------------|--------------------|
| message | module               | valset_confirm     |
| message | set_operator_address | {operator_address} |

### Msg/SendToEth

| Type    | Attribute Key  | Attribute Value |
|---------|----------------|-----------------|
| message | module         | send_to_eth     |
| message | outgoing_tx_id | {tx_id}         |

| Type                | Attribute Key   | Attribute Value   |
|---------------------|-----------------|-------------------|
| withdrawal_received | module          | gravity             |
| withdrawal_received | bridge_contract | {bridge_contract} |
| withdrawal_received | bridge_chain_id | {bridge_chain_id} |
| withdrawal_received | outgoing_tx_id  | {outgoing_tx_id}  |
| withdrawal_received | nonce           | {nonce}           |

### Msg/RequestBatch

| Type    | Attribute Key | Attribute Value |
|---------|---------------|-----------------|
| message | module        | request_batch   |
| message | batch_nonce   | {batch_tx_id}   |

| Type           | Attribute Key   | Attribute Value   |
|----------------|-----------------|-------------------|
| outgoing_batch | module          | gravity             |
| outgoing_batch | bridge_contract | {bridge_contract} |
| outgoing_batch | bridge_chain_id | {bridge_chain_id} |
| outgoing_batch | outgoing_tx_id  | {outgoing_tx_id}  |
| outgoing_batch | nonce           | {nonce}           |

### Msg/ConfirmBatch

| Type    | Attribute Key     | Attribute Value     |
|---------|-------------------|---------------------|
| message | module            | confirm_batch       |
| message | batch_confirm_key | {batch_confirm_key} |

### Msg/SetOrchestratorAddress

| Type    | Attribute Key        | Attribute Value      |
|---------|----------------------|----------------------|
| message | module               | set_operator_address |
| message | set_operator_address | {operator_address}   |

### MsgConfirmLogicCall

| Type    | Attribute Key | Attribute Value |
|---------|---------------|-----------------|
| message | module        | confirm_logic   |

### Msg/ERC20DeployedClaim

| Type    | Attribute Key  | Attribute Value      |
|---------|----------------|----------------------|
| message | module         | ERC20_deployed_claim |
| message | attestation_id | {attestation_key}    |

### Msg/ConfirmLogicCall

| Type    | Attribute Key | Attribute Value |
|---------|---------------|-----------------|
| message | module        | confirm_logic   |

### Msg/LogicCallExecutedClaim

| Type    | Attribute Key  | Attribute Value           |
|---------|----------------|---------------------------|
| message | module         | Logic_Call_Executed_Claim |
| message | attestation_id | {attestation_key}         |

### Msg/DepositClaim

| Type    | Attribute Key  | Attribute Value   |
|---------|----------------|-------------------|
| message | module         | deposit_claim     |
| message | attestation_id | {attestation_key} |

### Msg/WithdrawClaim

| Type    | Attribute Key  | Attribute Value   |
|---------|----------------|-------------------|
| message | module         | withdraw_claim    |
| message | attestation_id | {attestation_key} |
