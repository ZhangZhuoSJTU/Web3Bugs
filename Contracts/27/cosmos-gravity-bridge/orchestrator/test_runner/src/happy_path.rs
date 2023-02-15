use crate::get_fee;
use crate::utils::*;
use crate::ADDRESS_PREFIX;
use crate::MINER_ADDRESS;
use crate::MINER_PRIVATE_KEY;
use crate::STAKING_TOKEN;
use crate::STARTING_STAKE_PER_VALIDATOR;
use crate::TOTAL_TIMEOUT;
use clarity::PrivateKey as EthPrivateKey;
use clarity::{Address as EthAddress, Uint256};
use cosmos_gravity::send::{send_request_batch, send_to_eth};
use cosmos_gravity::{query::get_oldest_unsigned_transaction_batch, send::send_ethereum_claims};
use deep_space::address::Address as CosmosAddress;
use deep_space::coin::Coin;
use deep_space::private_key::PrivateKey as CosmosPrivateKey;
use deep_space::Contact;
use ethereum_gravity::utils::get_valset_nonce;
use ethereum_gravity::{send_to_cosmos::send_to_cosmos, utils::get_tx_batch_nonce};
use gravity_proto::gravity::query_client::QueryClient as GravityQueryClient;
use gravity_utils::types::SendToCosmosEvent;
use rand::Rng;
use std::time::Duration;
use std::time::Instant;
use tokio::time::sleep as delay_for;
use tonic::transport::Channel;
use web30::client::Web3;

pub async fn happy_path_test(
    web30: &Web3,
    grpc_client: GravityQueryClient<Channel>,
    contact: &Contact,
    keys: Vec<ValidatorKeys>,
    gravity_address: EthAddress,
    erc20_address: EthAddress,
    validator_out: bool,
) {
    let mut grpc_client = grpc_client;

    let no_relay_market_config = create_default_test_config();
    start_orchestrators(
        keys.clone(),
        gravity_address,
        validator_out,
        no_relay_market_config,
    )
    .await;

    // bootstrapping tests finish here and we move into operational tests

    // send 3 valset updates to make sure the process works back to back
    // don't do this in the validator out test because it changes powers
    // randomly and may actually make it impossible for that test to pass
    // by random re-allocation of powers. If we had 5 or 10 validators
    // instead of 3 this wouldn't be a problem. But with 3 not even 1% of
    // power can be reallocated to the down validator before things stop
    // working. We'll settle for testing that the initial valset (generated
    // with the first block) is successfully updated
    if !validator_out {
        for _ in 0u32..2 {
            test_valset_update(web30, contact, &keys, gravity_address).await;
        }
    } else {
        wait_for_nonzero_valset(web30, gravity_address).await;
    }

    // generate an address for coin sending tests, this ensures test imdepotency
    let mut rng = rand::thread_rng();
    let secret: [u8; 32] = rng.gen();
    let dest_cosmos_private_key = CosmosPrivateKey::from_secret(&secret);
    let dest_cosmos_address = dest_cosmos_private_key
        .to_address(ADDRESS_PREFIX.as_str())
        .unwrap();
    let dest_eth_private_key = EthPrivateKey::from_slice(&secret).unwrap();
    let dest_eth_address = dest_eth_private_key.to_public_key().unwrap();

    // the denom and amount of the token bridged from Ethereum -> Cosmos
    // so the denom is the gravity<hash> token name
    // Send a token 3 times
    for _ in 0u32..3 {
        test_erc20_deposit(
            web30,
            contact,
            dest_cosmos_address,
            gravity_address,
            erc20_address,
            100u64.into(),
        )
        .await;
    }

    // We are going to submit a duplicate tx with nonce 1
    // This had better not increase the balance again
    // this test may have false positives if the timeout is not
    // long enough. TODO check for an error on the cosmos send response
    submit_duplicate_erc20_send(
        1u64,
        contact,
        erc20_address,
        1u64.into(),
        dest_cosmos_address,
        &keys,
    )
    .await;

    // we test a batch by sending a transaction
    test_batch(
        contact,
        &mut grpc_client,
        web30,
        dest_eth_address,
        gravity_address,
        keys[0].validator_key,
        dest_cosmos_private_key,
        erc20_address,
    )
    .await;
}

pub async fn wait_for_nonzero_valset(web30: &Web3, gravity_address: EthAddress) {
    let start = Instant::now();
    let mut current_eth_valset_nonce = get_valset_nonce(gravity_address, *MINER_ADDRESS, web30)
        .await
        .expect("Failed to get current eth valset");

    while 0 == current_eth_valset_nonce {
        info!("Validator set is not yet updated to 0>, waiting",);
        current_eth_valset_nonce = get_valset_nonce(gravity_address, *MINER_ADDRESS, web30)
            .await
            .expect("Failed to get current eth valset");
        delay_for(Duration::from_secs(4)).await;
        if Instant::now() - start > TOTAL_TIMEOUT {
            panic!("Failed to update validator set");
        }
    }
}

pub async fn test_valset_update(
    web30: &Web3,
    contact: &Contact,
    keys: &[ValidatorKeys],
    gravity_address: EthAddress,
) {
    get_valset_nonce(
        gravity_address,
        keys[0].eth_key.to_public_key().unwrap(),
        web30,
    )
    .await
    .expect("Incorrect Gravity Address or otherwise unable to contact Gravity");

    // if we don't do this the orchestrators may run ahead of us and we'll be stuck here after
    // getting credit for two loops when we did one
    let starting_eth_valset_nonce = get_valset_nonce(gravity_address, *MINER_ADDRESS, web30)
        .await
        .expect("Failed to get starting eth valset");
    let start = Instant::now();

    // now we send a valset request that the orchestrators will pick up on
    // in this case we send it as the first validator because they can pay the fee
    info!("Sending in valset request");

    // this is hacky and not really a good way to test validator set updates in a highly
    // repeatable fashion. What we really need to do is be aware of the total staking state
    // and manipulate the validator set very intentionally rather than kinda blindly like
    // we are here. For example the more your run this function the less this fixed amount
    // makes any difference, eventually it will fail because the change to the total staked
    // percentage is too small.
    let mut rng = rand::thread_rng();
    let validator_to_change = rng.gen_range(0..keys.len());
    let delegate_address = &keys[validator_to_change]
        .validator_key
        // this is not guaranteed to be correct, the chain may set the valoper prefix in a
        // different way, but I haven't yet seen one that does not match this pattern
        .to_address(&format!("{}valoper", *ADDRESS_PREFIX))
        .unwrap();
    let amount = Coin {
        denom: STAKING_TOKEN.to_string(),
        amount: (STARTING_STAKE_PER_VALIDATOR / 4).into(),
    };
    info!(
        "Delegating {} to {} in order to generate a validator set update",
        amount, delegate_address
    );
    contact
        .delegate_to_validator(
            *delegate_address,
            amount,
            get_fee(),
            keys[1].validator_key,
            Some(TOTAL_TIMEOUT),
        )
        .await
        .unwrap();

    let mut current_eth_valset_nonce = get_valset_nonce(gravity_address, *MINER_ADDRESS, web30)
        .await
        .expect("Failed to get current eth valset");

    while starting_eth_valset_nonce == current_eth_valset_nonce {
        info!(
            "Validator set is not yet updated to {}>, waiting",
            starting_eth_valset_nonce
        );
        current_eth_valset_nonce = get_valset_nonce(gravity_address, *MINER_ADDRESS, web30)
            .await
            .expect("Failed to get current eth valset");
        delay_for(Duration::from_secs(4)).await;
        if Instant::now() - start > TOTAL_TIMEOUT {
            panic!("Failed to update validator set");
        }
    }
    assert!(starting_eth_valset_nonce != current_eth_valset_nonce);
    info!("Validator set successfully updated!");
}

/// this function tests Ethereum -> Cosmos
pub async fn test_erc20_deposit(
    web30: &Web3,
    contact: &Contact,
    dest: CosmosAddress,
    gravity_address: EthAddress,
    erc20_address: EthAddress,
    amount: Uint256,
) {
    get_valset_nonce(gravity_address, *MINER_ADDRESS, web30)
        .await
        .expect("Incorrect Gravity Address or otherwise unable to contact Gravity");

    let start_coin = check_cosmos_balance("gravity", dest, contact).await;
    info!(
        "Sending to Cosmos from {} to {} with amount {}",
        *MINER_ADDRESS, dest, amount
    );
    // we send some erc20 tokens to the gravity contract to register a deposit
    let tx_id = send_to_cosmos(
        erc20_address,
        gravity_address,
        amount.clone(),
        dest,
        *MINER_PRIVATE_KEY,
        Some(TOTAL_TIMEOUT),
        web30,
        vec![],
    )
    .await
    .expect("Failed to send tokens to Cosmos");
    info!("Send to Cosmos txid: {:#066x}", tx_id);

    let start = Instant::now();
    while Instant::now() - start < TOTAL_TIMEOUT {
        match (
            start_coin.clone(),
            check_cosmos_balance("gravity", dest, contact).await,
        ) {
            (Some(start_coin), Some(end_coin)) => {
                if start_coin.amount + amount.clone() == end_coin.amount
                    && start_coin.denom == end_coin.denom
                {
                    info!(
                        "Successfully bridged ERC20 {}{} to Cosmos! Balance is now {}{}",
                        amount, start_coin.denom, end_coin.amount, end_coin.denom
                    );
                    return;
                }
            }
            (None, Some(end_coin)) => {
                if amount == end_coin.amount {
                    info!(
                        "Successfully bridged ERC20 {}{} to Cosmos! Balance is now {}{}",
                        amount, end_coin.denom, end_coin.amount, end_coin.denom
                    );
                    return;
                } else {
                    panic!("Failed to bridge ERC20!")
                }
            }
            _ => {}
        }
        info!("Waiting for ERC20 deposit");
        contact.wait_for_next_block(TOTAL_TIMEOUT).await.unwrap();
    }
    panic!("Failed to bridge ERC20!")
}

#[allow(clippy::too_many_arguments)]
async fn test_batch(
    contact: &Contact,
    grpc_client: &mut GravityQueryClient<Channel>,
    web30: &Web3,
    dest_eth_address: EthAddress,
    gravity_address: EthAddress,
    requester_cosmos_private_key: CosmosPrivateKey,
    dest_cosmos_private_key: CosmosPrivateKey,
    erc20_contract: EthAddress,
) {
    get_valset_nonce(gravity_address, *MINER_ADDRESS, web30)
        .await
        .expect("Incorrect Gravity Address or otherwise unable to contact Gravity");

    let dest_cosmos_address = dest_cosmos_private_key
        .to_address(&contact.get_prefix())
        .unwrap();
    let coin = check_cosmos_balance("gravity", dest_cosmos_address, contact)
        .await
        .unwrap();
    let token_name = coin.denom;
    let amount = coin.amount;

    let bridge_denom_fee = Coin {
        denom: token_name.clone(),
        amount: 1u64.into(),
    };
    let amount = amount - 5u64.into();
    info!(
        "Sending {}{} from {} on Cosmos back to Ethereum",
        amount, token_name, dest_cosmos_address
    );
    let res = send_to_eth(
        dest_cosmos_private_key,
        dest_eth_address,
        Coin {
            denom: token_name.clone(),
            amount: amount.clone(),
        },
        bridge_denom_fee.clone(),
        bridge_denom_fee.clone(),
        contact,
    )
    .await
    .unwrap();
    info!("Sent tokens to Ethereum with {:?}", res);

    info!("Requesting transaction batch");
    send_request_batch(
        requester_cosmos_private_key,
        token_name.clone(),
        get_fee(),
        contact,
    )
    .await
    .unwrap();

    contact.wait_for_next_block(TOTAL_TIMEOUT).await.unwrap();
    let requester_address = requester_cosmos_private_key
        .to_address(&contact.get_prefix())
        .unwrap();
    get_oldest_unsigned_transaction_batch(grpc_client, requester_address, contact.get_prefix())
        .await
        .expect("Failed to get batch to sign");

    let mut current_eth_batch_nonce =
        get_tx_batch_nonce(gravity_address, erc20_contract, *MINER_ADDRESS, web30)
            .await
            .expect("Failed to get current eth valset");
    let starting_batch_nonce = current_eth_batch_nonce;

    let start = Instant::now();
    while starting_batch_nonce == current_eth_batch_nonce {
        info!(
            "Batch is not yet submitted {}>, waiting",
            starting_batch_nonce
        );
        current_eth_batch_nonce =
            get_tx_batch_nonce(gravity_address, erc20_contract, *MINER_ADDRESS, web30)
                .await
                .expect("Failed to get current eth tx batch nonce");
        delay_for(Duration::from_secs(4)).await;
        if Instant::now() - start > TOTAL_TIMEOUT {
            panic!("Failed to submit transaction batch set");
        }
    }

    let txid = web30
        .send_transaction(
            dest_eth_address,
            Vec::new(),
            1_000_000_000_000_000_000u128.into(),
            *MINER_ADDRESS,
            *MINER_PRIVATE_KEY,
            vec![],
        )
        .await
        .expect("Failed to send Eth to validator {}");
    web30
        .wait_for_transaction(txid, TOTAL_TIMEOUT, None)
        .await
        .unwrap();

    // we have to send this address one eth so that it can perform contract calls
    send_one_eth(dest_eth_address, web30).await;
    assert_eq!(
        web30
            .get_erc20_balance(erc20_contract, dest_eth_address)
            .await
            .unwrap(),
        amount
    );
    info!(
        "Successfully updated txbatch nonce to {} and sent {}{} tokens to Ethereum!",
        current_eth_batch_nonce, amount, token_name
    );
}

// this function submits a EthereumBridgeDepositClaim to the module with a given nonce. This can be set to be a nonce that has
// already been submitted to test the nonce functionality.
#[allow(clippy::too_many_arguments)]
async fn submit_duplicate_erc20_send(
    nonce: u64,
    contact: &Contact,
    erc20_address: EthAddress,
    amount: Uint256,
    receiver: CosmosAddress,
    keys: &[ValidatorKeys],
) {
    let start_coin = check_cosmos_balance("gravity", receiver, contact)
        .await
        .expect("Did not find coins!");

    let ethereum_sender = "0x912fd21d7a69678227fe6d08c64222db41477ba0"
        .parse()
        .unwrap();

    let event = SendToCosmosEvent {
        event_nonce: nonce,
        block_height: 500u16.into(),
        erc20: erc20_address,
        sender: ethereum_sender,
        destination: receiver,
        amount,
    };

    // iterate through all validators and try to send an event with duplicate nonce
    for k in keys.iter() {
        let c_key = k.validator_key;
        let res = send_ethereum_claims(
            contact,
            c_key,
            vec![event.clone()],
            vec![],
            vec![],
            vec![],
            vec![],
            get_fee(),
        )
        .await
        .unwrap();
        trace!("Submitted duplicate sendToCosmos event: {:?}", res);
    }

    if let Some(end_coin) = check_cosmos_balance("gravity", receiver, contact).await {
        if start_coin.amount == end_coin.amount && start_coin.denom == end_coin.denom {
            info!("Successfully failed to duplicate ERC20!");
        } else {
            panic!("Duplicated ERC20!")
        }
    } else {
        panic!("Duplicate test failed for unknown reasons!");
    }
}
