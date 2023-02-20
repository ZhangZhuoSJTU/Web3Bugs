//! This module contains code for the validator update lifecycle. Functioning as a way for this validator to observe
//! the state of both chains and perform the required operations.
use std::time::Duration;

use clarity::PrivateKey as EthPrivateKey;
use clarity::{address::Address as EthAddress, utils::bytes_to_hex_str};
use cosmos_gravity::query::get_latest_valsets;
use cosmos_gravity::query::{get_all_valset_confirms, get_valset};
use ethereum_gravity::message_signatures::encode_valset_confirm_hashed;
use ethereum_gravity::{
    one_eth,
    utils::downcast_to_u128,
    utils::get_valset_nonce,
    utils::GasCost,
    valset_update::{encode_valset_update_payload, send_eth_valset_update},
};
use gravity_proto::gravity::query_client::QueryClient as GravityQueryClient;
use gravity_utils::error::GravityError;
use gravity_utils::types::ValsetConfirmResponse;
use gravity_utils::types::{RelayerConfig, Valset};
use tonic::transport::Channel;
use web30::client::Web3;

// Locates the latest valid valset which can be moved to ethereum
// Due to the disparity between the ethereum valset and the actual current cosmos valset
// we may need to move multiple valsets over to update ethereum, based on how much voting power change has ocurred
async fn find_latest_valid_valset(
    latest_nonce: &u64,
    current_valset: &Valset,
    grpc_client: &mut GravityQueryClient<Channel>,
    gravity_id: &str,
) -> (
    Option<Valset>,
    Option<Vec<ValsetConfirmResponse>>,
    Option<GravityError>,
) {
    // we only use the latest valsets endpoint to get a starting point, from there we will iterate
    // backwards until we find the newest validator set that we can submit to the bridge. So if we
    // have sets A-Z and it's possible to submit only A, L, and Q before reaching Z this code will do
    // so.
    let mut latest_nonce = *latest_nonce;
    let mut latest_confirmed = None;
    let mut latest_valset = None;
    // this is used to display the state of the last validator set to fail signature checks
    let mut last_error = None;
    while latest_nonce > 0 {
        let valset = get_valset(grpc_client, latest_nonce).await;
        if let Ok(Some(valset)) = valset {
            assert_eq!(valset.nonce, latest_nonce);
            let confirms = get_all_valset_confirms(grpc_client, latest_nonce).await;
            if let Ok(confirms) = confirms {
                for confirm in confirms.iter() {
                    assert_eq!(valset.nonce, confirm.nonce);
                }
                let hash = encode_valset_confirm_hashed(gravity_id.to_string(), valset.clone());
                // order valset sigs prepares signatures for submission, notice we compare
                // them to the 'current' set in the bridge, this confirms for us that the validator set
                // we have here can be submitted to the bridge in it's current state
                let res = current_valset.order_sigs(&hash, &confirms);
                if res.is_ok() {
                    latest_confirmed = Some(confirms);
                    latest_valset = Some(valset);
                    // once we have the latest validator set we can submit exit
                    break;
                } else if let Err(e) = res {
                    last_error = Some(e);
                }
            }
        }

        latest_nonce -= 1
    }

    (latest_valset, latest_confirmed, last_error)
}

// Handles errors that ocurr when estimating valset cost
#[allow(clippy::too_many_arguments)]
async fn valset_cost_error(
    cost: Result<GasCost, GravityError>,
    ethereum_key: &EthPrivateKey,
    gravity_id: String,
    gravity_contract_address: &EthAddress,
    web3: &Web3,
    latest_cosmos_valset: Valset,
    latest_cosmos_confirmed: &[ValsetConfirmResponse],
    current_valset: Valset,
) {
    let our_address = ethereum_key.to_public_key().unwrap();
    let current_valset_from_eth =
        get_valset_nonce(*gravity_contract_address, our_address, web3).await;
    if let Ok(current_valset_from_eth) = current_valset_from_eth {
        error!(
            "Valset cost estimate for Nonce {} failed with {:?}, current valset {} / {}",
            latest_cosmos_valset.nonce, cost, current_valset.nonce, current_valset_from_eth
        );
        let hash = encode_valset_confirm_hashed(gravity_id.clone(), latest_cosmos_valset.clone());
        // there are two possible encoding problems that could cause the very rare sig failure bug,
        // one of them is that the hash is incorrect, that's not probable considering that
        // both Geth and Clarity agree on it. but this lets us check
        debug!(
            "New valset hash {} new valset data {:?} old valset data {:?}",
            bytes_to_hex_str(&hash),
            latest_cosmos_valset,
            current_valset,
        );
        // the other is the encoding of the payload itself, which I believe to be more probable.
        let payload = encode_valset_update_payload(
            latest_cosmos_valset,
            current_valset,
            latest_cosmos_confirmed,
            gravity_id,
        )
        .unwrap();
        debug!("New valset payload {}", bytes_to_hex_str(&payload));
    }
}

async fn should_relay_valset(
    valset: &Valset,
    ethereum_key: &EthPrivateKey,
    cost: GasCost,
    web3: &Web3,
) -> bool {
    let mut should_relay;

    let relaying_cost = cost.gas * cost.gas_price;
    let pub_key = ethereum_key.to_public_key().unwrap();
    let reward = valset.reward_amount.clone();
    let token_in = valset.reward_token;
    if token_in.is_none() {
        info!("No reward token has been determined for the valset, not relaying!");
        return false;
    }
    let token_in = token_in.unwrap();
    // for now we always want weth
    let token_out = *web30::amm::WETH_CONTRACT_ADDRESS;
    // If we're being rewarded in weth, we can just compare cost of gas to reward and see if we're getting enough
    if token_out == token_in {
        // TODO: Give relayers a configuration option in this case
        should_relay = reward > relaying_cost;
    } else {
        warn!(
            "No potential reward for relaying valset: {:#?} - not relaying!",
            valset
        );
        return false;
    }
    // TODO: Give relayers an option for this value
    // TODO: Understand this value better and give relayers an option
    let sqrt_price_limit_x96_uint160 = 0u8.into();

    if !should_relay {
        //
        let value = web3
            .get_uniswap_price(
                pub_key,
                token_in,
                token_out,
                None,
                reward,
                Some(sqrt_price_limit_x96_uint160),
                None,
            )
            .await;
        if value.is_err() {
            info!(
                "Not relaying because uniswap returned an error {}",
                value.err().unwrap()
            );
        } else {
            let val = value.unwrap();
            // TODO: Give relayers a configuration option in this case too
            should_relay = val > relaying_cost;
            debug!(
                "We will be relaying because value of reward in weth: {} > cost of gas {}",
                val, relaying_cost
            );
        }
    }

    should_relay
}

#[allow(clippy::too_many_arguments)]
// Performs relaying of a valid valset, if it is profitable to do so
async fn relay_valid_valset(
    latest_cosmos_valset: Valset,
    current_valset: Valset,
    latest_cosmos_confirmed: Vec<ValsetConfirmResponse>,
    web3: &Web3,
    gravity_contract_address: EthAddress,
    gravity_id: String,
    ethereum_key: EthPrivateKey,
    timeout: Duration,
    enable_relay_market: &bool,
) {
    let cost = ethereum_gravity::valset_update::estimate_valset_cost(
        &latest_cosmos_valset,
        &current_valset,
        &latest_cosmos_confirmed,
        web3,
        gravity_contract_address,
        gravity_id.clone(),
        ethereum_key,
    )
    .await;
    if cost.is_err() {
        valset_cost_error(
            cost,
            &ethereum_key,
            gravity_id.clone(),
            &gravity_contract_address,
            web3,
            latest_cosmos_valset.clone(),
            &latest_cosmos_confirmed,
            current_valset,
        )
        .await;
        return;
    }
    let cost = cost.unwrap();

    info!(
           "We have detected latest valset {} but latest on Ethereum is {} This valset is estimated to cost {} Gas / {:.4} ETH to submit",
            latest_cosmos_valset.nonce, current_valset.nonce,
            cost.gas_price.clone(),
            downcast_to_u128(cost.get_total()).unwrap() as f32
                / downcast_to_u128(one_eth()).unwrap() as f32
        );

    let should_relay = if *enable_relay_market {
        should_relay_valset(&latest_cosmos_valset, &ethereum_key, cost, web3).await
    } else {
        true // Default to relaying if the relay market is disabled
    };

    if should_relay {
        let _res = send_eth_valset_update(
            latest_cosmos_valset,
            current_valset,
            &latest_cosmos_confirmed,
            web3,
            timeout,
            gravity_contract_address,
            gravity_id,
            ethereum_key,
        )
        .await;
    } else {
        info!(
            "Not relaying valset {:?} because it is not profitable",
            latest_cosmos_valset
        );
    }
}

#[allow(clippy::too_many_arguments)]
/// Check the last validator set on Ethereum, if it's lower than our latest validator
/// set then we should package and submit the update as an Ethereum transaction
pub async fn relay_valsets(
    // the validator set currently in the contract on Ethereum
    current_valset: Valset,
    ethereum_key: EthPrivateKey,
    web3: &Web3,
    grpc_client: &mut GravityQueryClient<Channel>,
    gravity_contract_address: EthAddress,
    gravity_id: String,
    timeout: Duration,
    config: &RelayerConfig,
) {
    // we have to start with the current valset, we need to know what's currently
    // in the contract in order to determine if a new validator set is valid.
    // For example the contract has set A which contains validators x/y/z the
    // latest valset has set C which has validators z/e/f in order to have enough
    // power we actually need to submit validator set B with validators x/y/e in
    // order to know that we need a set from the history

    // we should determine if we need to relay one
    // to Ethereum for that we will find the latest confirmed valset and compare it to the ethereum chain
    let latest_valsets = get_latest_valsets(grpc_client).await;
    if latest_valsets.is_err() {
        trace!("Failed to get latest valsets!");
        // there are no latest valsets to check, possible on a bootstrapping chain maybe handle better?
        return;
    }
    let latest_valsets = latest_valsets.unwrap();
    if latest_valsets.is_empty() {
        return;
    }

    let (latest_valset, latest_confirmed, last_error) = find_latest_valid_valset(
        &latest_valsets[0].nonce,
        &current_valset,
        grpc_client,
        &gravity_id,
    )
    .await;

    if latest_valset.is_none() {
        trace!("Could not find a valset to move to ethereum! exiting");
        return;
    }

    // the latest cosmos validator set that it is possible to submit given the constraints
    // of the validator set currently in the bridge
    let latest_cosmos_valset = latest_valset.unwrap();
    let latest_nonce = latest_cosmos_valset.nonce;

    if latest_confirmed.is_none() {
        error!("We don't have a latest confirmed valset?");
        return;
    }

    // the signatures for the above
    let latest_cosmos_confirmed = latest_confirmed.unwrap();

    // this will print a message indicating the signing state of the latest validator
    // set if the latest available validator set is not the latest one that is possible
    // to submit. AKA if the bridge is behind where it should be
    if latest_nonce > latest_cosmos_valset.nonce && last_error.is_some() {
        warn!("{:?}", last_error)
    }

    if latest_cosmos_valset.nonce > current_valset.nonce {
        relay_valid_valset(
            latest_cosmos_valset,
            current_valset,
            latest_cosmos_confirmed,
            web3,
            gravity_contract_address,
            gravity_id,
            ethereum_key,
            timeout,
            &config.valset_market_enabled,
        )
        .await;
    }
}
