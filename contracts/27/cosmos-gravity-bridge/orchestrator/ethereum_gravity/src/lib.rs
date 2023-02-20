//! This crate contains various components and utilities for interacting with the Gravity Ethereum contract.

use clarity::Uint256;

#[macro_use]
extern crate log;

pub mod deploy_erc20;
pub mod logic_call;
pub mod message_signatures;
pub mod send_to_cosmos;
pub mod submit_batch;
mod test_cases;
pub mod utils;
pub mod valset_update;

pub fn one_eth() -> Uint256 {
    1000000000000000000u128.into()
}
