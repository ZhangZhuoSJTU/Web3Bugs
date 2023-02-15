use clarity::Address as EthAddress;
use deep_space::address::Address;
use gravity_proto::gravity::query_client::QueryClient as GravityQueryClient;
use gravity_proto::gravity::Params;
use gravity_proto::gravity::QueryBatchConfirmsRequest;
use gravity_proto::gravity::QueryCurrentValsetRequest;
use gravity_proto::gravity::QueryLastEventNonceByAddrRequest;
use gravity_proto::gravity::QueryLastPendingBatchRequestByAddrRequest;
use gravity_proto::gravity::QueryLastPendingLogicCallByAddrRequest;
use gravity_proto::gravity::QueryLastPendingValsetRequestByAddrRequest;
use gravity_proto::gravity::QueryLastValsetRequestsRequest;
use gravity_proto::gravity::QueryLogicConfirmsRequest;
use gravity_proto::gravity::QueryOutgoingLogicCallsRequest;
use gravity_proto::gravity::QueryOutgoingTxBatchesRequest;
use gravity_proto::gravity::QueryParamsRequest;
use gravity_proto::gravity::QueryValsetConfirmsByNonceRequest;
use gravity_proto::gravity::QueryValsetRequestRequest;
use gravity_utils::error::GravityError;
use gravity_utils::types::*;
use tonic::transport::Channel;

/// Gets the Gravity module parameters from the Gravity module
pub async fn get_gravity_params(
    client: &mut GravityQueryClient<Channel>,
) -> Result<Params, GravityError> {
    let request = client.params(QueryParamsRequest {}).await?.into_inner();
    Ok(request.params.unwrap())
}

/// get the valset for a given nonce (block) height
pub async fn get_valset(
    client: &mut GravityQueryClient<Channel>,
    nonce: u64,
) -> Result<Option<Valset>, GravityError> {
    let request = client
        .valset_request(QueryValsetRequestRequest { nonce })
        .await?;
    let valset = request.into_inner().valset;
    let valset = valset.map(|v| v.into());
    Ok(valset)
}

/// get the current valset. You should never sign this valset
/// valset requests create a consensus point around the block height
/// that transaction got in. Without that consensus point everyone trying
/// to sign the 'current' valset would run into slight differences and fail
/// to produce a viable update.
pub async fn get_current_valset(
    client: &mut GravityQueryClient<Channel>,
) -> Result<Valset, GravityError> {
    let request = client.current_valset(QueryCurrentValsetRequest {}).await?;
    let valset = request.into_inner().valset;
    if let Some(valset) = valset {
        Ok(valset.into())
    } else {
        error!("Current valset returned None? This should be impossible");
        Err(GravityError::InvalidBridgeStateError(
            "Must have a current valset!".to_string(),
        ))
    }
}

/// This hits the /pending_valset_requests endpoint and will provide
/// an array of validator sets we have not already signed
pub async fn get_oldest_unsigned_valsets(
    client: &mut GravityQueryClient<Channel>,
    address: Address,
    prefix: String,
) -> Result<Vec<Valset>, GravityError> {
    let request = client
        .last_pending_valset_request_by_addr(QueryLastPendingValsetRequestByAddrRequest {
            address: address.to_bech32(prefix).unwrap(),
        })
        .await?;
    let valsets = request.into_inner().valsets;
    // convert from proto valset type to rust valset type
    let valsets = valsets.iter().map(|v| v.into()).collect();
    Ok(valsets)
}

/// this input views the last five valset requests that have been made, useful if you're
/// a relayer looking to ferry confirmations
pub async fn get_latest_valsets(
    client: &mut GravityQueryClient<Channel>,
) -> Result<Vec<Valset>, GravityError> {
    let request = client
        .last_valset_requests(QueryLastValsetRequestsRequest {})
        .await?;
    let valsets = request.into_inner().valsets;
    Ok(valsets.iter().map(|v| v.into()).collect())
}

/// get all valset confirmations for a given nonce
pub async fn get_all_valset_confirms(
    client: &mut GravityQueryClient<Channel>,
    nonce: u64,
) -> Result<Vec<ValsetConfirmResponse>, GravityError> {
    let request = client
        .valset_confirms_by_nonce(QueryValsetConfirmsByNonceRequest { nonce })
        .await?;
    let confirms = request.into_inner().confirms;
    let mut parsed_confirms = Vec::new();
    for item in confirms {
        parsed_confirms.push(ValsetConfirmResponse::from_proto(item)?)
    }
    Ok(parsed_confirms)
}

pub async fn get_oldest_unsigned_transaction_batch(
    client: &mut GravityQueryClient<Channel>,
    address: Address,
    prefix: String,
) -> Result<Option<TransactionBatch>, GravityError> {
    let request = client
        .last_pending_batch_request_by_addr(QueryLastPendingBatchRequestByAddrRequest {
            address: address.to_bech32(prefix).unwrap(),
        })
        .await?;
    let batch = request.into_inner().batch;
    match batch {
        Some(batch) => Ok(Some(TransactionBatch::from_proto(batch)?)),
        None => Ok(None),
    }
}

/// gets the latest 100 transaction batches, regardless of token type
/// for relayers to consider relaying
pub async fn get_latest_transaction_batches(
    client: &mut GravityQueryClient<Channel>,
) -> Result<Vec<TransactionBatch>, GravityError> {
    let request = client
        .outgoing_tx_batches(QueryOutgoingTxBatchesRequest {})
        .await?;
    let batches = request.into_inner().batches;
    let mut out = Vec::new();
    for batch in batches {
        out.push(TransactionBatch::from_proto(batch)?)
    }
    Ok(out)
}

/// get all batch confirmations for a given nonce and denom
pub async fn get_transaction_batch_signatures(
    client: &mut GravityQueryClient<Channel>,
    nonce: u64,
    contract_address: EthAddress,
) -> Result<Vec<BatchConfirmResponse>, GravityError> {
    let request = client
        .batch_confirms(QueryBatchConfirmsRequest {
            nonce,
            contract_address: contract_address.to_string(),
        })
        .await?;
    let batch_confirms = request.into_inner().confirms;
    let mut out = Vec::new();
    for confirm in batch_confirms {
        out.push(BatchConfirmResponse::from_proto(confirm)?)
    }
    Ok(out)
}

/// Gets the last event nonce that a given validator has attested to, this lets us
/// catch up with what the current event nonce should be if a oracle is restarted
pub async fn get_last_event_nonce_for_validator(
    client: &mut GravityQueryClient<Channel>,
    address: Address,
    prefix: String,
) -> Result<u64, GravityError> {
    let request = client
        .last_event_nonce_by_addr(QueryLastEventNonceByAddrRequest {
            address: address.to_bech32(prefix).unwrap(),
        })
        .await?;
    Ok(request.into_inner().event_nonce)
}

/// Gets the 100 latest logic calls for a relayer to consider relaying
pub async fn get_latest_logic_calls(
    client: &mut GravityQueryClient<Channel>,
) -> Result<Vec<LogicCall>, GravityError> {
    let request = client
        .outgoing_logic_calls(QueryOutgoingLogicCallsRequest {})
        .await?;
    let calls = request.into_inner().calls;
    let mut out = Vec::new();
    for call in calls {
        out.push(LogicCall::from_proto(call)?);
    }
    Ok(out)
}

pub async fn get_logic_call_signatures(
    client: &mut GravityQueryClient<Channel>,
    invalidation_id: Vec<u8>,
    invalidation_nonce: u64,
) -> Result<Vec<LogicCallConfirmResponse>, GravityError> {
    let request = client
        .logic_confirms(QueryLogicConfirmsRequest {
            invalidation_id,
            invalidation_nonce,
        })
        .await?;
    let call_confirms = request.into_inner().confirms;
    let mut out = Vec::new();
    for confirm in call_confirms {
        out.push(LogicCallConfirmResponse::from_proto(confirm)?)
    }
    Ok(out)
}

pub async fn get_oldest_unsigned_logic_call(
    client: &mut GravityQueryClient<Channel>,
    address: Address,
    prefix: String,
) -> Result<Option<LogicCall>, GravityError> {
    let request = client
        .last_pending_logic_call_by_addr(QueryLastPendingLogicCallByAddrRequest {
            address: address.to_bech32(prefix).unwrap(),
        })
        .await?;
    let call = request.into_inner().call;
    match call {
        Some(call) => Ok(Some(LogicCall::from_proto(call)?)),
        None => Ok(None),
    }
}
