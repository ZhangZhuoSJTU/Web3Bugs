use std::process::exit;

use crate::args::EthToCosmosOpts;
use crate::utils::fraction_to_exponent;
use crate::utils::TIMEOUT;
use ethereum_gravity::send_to_cosmos::send_to_cosmos;
use ethereum_gravity::utils::get_valset_nonce;
use gravity_utils::connection_prep::{check_for_eth, create_rpc_connections};

pub async fn eth_to_cosmos(args: EthToCosmosOpts, prefix: String) {
    let gravity_address = args.gravity_contract_address;
    let erc20_address = args.token_contract_address;
    let cosmos_dest = args.destination;
    let ethereum_key = args.ethereum_key;
    let ethereum_public_key = ethereum_key.to_public_key().unwrap();
    let ethereum_rpc = args.ethereum_rpc;
    let amount = args.amount;

    let connections = create_rpc_connections(prefix, None, Some(ethereum_rpc), TIMEOUT).await;

    let web3 = connections.web3.unwrap();

    get_valset_nonce(gravity_address, ethereum_public_key, &web3)
        .await
        .expect("Incorrect Gravity Address or otherwise unable to contact Gravity");

    check_for_eth(ethereum_public_key, &web3).await;

    let res = web3
        .get_erc20_decimals(erc20_address, ethereum_public_key)
        .await
        .expect("Failed to query ERC20 contract");
    let decimals: u8 = res.to_string().parse().unwrap();
    let amount = fraction_to_exponent(amount, decimals);

    let erc20_balance = web3
        .get_erc20_balance(erc20_address, ethereum_public_key)
        .await
        .expect("Failed to get balance, check ERC20 contract address");

    if erc20_balance == 0u8.into() {
        error!(
            "You have zero {} tokens, please double check your sender and erc20 addresses!",
            erc20_address
        );
        exit(1);
    } else if amount.clone() > erc20_balance {
        error!("Insufficient balance {} > {}", amount, erc20_balance);
        exit(1);
    }

    info!(
        "Sending {} / {} to Cosmos from {} to {}",
        amount, erc20_address, ethereum_public_key, cosmos_dest
    );
    // we send some erc20 tokens to the gravity contract to register a deposit
    let res = send_to_cosmos(
        erc20_address,
        gravity_address,
        amount.clone(),
        cosmos_dest,
        ethereum_key,
        Some(TIMEOUT),
        &web3,
        vec![],
    )
    .await;
    match res {
        Ok(tx_id) => info!("Send to Cosmos txid: {:#066x}", tx_id),
        Err(e) => info!("Failed to send tokens! {:?}", e),
    }
}
