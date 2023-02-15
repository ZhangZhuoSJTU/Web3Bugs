// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./MockBooster.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../interfaces/vendor/IBooster.sol";
import "../../interfaces/vendor/IRewardStaking.sol";
import "../testing/MockErc20.sol";
import "../utils/CvxMintAmount.sol";

// solhint-disable no-unused-vars
contract MockRewardStaking is IRewardStaking, CvxMintAmount {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public crvEarned;
    mapping(address => uint256) public cvxEarned;

    address public token;
    address public crvToken;
    address public cvxToken;
    address public booster;

    constructor(
        address _token,
        address _tokenCrv,
        address _tokenCvx
    ) {
        token = _token;
        crvToken = _tokenCrv;
        cvxToken = _tokenCvx;
    }

    function setBooster(address _booster) external {
        booster = _booster;
    }

    function setCrvEarned(address user, uint256 amount) external {
        crvEarned[user] = amount;
        cvxEarned[user] = getCvxMintAmount(amount);
    }

    function stakeFor(address user, uint256 amount) external override {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        balances[user] += amount;
    }

    function stake(uint256) external override {}

    function stakeAll() external override returns (bool) {
        return true;
    }

    function withdraw(uint256 amount, bool claim) external override returns (bool) {
        return true;
    }

    function withdrawAndUnwrap(uint256 amount, bool claim) external override returns (bool) {
        require(!claim, "Not implemented claiming in withdraw and unwrap");
        balances[msg.sender] -= amount;
        IBooster(booster).withdrawTo(0, amount, msg.sender);
        return true;
    }

    function getReward() external override {
        MockErc20(crvToken).mint_for_testing(msg.sender, crvEarned[msg.sender]);
        MockErc20(cvxToken).mint_for_testing(msg.sender, cvxEarned[msg.sender]);
        crvEarned[msg.sender] = 0;
        cvxEarned[msg.sender] = 0;
    }

    function getReward(address _account, bool _claimExtras) external override {
        MockErc20(crvToken).mint_for_testing(_account, crvEarned[_account]);
        MockErc20(cvxToken).mint_for_testing(_account, cvxEarned[_account]);
        crvEarned[_account] = 0;
        cvxEarned[_account] = 0;
    }

    function earned(address account) external view override returns (uint256) {
        return crvEarned[account];
    }

    function extraRewardsLength() external view override returns (uint256) {
        return 0;
    }

    function extraRewards(uint256 _pid) external view override returns (address) {
        return address(0);
    }

    function rewardToken() external view override returns (address) {
        return crvToken;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return balances[account];
    }
}
