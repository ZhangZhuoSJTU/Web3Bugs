#[macro_use]
extern crate log;
#[macro_use]
extern crate serde_derive;

use crate::args::{ClientSubcommand, KeysSubcommand, SubCommand};
use crate::config::init_config;
use crate::keys::show_keys;
use crate::{orchestrator::orchestrator, relayer::relayer};
use args::Opts;
use clap::Clap;
use client::cosmos_to_eth::cosmos_to_eth;
use client::deploy_erc20_representation::deploy_erc20_representation;
use client::eth_to_cosmos::eth_to_cosmos;
use config::{get_home_dir, load_config};
use env_logger::Env;
use keys::register_orchestrator_address::register_orchestrator_address;
use keys::set_eth_key;
use keys::set_orchestrator_key;

mod args;
mod client;
mod config;
mod keys;
mod orchestrator;
mod relayer;
mod utils;

#[actix_rt::main]
async fn main() {
    env_logger::Builder::from_env(Env::default().default_filter_or("info")).init();
    // On Linux static builds we need to probe ssl certs path to be able to
    // do TLS stuff.
    openssl_probe::init_ssl_cert_env_vars();
    // parse the arguments
    let opts: Opts = Opts::parse();

    // handle global config here
    let address_prefix = opts.address_prefix;
    let home_dir = get_home_dir(opts.home);
    let config = load_config(&home_dir);

    // control flow for the command structure
    match opts.subcmd {
        SubCommand::Client(client_opts) => match client_opts.subcmd {
            ClientSubcommand::EthToCosmos(eth_to_cosmos_opts) => {
                eth_to_cosmos(eth_to_cosmos_opts, address_prefix).await
            }
            ClientSubcommand::CosmosToEth(cosmos_to_eth_opts) => {
                cosmos_to_eth(cosmos_to_eth_opts, address_prefix).await
            }
            ClientSubcommand::DeployErc20Representation(deploy_erc20_opts) => {
                deploy_erc20_representation(deploy_erc20_opts, address_prefix).await
            }
        },
        SubCommand::Keys(key_opts) => match key_opts.subcmd {
            KeysSubcommand::RegisterOrchestratorAddress(set_orchestrator_address_opts) => {
                register_orchestrator_address(
                    set_orchestrator_address_opts,
                    address_prefix,
                    home_dir,
                )
                .await
            }
            KeysSubcommand::Show => show_keys(&home_dir, &address_prefix),
            KeysSubcommand::SetEthereumKey(set_eth_key_opts) => {
                set_eth_key(&home_dir, set_eth_key_opts)
            }
            KeysSubcommand::SetOrchestratorKey(set_orch_key_opts) => {
                set_orchestrator_key(&home_dir, set_orch_key_opts)
            }
        },
        SubCommand::Orchestrator(orchestrator_opts) => {
            orchestrator(orchestrator_opts, address_prefix, &home_dir, config).await
        }
        SubCommand::Relayer(relayer_opts) => {
            relayer(relayer_opts, address_prefix, &home_dir, &config.relayer).await
        }
        SubCommand::Init(init_opts) => init_config(init_opts, home_dir),
    }
}
