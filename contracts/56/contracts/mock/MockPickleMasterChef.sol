// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockPickleMasterChef {
    IERC20 public pickleToken;
    IERC20 public lpToken;

    struct UserInfo {
        uint amount; // How many LP tokens the user has provided.
        uint rewardDebt; // Reward debt. See explanation below.
    }

    mapping(uint => mapping(address => UserInfo)) public userInfo;

    constructor(IERC20 _pickleToken, IERC20 _lpToken) public {
        pickleToken = _pickleToken;
        lpToken = _lpToken;
    }

    function deposit(uint _pid, uint _amount) external {
        lpToken.transferFrom(msg.sender, address(this), _amount);
        UserInfo storage user = userInfo[_pid][msg.sender];
        pickleToken.transfer(msg.sender, user.amount / 10); // always get 10% of deposited amount
        user.amount = user.amount + _amount;
    }

    function withdraw(uint _pid, uint _amount) external {
        lpToken.transfer(msg.sender, _amount);
        UserInfo storage user = userInfo[_pid][msg.sender];
        pickleToken.transfer(msg.sender, user.amount / 10); // always get 10% of deposited amount
        user.amount = user.amount - _amount;
    }

    function pendingPickle(uint, address) external view returns (uint) {
        return pickleToken.balanceOf(address(this)) / 10;
    }

    function emergencyWithdraw(uint _pid) external {
        UserInfo storage user = userInfo[_pid][msg.sender];
        lpToken.transfer(msg.sender, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }
}
