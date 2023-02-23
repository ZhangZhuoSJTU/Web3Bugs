// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {ImmutableModule} from "../shared/ImmutableModule.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title   DelayedProxyAdmin
 * @author  mStable
 * @notice  Proxy admin contract to upgrade the upgradable contracts. The upgradable contracts
 *          are transparent proxy contracts from OpenZeppelin-SDK.
 * @dev     The contract has a delyed upgradability. The Governor can propose a new implementation
 *          for a proxy contract. After 1 week of opt-out delay, upgrade request can be accepted
 *          and upgrade of contract is performed.
 *          Part of the code taken from OpenZeppelin-SDK's ProxyAdmin.sol
 */
contract DelayedProxyAdmin is ImmutableModule {
  event UpgradeProposed(
    address indexed proxy,
    address implementation,
    bytes data
  );
  event UpgradeCancelled(address indexed proxy);
  event Upgraded(
    address indexed proxy,
    address oldImpl,
    address newImpl,
    bytes data
  );

  // Request struct to store proposed upgrade requests
  struct Request {
    address implementation; // New contract implementation address
    bytes data; // Data to call a function on new contract implementation
    uint256 timestamp; // Timestamp when upgrade request is proposed
  }

  // Opt-out upgrade delay
  uint256 public constant UPGRADE_DELAY = 1 weeks;

  // ProxyAddress => Request
  mapping(address => Request) public requests;

  /**
   * @dev Constructor
   * @param _nexus Nexus contract address
   */
  constructor(address _nexus) ImmutableModule(_nexus) {}

  /**
   * @dev The Governor can propose a new contract implementation for a given proxy.
   * @param _proxy Proxy address which is to be upgraded
   * @param _implementation Contract address of new implementation
   * @param _data calldata to execute initialization function upon upgrade
   */
  function proposeUpgrade(
    address _proxy,
    address _implementation,
    bytes calldata _data
  ) external onlyGovernor {
    require(_proxy != address(0), "Proxy address is zero");
    require(_implementation != address(0), "Implementation address is zero");
    require(
      requests[_proxy].implementation == address(0),
      "Upgrade already proposed"
    );
    validateProxy(_proxy, _implementation);

    Request storage request = requests[_proxy];
    request.implementation = _implementation;
    request.data = _data;
    request.timestamp = block.timestamp;

    emit UpgradeProposed(_proxy, _implementation, _data);
  }

  /**
   * @dev The Governor can cancel any existing upgrade request.
   * @param _proxy The proxy address of the existing request
   */
  function cancelUpgrade(address _proxy) external onlyGovernor {
    require(_proxy != address(0), "Proxy address is zero");
    require(requests[_proxy].implementation != address(0), "No request found");
    delete requests[_proxy];
    emit UpgradeCancelled(_proxy);
  }

  /**
   * @dev The Governor can accept upgrade request after opt-out delay over. The function is
   *      `payable`, to forward ETH to initialize function call upon upgrade.
   * @param _proxy The address of the proxy
   */
  function acceptUpgradeRequest(address payable _proxy)
    external
    payable
    onlyGovernor
  {
    // _proxy is payable, because AdminUpgradeabilityProxy has fallback function
    require(_proxy != address(0), "Proxy address is zero");
    Request memory request = requests[_proxy];
    require(_isDelayOver(request.timestamp), "Delay not over");

    address newImpl = request.implementation;
    bytes memory data = request.data;

    address oldImpl = getProxyImplementation(_proxy);

    // Deleting before to avoid re-entrancy
    delete requests[_proxy];

    if (data.length == 0) {
      require(msg.value == 0, "msg.value should be zero");
      TransparentUpgradeableProxy(_proxy).upgradeTo(newImpl);
    } else {
      TransparentUpgradeableProxy(_proxy).upgradeToAndCall{value: msg.value}(
        newImpl,
        data
      );
    }

    emit Upgraded(_proxy, oldImpl, newImpl, data);
  }

  /**
   * @dev Checks that the opt-out delay is over
   * @param _timestamp Timestamp when upgrade requested
   * @return Returns `true` when upgrade delay is over, otherwise `false`
   */
  function _isDelayOver(uint256 _timestamp) private view returns (bool) {
    if (_timestamp > 0 && block.timestamp >= _timestamp + UPGRADE_DELAY)
      return true;
    return false;
  }

  /**
   * @dev Checks the given proxy address is a valid proxy for this contract
   * @param _proxy The address of the proxy
   * @param _newImpl New implementation contract address
   */
  function validateProxy(address _proxy, address _newImpl) internal view {
    // Proxy has an implementation
    address currentImpl = getProxyImplementation(_proxy);

    // Existing implementation must not be same as new one
    require(_newImpl != currentImpl, "Implementation must be different");

    // This contract is the Proxy admin of the given _proxy address
    address admin = getProxyAdmin(_proxy);
    require(admin == address(this), "Proxy admin not matched");
  }

  /**
   * @dev Returns the admin of a proxy. Only the admin can query it.
   * @param _proxy Contract address of Proxy
   * @return The address of the current admin of the proxy.
   */
  function getProxyAdmin(address _proxy) public view returns (address) {
    // We need to manually run the static call since the getter cannot be flagged as view
    // bytes4(keccak256("admin()")) == 0xf851a440
    (bool success, bytes memory returndata) = _proxy.staticcall(hex"f851a440");
    require(success, "Call failed");
    return abi.decode(returndata, (address));
  }

  /**
   * @dev Returns the current implementation of a proxy.
   * This is needed because only the proxy admin can query it.
   * @param _proxy Contract address of Proxy
   * @return The address of the current implementation of the proxy.
   */
  function getProxyImplementation(address _proxy)
    public
    view
    returns (address)
  {
    // We need to manually run the static call since the getter cannot be flagged as view
    // bytes4(keccak256("implementation()")) == 0x5c60da1b
    (bool success, bytes memory returndata) = _proxy.staticcall(hex"5c60da1b");
    require(success, "Call failed");
    return abi.decode(returndata, (address));
  }

  // NOTICE: This can be removed. However, kept it for us to remind that we are not calling this fn.
  // We are not allowing this function call from Governor or Governance.
  /**
   * @dev Changes the admin of a proxy.
   * @param proxy Proxy to change admin.
   * @param newAdmin Address to transfer proxy administration to.
   */
  // function changeProxyAdmin(AdminUpgradeabilityProxy proxy, address newAdmin) public onlyGovernor {
  //     proxy.changeAdmin(newAdmin);
  // }
}
