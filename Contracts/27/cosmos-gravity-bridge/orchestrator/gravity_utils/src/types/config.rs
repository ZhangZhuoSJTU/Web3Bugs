//! contains configuration structs that need to be accessed across crates.

/// Global configuration struct for Gravity bridge tools
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Default, Clone)]
pub struct GravityBridgeToolsConfig {
    #[serde(default = "RelayerConfig::default")]
    pub relayer: RelayerConfig,
    #[serde(default = "OrchestratorConfig::default")]
    pub orchestrator: OrchestratorConfig,
}

/// Relayer configuration options
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct RelayerConfig {
    #[serde(default = "default_valset_market_enabled")]
    pub valset_market_enabled: bool,
    #[serde(default = "default_batch_market_enabled")]
    pub batch_market_enabled: bool,
    #[serde(default = "default_logic_call_market_enabled")]
    pub logic_call_market_enabled: bool,
}

// Disabled for bridge launch as some valsets need to be relayed before the
// ethereum-representation of cosmos tokens appear on uniswap. Enabling this would
// halt the bridge launch.
fn default_valset_market_enabled() -> bool {
    false
}

fn default_batch_market_enabled() -> bool {
    true
}

fn default_logic_call_market_enabled() -> bool {
    true
}

impl Default for RelayerConfig {
    fn default() -> Self {
        RelayerConfig {
            valset_market_enabled: default_valset_market_enabled(),
            batch_market_enabled: default_batch_market_enabled(),
            logic_call_market_enabled: default_logic_call_market_enabled(),
        }
    }
}

/// Orchestrator configuration options
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub struct OrchestratorConfig {
    /// If this Orchestrator should run an integrated relayer or not
    #[serde(default = "default_relayer_enabled")]
    pub relayer_enabled: bool,
}

fn default_relayer_enabled() -> bool {
    true
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        OrchestratorConfig {
            relayer_enabled: default_relayer_enabled(),
        }
    }
}
