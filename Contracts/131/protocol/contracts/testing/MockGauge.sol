// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../interfaces/vendor/IGauge.sol";
import "./MockErc20.sol";

contract MockGauge is IGauge {
    address private _lpToken;

    mapping(address => uint256) private _balances;

    // mock claimable CRV rewards
    uint256 private _claimableTokens = 0;

    constructor(address lpToken_) {
        _lpToken = lpToken_;
    }

    function deposit(uint256 amount) external override {
        require(
            MockErc20(_lpToken).balanceOf(msg.sender) >= amount,
            "insufficient user gauge balance"
        );
        MockErc20(_lpToken).transferFrom(msg.sender, address(this), amount);
        _balances[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external override {
        require(_balances[msg.sender] >= amount, "insufficient user gauge balance");
        _balances[msg.sender] -= amount;
        MockErc20(_lpToken).transfer(msg.sender, amount);
    }

    // for mocking CRV rewards
    function setClaimableTokens(uint256 amount) external {
        _claimableTokens = amount;
    }

    // solhint-disable-next-line func-name-mixedcase
    function user_checkpoint(address account) external override {}

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    // solhint-disable-next-line func-name-mixedcase
    function claimable_tokens(address) external view override returns (uint256) {
        return _claimableTokens;
    }
}
