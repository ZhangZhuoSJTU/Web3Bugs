// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IExecutorManager.sol";

contract ExecutorManager is IExecutorManager, Ownable {
    address[] internal executors;
    mapping(address => bool) internal executorStatus;

    event ExecutorAdded(address executor, address owner);
    event ExecutorRemoved(address executor, address owner);

    // MODIFIERS
    modifier onlyExecutor() {
        require(executorStatus[msg.sender], "You are not allowed to perform this operation");
        _;
    }

    function getExecutorStatus(address executor) public view override returns (bool status) {
        status = executorStatus[executor];
    }

    function getAllExecutors() public view override returns (address[] memory) {
        return executors;
    }

    //Register new Executors
    function addExecutors(address[] calldata executorArray) external override onlyOwner {
        for (uint256 i = 0; i < executorArray.length; ++i) {
            addExecutor(executorArray[i]);
        }
    }

    // Register single executor
    function addExecutor(address executorAddress) public override onlyOwner {
        require(executorAddress != address(0), "executor address can not be 0");
        require(!executorStatus[executorAddress], "Executor already registered");
        executors.push(executorAddress);
        executorStatus[executorAddress] = true;
        emit ExecutorAdded(executorAddress, msg.sender);
    }

    //Remove registered Executors
    function removeExecutors(address[] calldata executorArray) external override onlyOwner {
        for (uint256 i = 0; i < executorArray.length; ++i) {
            removeExecutor(executorArray[i]);
        }
    }

    // Remove Register single executor
    function removeExecutor(address executorAddress) public override onlyOwner {
        require(executorAddress != address(0), "executor address can not be 0");
        executorStatus[executorAddress] = false;
        emit ExecutorRemoved(executorAddress, msg.sender);
    }
}
