use crate::message_signatures::encode_logic_call_confirm_hashed;
use crate::utils::{encode_valset_struct, get_logic_call_nonce, GasCost};
use clarity::{abi::Token, utils::bytes_to_hex_str, PrivateKey as EthPrivateKey};
use clarity::{Address as EthAddress, Uint256};
use gravity_utils::error::GravityError;
use gravity_utils::types::*;
use std::{cmp::min, time::Duration};
use web30::{client::Web3, types::TransactionRequest};

/// this function generates an appropriate Ethereum transaction
/// to submit the provided logic call
#[allow(clippy::too_many_arguments)]
pub async fn send_eth_logic_call(
    current_valset: Valset,
    call: LogicCall,
    confirms: &[LogicCallConfirmResponse],
    web3: &Web3,
    timeout: Duration,
    gravity_contract_address: EthAddress,
    gravity_id: String,
    our_eth_key: EthPrivateKey,
) -> Result<(), GravityError> {
    let new_call_nonce = call.invalidation_nonce;
    let eth_address = our_eth_key.to_public_key().unwrap();
    info!(
        "Ordering signatures and submitting LogicCall {}:{} to Ethereum",
        bytes_to_hex_str(&call.invalidation_id),
        new_call_nonce
    );
    trace!("Call {:?}", call);

    let before_nonce = get_logic_call_nonce(
        gravity_contract_address,
        call.invalidation_id.clone(),
        eth_address,
        web3,
    )
    .await?;
    let current_block_height = web3.eth_block_number().await?;
    if before_nonce >= new_call_nonce {
        info!(
            "Someone else updated the LogicCall to {}, exiting early",
            before_nonce
        );
        return Ok(());
    } else if current_block_height > call.timeout.into() {
        info!(
            "This LogicCall is timed out. timeout block: {} current block: {}, exiting early",
            current_block_height, call.timeout
        );
        return Ok(());
    }

    let payload = encode_logic_call_payload(current_valset, &call, confirms, gravity_id)?;

    let tx = web3
        .send_transaction(
            gravity_contract_address,
            payload,
            0u32.into(),
            eth_address,
            our_eth_key,
            vec![],
        )
        .await?;
    info!("Sent batch update with txid {:#066x}", tx);

    web3.wait_for_transaction(tx.clone(), timeout, None).await?;

    let last_nonce = get_logic_call_nonce(
        gravity_contract_address,
        call.invalidation_id,
        eth_address,
        web3,
    )
    .await?;
    if last_nonce != new_call_nonce {
        error!(
            "Current nonce is {} expected to update to nonce {}",
            last_nonce, new_call_nonce
        );
    } else {
        info!(
            "Successfully updated LogicCall with new Nonce {:?}",
            last_nonce
        );
    }
    Ok(())
}

/// Returns the cost in Eth of sending this batch
pub async fn estimate_logic_call_cost(
    current_valset: Valset,
    call: LogicCall,
    confirms: &[LogicCallConfirmResponse],
    web3: &Web3,
    gravity_contract_address: EthAddress,
    gravity_id: String,
    our_eth_key: EthPrivateKey,
) -> Result<GasCost, GravityError> {
    let our_eth_address = our_eth_key.to_public_key().unwrap();
    let our_balance = web3.eth_get_balance(our_eth_address).await?;
    let our_nonce = web3.eth_get_transaction_count(our_eth_address).await?;
    let gas_limit = min((u64::MAX - 1).into(), our_balance.clone());
    let gas_price = web3.eth_gas_price().await?;
    let zero: Uint256 = 0u8.into();
    let val = web3
        .eth_estimate_gas(TransactionRequest {
            from: Some(our_eth_address),
            to: gravity_contract_address,
            nonce: Some(our_nonce.clone().into()),
            gas_price: Some(gas_price.clone().into()),
            gas: Some(gas_limit.into()),
            value: Some(zero.into()),
            data: Some(
                encode_logic_call_payload(current_valset, &call, confirms, gravity_id)?.into(),
            ),
        })
        .await?;

    Ok(GasCost {
        gas: val,
        gas_price,
    })
}

/// Encodes the logic call payload for both cost estimation and submission to EThereum
fn encode_logic_call_payload(
    current_valset: Valset,
    call: &LogicCall,
    confirms: &[LogicCallConfirmResponse],
    gravity_id: String,
) -> Result<Vec<u8>, GravityError> {
    let current_valset_token = encode_valset_struct(&current_valset);
    let hash = encode_logic_call_confirm_hashed(gravity_id, call.clone());
    let sig_data = current_valset.order_sigs(&hash, confirms)?;
    let sig_arrays = to_arrays(sig_data);

    let mut transfer_amounts = Vec::new();
    let mut transfer_token_contracts = Vec::new();
    let mut fee_amounts = Vec::new();
    let mut fee_token_contracts = Vec::new();
    for item in call.transfers.iter() {
        transfer_amounts.push(Token::Uint(item.amount.clone()));
        transfer_token_contracts.push(item.token_contract_address);
    }
    for item in call.fees.iter() {
        fee_amounts.push(Token::Uint(item.amount.clone()));
        fee_token_contracts.push(item.token_contract_address);
    }

    // Solidity function signature
    // function submitBatch(
    // // The validators that approve the batch and new valset encoded as a ValsetArgs struct
    // address[] memory _currentValidators,
    // uint256[] memory _currentPowers,
    // uint256 _currentValsetNonce,
    // uint256 _rewardAmount,
    // address _rewardToken,
    //
    // // These are arrays of the parts of the validators signatures
    // uint8[] memory _v,
    // bytes32[] memory _r,
    // bytes32[] memory _s,
    //
    // // The LogicCall arguments, encoded as a LogicCallArgs struct
    // see the Ethereum ABI encoding documentation for the handling of structs as arguments
    // as well as Gravity.sol for the struct definition. This call includes the primitive types
    // of both.
    // uint256[] transferAmounts;
    // address[] transferTokenContracts;
    // // The fees (transferred to msg.sender)
    // uint256[] feeAmounts;
    // address[] feeTokenContracts;
    // // The arbitrary logic call
    // address logicContractAddress;
    // bytes payload;
    // // Invalidation metadata
    // uint256 timeOut;
    // bytes32 invalidationId;
    // uint256 invalidationNonce;
    let struct_tokens = &[
        Token::Dynamic(transfer_amounts),
        transfer_token_contracts.into(),
        Token::Dynamic(fee_amounts),
        fee_token_contracts.into(),
        call.logic_contract_address.into(),
        Token::UnboundedBytes(call.payload.clone()),
        call.timeout.into(),
        Token::Bytes(call.invalidation_id.clone()),
        call.invalidation_nonce.into(),
    ];
    let tokens = &[
        current_valset_token,
        sig_arrays.v,
        sig_arrays.r,
        sig_arrays.s,
        Token::Struct(struct_tokens.to_vec()),
    ];
    let payload = clarity::abi::encode_call(
        "submitLogicCall((address[],uint256[],uint256,uint256,address),uint8[],bytes32[],bytes32[],(uint256[],address[],uint256[],address[],address,bytes,uint256,bytes32,uint256))",
        tokens,
    )
    .unwrap();
    trace!("Tokens {:?}", tokens);

    Ok(payload)
}

#[cfg(test)]
mod tests {
    use super::*;
    use clarity::utils::hex_str_to_bytes;
    use clarity::Signature;

    #[test]
    /// This test encodes an abiV2 function call, specifically one
    /// with a nontrivial struct in the header
    fn encode_abiv2_function_header() {
        // a golden master example encoding taken from Hardhat with all of it's parameters recreated
        let encoded = "0x4c164fef00000000000000000000000000000000000000000000000000000000000000a000000000000\
                            000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000\
                            0000000020000000000000000000000000000000000000000000000000000000000000002400000000000000000000000000000000\
                            00000000000000000000000000000028000000000000000000000000000000000000000000000000000000000000000a0000000000\
                            00000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000\
                            0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000\
                            0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000\
                            00000000000000000c783df8a850f42e7f7e57013759c285caa701eb60000000000000000000000000000000000000000000000000\
                            00000000000000100000000000000000000000000000000000000000000000000000000ffffffff000000000000000000000000000\
                            0000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000001c00000\
                            00000000000000000000000000000000000000000000000000000000001b916bf9a6a908cbf3adee07b90c257ad68cd7006616e56d\
                            b9de1b8138b83c6b600000000000000000000000000000000000000000000000000000000000000013d124e8782f054c80d07de84b\
                            5423a5f9a1d1cb005337a634066854b56b11da50000000000000000000000000000000000000000000000000000000000000120000\
                            0000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000\
                            00000000000000001a000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000\
                            017c1736ccf692f653c433d7aa2ab45148c016f6800000000000000000000000000000000000000000000000000000000000002200\
                            0000000000000000000000000000000000000000000000000000455e2bfa248696e76616c69646174696f6e4964000000000000000\
                            0000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000\
                            0000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000\
                            10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000c85759553aee2d412\
                            5afa8a9421aaf5397b96e6b00000000000000000000000000000000000000000000000000000000000000010000000000000000000\
                            0000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000\
                            001000000000000000000000000c85759553aee2d4125afa8a9421aaf5397b96e6b000000000000000000000000000000000000000\
                            000000000000000000000002074657374696e675061796c6f6164000000000000000000000000000000000000";
        let encoded = hex_str_to_bytes(encoded).unwrap();

        let token_contract_address = "0xc85759553AEE2D4125aFa8a9421AAf5397b96E6b"
            .parse()
            .unwrap();
        let logic_contract_address = "0x17c1736CcF692F653c433d7aa2aB45148C016F68"
            .parse()
            .unwrap();
        let invalidation_id =
            hex_str_to_bytes("0x696e76616c69646174696f6e4964000000000000000000000000000000000000")
                .unwrap();
        let invalidation_nonce = 1u8.into();
        let ethereum_signer = "0xc783df8a850f42e7F7e57013759C285caa701eB6"
            .parse()
            .unwrap();
        let token = vec![Erc20Token {
            amount: 1u8.into(),
            token_contract_address,
        }];

        let logic_call = LogicCall {
            transfers: token.clone(),
            fees: token,
            logic_contract_address,
            payload: hex_str_to_bytes(
                "0x74657374696e675061796c6f6164000000000000000000000000000000000000",
            )
            .unwrap(),
            timeout: 4766922941000,
            invalidation_id: invalidation_id.clone(),
            invalidation_nonce,
        };

        // a validator set
        let valset = Valset {
            reward_token: None,
            reward_amount: 0u8.into(),
            nonce: 0,
            members: vec![ValsetMember {
                eth_address: Some(ethereum_signer),
                power: 4294967295,
            }],
        };
        let confirm = LogicCallConfirmResponse {
            invalidation_id,
            invalidation_nonce,
            ethereum_signer,
            eth_signature: Signature {
                v: 28u8.into(),
                r: Uint256::from_bytes_be(
                    &hex_str_to_bytes(
                        "0xb916bf9a6a908cbf3adee07b90c257ad68cd7006616e56db9de1b8138b83c6b6",
                    )
                    .unwrap(),
                ),
                s: Uint256::from_bytes_be(
                    &hex_str_to_bytes(
                        "0x3d124e8782f054c80d07de84b5423a5f9a1d1cb005337a634066854b56b11da5",
                    )
                    .unwrap(),
                ),
            },
            // this value is totally random as it's not included in any way in the eth encoding.
            orchestrator: "cosmos1vlms2r8f6x7yxjh3ynyzc7ckarqd8a96ckjvrp"
                .parse()
                .unwrap(),
        };

        assert_eq!(
            bytes_to_hex_str(&encoded),
            bytes_to_hex_str(
                &encode_logic_call_payload(valset, &logic_call, &[confirm], "foo".to_string())
                    .unwrap()
            )
        );
    }

    /// prints a byte vec line by line as unint256 words
    fn _print_bytes_as_uint256_words(input: &[u8]) {
        for i in 0..(input.len() / 32) {
            let start = i * 32;
            let mut end = start + 32;
            if end > input.len() {
                end = input.len()
            }
            println!("{}", bytes_to_hex_str(&input[start..end]))
        }
    }
}
