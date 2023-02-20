//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title Controller component
 * @dev For easy access to any core components
 */
abstract contract Controller is Initializable, UUPSUpgradeable, AccessControlUpgradeable {
    bytes32 public constant ROLE_ADMIN = keccak256("ROLE_ADMIN");

    mapping(address => address) private _admins;
    // slither-disable-next-line uninitialized-state
    bool private _paused;
    // slither-disable-next-line uninitialized-state
    address public pauseGuardian;

    /**
     * @dev Emitted when the pause is triggered by a pauser (`account`).
     */
    event Paused(address account);

    /**
     * @dev Emitted when the pause is lifted by a pauser (`account`).
     */
    event Unpaused(address account);

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     */
    modifier whenNotPaused() {
        require(!_paused, "Controller: paused");
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     */
    modifier whenPaused() {
        require(_paused, "Controller: not paused");
        _;
    }

    modifier onlyAdmin() {
        require(hasRole(ROLE_ADMIN, msg.sender), "Controller: not admin");
        _;
    }

    modifier onlyGuardian() {
        require(pauseGuardian == msg.sender, "Controller: caller does not have the guardian role");
        _;
    }

    //When using minimal deploy, do not call initialize directly during deploy, because msg.sender is the proxyFactory address, and you need to call it manually
    function __Controller_init(address admin_) public initializer {
        require(admin_ != address(0), "Controller: address zero");
        _paused = false;
        _admins[admin_] = admin_;
        __UUPSUpgradeable_init();
        _setupRole(ROLE_ADMIN, admin_);
        pauseGuardian = admin_;
    }

    function _authorizeUpgrade(address) internal view override onlyAdmin {}

    /**
     * @dev Check if the address provided is the admin
     * @param account Account address
     */
    function isAdmin(address account) public view returns (bool) {
        return hasRole(ROLE_ADMIN, account);
    }

    /**
     * @dev Add a new admin account
     * @param account Account address
     */
    function addAdmin(address account) public onlyAdmin {
        require(account != address(0), "Controller: address zero");
        require(_admins[account] == address(0), "Controller: admin already existed");

        _admins[account] = account;
        _setupRole(ROLE_ADMIN, account);
    }

    /**
     * @dev Set pauseGuardian account
     * @param account Account address
     */
    function setGuardian(address account) public onlyAdmin {
        pauseGuardian = account;
    }

    /**
     * @dev Renouce the admin from the sender's address
     */
    function renounceAdmin() public {
        renounceRole(ROLE_ADMIN, msg.sender);
        delete _admins[msg.sender];
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view returns (bool) {
        return _paused;
    }

    /**
     * @dev Called by a pauser to pause, triggers stopped state.
     */
    function pause() public onlyGuardian whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @dev Called by a pauser to unpause, returns to normal state.
     */
    function unpause() public onlyGuardian whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    uint256[50] private ______gap;
}
