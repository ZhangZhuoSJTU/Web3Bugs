//! Command line argument definitions for Gravity bridge tools
//! See the clap documentation for how exactly this works, note that doc comments are displayed to the user

use std::path::PathBuf;

use clap::AppSettings;
use clap::Clap;
use clarity::Address as EthAddress;
use clarity::PrivateKey as EthPrivateKey;
use deep_space::PrivateKey as CosmosPrivateKey;
use deep_space::{address::Address as CosmosAddress, Coin};

/// Gravity Bridge tools (gbt) provides tools for interacting with the Althea Gravity bridge for Cosmos based blockchains.
#[derive(Clap)]
#[clap(version = env!("CARGO_PKG_VERSION"), author = "Justin Kilpatrick <justin@althea.net>")]
#[clap(setting = AppSettings::ColoredHelp)]
pub struct Opts {
    /// Increase the logging verbosity
    #[clap(short, long)]
    pub verbose: bool,
    /// Decrease the logging verbosity
    #[clap(short, long)]
    pub quiet: bool,
    /// The home directory for Gravity Bridge Tools, by default
    /// $HOME/.althea_gbt/
    #[clap(short, long, parse(from_str))]
    pub home: Option<PathBuf>,
    /// Set the address prefix for the Cosmos chain
    /// default is 'cosmos'
    #[clap(short, long, default_value = "cosmos")]
    pub address_prefix: String,
    #[clap(subcommand)]
    pub subcmd: SubCommand,
}

#[derive(Clap)]
pub enum SubCommand {
    Orchestrator(OrchestratorOpts),
    Relayer(RelayerOpts),
    Client(ClientOpts),
    Keys(KeyOpts),
    Init(InitOpts),
}

/// The Gravity Bridge orchestrator is required for all validators of the Cosmos chain running
/// the Gravity Bridge module. It contains an Ethereum Signer, Oracle, and optional relayer
#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
pub struct OrchestratorOpts {
    /// Cosmos mnemonic phrase containing the tokens you would like to send
    #[clap(short, long, parse(try_from_str))]
    pub cosmos_phrase: Option<CosmosPrivateKey>,
    /// An Ethereum private key containing ETH to pay for fees, this will also hold the relayers earnings
    /// in the near future it will be possible to disable the Orchestrators integrated relayer
    #[clap(short, long, parse(try_from_str))]
    pub ethereum_key: Option<EthPrivateKey>,
    /// (Optional) The Cosmos gRPC server that will be used
    #[clap(long, default_value = "http://localhost:9090")]
    pub cosmos_grpc: String,
    /// (Optional) The Ethereum RPC server that will be used
    #[clap(long, default_value = "http://localhost:8545")]
    pub ethereum_rpc: String,
    /// The Cosmos Denom and amount to pay Cosmos chain fees
    #[clap(short, long, parse(try_from_str))]
    pub fees: Coin,
    /// The address fo the Gravity contract on Ethereum
    #[clap(short, long, parse(try_from_str))]
    pub gravity_contract_address: Option<EthAddress>,
}

/// The Gravity Bridge Relayer is an unpermissioned role that takes data from the Cosmos blockchain
/// packages it into Ethereum transactions and is paid to submit these transactions to the Ethereum blockchain
/// The relayer will attempt to only relay profitable transactions, but there is no guarantee that it will succeed
#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
pub struct RelayerOpts {
    /// An Ethereum private key containing ETH to pay for fees, this will also hold the relayers earnings
    #[clap(short, long, parse(try_from_str))]
    pub ethereum_key: Option<EthPrivateKey>,
    /// The address fo the Gravity contract on Ethereum
    #[clap(short, long, parse(try_from_str))]
    pub gravity_contract_address: Option<EthAddress>,
    /// (Optional) The Ethereum RPC server that will be used
    #[clap(long, default_value = "http://localhost:8545")]
    pub ethereum_rpc: String,
    /// (Optional) The Cosmos gRPC server that will be used to
    #[clap(short, long, default_value = "http://localhost:9090")]
    pub cosmos_grpc: String,
}

/// The Gravity Bridge client contains helpful command line tools for interacting with the Gravity bridge
#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
pub struct ClientOpts {
    #[clap(subcommand)]
    pub subcmd: ClientSubcommand,
}

#[derive(Clap)]
pub enum ClientSubcommand {
    CosmosToEth(CosmosToEthOpts),
    EthToCosmos(EthToCosmosOpts),
    DeployErc20Representation(DeployErc20RepresentationOpts),
}

/// Send Cosmos tokens to Ethereum
#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
pub struct CosmosToEthOpts {
    /// Cosmos mnemonic phrase containing the tokens you would like to send
    #[clap(short, long, parse(try_from_str))]
    pub cosmos_phrase: CosmosPrivateKey,
    /// (Optional) The Cosmos gRPC server that will be used to submit the transaction
    #[clap(long, default_value = "http://localhost:9090")]
    pub cosmos_grpc: String,
    /// The Denom and amount you wish to send eg: 100uatom
    #[clap(short, long, parse(try_from_str))]
    pub amount: Coin,
    /// The Cosmos Denom and amount to pay Cosmos chain fees eg: 1uatom
    #[clap(short, long, parse(try_from_str))]
    pub fees: Coin,
    /// The destination address on the Ethereum chain
    #[clap(short, long, parse(try_from_str))]
    pub eth_destination: EthAddress,
    /// If this command should request a batch to push
    /// your tx along immediately
    #[clap(short, long)]
    pub no_batch: bool,
}

/// Send an Ethereum ERC20 token to Cosmos
#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
pub struct EthToCosmosOpts {
    /// The Ethereum private key to use for sending tokens
    #[clap(long, parse(try_from_str))]
    pub ethereum_key: EthPrivateKey,
    /// (Optional) The Ethereum RPC server that will be used to submit the transaction
    #[clap(long, default_value = "http://localhost:8545")]
    pub ethereum_rpc: String,
    /// The address fo the Gravity contract on Ethereum
    #[clap(short, long, parse(try_from_str))]
    pub gravity_contract_address: EthAddress,
    /// The ERC20 contract address of the ERC20 you are sending
    #[clap(short, long, parse(try_from_str))]
    pub token_contract_address: EthAddress,
    /// The amount of tokens you are sending eg. 1.2 ATOM
    #[clap(short, long, parse(try_from_str))]
    pub amount: f64,
    /// The destination address on the Cosmos blockchain
    #[clap(short, long, parse(try_from_str))]
    pub destination: CosmosAddress,
}

/// Deploy an ERC20 representation of a Cosmos asset on the Ethereum chain
/// this can only be run once for each time of Cosmos asset
#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
pub struct DeployErc20RepresentationOpts {
    /// (Optional) The Cosmos gRPC server that will be used to submit the transaction
    #[clap(long, default_value = "http://localhost:9090")]
    pub cosmos_grpc: String,
    /// (Optional) The Ethereum RPC server that will be used to submit the transaction
    #[clap(long, default_value = "http://localhost:8545")]
    pub ethereum_rpc: String,
    /// The Cosmos Denom you wish to create an ERC20 representation for
    #[clap(short, long)]
    pub cosmos_denom: String,
    /// An Ethereum private key, containing enough ETH to pay for the transaction
    #[clap(short, long, parse(try_from_str))]
    pub ethereum_key: EthPrivateKey,
    /// The address fo the Gravity contract on Ethereum
    #[clap(short, long, parse(try_from_str))]
    pub gravity_contract_address: Option<EthAddress>,
    /// The name value for the ERC20 contract, must mach Cosmos denom metadata in order to be adopted
    #[clap(long)]
    pub erc20_name: String,
    /// The symbol value for the ERC20 contract, must mach Cosmos denom metadata in order to be adopted
    #[clap(long)]
    pub erc20_symbol: String,
    /// The decimals value for the ERC20 contract, must mach Cosmos denom metadata in order to be adopted
    #[clap(long)]
    pub erc20_decimals: u8,
}

/// Manage keys
#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
pub struct KeyOpts {
    #[clap(subcommand)]
    pub subcmd: KeysSubcommand,
}

#[derive(Clap)]
pub enum KeysSubcommand {
    RegisterOrchestratorAddress(RegisterOrchestratorAddressOpts),
    SetEthereumKey(SetEthereumKeyOpts),
    SetOrchestratorKey(SetOrchestratorKeyOpts),
    Show,
}

/// Register delegate keys for the Gravity Orchestrator.
/// this is a mandatory part of setting up a Gravity Orchestrator
/// If you would like sign using a ledger see `cosmos tx gravity set-orchestrator-address` instead
#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
pub struct RegisterOrchestratorAddressOpts {
    /// The Cosmos private key of the validator
    #[clap(short, long, parse(try_from_str))]
    pub validator_phrase: CosmosPrivateKey,
    /// (Optional) The Ethereum private key to register, will be generated if not provided
    #[clap(short, long, parse(try_from_str))]
    pub ethereum_key: Option<EthPrivateKey>,
    /// (Optional) The phrase for the Cosmos key to register, will be generated if not provided.
    #[clap(short, long, parse(try_from_str))]
    pub cosmos_phrase: Option<String>,
    /// (Optional) The Cosmos gRPC server that will be used to submit the transaction
    #[clap(long, default_value = "http://localhost:9090")]
    pub cosmos_grpc: String,
    /// The Cosmos Denom and amount to pay Cosmos chain fees
    #[clap(short, long, parse(try_from_str))]
    pub fees: Coin,
    /// Do not save keys to disk for later use with `orchestrator start`
    #[clap(long)]
    pub no_save: bool,
}

/// Add an Ethereum private key for use with either the Relayer or the Orchestrator
#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
pub struct SetEthereumKeyOpts {
    ///
    #[clap(short, long, parse(try_from_str))]
    pub key: EthPrivateKey,
}

/// Add a Cosmos private key to use as the Orchestrator address
#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
pub struct SetOrchestratorKeyOpts {
    #[clap(short, long)]
    pub phrase: String,
}

/// Initialize configuration
#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
pub struct InitOpts {}
