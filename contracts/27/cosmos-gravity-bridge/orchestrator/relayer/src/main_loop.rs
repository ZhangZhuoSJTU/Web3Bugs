use crate::{
    batch_relaying::relay_batches, find_latest_valset::find_latest_valset,
    logic_call_relaying::relay_logic_calls, valset_relaying::relay_valsets,
};
use clarity::address::Address as EthAddress;
use clarity::PrivateKey as EthPrivateKey;
use ethereum_gravity::utils::get_gravity_id;
use gravity_proto::gravity::query_client::QueryClient as GravityQueryClient;
use gravity_utils::types::RelayerConfig;
use std::time::{Duration, Instant};
use tokio::time::sleep as delay_for;
use tonic::transport::Channel;
use web30::client::Web3;

pub const LOOP_SPEED: Duration = Duration::from_secs(17);

/// This function contains the orchestrator primary loop, it is broken out of the main loop so that
/// it can be called in the test runner for easier orchestration of multi-node tests
pub async fn relayer_main_loop(
    ethereum_key: EthPrivateKey,
    web3: Web3,
    grpc_client: GravityQueryClient<Channel>,
    gravity_contract_address: EthAddress,
    relayer_config: &RelayerConfig,
) {
    let mut grpc_client = grpc_client;
    loop {
        let loop_start = Instant::now();

        let our_ethereum_address = ethereum_key.to_public_key().unwrap();
        let current_valset =
            find_latest_valset(&mut grpc_client, gravity_contract_address, &web3).await;
        if current_valset.is_err() {
            error!("Could not get current valset! {:?}", current_valset);
            continue;
        }
        let current_valset = current_valset.unwrap();

        let gravity_id =
            get_gravity_id(gravity_contract_address, our_ethereum_address, &web3).await;
        if gravity_id.is_err() {
            error!("Failed to get GravityID, check your Eth node");
            return;
        }
        let gravity_id = gravity_id.unwrap();
        let gravity_id = String::from_utf8(gravity_id.clone()).expect("Invalid GravityID");

        relay_valsets(
            current_valset.clone(),
            ethereum_key,
            &web3,
            &mut grpc_client,
            gravity_contract_address,
            gravity_id.clone(),
            LOOP_SPEED,
            relayer_config,
        )
        .await;

        relay_batches(
            current_valset.clone(),
            ethereum_key,
            &web3,
            &mut grpc_client,
            gravity_contract_address,
            gravity_id.clone(),
            LOOP_SPEED,
            relayer_config,
        )
        .await;

        relay_logic_calls(
            current_valset,
            ethereum_key,
            &web3,
            &mut grpc_client,
            gravity_contract_address,
            gravity_id.clone(),
            LOOP_SPEED,
            relayer_config,
        )
        .await;

        // a bit of logic that tires to keep things running every 5 seconds exactly
        // this is not required for any specific reason. In fact we expect and plan for
        // the timing being off significantly
        let elapsed = Instant::now() - loop_start;
        if elapsed < LOOP_SPEED {
            delay_for(LOOP_SPEED - elapsed).await;
        }
    }
}
