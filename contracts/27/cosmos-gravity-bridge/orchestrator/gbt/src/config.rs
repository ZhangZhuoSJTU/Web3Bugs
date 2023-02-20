//! Handles configuration structs + saving and loading for Gravity bridge tools

use crate::args::InitOpts;
use clarity::PrivateKey as EthPrivateKey;
use gravity_utils::types::GravityBridgeToolsConfig;
use std::{
    fs::{self, create_dir},
    path::{Path, PathBuf},
    process::exit,
};

/// The name of the config file, this file is copied
/// from default-config.toml when generated so that we
/// can include comments
pub const CONFIG_NAME: &str = "config.toml";
/// The name of the keys file, this file is not expected
/// to be hand edited.
pub const KEYS_NAME: &str = "keys.json";
/// The folder name for the config
pub const CONFIG_FOLDER: &str = ".gbt";

/// The keys storage struct, including encrypted and un-encrypted local keys
/// un-encrypted keys provide for orchestrator start and relayer start functions
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Default)]
pub struct KeyStorage {
    pub orchestrator_phrase: Option<String>,
    pub ethereum_key: Option<EthPrivateKey>,
}

/// Checks if the user has setup their config environment
pub fn config_exists(home_dir: &Path) -> bool {
    let config_file = home_dir.join(CONFIG_FOLDER).with_file_name(CONFIG_NAME);
    let keys_file = home_dir.join(CONFIG_FOLDER).with_file_name(KEYS_NAME);
    home_dir.exists() && config_file.exists() && keys_file.exists()
}

/// Creates the config directory and default config file if it does
/// not already exist
pub fn init_config(_init_ops: InitOpts, home_dir: PathBuf) {
    if home_dir.exists() {
        warn!(
            "The Gravity bridge tools config folder {} already exists!",
            home_dir.to_str().unwrap()
        );
        warn!("You can delete this folder and run init again, you will lose any keys or other config data!");
    } else {
        create_dir(home_dir.clone()).expect("Failed to create config directory!");

        fs::write(home_dir.join(CONFIG_NAME), get_default_config())
            .expect("Unable to write config file");
        fs::write(
            home_dir.join(KEYS_NAME),
            toml::to_string(&KeyStorage::default()).unwrap(),
        )
        .expect("Unable to write config file");
    }
}

/// Loads the default config from the default-config.toml file
/// done at compile time and is included in the binary
/// This is done so that we can have hand edited and annotated
/// config
fn get_default_config() -> String {
    include_str!("default-config.toml").to_string()
}

pub fn get_home_dir(home_arg: Option<PathBuf>) -> PathBuf {
    match (dirs::home_dir(), home_arg) {
        (_, Some(user_home)) => PathBuf::from(&user_home),
        (Some(default_home_dir), None) => default_home_dir.join(CONFIG_FOLDER),
        (None, None) => {
            error!("Failed to automatically determine your home directory, please provide a path to the --home argument!");
            exit(1);
        }
    }
}

/// Load the config file, this operates at runtime
pub fn load_config(home_dir: &Path) -> GravityBridgeToolsConfig {
    let config_file = home_dir.join(CONFIG_FOLDER).with_file_name(CONFIG_NAME);
    if !config_file.exists() {
        return GravityBridgeToolsConfig::default();
    }

    let config =
        fs::read_to_string(config_file).expect("Could not find config file! Run `gbt init`");
    match toml::from_str(&config) {
        Ok(v) => v,
        Err(e) => {
            error!("Invalid config! {:?}", e);
            exit(1);
        }
    }
}

/// Load the keys file, this operates at runtime
pub fn load_keys(home_dir: &Path) -> KeyStorage {
    let keys_file = home_dir.join(CONFIG_FOLDER).with_file_name(KEYS_NAME);
    if !keys_file.exists() {
        error!(
            "Keys file at {} not detected, use `gbt init` to generate a config.",
            keys_file.to_str().unwrap()
        );
        exit(1);
    }

    let keys = fs::read_to_string(keys_file).unwrap();
    match toml::from_str(&keys) {
        Ok(v) => v,
        Err(e) => {
            error!("Invalid keys! {:?}", e);
            exit(1);
        }
    }
}

/// Saves the keys file, overwriting the existing one
pub fn save_keys(home_dir: &Path, updated_keys: KeyStorage) {
    let config_file = home_dir.join(CONFIG_FOLDER).with_file_name(KEYS_NAME);
    if !config_file.exists() {
        info!(
            "Config file at {} not detected, using defaults, use `gbt init` to generate a config.",
            config_file.to_str().unwrap()
        );
    }

    fs::write(
        home_dir.join(KEYS_NAME),
        toml::to_string(&updated_keys).unwrap(),
    )
    .expect("Unable to write config file");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test that the config is both valid toml for the struct and that it's values are
    /// equal to the default values of the config.
    #[test]
    fn test_default_config() {
        let res: GravityBridgeToolsConfig = toml::from_str(&get_default_config()).unwrap();
        assert_eq!(res, GravityBridgeToolsConfig::default())
    }
}
