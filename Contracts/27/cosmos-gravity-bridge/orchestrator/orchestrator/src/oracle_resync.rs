use clarity::{Address, Uint256};
use cosmos_gravity::utils::get_last_event_nonce_with_retry;
use deep_space::address::Address as CosmosAddress;
use gravity_proto::gravity::query_client::QueryClient as GravityQueryClient;
use gravity_utils::get_with_retry::get_block_number_with_retry;
use gravity_utils::get_with_retry::RETRY_TIME;
use gravity_utils::types::event_signatures::*;
use gravity_utils::types::{
    Erc20DeployedEvent, LogicCallExecutedEvent, SendToCosmosEvent, TransactionBatchExecutedEvent,
    ValsetUpdatedEvent,
};
use tokio::time::sleep as delay_for;
use tonic::transport::Channel;
use web30::client::Web3;

/// This function retrieves the last event nonce this oracle has relayed to Cosmos
/// it then uses the Ethereum indexes to determine what block the last entry
pub async fn get_last_checked_block(
    grpc_client: GravityQueryClient<Channel>,
    our_cosmos_address: CosmosAddress,
    prefix: String,
    gravity_contract_address: Address,
    web3: &Web3,
) -> Uint256 {
    let mut grpc_client = grpc_client;
    const BLOCKS_TO_SEARCH: u128 = 5_000u128;

    let latest_block = get_block_number_with_retry(web3).await;
    let mut last_event_nonce: Uint256 =
        get_last_event_nonce_with_retry(&mut grpc_client, our_cosmos_address, prefix)
            .await
            .into();

    // zero indicates this oracle has never submitted an event before since there is no
    // zero event nonce (it's pre-incremented in the solidity contract) we have to go
    // and look for event nonce one.
    if last_event_nonce == 0u8.into() {
        last_event_nonce = 1u8.into();
    }

    let mut current_block: Uint256 = latest_block.clone();

    while current_block.clone() > 0u8.into() {
        info!(
            "Oracle is resyncing, looking back into the history to find our last event nonce {}, on block {}",
            last_event_nonce, current_block
        );
        let end_search = if current_block.clone() < BLOCKS_TO_SEARCH.into() {
            0u8.into()
        } else {
            current_block.clone() - BLOCKS_TO_SEARCH.into()
        };
        let batch_events = web3
            .check_for_events(
                end_search.clone(),
                Some(current_block.clone()),
                vec![gravity_contract_address],
                vec![TRANSACTION_BATCH_EXECUTED_EVENT_SIG],
            )
            .await;
        let send_to_cosmos_events = web3
            .check_for_events(
                end_search.clone(),
                Some(current_block.clone()),
                vec![gravity_contract_address],
                vec![SENT_TO_COSMOS_EVENT_SIG],
            )
            .await;
        let erc20_deployed_events = web3
            .check_for_events(
                end_search.clone(),
                Some(current_block.clone()),
                vec![gravity_contract_address],
                vec![ERC20_DEPLOYED_EVENT_SIG],
            )
            .await;
        let logic_call_executed_events = web3
            .check_for_events(
                end_search.clone(),
                Some(current_block.clone()),
                vec![gravity_contract_address],
                vec![LOGIC_CALL_EVENT_SIG],
            )
            .await;

        // valset update events have one special property
        // that is useful to us in this handler a valset update event for nonce 0 is emitted
        // in the contract constructor meaning once you find that event you can exit the search
        // with confidence that you have not missed any events without searching the entire blockchain
        // history
        let valset_events = web3
            .check_for_events(
                end_search.clone(),
                Some(current_block.clone()),
                vec![gravity_contract_address],
                vec![VALSET_UPDATED_EVENT_SIG],
            )
            .await;
        if batch_events.is_err()
            || send_to_cosmos_events.is_err()
            || valset_events.is_err()
            || erc20_deployed_events.is_err()
            || logic_call_executed_events.is_err()
        {
            error!("Failed to get blockchain events while resyncing, is your Eth node working? If you see only one of these it's fine",);
            delay_for(RETRY_TIME).await;
            continue;
        }
        let batch_events = batch_events.unwrap();
        let send_to_cosmos_events = send_to_cosmos_events.unwrap();
        let mut valset_events = valset_events.unwrap();
        let erc20_deployed_events = erc20_deployed_events.unwrap();
        let logic_call_executed_events = logic_call_executed_events.unwrap();

        // look for and return the block number of the event last seen on the Cosmos chain
        // then we will play events from that block (including that block, just in case
        // there is more than one event there) onwards. We use valset nonce 0 as an indicator
        // of what block the contract was deployed on.
        for event in batch_events {
            match TransactionBatchExecutedEvent::from_log(&event) {
                Ok(batch) => {
                    trace!(
                        "{} batch event nonce {} last event nonce",
                        batch.event_nonce,
                        last_event_nonce
                    );
                    if upcast(batch.event_nonce) == last_event_nonce && event.block_number.is_some()
                    {
                        return event.block_number.unwrap();
                    }
                }
                Err(e) => error!("Got batch event that we can't parse {}", e),
            }
        }
        for event in send_to_cosmos_events {
            match SendToCosmosEvent::from_log(&event) {
                Ok(send) => {
                    trace!(
                        "{} send event nonce {} last event nonce",
                        send.event_nonce,
                        last_event_nonce
                    );
                    if upcast(send.event_nonce) == last_event_nonce && event.block_number.is_some()
                    {
                        return event.block_number.unwrap();
                    }
                }
                Err(e) => error!("Got SendToCosmos event that we can't parse {}", e),
            }
        }
        for event in erc20_deployed_events {
            match Erc20DeployedEvent::from_log(&event) {
                Ok(deploy) => {
                    trace!(
                        "{} deploy event nonce {} last event nonce",
                        deploy.event_nonce,
                        last_event_nonce
                    );
                    if upcast(deploy.event_nonce) == last_event_nonce
                        && event.block_number.is_some()
                    {
                        return event.block_number.unwrap();
                    }
                }
                Err(e) => error!("Got ERC20Deployed event that we can't parse {}", e),
            }
        }
        for event in logic_call_executed_events {
            match LogicCallExecutedEvent::from_log(&event) {
                Ok(call) => {
                    trace!(
                        "{} LogicCall event nonce {} last event nonce",
                        call.event_nonce,
                        last_event_nonce
                    );
                    if upcast(call.event_nonce) == last_event_nonce && event.block_number.is_some()
                    {
                        return event.block_number.unwrap();
                    }
                }
                Err(e) => error!("Got ERC20Deployed event that we can't parse {}", e),
            }
        }

        // this reverse solves a very specific bug, we use the properties of the first valsets for edgecase
        // handling here, but events come in chronological order, so if we don't reverse the iterator
        // we will encounter the first validator sets first and exit early and incorrectly.
        // note that reversing everything won't actually get you that much of a performance gain
        // because this only involves events within the searching block range.
        valset_events.reverse();
        for event in valset_events {
            match ValsetUpdatedEvent::from_log(&event) {
                Ok(valset) => {
                    // if we've found this event it is the first possible event from the contract
                    // no other events can come before it, therefore either there's been a parsing error
                    // or no events have been submitted on this chain yet.
                    let bootstrapping = valset.valset_nonce == 0 && last_event_nonce == 1u8.into();
                    // our last event was a valset update event, treat as normal case
                    let common_case = upcast(valset.event_nonce) == last_event_nonce
                        && event.block_number.is_some();
                    trace!(
                        "{} valset event nonce {} last event nonce",
                        valset.event_nonce,
                        last_event_nonce
                    );
                    if common_case || bootstrapping {
                        return event.block_number.unwrap();
                    }
                    // if we're looking for a later event nonce and we find the deployment of the contract
                    // we must have failed to parse the event we're looking for. The oracle can not start
                    else if valset.valset_nonce == 0 && last_event_nonce > 1u8.into() {
                        panic!("Could not find the last event relayed by {}, Last Event nonce is {} but no event matching that could be found!", our_cosmos_address, last_event_nonce)
                    }
                }
                Err(e) => error!("Got valset event that we can't parse {}", e),
            }
        }
        current_block = end_search;
    }

    // we should exit above when we find the zero valset, if we have the wrong contract address through we could be at it a while as we go over
    // the entire history to 'prove' it.
    panic!("You have reached the end of block history without finding the Gravity contract deploy event! You must have the wrong contract address!");
}

fn upcast(input: u64) -> Uint256 {
    input.into()
}
