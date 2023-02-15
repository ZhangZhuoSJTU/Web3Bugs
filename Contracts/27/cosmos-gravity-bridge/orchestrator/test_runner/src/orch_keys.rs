//! This test verifies that orchestrator keys are correctly set from the genesis file and set
//! on chain start. Currently it is not possible to rotate orchestrator keys live as the key rotation
//! logic has not been implemented. If at some point in the future that is implemented it would be
//! checked in this test

use crate::utils::ValidatorKeys;
use clarity::Address as EthAddress;
use deep_space::address::Address as CosmosAddress;
use deep_space::Contact;
use gravity_proto::gravity::{
    query_client::QueryClient as GravityQueryClient, QueryDelegateKeysByEthAddress,
    QueryDelegateKeysByOrchestratorAddress,
};
use tonic::transport::Channel;

pub async fn orch_keys(
    grpc_client: GravityQueryClient<Channel>,
    contact: &Contact,
    keys: Vec<ValidatorKeys>,
) {
    let mut grpc_client = grpc_client;
    // just to test that we have the right keys from the gentx
    info!("About to check already set delegate addresses");
    for k in keys.iter() {
        let eth_address = k.eth_key.to_public_key().unwrap();
        let orch_address = k.orch_key.to_address(&contact.get_prefix()).unwrap();
        let eth_response = grpc_client
            .get_delegate_key_by_eth(QueryDelegateKeysByEthAddress {
                eth_address: eth_address.to_string(),
            })
            .await
            .unwrap()
            .into_inner();

        let parsed_response_orch_address: CosmosAddress =
            eth_response.orchestrator_address.parse().unwrap();
        assert_eq!(parsed_response_orch_address, orch_address);

        let orchestrator_response = grpc_client
            .get_delegate_key_by_orchestrator(QueryDelegateKeysByOrchestratorAddress {
                orchestrator_address: orch_address.to_string(),
            })
            .await
            .unwrap()
            .into_inner();

        let parsed_response_eth_address: EthAddress =
            orchestrator_response.eth_address.parse().unwrap();
        assert_eq!(parsed_response_eth_address, eth_address);
    }
}
