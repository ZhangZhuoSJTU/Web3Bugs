// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {ModuleKeys} from "./ModuleKeys.sol";
import {INexus} from "../interfaces/INexus.sol";

/**
 * @title   ImmutableModule
 * @author  mStable
 * @dev     Subscribes to module updates from a given publisher and reads from its registry.
 *          Contract is used for upgradable proxy contracts.
 */
abstract contract ImmutableModule is ModuleKeys {
  INexus public immutable nexus;

  /**
   * @dev Initialization function for upgradable proxy contracts
   * @param _nexus Nexus contract address
   */
  constructor(address _nexus) {
    require(_nexus != address(0), "Nexus address is zero");
    nexus = INexus(_nexus);
  }

  /**
   * @dev Modifier to allow function calls only from the Governor.
   */
  modifier onlyGovernor() {
    _onlyGovernor();
    _;
  }

  function _onlyGovernor() internal view {
    require(msg.sender == _governor(), "Only governor can execute");
  }

  /**
   * @dev Modifier to allow function calls only from the Governor or the Keeper EOA.
   */
  modifier onlyKeeperOrGovernor() {
    _keeperOrGovernor();
    _;
  }

  function _keeperOrGovernor() internal view {
    require(
      msg.sender == _keeper() || msg.sender == _governor(),
      "Only keeper or governor"
    );
  }

  /**
   * @dev Modifier to allow function calls only from the Governance.
   *      Governance is either Governor address or Governance address.
   */
  modifier onlyGovernance() {
    require(
      msg.sender == _governor() || msg.sender == _governance(),
      "Only governance can execute"
    );
    _;
  }

  /**
   * @dev Returns Governor address from the Nexus
   * @return Address of Governor Contract
   */
  function _governor() internal view returns (address) {
    return nexus.governor();
  }

  /**
   * @dev Returns Governance Module address from the Nexus
   * @return Address of the Governance (Phase 2)
   */
  function _governance() internal view returns (address) {
    return nexus.getModule(KEY_GOVERNANCE);
  }

  /**
   * @dev Return Keeper address from the Nexus.
   *      This account is used for operational transactions that
   *      don't need multiple signatures.
   * @return  Address of the Keeper externally owned account.
   */
  function _keeper() internal view returns (address) {
    return nexus.getModule(KEY_KEEPER);
  }

  /**
   * @dev Return SavingsManager Module address from the Nexus
   * @return Address of the SavingsManager Module contract
   */
  function _savingsManager() internal view returns (address) {
    return nexus.getModule(KEY_SAVINGS_MANAGER);
  }

  /**
   * @dev Return Recollateraliser Module address from the Nexus
   * @return  Address of the Recollateraliser Module contract (Phase 2)
   */
  function _recollateraliser() internal view returns (address) {
    return nexus.getModule(KEY_RECOLLATERALISER);
  }

  /**
   * @dev Return Liquidator Module address from the Nexus
   * @return  Address of the Liquidator Module contract
   */
  function _liquidator() internal view returns (address) {
    return nexus.getModule(KEY_LIQUIDATOR);
  }

  /**
   * @dev Return ProxyAdmin Module address from the Nexus
   * @return Address of the ProxyAdmin Module contract
   */
  function _proxyAdmin() internal view returns (address) {
    return nexus.getModule(KEY_PROXY_ADMIN);
  }
}
