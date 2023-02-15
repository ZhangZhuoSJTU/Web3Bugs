//! Basic utility functions to stubbornly get data
use clarity::Address as EthAddress;
use clarity::Uint256;
use deep_space::{address::Address as CosmosAddress, Coin, Contact};
use std::time::Duration;
use tokio::time::sleep as delay_for;
use web30::client::Web3;

pub const RETRY_TIME: Duration = Duration::from_secs(5);

/// gets the current Ethereum block number, no matter how long it takes
pub async fn get_block_number_with_retry(web3: &Web3) -> Uint256 {
    let mut res = web3.eth_block_number().await;
    while res.is_err() {
        error!("Failed to get latest block! Is your Eth node working?");
        delay_for(RETRY_TIME).await;
        res = web3.eth_block_number().await;
    }
    res.unwrap()
}

/// gets the current Ethereum block number, no matter how long it takes
pub async fn get_eth_balances_with_retry(address: EthAddress, web3: &Web3) -> Uint256 {
    let mut res = web3.eth_get_balance(address).await;
    while res.is_err() {
        error!("Failed to get Eth balances! Is your Eth node working?");
        delay_for(RETRY_TIME).await;
        res = web3.eth_block_number().await;
    }
    res.unwrap()
}

/// gets Cosmos balances, no matter how long it takes
pub async fn get_balances_with_retry(address: CosmosAddress, contact: &Contact) -> Vec<Coin> {
    let mut res = contact.get_balances(address).await;
    while res.is_err() {
        error!("Failed to get Cosmos balances! Is your Cosmos node working?");
        delay_for(RETRY_TIME).await;
        res = contact.get_balances(address).await;
    }
    res.unwrap()
}

/// gets the net version, no matter how long it takes
pub async fn get_net_version_with_retry(web3: &Web3) -> u64 {
    let mut res = web3.net_version().await;
    while res.is_err() {
        error!("Failed to get net version! Is your Eth node working?");
        delay_for(RETRY_TIME).await;
        res = web3.net_version().await;
    }
    res.unwrap()
}
