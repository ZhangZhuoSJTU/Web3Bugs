//! This crate contains various components and utilities for interacting with the Gravity Cosmos module. Primarily
//! Extensions to Althea's 'deep_space' Cosmos transaction library to allow it to send Gravity module specific messages
//! parse Gravity module specific endpoints and generally interact with the multitude of Gravity specific functionality
//! that's part of the Cosmos module.

#[macro_use]
extern crate log;

pub mod query;
pub mod send;
pub mod utils;
