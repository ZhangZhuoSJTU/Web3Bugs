// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.7.6;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TransferHelper} from "@uniswap/lib/contracts/libraries/TransferHelper.sol";

import {Powered} from "./Powered.sol";

interface IRewardPool {
    function sendERC20(
        address token,
        address to,
        uint256 value
    ) external;

    function rescueERC20(address[] calldata tokens, address recipient) external;
}

/// @title Reward Pool
/// @notice Vault for isolated storage of reward tokens
contract RewardPool is IRewardPool, Powered, Ownable {
    /* initializer */

    constructor(address powerSwitch) {
        Powered._setPowerSwitch(powerSwitch);
    }

    /* user functions */

    /// @notice Send an ERC20 token
    /// access control: only owner
    /// state machine:
    ///   - can be called multiple times
    ///   - only online
    /// state scope: none
    /// token transfer: transfer tokens from self to recipient
    /// @param token address The token to send
    /// @param to address The recipient to send to
    /// @param value uint256 Amount of tokens to send
    function sendERC20(
        address token,
        address to,
        uint256 value
    ) external override onlyOwner onlyOnline {
        TransferHelper.safeTransfer(token, to, value);
    }

    /* emergency functions */

    /// @notice Rescue multiple ERC20 tokens
    /// access control: only power controller
    /// state machine:
    ///   - can be called multiple times
    ///   - only shutdown
    /// state scope: none
    /// token transfer: transfer tokens from self to recipient
    /// @param tokens address[] The tokens to rescue
    /// @param recipient address The recipient to rescue to
    function rescueERC20(address[] calldata tokens, address recipient)
        external
        override
        onlyShutdown
    {
        // only callable by controller
        require(
            msg.sender == Powered.getPowerController(),
            "RewardPool: only controller can withdraw after shutdown"
        );

        // assert recipient is defined
        require(recipient != address(0), "RewardPool: recipient not defined");

        // transfer tokens
        for (uint256 index = 0; index < tokens.length; index++) {
            // get token
            address token = tokens[index];
            // get balance
            uint256 balance = IERC20(token).balanceOf(address(this));
            // transfer token
            TransferHelper.safeTransfer(token, recipient, balance);
        }
    }
}
