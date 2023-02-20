use crate::args::RelayerOpts;
use crate::config::config_exists;
use crate::config::load_keys;
use cosmos_gravity::query::get_gravity_params;
use gravity_utils::connection_prep::{
    check_for_eth, create_rpc_connections, wait_for_cosmos_node_ready,
};
use gravity_utils::types::RelayerConfig;
use relayer::main_loop::relayer_main_loop;
use relayer::main_loop::LOOP_SPEED;
use std::path::Path;
use std::process::exit;

pub async fn relayer(
    args: RelayerOpts,
    address_prefix: String,
    home_dir: &Path,
    config: &RelayerConfig,
) {
    let cosmos_grpc = args.cosmos_grpc;
    let ethereum_rpc = args.ethereum_rpc;
    let ethereum_key = args.ethereum_key;
    let connections = create_rpc_connections(
        address_prefix,
        Some(cosmos_grpc),
        Some(ethereum_rpc),
        LOOP_SPEED,
    )
    .await;

    let ethereum_key = if let Some(k) = ethereum_key {
        k
    } else {
        let mut k = None;
        if config_exists(home_dir) {
            let keys = load_keys(home_dir);
            if let Some(stored_key) = keys.ethereum_key {
                k = Some(stored_key)
            }
        }
        if k.is_none() {
            error!("You must specify an Ethereum key!");
            error!("To generate, register, and store a key use `gbt keys register-orchestrator-address`");
            error!("Store an already registered key using 'gbt keys set-ethereum-key`");
            error!("To run from the command line, with no key storage use 'gbt orchestrator --ethereum-key your key' ");
            exit(1);
        }
        k.unwrap()
    };

    let public_eth_key = ethereum_key
        .to_public_key()
        .expect("Invalid Ethereum Private Key!");
    info!("Starting Gravity Relayer");
    info!("Ethereum Address: {}", public_eth_key);

    let contact = connections.contact.clone().unwrap();
    let web3 = connections.web3.unwrap();
    let mut grpc = connections.grpc.unwrap();

    // check if the cosmos node is syncing, if so wait for it
    // we can't move any steps above this because they may fail on an incorrect
    // historic chain state while syncing occurs
    wait_for_cosmos_node_ready(&contact).await;
    check_for_eth(public_eth_key, &web3).await;

    // get the gravity contract address, if not provided
    let contract_address = if let Some(c) = args.gravity_contract_address {
        c
    } else {
        let params = get_gravity_params(&mut grpc).await.unwrap();
        let c = params.bridge_ethereum_address.parse();
        if c.is_err() {
            error!("The Gravity address is not yet set as a chain parameter! You must specify --gravity-contract-address");
            exit(1);
        }
        c.unwrap()
    };

    relayer_main_loop(ethereum_key, web3, grpc, contract_address, config).await
}
