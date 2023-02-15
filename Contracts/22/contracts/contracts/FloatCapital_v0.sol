// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/** @title Float Capital Contract */
contract FloatCapital_v0 is Initializable {
  address public admin;

  /*╔═════════════════════════════╗
    ║          MODIFIERS          ║
    ╚═════════════════════════════╝*/

  modifier onlyAdmin() {
    require(msg.sender == admin, "Not admin");
    _;
  }

  /*╔═════════════════════════════╗
    ║       CONTRACT SETUP        ║
    ╚═════════════════════════════╝*/

  function initialize(address _admin) external initializer {
    admin = _admin;
  }

  /*╔════════════════════════════════╗
    ║    MULTISIG ADMIN FUNCTIONS    ║
    ╚════════════════════════════════╝*/

  function changeAdmin(address _admin) external onlyAdmin {
    admin = _admin;
  }

  /** A percentage of float token to accrue here for project
     development */
}
