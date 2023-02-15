// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IConcurRewardClaim} from "./interfaces/IConcurRewardClaim.sol";

contract ConcurRewardPool is IConcurRewardClaim {
    using SafeERC20 for IERC20;
    address public immutable rewardNotifier;

    mapping(address => mapping(address => uint256)) public reward;

    constructor(address _notifier) {
        rewardNotifier = _notifier;
    }

    /// @notice push reward to `_recipient`
    /// @param _recipient reward recipient address
    /// @param _token token to reward
    /// @param _amount amount of tokens to allocate to `_recipient`
    function pushReward(
        address _recipient,
        address _token,
        uint256 _amount
    ) external override {
        require(msg.sender == rewardNotifier, "!notifier");
        reward[_recipient][_token] += _amount;
    }

    /// @notice claim rewards of `msg.sender`
    /// @param _tokens array of tokens to claim
    function claimRewards(address[] calldata _tokens) external override {
        for (uint256 i = 0; i < _tokens.length; i++) {
            uint256 getting = reward[msg.sender][_tokens[i]];
            IERC20(_tokens[i]).safeTransfer(msg.sender, getting);
            reward[msg.sender][_tokens[i]] = 0;
        }
    }
}
