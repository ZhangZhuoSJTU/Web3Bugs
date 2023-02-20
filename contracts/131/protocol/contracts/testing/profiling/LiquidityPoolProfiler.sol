// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../../interfaces/pool/ILiquidityPool.sol";

import "../../LpToken.sol";
import "../../pool/LiquidityPool.sol";

contract LiquidityPoolProfiler {
    LiquidityPool public liquidityPool;

    constructor(address _liquidityPool, address token) {
        liquidityPool = LiquidityPool(_liquidityPool);
        LpToken(address(liquidityPool.lpToken())).approve(
            address(liquidityPool),
            type(uint256).max
        );
        ERC20(token).approve(address(liquidityPool), type(uint256).max);
    }

    function profileDeposit(uint256 amount) external {
        liquidityPool.deposit(amount);
        liquidityPool.deposit(amount);
        liquidityPool.deposit(amount);

        liquidityPool.redeem(amount);
        liquidityPool.redeem(amount);
    }
}
