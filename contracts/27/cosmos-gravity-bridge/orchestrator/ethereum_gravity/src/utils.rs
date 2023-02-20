use clarity::Address as EthAddress;
use clarity::Uint256;
use clarity::{abi::Token, constants::ZERO_ADDRESS};
use gravity_utils::types::*;
use std::u128::MAX as U128MAX;
use std::u64::MAX as U64MAX;
use web30::{client::Web3, jsonrpc::error::Web3Error};

pub fn downcast_uint256(input: Uint256) -> Option<u64> {
    if input >= U64MAX.into() {
        None
    } else {
        let mut val = input.to_bytes_be();
        // pad to 8 bytes
        while val.len() < 8 {
            val.insert(0, 0);
        }
        let mut lower_bytes: [u8; 8] = [0; 8];
        // get the 'lowest' 8 bytes from a 256 bit integer
        lower_bytes.copy_from_slice(&val[0..val.len()]);
        Some(u64::from_be_bytes(lower_bytes))
    }
}

pub fn downcast_to_u128(input: Uint256) -> Option<u128> {
    if input >= U128MAX.into() {
        None
    } else {
        let mut val = input.to_bytes_be();
        // pad to 8 bytes
        while val.len() < 16 {
            val.insert(0, 0);
        }
        let mut lower_bytes: [u8; 16] = [0; 16];
        // get the 'lowest' 16 bytes from a 256 bit integer
        lower_bytes.copy_from_slice(&val[0..val.len()]);
        Some(u128::from_be_bytes(lower_bytes))
    }
}

#[test]
fn test_downcast_nonce() {
    let mut i = 0u64;
    while i < 100_000 {
        assert_eq!(i, downcast_uint256(i.into()).unwrap());
        i += 1
    }
    let mut i: u64 = std::u32::MAX.into();
    i -= 100;
    let end = i + 100_000;
    while i < end {
        assert_eq!(i, downcast_uint256(i.into()).unwrap());
        i += 1
    }
}

#[test]
fn test_downcast_to_u128() {
    let mut i = 0u128;
    while i < 100_000 {
        assert_eq!(i, downcast_to_u128(i.into()).unwrap());
        i += 1
    }
    let mut i: u128 = std::u64::MAX.into();
    i -= 100;
    let end = i + 100_000;
    while i < end {
        assert_eq!(i, downcast_to_u128(i.into()).unwrap());
        i += 1
    }
}

/// Gets the latest validator set nonce
pub async fn get_valset_nonce(
    contract_address: EthAddress,
    caller_address: EthAddress,
    web3: &Web3,
) -> Result<u64, Web3Error> {
    let val = web3
        .contract_call(
            contract_address,
            "state_lastValsetNonce()",
            &[],
            caller_address,
            None,
        )
        .await?;
    // the go represents all nonces as u64, there's no
    // reason they should ever overflow without a user
    // submitting millions or tens of millions of dollars
    // worth of transactions. But we properly check and
    // handle that case here.
    let real_num = Uint256::from_bytes_be(&val);
    Ok(downcast_uint256(real_num).expect("Valset nonce overflow! Bridge Halt!"))
}

/// Gets the latest transaction batch nonce
pub async fn get_tx_batch_nonce(
    gravity_contract_address: EthAddress,
    erc20_contract_address: EthAddress,
    caller_address: EthAddress,
    web3: &Web3,
) -> Result<u64, Web3Error> {
    let val = web3
        .contract_call(
            gravity_contract_address,
            "lastBatchNonce(address)",
            &[erc20_contract_address.into()],
            caller_address,
            None,
        )
        .await?;
    // the go represents all nonces as u64, there's no
    // reason they should ever overflow without a user
    // submitting millions or tens of millions of dollars
    // worth of transactions. But we properly check and
    // handle that case here.
    let real_num = Uint256::from_bytes_be(&val);
    Ok(downcast_uint256(real_num).expect("TxBatch nonce overflow! Bridge Halt!"))
}

/// Gets the latest transaction batch nonce
pub async fn get_logic_call_nonce(
    gravity_contract_address: EthAddress,
    invalidation_id: Vec<u8>,
    caller_address: EthAddress,
    web3: &Web3,
) -> Result<u64, Web3Error> {
    let val = web3
        .contract_call(
            gravity_contract_address,
            "lastLogicCallNonce(bytes32)",
            &[Token::Bytes(invalidation_id)],
            caller_address,
            None,
        )
        .await?;
    // the go represents all nonces as u64, there's no
    // reason they should ever overflow without a user
    // submitting millions or tens of millions of dollars
    // worth of transactions. But we properly check and
    // handle that case here.
    let real_num = Uint256::from_bytes_be(&val);
    Ok(downcast_uint256(real_num).expect("LogicCall nonce overflow! Bridge Halt!"))
}

/// Gets the latest transaction batch nonce
pub async fn get_event_nonce(
    gravity_contract_address: EthAddress,
    caller_address: EthAddress,
    web3: &Web3,
) -> Result<u64, Web3Error> {
    let val = web3
        .contract_call(
            gravity_contract_address,
            "state_lastEventNonce()",
            &[],
            caller_address,
            None,
        )
        .await?;
    // the go represents all nonces as u64, there's no
    // reason they should ever overflow without a user
    // submitting millions or tens of millions of dollars
    // worth of transactions. But we properly check and
    // handle that case here.
    let real_num = Uint256::from_bytes_be(&val);
    Ok(downcast_uint256(real_num).expect("EventNonce nonce overflow! Bridge Halt!"))
}

/// Gets the gravityID
pub async fn get_gravity_id(
    contract_address: EthAddress,
    caller_address: EthAddress,
    web3: &Web3,
) -> Result<Vec<u8>, Web3Error> {
    let val = web3
        .contract_call(
            contract_address,
            "state_gravityId()",
            &[],
            caller_address,
            None,
        )
        .await?;
    Ok(val)
}

/// Just a helper struct to represent the cost of actions on Ethereum
#[derive(Debug, Default, Clone)]
pub struct GasCost {
    /// The amount of gas spent
    pub gas: Uint256,
    /// The price of the gas
    pub gas_price: Uint256,
}

impl GasCost {
    /// Gets the total cost in Eth (or other EVM chain native token)
    /// of executing the batch
    pub fn get_total(&self) -> Uint256 {
        self.gas.clone() * self.gas_price.clone()
    }
}

/// This encodes the solidity struct ValsetArgs from the Gravity
/// contract useful for all three major contract calls
/// struct ValsetArgs {
///     address[] validators;
///     uint256[] powers;
///     uint256 valsetNonce;
///     uint256 rewardAmount;
///     address rewardToken;
// }
pub fn encode_valset_struct(valset: &Valset) -> Token {
    let (addresses, powers) = valset.filter_empty_addresses();
    let nonce = valset.nonce;
    let reward_amount = valset.reward_amount.clone();
    // the zero address represents 'no reward' in this case we have replaced it with a 'none'
    // so that it's easy to identify if this validator set has a reward or not. Now that we're
    // going to encode it for the contract call we need return it to the magic value the contract
    // expects.
    let reward_token = valset.reward_token.unwrap_or_else(|| *ZERO_ADDRESS);
    let struct_tokens = &[
        addresses.into(),
        powers.into(),
        nonce.into(),
        reward_amount.into(),
        reward_token.into(),
    ];
    Token::Struct(struct_tokens.to_vec())
}
