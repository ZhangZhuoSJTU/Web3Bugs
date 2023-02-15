// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/** @title Treasury Contract */
contract Treasury_v0 is Initializable {
  address public admin;

  /*╔═════════════════════════════╗
    ║          MODIFIERS          ║
    ╚═════════════════════════════╝*/

  modifier onlyAdmin() {
    require(msg.sender == admin, "Not admin");
    _;
  }

  /*╔══════════════════════════════╗
    ║        CONTRACT SETUP        ║
    ╚══════════════════════════════╝*/

  function initialize(address _admin) external initializer {
    admin = _admin;
  }

  /*╔════════════════════════════════╗
    ║    MULTISIG ADMIN FUNCTIONS    ║
    ╚════════════════════════════════╝*/

  function changeAdmin(address _admin) external onlyAdmin {
    admin = _admin;
  }

  /** To be upgraded in future allowing governance of treasury 
    and its funds */
}
