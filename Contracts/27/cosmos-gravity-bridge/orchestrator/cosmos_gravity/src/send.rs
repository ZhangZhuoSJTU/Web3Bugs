use clarity::PrivateKey as EthPrivateKey;
use clarity::{constants::ZERO_ADDRESS, Address as EthAddress};
use deep_space::address::Address;
use deep_space::error::CosmosGrpcError;
use deep_space::private_key::PrivateKey;
use deep_space::Contact;
use deep_space::Fee;
use deep_space::Msg;
use deep_space::{coin::Coin, utils::bytes_to_hex_str};
use ethereum_gravity::message_signatures::{
    encode_logic_call_confirm, encode_tx_batch_confirm, encode_valset_confirm,
};
use ethereum_gravity::utils::downcast_uint256;
use gravity_proto::cosmos_sdk_proto::cosmos::base::abci::v1beta1::TxResponse;
use gravity_proto::cosmos_sdk_proto::cosmos::tx::v1beta1::BroadcastMode;
use gravity_proto::gravity::MsgBatchSendToEthClaim;
use gravity_proto::gravity::MsgConfirmBatch;
use gravity_proto::gravity::MsgConfirmLogicCall;
use gravity_proto::gravity::MsgErc20DeployedClaim;
use gravity_proto::gravity::MsgLogicCallExecutedClaim;
use gravity_proto::gravity::MsgRequestBatch;
use gravity_proto::gravity::MsgSendToCosmosClaim;
use gravity_proto::gravity::MsgSendToEth;
use gravity_proto::gravity::MsgSetOrchestratorAddress;
use gravity_proto::gravity::MsgValsetConfirm;
use gravity_proto::gravity::MsgValsetUpdatedClaim;
use gravity_utils::types::*;
use std::{collections::HashMap, time::Duration};

pub const MEMO: &str = "Sent using Althea Orchestrator";
pub const TIMEOUT: Duration = Duration::from_secs(60);

/// Send a transaction updating the eth address for the sending
/// Cosmos address. The sending Cosmos address should be a validator
/// this can only be called once! Key rotation code is possible but
/// not currently implemented
pub async fn set_gravity_delegate_addresses(
    contact: &Contact,
    delegate_eth_address: EthAddress,
    delegate_cosmos_address: Address,
    private_key: PrivateKey,
    fee: Coin,
) -> Result<TxResponse, CosmosGrpcError> {
    trace!("Updating Gravity Delegate addresses");
    let our_valoper_address = private_key
        .to_address(&contact.get_prefix())
        .unwrap()
        // This works so long as the format set by the cosmos hub is maintained
        // having a main prefix followed by a series of titles for specific keys
        // this will not work if that convention is broken. This will be resolved when
        // GRPC exposes prefix endpoints (coming to upstream cosmos sdk soon)
        .to_bech32(format!("{}valoper", contact.get_prefix()))
        .unwrap();
    let our_address = private_key.to_address(&contact.get_prefix()).unwrap();

    let msg_set_orch_address = MsgSetOrchestratorAddress {
        validator: our_valoper_address.to_string(),
        orchestrator: delegate_cosmos_address.to_string(),
        eth_address: delegate_eth_address.to_string(),
    };

    let fee = Fee {
        amount: vec![fee],
        gas_limit: 500_000u64,
        granter: None,
        payer: None,
    };

    let msg = Msg::new(
        "/gravity.v1.MsgSetOrchestratorAddress",
        msg_set_orch_address,
    );

    let args = contact.get_message_args(our_address, fee).await?;
    trace!("got optional tx info");

    let msg_bytes = private_key.sign_std_msg(&[msg], args, MEMO)?;

    let response = contact
        .send_transaction(msg_bytes, BroadcastMode::Sync)
        .await?;

    contact.wait_for_tx(response, TIMEOUT).await
}

/// Send in a confirmation for an array of validator sets, it's far more efficient to send these
/// as a single message
#[allow(clippy::too_many_arguments)]
pub async fn send_valset_confirms(
    contact: &Contact,
    eth_private_key: EthPrivateKey,
    fee: Coin,
    valsets: Vec<Valset>,
    private_key: PrivateKey,
    gravity_id: String,
) -> Result<TxResponse, CosmosGrpcError> {
    let our_address = private_key.to_address(&contact.get_prefix()).unwrap();
    let our_eth_address = eth_private_key.to_public_key().unwrap();

    let fee = Fee {
        amount: vec![fee],
        gas_limit: 500_000_000u64,
        granter: None,
        payer: None,
    };

    let mut messages = Vec::new();

    for valset in valsets {
        trace!("Submitting signature for valset {:?}", valset);
        let message = encode_valset_confirm(gravity_id.clone(), valset.clone());
        let eth_signature = eth_private_key.sign_ethereum_msg(&message);
        trace!(
            "Sending valset update with address {} and sig {}",
            our_eth_address,
            bytes_to_hex_str(&eth_signature.to_bytes())
        );
        let confirm = MsgValsetConfirm {
            orchestrator: our_address.to_string(),
            eth_address: our_eth_address.to_string(),
            nonce: valset.nonce,
            signature: bytes_to_hex_str(&eth_signature.to_bytes()),
        };
        let msg = Msg::new("/gravity.v1.MsgValsetConfirm", confirm);
        messages.push(msg);
    }
    let args = contact.get_message_args(our_address, fee).await?;
    trace!("got optional tx info");

    let msg_bytes = private_key.sign_std_msg(&messages, args, MEMO)?;

    let response = contact
        .send_transaction(msg_bytes, BroadcastMode::Sync)
        .await?;

    contact.wait_for_tx(response, TIMEOUT).await
}

/// Send in a confirmation for a specific transaction batch
pub async fn send_batch_confirm(
    contact: &Contact,
    eth_private_key: EthPrivateKey,
    fee: Coin,
    transaction_batches: Vec<TransactionBatch>,
    private_key: PrivateKey,
    gravity_id: String,
) -> Result<TxResponse, CosmosGrpcError> {
    let our_address = private_key.to_address(&contact.get_prefix()).unwrap();
    let our_eth_address = eth_private_key.to_public_key().unwrap();

    let fee = Fee {
        amount: vec![fee],
        gas_limit: 500_000_000u64,
        granter: None,
        payer: None,
    };

    let mut messages = Vec::new();

    for batch in transaction_batches {
        trace!("Submitting signature for batch {:?}", batch);
        let message = encode_tx_batch_confirm(gravity_id.clone(), batch.clone());
        let eth_signature = eth_private_key.sign_ethereum_msg(&message);
        trace!(
            "Sending batch update with address {} and sig {}",
            our_eth_address,
            bytes_to_hex_str(&eth_signature.to_bytes())
        );
        let confirm = MsgConfirmBatch {
            token_contract: batch.token_contract.to_string(),
            orchestrator: our_address.to_string(),
            eth_signer: our_eth_address.to_string(),
            nonce: batch.nonce,
            signature: bytes_to_hex_str(&eth_signature.to_bytes()),
        };
        let msg = Msg::new("/gravity.v1.MsgConfirmBatch", confirm);
        messages.push(msg);
    }
    let args = contact.get_message_args(our_address, fee).await?;
    trace!("got optional tx info");

    let msg_bytes = private_key.sign_std_msg(&messages, args, MEMO)?;

    let response = contact
        .send_transaction(msg_bytes, BroadcastMode::Sync)
        .await?;

    contact.wait_for_tx(response, TIMEOUT).await
}

/// Send in a confirmation for a specific logic call
pub async fn send_logic_call_confirm(
    contact: &Contact,
    eth_private_key: EthPrivateKey,
    fee: Coin,
    logic_calls: Vec<LogicCall>,
    private_key: PrivateKey,
    gravity_id: String,
) -> Result<TxResponse, CosmosGrpcError> {
    let our_address = private_key.to_address(&contact.get_prefix()).unwrap();
    let our_eth_address = eth_private_key.to_public_key().unwrap();

    let fee = Fee {
        amount: vec![fee],
        gas_limit: 500_000_000u64,
        granter: None,
        payer: None,
    };

    let mut messages = Vec::new();

    for call in logic_calls {
        trace!("Submitting signature for LogicCall {:?}", call);
        let message = encode_logic_call_confirm(gravity_id.clone(), call.clone());
        let eth_signature = eth_private_key.sign_ethereum_msg(&message);
        trace!(
            "Sending LogicCall update with address {} and sig {}",
            our_eth_address,
            bytes_to_hex_str(&eth_signature.to_bytes())
        );
        let confirm = MsgConfirmLogicCall {
            orchestrator: our_address.to_string(),
            eth_signer: our_eth_address.to_string(),
            signature: bytes_to_hex_str(&eth_signature.to_bytes()),
            invalidation_id: bytes_to_hex_str(&call.invalidation_id),
            invalidation_nonce: call.invalidation_nonce,
        };
        let msg = Msg::new("/gravity.v1.MsgConfirmLogicCall", confirm);
        messages.push(msg);
    }
    let args = contact.get_message_args(our_address, fee).await?;
    trace!("got optional tx info");

    let msg_bytes = private_key.sign_std_msg(&messages, args, MEMO)?;

    let response = contact
        .send_transaction(msg_bytes, BroadcastMode::Sync)
        .await?;

    contact.wait_for_tx(response, TIMEOUT).await
}

#[allow(clippy::too_many_arguments)]
pub async fn send_ethereum_claims(
    contact: &Contact,
    private_key: PrivateKey,
    deposits: Vec<SendToCosmosEvent>,
    withdraws: Vec<TransactionBatchExecutedEvent>,
    erc20_deploys: Vec<Erc20DeployedEvent>,
    logic_calls: Vec<LogicCallExecutedEvent>,
    valsets: Vec<ValsetUpdatedEvent>,
    fee: Coin,
) -> Result<TxResponse, CosmosGrpcError> {
    let our_address = private_key.to_address(&contact.get_prefix()).unwrap();

    // This sorts oracle messages by event nonce before submitting them. It's not a pretty implementation because
    // we're missing an intermediary layer of abstraction. We could implement 'EventTrait' and then implement sort
    // for it, but then when we go to transform 'EventTrait' objects into GravityMsg enum values we'll have all sorts
    // of issues extracting the inner object from the TraitObject. Likewise we could implement sort of GravityMsg but that
    // would require a truly horrendous (nearly 100 line) match statement to deal with all combinations. That match statement
    // could be reduced by adding two traits to sort against but really this is the easiest option.
    //
    // We index the events by event nonce in an unordered hashmap and then play them back in order into a vec
    let mut unordered_msgs = HashMap::new();
    for deposit in deposits {
        let claim = MsgSendToCosmosClaim {
            event_nonce: deposit.event_nonce,
            block_height: downcast_uint256(deposit.block_height).unwrap(),
            token_contract: deposit.erc20.to_string(),
            amount: deposit.amount.to_string(),
            cosmos_receiver: deposit.destination.to_bech32(contact.get_prefix()).unwrap(),
            ethereum_sender: deposit.sender.to_string(),
            orchestrator: our_address.to_string(),
        };
        let msg = Msg::new("/gravity.v1.MsgSendToCosmosClaim", claim);
        unordered_msgs.insert(deposit.event_nonce, msg);
    }
    for withdraw in withdraws {
        let claim = MsgBatchSendToEthClaim {
            event_nonce: withdraw.event_nonce,
            block_height: downcast_uint256(withdraw.block_height).unwrap(),
            token_contract: withdraw.erc20.to_string(),
            batch_nonce: withdraw.batch_nonce,
            orchestrator: our_address.to_string(),
        };
        let msg = Msg::new("/gravity.v1.MsgBatchSendToEthClaim", claim);
        unordered_msgs.insert(withdraw.event_nonce, msg);
    }
    for deploy in erc20_deploys {
        let claim = MsgErc20DeployedClaim {
            event_nonce: deploy.event_nonce,
            block_height: downcast_uint256(deploy.block_height).unwrap(),
            cosmos_denom: deploy.cosmos_denom,
            token_contract: deploy.erc20_address.to_string(),
            name: deploy.name,
            symbol: deploy.symbol,
            decimals: deploy.decimals as u64,
            orchestrator: our_address.to_string(),
        };
        let msg = Msg::new("/gravity.v1.MsgERC20DeployedClaim", claim);
        unordered_msgs.insert(deploy.event_nonce, msg);
    }
    for call in logic_calls {
        let claim = MsgLogicCallExecutedClaim {
            event_nonce: call.event_nonce,
            block_height: downcast_uint256(call.block_height).unwrap(),
            invalidation_id: call.invalidation_id,
            invalidation_nonce: call.invalidation_nonce,
            orchestrator: our_address.to_string(),
        };
        let msg = Msg::new("/gravity.v1.MsgLogicCallExecutedClaim", claim);
        unordered_msgs.insert(call.event_nonce, msg);
    }
    for valset in valsets {
        let claim = MsgValsetUpdatedClaim {
            event_nonce: valset.event_nonce,
            valset_nonce: valset.valset_nonce,
            block_height: downcast_uint256(valset.block_height).unwrap(),
            members: valset.members.iter().map(|v| v.into()).collect(),
            reward_amount: valset.reward_amount.to_string(),
            reward_token: valset
                .reward_token
                .unwrap_or_else(|| *ZERO_ADDRESS)
                .to_string(),
            orchestrator: our_address.to_string(),
        };
        let msg = Msg::new("/gravity.v1.MsgValsetUpdatedClaim", claim);
        unordered_msgs.insert(valset.event_nonce, msg);
    }
    let mut keys = Vec::new();
    for (key, _) in unordered_msgs.iter() {
        keys.push(*key);
    }
    keys.sort_unstable();

    let mut msgs = Vec::new();
    for i in keys {
        msgs.push(unordered_msgs.remove_entry(&i).unwrap().1);
    }

    let fee = Fee {
        amount: vec![fee],
        gas_limit: 500_000_000u64,
        granter: None,
        payer: None,
    };

    let args = contact.get_message_args(our_address, fee).await?;
    trace!("got optional tx info");

    let msg_bytes = private_key.sign_std_msg(&msgs, args, MEMO)?;

    let response = contact
        .send_transaction(msg_bytes, BroadcastMode::Sync)
        .await?;

    contact.wait_for_tx(response, TIMEOUT).await
}

/// Sends tokens from Cosmos to Ethereum. These tokens will not be sent immediately instead
/// they will require some time to be included in a batch. Note that there are two fees
/// one is the fee to be sent to Ethereum, which must be the same denom as the amount
/// the other is the Cosmos chain fee, which can be any allowed coin
pub async fn send_to_eth(
    private_key: PrivateKey,
    destination: EthAddress,
    amount: Coin,
    bridge_fee: Coin,
    fee: Coin,
    contact: &Contact,
) -> Result<TxResponse, CosmosGrpcError> {
    let our_address = private_key.to_address(&contact.get_prefix()).unwrap();
    if amount.denom != bridge_fee.denom {
        return Err(CosmosGrpcError::BadInput(format!(
            "{} {} is an invalid denom set for SendToEth you must pay fees in the same token your sending",
            amount.denom, bridge_fee.denom,
        )));
    }
    let balances = contact.get_balances(our_address).await.unwrap();
    let mut found = false;
    for balance in balances {
        if balance.denom == amount.denom {
            let total_amount = amount.amount.clone() + (fee.amount.clone() * 2u8.into());
            if balance.amount < total_amount {
                return Err(CosmosGrpcError::BadInput(format!(
                    "Insufficient balance of {} to send {}",
                    amount.denom, total_amount,
                )));
            }
            found = true;
        }
    }
    if !found {
        return Err(CosmosGrpcError::BadInput(format!(
            "No balance of {} to send",
            amount.denom,
        )));
    }

    let msg_send_to_eth = MsgSendToEth {
        sender: our_address.to_string(),
        eth_dest: destination.to_string(),
        amount: Some(amount.into()),
        bridge_fee: Some(bridge_fee.clone().into()),
    };

    let fee = Fee {
        amount: vec![fee],
        gas_limit: 500_000u64,
        granter: None,
        payer: None,
    };

    let msg = Msg::new("/gravity.v1.MsgSendToEth", msg_send_to_eth);

    let args = contact.get_message_args(our_address, fee).await?;
    trace!("got optional tx info");

    let msg_bytes = private_key.sign_std_msg(&[msg], args, MEMO)?;

    let response = contact
        .send_transaction(msg_bytes, BroadcastMode::Sync)
        .await?;

    contact.wait_for_tx(response, TIMEOUT).await
}

pub async fn send_request_batch(
    private_key: PrivateKey,
    denom: String,
    fee: Coin,
    contact: &Contact,
) -> Result<TxResponse, CosmosGrpcError> {
    let our_address = private_key.to_address(&contact.get_prefix()).unwrap();

    let msg_request_batch = MsgRequestBatch {
        sender: our_address.to_string(),
        denom,
    };

    let fee = Fee {
        amount: vec![fee],
        gas_limit: 500_000_000u64,
        granter: None,
        payer: None,
    };

    let msg = Msg::new("/gravity.v1.MsgRequestBatch", msg_request_batch);

    let args = contact.get_message_args(our_address, fee).await?;
    trace!("got optional tx info");

    let msg_bytes = private_key.sign_std_msg(&[msg], args, MEMO)?;

    let response = contact
        .send_transaction(msg_bytes, BroadcastMode::Sync)
        .await?;

    contact.wait_for_tx(response, TIMEOUT).await
}
