// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

/**
 * @title  ModuleKeys
 * @author mStable
 * @notice Provides system wide access to the byte32 represntations of system modules
 *         This allows each system module to be able to reference and update one another in a
 *         friendly way
 * @dev    keccak256() values are hardcoded to avoid re-evaluation of the constants at runtime.
 */
contract ModuleKeys {
  // Governance
  // ===========
  // keccak256("Governance");
  bytes32 internal constant KEY_GOVERNANCE =
    0x9409903de1e6fd852dfc61c9dacb48196c48535b60e25abf92acc92dd689078d;
  //keccak256("Staking");
  bytes32 internal constant KEY_STAKING =
    0x1df41cd916959d1163dc8f0671a666ea8a3e434c13e40faef527133b5d167034;
  //keccak256("ProxyAdmin");
  bytes32 internal constant KEY_PROXY_ADMIN =
    0x96ed0203eb7e975a4cbcaa23951943fa35c5d8288117d50c12b3d48b0fab48d1;

  // mStable
  // =======
  // keccak256("OracleHub");
  bytes32 internal constant KEY_ORACLE_HUB =
    0x8ae3a082c61a7379e2280f3356a5131507d9829d222d853bfa7c9fe1200dd040;
  // keccak256("Manager");
  bytes32 internal constant KEY_MANAGER =
    0x6d439300980e333f0256d64be2c9f67e86f4493ce25f82498d6db7f4be3d9e6f;
  //keccak256("Recollateraliser");
  bytes32 internal constant KEY_RECOLLATERALISER =
    0x39e3ed1fc335ce346a8cbe3e64dd525cf22b37f1e2104a755e761c3c1eb4734f;
  //keccak256("MetaToken");
  bytes32 internal constant KEY_META_TOKEN =
    0xea7469b14936af748ee93c53b2fe510b9928edbdccac3963321efca7eb1a57a2;
  // keccak256("SavingsManager");
  bytes32 internal constant KEY_SAVINGS_MANAGER =
    0x12fe936c77a1e196473c4314f3bed8eeac1d757b319abb85bdda70df35511bf1;
  // keccak256("Liquidator");
  bytes32 internal constant KEY_LIQUIDATOR =
    0x1e9cb14d7560734a61fa5ff9273953e971ff3cd9283c03d8346e3264617933d4;
  // keccak256("InterestValidator");
  bytes32 internal constant KEY_INTEREST_VALIDATOR =
    0xc10a28f028c7f7282a03c90608e38a4a646e136e614e4b07d119280c5f7f839f;
  // keccak256("Keeper");
  bytes32 internal constant KEY_KEEPER =
    0x4f78afe9dfc9a0cb0441c27b9405070cd2a48b490636a7bdd09f355e33a5d7de;
}
