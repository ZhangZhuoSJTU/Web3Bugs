//! The Gravity deployERC20 endpoint deploys an ERC20 contract representing a Cosmos asset onto the Ethereum blockchain
//! the event for this deployment is then ferried over to Cosmos where the validators will accept the ERC20 contract address
//! as the representation of this asset on Ethereum

use clarity::{
    abi::{encode_call, Token},
    Uint256,
};
use clarity::{Address, PrivateKey};
use gravity_utils::error::GravityError;
use std::time::Duration;
use web30::{client::Web3, types::SendTxOption};

/// Calls the Gravity ethereum contract to deploy the ERC20 representation of the given Cosmos asset
/// denom. If an existing contract is already deployed representing this asset this call will cost
/// Gas but not actually do anything. Returns the new contract address or an error
#[allow(clippy::too_many_arguments)]
pub async fn deploy_erc20(
    cosmos_denom: String,
    erc20_name: String,
    erc20_symbol: String,
    decimals: u8,
    gravity_contract: Address,
    web3: &Web3,
    wait_timeout: Option<Duration>,
    sender_secret: PrivateKey,
    options: Vec<SendTxOption>,
) -> Result<Uint256, GravityError> {
    let sender_address = sender_secret.to_public_key().unwrap();
    let tx_hash = web3
        .send_transaction(
            gravity_contract,
            encode_call(
                "deployERC20(string,string,string,uint8)",
                &[
                    Token::String(cosmos_denom),
                    Token::String(erc20_name),
                    Token::String(erc20_symbol),
                    decimals.into(),
                ],
            )?,
            0u32.into(),
            sender_address,
            sender_secret,
            options,
        )
        .await?;

    if let Some(timeout) = wait_timeout {
        web3.wait_for_transaction(tx_hash.clone(), timeout, None)
            .await?;
    }

    Ok(tx_hash)
}
