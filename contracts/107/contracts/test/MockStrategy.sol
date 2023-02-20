// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IController.sol";
import "../interfaces/IStrategy.sol";

contract MockStrategy is IStrategy {
    address public override want;
    address public jpeg;
    address public baseRewardPool;

    constructor(
        address _want,
        address _jpeg,
        address _baseRewardPool
    ) {
        want = _want;
        jpeg = _jpeg;
        baseRewardPool = _baseRewardPool;
    }

    function deposit() external override {}

    function withdraw(address token) external override {
        IERC20(token).transfer(
            msg.sender,
            IERC20(token).balanceOf(address(this))
        );
    }

    function withdraw(uint256 amount) external override {
        address vault = IController(msg.sender).vaults(want);
        IERC20(want).transfer(vault, amount);
    }

    function withdrawAll() external override returns (uint256) {
        address vault = IController(msg.sender).vaults(want);
        uint256 balance = IERC20(want).balanceOf(address(this));
        IERC20(want).transfer(vault, balance);
        return balance;
    }

    function balanceOf() external view override returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    function balanceOfJPEG() public view override returns (uint256) {
        return IERC20(jpeg).balanceOf(address(this));
    }

    function withdrawJPEG(address to) external override {
        IERC20(jpeg).transfer(to, balanceOfJPEG());
    }

    function convexConfig()
        external
        view
        override
        returns (
            address,
            address,
            uint256
        )
    {
        return (address(0), baseRewardPool, 0);
    }
}
