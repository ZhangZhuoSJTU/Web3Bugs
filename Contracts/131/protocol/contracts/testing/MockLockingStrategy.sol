// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./MockErc20Strategy.sol";
import "./MockEthStrategy.sol";

contract MockLockingStrategy {
    uint256 public amountLocked;

    function setAmountLocked(uint256 amount) external {
        amountLocked = amount;
    }
}

contract MockLockingErc20Strategy is MockErc20Strategy, MockLockingStrategy {
    using SafeERC20 for IERC20;

    constructor(IRoleManager roleManager, address _underlying)
        MockErc20Strategy(roleManager, _underlying)
    {}

    function withdrawAll() external override returns (uint256) {
        uint256 currentBalance = IERC20(_underlying).balanceOf(address(this));
        uint256 toWithdraw = currentBalance - amountLocked;
        IERC20(_underlying).safeTransfer(_vault, toWithdraw);
        return toWithdraw;
    }
}

contract MockLockingEthStrategy is MockEthStrategy, MockLockingStrategy {
    constructor(IRoleManager roleManager) MockEthStrategy(roleManager) {}

    function withdrawAll() external override returns (uint256) {
        uint256 currentBalance = address(this).balance;
        uint256 toWithdraw = currentBalance - amountLocked;
        payable(address(_vault)).transfer(toWithdraw);
        return toWithdraw;
    }
}
