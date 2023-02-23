// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

import {INexus} from "../interfaces/INexus.sol";
import {Governable} from "../governance/Governable.sol";
import {DelayedClaimableGovernor} from "../governance/DelayedClaimableGovernor.sol";

/**
 * @title   Nexus
 * @author  mStable
 * @notice  Address provider and system kernel, also facilitates governance changes
 * @dev     The Nexus is mStable's Kernel, and allows the publishing and propagating
 *          of new system Modules. Other Modules will read from the Nexus
 *          VERSION: 3.0
 *          DATE:    2021-04-15
 */
contract Nexus is INexus, DelayedClaimableGovernor {
  event ModuleProposed(bytes32 indexed key, address addr, uint256 timestamp);
  event ModuleAdded(bytes32 indexed key, address addr, bool isLocked);
  event ModuleCancelled(bytes32 indexed key);
  event ModuleLockRequested(bytes32 indexed key, uint256 timestamp);
  event ModuleLockEnabled(bytes32 indexed key);
  event ModuleLockCancelled(bytes32 indexed key);

  /** @dev Struct to store information about current modules */
  struct Module {
    address addr; // Module address
    bool isLocked; // Module lock status
  }

  /** @dev Struct to store information about proposed modules */
  struct Proposal {
    address newAddress; // Proposed Module address
    uint256 timestamp; // Timestamp when module upgrade was proposed
  }

  // 1 week delayed upgrade period
  uint256 public constant UPGRADE_DELAY = 1 weeks;

  // Module-key => Module
  mapping(bytes32 => Module) public modules;
  // Module-address => Module-key
  mapping(address => bytes32) private addressToModule;
  // Module-key => Proposal
  mapping(bytes32 => Proposal) public proposedModules;
  // Module-key => Timestamp when lock was proposed
  mapping(bytes32 => uint256) public proposedLockModules;

  // Init flag to allow add modules at the time of deplyment without delay
  bool public initialized = false;

  /**
   * @dev Modifier allows functions calls only when contract is not initialized.
   */
  modifier whenNotInitialized() {
    require(!initialized, "Nexus is already initialized");
    _;
  }

  /**
   * @dev Initialises the Nexus and adds the core data to the Kernel (itself and governor)
   * @param _governorAddr Governor address
   */
  constructor(address _governorAddr)
    DelayedClaimableGovernor(_governorAddr, UPGRADE_DELAY)
  {}

  // FIXME can this function be avoided as it just calls the super function
  function governor()
    public
    view
    override(Governable, INexus)
    returns (address)
  {
    return super.governor();
  }

  /**
   * @dev Adds multiple new modules to the system to initialize the
   *      Nexus contract with default modules. This should be called first
   *      after deploying Nexus contract.
   * @param _keys         Keys of the new modules in bytes32 form
   * @param _addresses    Contract addresses of the new modules
   * @param _isLocked     IsLocked flag for the new modules
   * @param _governorAddr New Governor address
   * @return bool         Success of publishing new Modules
   */
  function initialize(
    bytes32[] calldata _keys,
    address[] calldata _addresses,
    bool[] calldata _isLocked,
    address _governorAddr
  ) external onlyGovernor whenNotInitialized returns (bool) {
    uint256 len = _keys.length;
    require(len > 0, "No keys provided");
    require(len == _addresses.length, "Insufficient address data");
    require(len == _isLocked.length, "Insufficient locked statuses");

    for (uint256 i = 0; i < len; i++) {
      _publishModule(_keys[i], _addresses[i], _isLocked[i]);
    }

    if (_governorAddr != governor()) _changeGovernor(_governorAddr);

    initialized = true;
    return true;
  }

  /***************************************
                MODULE ADDING
    ****************************************/

  /**
   * @dev Propose a new or update existing module
   * @param _key  Key of the module
   * @param _addr Address of the module
   */
  function proposeModule(bytes32 _key, address _addr)
    external
    override
    onlyGovernor
  {
    require(_key != bytes32(0x0), "Key must not be zero");
    require(_addr != address(0), "Module address must not be 0");
    require(!modules[_key].isLocked, "Module must be unlocked");
    require(modules[_key].addr != _addr, "Module already has same address");
    Proposal storage p = proposedModules[_key];
    require(p.timestamp == 0, "Module already proposed");

    p.newAddress = _addr;
    p.timestamp = block.timestamp;
    emit ModuleProposed(_key, _addr, block.timestamp);
  }

  /**
   * @dev Cancel a proposed module request
   * @param _key Key of the module
   */
  function cancelProposedModule(bytes32 _key) external override onlyGovernor {
    uint256 timestamp = proposedModules[_key].timestamp;
    require(timestamp > 0, "Proposed module not found");

    delete proposedModules[_key];
    emit ModuleCancelled(_key);
  }

  /**
   * @dev Accept and publish an already proposed module
   * @param _key Key of the module
   */
  function acceptProposedModule(bytes32 _key) external override onlyGovernor {
    _acceptProposedModule(_key);
  }

  /**
   * @dev Accept and publish already proposed modules
   * @param _keys Keys array of the modules
   */
  function acceptProposedModules(bytes32[] calldata _keys)
    external
    override
    onlyGovernor
  {
    uint256 len = _keys.length;
    require(len > 0, "Keys array empty");

    for (uint256 i = 0; i < len; i++) {
      _acceptProposedModule(_keys[i]);
    }
  }

  /**
   * @dev Accept a proposed module
   * @param _key Key of the module
   */
  function _acceptProposedModule(bytes32 _key) internal {
    Proposal memory p = proposedModules[_key];
    require(_isDelayOver(p.timestamp), "Module upgrade delay not over");

    delete proposedModules[_key];
    _publishModule(_key, p.newAddress, false);
  }

  /**
   * @dev Internal func to publish a module to kernel
   * @param _key      Key of the new module in bytes32 form
   * @param _addr     Contract address of the new module
   * @param _isLocked Flag to lock a module
   */
  function _publishModule(
    bytes32 _key,
    address _addr,
    bool _isLocked
  ) internal {
    require(
      addressToModule[_addr] == bytes32(0x0),
      "Modules must have unique addr"
    );
    require(!modules[_key].isLocked, "Module must be unlocked");
    // Old no longer points to a moduleAddress
    address oldModuleAddr = modules[_key].addr;
    if (oldModuleAddr != address(0x0)) {
      addressToModule[oldModuleAddr] = bytes32(0x0);
    }
    modules[_key].addr = _addr;
    modules[_key].isLocked = _isLocked;
    addressToModule[_addr] = _key;
    emit ModuleAdded(_key, _addr, _isLocked);
  }

  /***************************************
                MODULE LOCKING
    ****************************************/

  /**
   * @dev Request to lock an existing module
   * @param _key Key of the module
   */
  function requestLockModule(bytes32 _key) external override onlyGovernor {
    require(moduleExists(_key), "Module must exist");
    require(!modules[_key].isLocked, "Module must be unlocked");
    require(proposedLockModules[_key] == 0, "Lock already proposed");

    proposedLockModules[_key] = block.timestamp;
    emit ModuleLockRequested(_key, block.timestamp);
  }

  /**
   * @dev Cancel a lock module request
   * @param _key Key of the module
   */
  function cancelLockModule(bytes32 _key) external override onlyGovernor {
    require(proposedLockModules[_key] > 0, "Module lock request not found");

    delete proposedLockModules[_key];
    emit ModuleLockCancelled(_key);
  }

  /**
   * @dev Permanently lock a module to its current settings
   * @param _key Bytes32 key of the module
   */
  function lockModule(bytes32 _key) external override onlyGovernor {
    require(_isDelayOver(proposedLockModules[_key]), "Delay not over");

    modules[_key].isLocked = true;
    delete proposedLockModules[_key];
    emit ModuleLockEnabled(_key);
  }

  /***************************************
                HELPERS & GETTERS
    ****************************************/

  /**
   * @dev Checks if a module exists
   * @param _key  Key of the module
   * @return      Returns 'true' when a module exists, otherwise 'false'
   */
  function moduleExists(bytes32 _key) public view returns (bool) {
    if (_key != 0 && modules[_key].addr != address(0)) return true;
    return false;
  }

  /**
   * @dev Get the module address
   * @param _key  Key of the module
   * @return addr Return the address of the module
   */
  function getModule(bytes32 _key)
    external
    view
    override
    returns (address addr)
  {
    addr = modules[_key].addr;
  }

  /**
   * @dev Checks if upgrade delay over
   * @param _timestamp    Timestamp to check
   * @return              Return 'true' when delay is over, otherwise 'false'
   */
  function _isDelayOver(uint256 _timestamp) private view returns (bool) {
    if (_timestamp > 0 && block.timestamp >= _timestamp + UPGRADE_DELAY)
      return true;
    return false;
  }
}
