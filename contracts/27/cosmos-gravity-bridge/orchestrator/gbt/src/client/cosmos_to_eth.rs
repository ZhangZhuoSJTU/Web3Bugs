use crate::utils::print_eth;
use crate::utils::TIMEOUT;
use crate::{args::CosmosToEthOpts, utils::print_atom};
use cosmos_gravity::send::{send_request_batch, send_to_eth};
use deep_space::Coin;
use gravity_proto::gravity::QueryDenomToErc20Request;
use gravity_utils::connection_prep::{check_for_fee, create_rpc_connections};
use std::process::exit;

pub async fn cosmos_to_eth(args: CosmosToEthOpts, address_prefix: String) {
    let cosmos_key = args.cosmos_phrase;
    let gravity_coin = args.amount;
    let fee = args.fees;
    let cosmos_grpc = args.cosmos_grpc;
    let eth_dest = args.eth_destination;
    let no_batch = args.no_batch;

    let cosmos_address = cosmos_key.to_address(&address_prefix).unwrap();

    let is_cosmos_originated = gravity_coin.denom.starts_with("gravity");

    info!("Sending from Cosmos address {}", cosmos_address);
    let connections =
        create_rpc_connections(address_prefix, Some(cosmos_grpc), None, TIMEOUT).await;
    let contact = connections.contact.unwrap();
    let mut grpc = connections.grpc.unwrap();

    let res = grpc
        .denom_to_erc20(QueryDenomToErc20Request {
            denom: gravity_coin.denom.clone(),
        })
        .await;
    match res {
        Ok(val) => info!(
            "Asset {} has ERC20 representation {}",
            gravity_coin.denom,
            val.into_inner().erc20
        ),
        Err(_e) => {
            info!(
                "Asset {} has no ERC20 representation, you may need to deploy an ERC20 for it!",
                gravity_coin.denom
            );
            exit(1);
        }
    }

    let amount = gravity_coin.clone();
    let bridge_fee = Coin {
        denom: gravity_coin.denom.clone(),
        amount: 1u64.into(),
    };
    check_for_fee(&gravity_coin, cosmos_address, &contact).await;
    check_for_fee(&fee, cosmos_address, &contact).await;

    let balances = contact
        .get_balances(cosmos_address)
        .await
        .expect("Failed to get balances!");
    let mut found = None;
    for coin in balances.iter() {
        if coin.denom == gravity_coin.denom {
            found = Some(coin);
        }
    }

    info!("Cosmos balances {:?}", balances);

    if found.is_none() {
        error!("You don't have any {} tokens!", gravity_coin.denom);
        exit(1);
    } else if amount.amount.clone() >= found.unwrap().amount {
        if is_cosmos_originated {
            error!("Your transfer of {} {} tokens is greater than your balance of {} tokens. Remember you need some to pay for fees!", print_atom(amount.amount), gravity_coin.denom, print_atom(found.unwrap().amount.clone()));
        } else {
            error!("Your transfer of {} {} tokens is greater than your balance of {} tokens. Remember you need some to pay for fees!", print_eth(amount.amount), gravity_coin.denom, print_eth(found.unwrap().amount.clone()));
        }
        exit(1);
    }

    info!(
        "Locking {} / {} into the batch pool",
        amount.denom, gravity_coin.denom
    );
    let res = send_to_eth(
        cosmos_key,
        eth_dest,
        amount.clone(),
        bridge_fee.clone(),
        fee,
        &contact,
    )
    .await;
    match res {
        Ok(tx_id) => info!("Send to Eth txid {}", tx_id.txhash),
        Err(e) => info!("Failed to send tokens! {:?}", e),
    }

    if !no_batch {
        info!("Requesting a batch to push transaction along immediately");
        send_request_batch(cosmos_key, gravity_coin.denom, bridge_fee, &contact)
            .await
            .expect("Failed to request batch");
    } else {
        info!("--no-batch specified, your transfer will wait until someone requests a batch for this token type")
    }
}
