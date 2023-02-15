//! this crate, namely runs all up integration tests of the Gravity code against
//! several scenarios, happy path and non happy path. This is essentially meant
//! to be executed in our specific CI docker container and nowhere else. If you
//! find some function useful pull it up into the more general gravity_utils or the like

#[macro_use]
extern crate log;

use crate::bootstrapping::*;
use crate::utils::*;
use crate::valset_rewards::valset_rewards_test;
use arbitrary_logic::arbitrary_logic_test;
use clarity::PrivateKey as EthPrivateKey;
use clarity::{Address as EthAddress, Uint256};
use cosmos_gravity::utils::wait_for_cosmos_online;
use deep_space::coin::Coin;
use deep_space::Address as CosmosAddress;
use deep_space::Contact;
use gravity_proto::gravity::query_client::QueryClient as GravityQueryClient;
use happy_path::happy_path_test;
use happy_path_v2::happy_path_test_v2;
use lazy_static::lazy_static;
use orch_keys::orch_keys;
use relay_market::relay_market_test;
use std::{env, time::Duration};
use transaction_stress_test::transaction_stress_test;
use valset_stress::validator_set_stress_test;

mod arbitrary_logic;
mod bootstrapping;
mod happy_path;
mod happy_path_v2;
mod orch_keys;
mod relay_market;
mod transaction_stress_test;
mod utils;
mod valset_rewards;
mod valset_stress;

/// the timeout for individual requests
const OPERATION_TIMEOUT: Duration = Duration::from_secs(30);
/// the timeout for the total system
const TOTAL_TIMEOUT: Duration = Duration::from_secs(300);

// Retrieve values from runtime ENV vars
lazy_static! {
    static ref ADDRESS_PREFIX: String =
        env::var("ADDRESS_PREFIX").unwrap_or_else(|_| CosmosAddress::DEFAULT_PREFIX.to_owned());
    static ref STAKING_TOKEN: String =
        env::var("STAKING_TOKEN").unwrap_or_else(|_| "stake".to_owned());
    static ref COSMOS_NODE_GRPC: String =
        env::var("COSMOS_NODE_GRPC").unwrap_or_else(|_| "http://localhost:9090".to_owned());
    static ref COSMOS_NODE_ABCI: String =
        env::var("COSMOS_NODE_ABCI").unwrap_or_else(|_| "http://localhost:26657".to_owned());
    static ref ETH_NODE: String =
        env::var("ETH_NODE").unwrap_or_else(|_| "http://localhost:8545".to_owned());
}

/// this value reflects the contents of /tests/container-scripts/setup-validator.sh
/// and is used to compute if a stake change is big enough to trigger a validator set
/// update since we want to make several such changes intentionally
pub const STAKE_SUPPLY_PER_VALIDATOR: u128 = 1000000000;
/// this is the amount each validator bonds at startup
pub const STARTING_STAKE_PER_VALIDATOR: u128 = STAKE_SUPPLY_PER_VALIDATOR / 2;

lazy_static! {
    // this key is the private key for the public key defined in tests/assets/ETHGenesis.json
    // where the full node / miner sends its rewards. Therefore it's always going
    // to have a lot of ETH to pay for things like contract deployments
    static ref MINER_PRIVATE_KEY: EthPrivateKey =
        "0xb1bab011e03a9862664706fc3bbaa1b16651528e5f0e7fbfcbfdd8be302a13e7"
            .parse()
            .unwrap();
    static ref MINER_ADDRESS: EthAddress = MINER_PRIVATE_KEY.to_public_key().unwrap();
}

/// Gets the standard non-token fee for the testnet. We deploy the test chain with STAKE
/// and FOOTOKEN balances by default, one footoken is sufficient for any Cosmos tx fee except
/// fees for send_to_eth messages which have to be of the same bridged denom so that the relayers
/// on the Ethereum side can be paid in that token.
pub fn get_fee() -> Coin {
    Coin {
        denom: get_test_token_name(),
        amount: 1u32.into(),
    }
}

pub fn get_test_token_name() -> String {
    "footoken".to_string()
}

pub fn get_chain_id() -> String {
    "gravity-test".to_string()
}

pub fn one_eth() -> Uint256 {
    1000000000000000000u128.into()
}

pub fn one_hundred_eth() -> Uint256 {
    (1000000000000000000u128 * 100).into()
}

pub fn should_deploy_contracts() -> bool {
    match env::var("DEPLOY_CONTRACTS") {
        Ok(s) => s == "1" || s.to_lowercase() == "yes" || s.to_lowercase() == "true",
        _ => false,
    }
}

#[actix_rt::main]
pub async fn main() {
    env_logger::init();
    info!("Starting Gravity test-runner");
    let contact = Contact::new(
        COSMOS_NODE_GRPC.as_str(),
        OPERATION_TIMEOUT,
        ADDRESS_PREFIX.as_str(),
    )
    .unwrap();

    info!("Waiting for Cosmos chain to come online");
    wait_for_cosmos_online(&contact, TOTAL_TIMEOUT).await;

    let grpc_client = GravityQueryClient::connect(COSMOS_NODE_GRPC.as_str())
        .await
        .unwrap();
    let web30 = web30::client::Web3::new(ETH_NODE.as_str(), OPERATION_TIMEOUT);
    let keys = get_keys();

    // if we detect this env var we are only deploying contracts, do that then exit.
    if should_deploy_contracts() {
        info!("test-runner in contract deploying mode, deploying contracts, then exiting");
        deploy_contracts(&contact).await;
        return;
    }

    let contracts = parse_contract_addresses();
    // the address of the deployed Gravity contract
    let gravity_address = contracts.gravity_contract;
    // addresses of deployed ERC20 token contracts to be used for testing
    let erc20_addresses = contracts.erc20_addresses;

    // before we start the orchestrators send them some funds so they can pay
    // for things
    send_eth_to_orchestrators(&keys, &web30).await;

    assert!(check_cosmos_balance(
        &get_test_token_name(),
        keys[0]
            .validator_key
            .to_address(&contact.get_prefix())
            .unwrap(),
        &contact
    )
    .await
    .is_some());

    // This segment contains optional tests, by default we run a happy path test
    // this tests all major functionality of Gravity once or twice.
    // VALSET_STRESS sends in 1k valsets to sign and update
    // BATCH_STRESS fills several batches and executes an out of order batch
    // VALIDATOR_OUT simulates a validator not participating in the happy path test
    // V2_HAPPY_PATH runs the happy path tests but focusing on moving Cosmos assets to Ethereum
    // ARBITRARY_LOGIC tests the arbitrary logic functionality, where an arbitrary contract call
    //                 is created and deployed vai the bridge.
    let test_type = env::var("TEST_TYPE");
    info!("Starting tests with {:?}", test_type);
    if let Ok(test_type) = test_type {
        if test_type == "VALIDATOR_OUT" {
            info!("Starting Validator out test");
            happy_path_test(
                &web30,
                grpc_client,
                &contact,
                keys,
                gravity_address,
                erc20_addresses[0],
                true,
            )
            .await;
            return;
        } else if test_type == "BATCH_STRESS" {
            let contact = Contact::new(
                COSMOS_NODE_GRPC.as_str(),
                TOTAL_TIMEOUT,
                ADDRESS_PREFIX.as_str(),
            )
            .unwrap();
            transaction_stress_test(&web30, &contact, keys, gravity_address, erc20_addresses).await;
            return;
        } else if test_type == "VALSET_STRESS" {
            info!("Starting Valset update stress test");
            validator_set_stress_test(&web30, &contact, keys, gravity_address).await;
            return;
        } else if test_type == "VALSET_REWARDS" {
            info!("Starting Valset rewards test");
            valset_rewards_test(&web30, grpc_client, &contact, keys, gravity_address, false).await;
            return;
        } else if test_type == "V2_HAPPY_PATH" {
            info!("Starting happy path for Gravity v2");
            happy_path_test_v2(&web30, grpc_client, &contact, keys, gravity_address, false).await;
            return;
        } else if test_type == "ARBITRARY_LOGIC" {
            info!("Starting arbitrary logic tests!");
            arbitrary_logic_test(&web30, grpc_client, &contact, keys, gravity_address).await;
            return;
        } else if test_type == "RELAY_MARKET" {
            info!("Starting relay market tests!");
            relay_market_test(&web30, grpc_client, &contact, keys, gravity_address).await;
            return;
        } else if test_type == "ORCHESTRATOR_KEYS" {
            info!("Starting orchestrator key update tests!");
            orch_keys(grpc_client, &contact, keys).await;
            return;
        } else if test_type == "LONDON" {
            info!("Starting London hardfork tests");
            happy_path_test(
                &web30,
                grpc_client,
                &contact,
                keys,
                gravity_address,
                erc20_addresses[0],
                true,
            )
            .await;
            return;
        }
    }
    info!("Starting Happy path test");
    happy_path_test(
        &web30,
        grpc_client,
        &contact,
        keys,
        gravity_address,
        erc20_addresses[0],
        false,
    )
    .await;
}
