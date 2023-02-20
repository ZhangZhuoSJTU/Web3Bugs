// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/structs/DoubleEndedQueueUpgradeable.sol";
import "../proxy/utils/Initializable.sol";

// Bytes32Deque
contract Bytes32DequeMockUpgradeable is Initializable {
    function __Bytes32DequeMock_init() internal onlyInitializing {
    }

    function __Bytes32DequeMock_init_unchained() internal onlyInitializing {
    }
    using DoubleEndedQueueUpgradeable for DoubleEndedQueueUpgradeable.Bytes32Deque;

    event OperationResult(bytes32 value);

    DoubleEndedQueueUpgradeable.Bytes32Deque private _vector;

    function pushBack(bytes32 value) public {
        _vector.pushBack(value);
    }

    function pushFront(bytes32 value) public {
        _vector.pushFront(value);
    }

    function popFront() public returns (bytes32) {
        bytes32 value = _vector.popFront();
        emit OperationResult(value);
        return value;
    }

    function popBack() public returns (bytes32) {
        bytes32 value = _vector.popBack();
        emit OperationResult(value);
        return value;
    }

    function front() public view returns (bytes32) {
        return _vector.front();
    }

    function back() public view returns (bytes32) {
        return _vector.back();
    }

    function at(uint256 i) public view returns (bytes32) {
        return _vector.at(i);
    }

    function clear() public {
        _vector.clear();
    }

    function length() public view returns (uint256) {
        return _vector.length();
    }

    function empty() public view returns (bool) {
        return _vector.empty();
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[48] private __gap;
}
