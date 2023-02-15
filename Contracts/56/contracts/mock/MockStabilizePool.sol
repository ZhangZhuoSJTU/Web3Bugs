// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/Stabilize.sol";

contract MockStabilizePool is IZPAPool {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public lpToken;
    IERC20 public rewardToken;
    uint256 public rewardRate;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 unclaimedReward;
    }

    mapping(uint256 => mapping(address => UserInfo)) private userInfo;
    mapping(uint256 => address) public override poolTokenAddress;

    constructor(
        address _lpToken,
        address _rewardToken,
        uint256 _rewardRate
    ) public {
        lpToken = IERC20(_lpToken);
        rewardToken = IERC20(_rewardToken);
        rewardRate = _rewardRate;
    }

    function deposit(uint256 _pid, uint256 _amount) external override {
        userInfo[_pid][msg.sender].amount = userInfo[_pid][msg.sender].amount.add(_amount);
        lpToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function withdraw(uint256 _pid, uint256 _amount) public override {
        userInfo[_pid][msg.sender].amount = userInfo[_pid][msg.sender].amount.sub(_amount);
        lpToken.safeTransfer(msg.sender, _amount);
    }

    function exit(uint256 _pid, uint256 _amount) external override {
        withdraw(_pid, _amount);
        getReward(_pid);
    }

    function getReward(uint256 _pid) public override {
        uint256 _amount = rewardEarned(_pid, msg.sender);
        rewardToken.safeTransfer(msg.sender, _amount);
    }

    function rewardEarned(uint256 _pid, address _user) public view override returns (uint256) {
        return poolBalance(_pid, _user).mul(rewardRate).div(1000);
    }

    function poolBalance(uint256 _pid, address _user) public view override returns (uint256) {
        return userInfo[_pid][_user].amount;
    }
}
