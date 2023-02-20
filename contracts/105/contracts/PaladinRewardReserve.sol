// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./open-zeppelin/utils/Ownable.sol";
import "./open-zeppelin/utils/ReentrancyGuard.sol";
import "./open-zeppelin/interfaces/IERC20.sol";
import "./open-zeppelin/libraries/SafeERC20.sol";

/** @title Paladin Reward Reserve contract  */
/// @author Paladin
contract PaladinRewardReserve is Ownable, ReentrancyGuard{
    using SafeERC20 for IERC20;

    /** @notice Addresses allowed to transfer tokens from this contract */
    mapping(address => bool) public approvedSpenders;

    /** @notice Emitted when a new spender is approved*/
    event NewSpender(address indexed token, address indexed spender, uint256 amount);
    /** @notice Emitted when the allowance of a spander is updated */
    event UpdateSpender(address indexed token, address indexed spender, uint256 amount);
    /** @notice Emitted when a spender allowance is removed */
    event RemovedSpender(address indexed token, address indexed spender);

    constructor(address _admin) {
        transferOwnership(_admin);
    }

    function setNewSpender(address token, address spender, uint256 amount) external onlyOwner {
        require(!approvedSpenders[spender], "Already Spender");
        approvedSpenders[spender] = true;
        IERC20(token).safeApprove(spender, amount);

        emit NewSpender(token, spender, amount);
    }

    function updateSpenderAllowance(address token, address spender, uint256 amount) external onlyOwner {
        require(approvedSpenders[spender], "Not approved Spender");
        IERC20(token).safeApprove(spender, 0);
        IERC20(token).safeApprove(spender, amount);

        emit UpdateSpender(token, spender, amount);
    }

    function removeSpender(address token, address spender) external onlyOwner {
        require(approvedSpenders[spender], "Not approved Spender");
        approvedSpenders[spender] = false;
        IERC20(token).safeApprove(spender, 0);

        emit RemovedSpender(token, spender);
    }

    function transferToken(address token, address receiver, uint256 amount) external onlyOwner nonReentrant {
        IERC20(token).safeTransfer(receiver, amount);
    }

}
