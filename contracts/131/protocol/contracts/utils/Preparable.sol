// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../interfaces/IPreparable.sol";
import "../../libraries/Errors.sol";

/**
 * @notice Implements the base logic for a two-phase commit
 * @dev This does not implements any access-control so publicly exposed
 * callers should make sure to have the proper checks in place
 */
contract Preparable is IPreparable {
    uint256 private constant _MIN_DELAY = 3 days;

    mapping(bytes32 => address) public pendingAddresses;
    mapping(bytes32 => uint256) public pendingUInts256;

    mapping(bytes32 => address) public currentAddresses;
    mapping(bytes32 => uint256) public currentUInts256;

    /**
     * @dev Deadlines shares the same namespace regardless of the type
     * of the pending variable so this needs to be enforced in the caller
     */
    mapping(bytes32 => uint256) public deadlines;

    function _prepareDeadline(bytes32 key, uint256 delay) internal {
        require(deadlines[key] == 0, Error.DEADLINE_NOT_ZERO);
        require(delay >= _MIN_DELAY, Error.DELAY_TOO_SHORT);
        deadlines[key] = block.timestamp + delay;
    }

    /**
     * @notice Prepares an uint256 that should be committed to the contract
     * after `_MIN_DELAY` elapsed
     * @param value The value to prepare
     * @return `true` if success.
     */
    function _prepare(
        bytes32 key,
        uint256 value,
        uint256 delay
    ) internal returns (bool) {
        _prepareDeadline(key, delay);
        pendingUInts256[key] = value;
        emit ConfigPreparedNumber(key, value, delay);
        return true;
    }

    /**
     * @notice Same as `_prepare(bytes32,uint256,uint256)` but uses a default delay
     */
    function _prepare(bytes32 key, uint256 value) internal returns (bool) {
        return _prepare(key, value, _MIN_DELAY);
    }

    /**
     * @notice Prepares an address that should be committed to the contract
     * after `_MIN_DELAY` elapsed
     * @param value The value to prepare
     * @return `true` if success.
     */
    function _prepare(
        bytes32 key,
        address value,
        uint256 delay
    ) internal returns (bool) {
        _prepareDeadline(key, delay);
        pendingAddresses[key] = value;
        emit ConfigPreparedAddress(key, value, delay);
        return true;
    }

    /**
     * @notice Same as `_prepare(bytes32,address,uint256)` but uses a default delay
     */
    function _prepare(bytes32 key, address value) internal returns (bool) {
        return _prepare(key, value, _MIN_DELAY);
    }

    /**
     * @notice Reset a uint256 key
     * @return `true` if success.
     */
    function _resetUInt256Config(bytes32 key) internal returns (bool) {
        require(deadlines[key] != 0, Error.NOTHING_PENDING);
        deadlines[key] = 0;
        pendingUInts256[key] = 0;
        emit ConfigReset(key);
        return true;
    }

    /**
     * @notice Reset an address key
     * @return `true` if success.
     */
    function _resetAddressConfig(bytes32 key) internal returns (bool) {
        require(deadlines[key] != 0, Error.NOTHING_PENDING);
        deadlines[key] = 0;
        pendingAddresses[key] = address(0);
        emit ConfigReset(key);
        return true;
    }

    /**
     * @dev Checks the deadline of the key and reset it
     */
    function _executeDeadline(bytes32 key) internal {
        uint256 deadline = deadlines[key];
        require(block.timestamp >= deadline, Error.DEADLINE_NOT_REACHED);
        require(deadline != 0, Error.DEADLINE_NOT_SET);
        deadlines[key] = 0;
    }

    /**
     * @notice Execute uint256 config update (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New value.
     */
    function _executeUInt256(bytes32 key) internal returns (uint256) {
        _executeDeadline(key);
        uint256 newValue = pendingUInts256[key];
        _setConfig(key, newValue);
        return newValue;
    }

    /**
     * @notice Execute address config update (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New value.
     */
    function _executeAddress(bytes32 key) internal returns (address) {
        _executeDeadline(key);
        address newValue = pendingAddresses[key];
        _setConfig(key, newValue);
        return newValue;
    }

    function _setConfig(bytes32 key, address value) internal returns (address) {
        emit ConfigUpdatedAddress(key, currentAddresses[key], value);
        currentAddresses[key] = value;
        pendingAddresses[key] = address(0);
        deadlines[key] = 0;
        return value;
    }

    function _setConfig(bytes32 key, uint256 value) internal returns (uint256) {
        uint256 oldValue = currentUInts256[key];
        currentUInts256[key] = value;
        pendingUInts256[key] = 0;
        deadlines[key] = 0;
        emit ConfigUpdatedNumber(key, oldValue, value);
        return value;
    }
}
