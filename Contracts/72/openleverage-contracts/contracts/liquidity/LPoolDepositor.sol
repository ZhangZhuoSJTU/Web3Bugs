// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;

import "./LPoolInterface.sol";
import "../lib/Exponential.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../lib/TransferHelper.sol";
import "../dex/DexAggregatorInterface.sol";
import "../IWETH.sol";

/// @title User Deposit Contract
/// @author OpenLeverage
/// @notice Use this contract for supplying lending pool funds  
contract LPoolDepositor is ReentrancyGuard {
    using TransferHelper for IERC20;

    mapping(address => mapping(address => uint)) allowedToTransfer;

    constructor() {
    }

    /// @notice Deposit ERC20 token
    function deposit(address pool, uint amount) external {
        allowedToTransfer[pool][msg.sender] = amount;
        LPoolInterface(pool).mintTo(msg.sender, amount);
    }

    /// @dev Callback function for lending pool 
    function transferToPool(address from, uint amount) external{
        require(allowedToTransfer[msg.sender][from] == amount, "for callback only");
        delete allowedToTransfer[msg.sender][from];
        IERC20(LPoolInterface(msg.sender).underlying()).safeTransferFrom(from, msg.sender, amount);
    }

    /// @notice Deposit native token
    function depositNative(address payable pool) external payable  {
        LPoolInterface(pool).mintTo{value : msg.value}(msg.sender, 0);
    }
}

