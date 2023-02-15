// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../interfaces/IMochiEngine.sol";
import "../interfaces/IReferralFeePool.sol";

contract ReferralFeePoolV0 is IReferralFeePool {
    IMochiEngine public immutable engine;
    IUniswapV2Router02 public immutable uniswapRouter;

    uint256 public rewards;

    mapping(address => uint256) public reward;

    constructor(address _engine, address _uniswap) {
        engine = IMochiEngine(_engine);
        uniswapRouter = IUniswapV2Router02(_uniswap);
    }

    function addReward(address _recipient) external override {
        uint256 newReward = engine.usdm().balanceOf(address(this)) - rewards;
        reward[_recipient] += newReward;
        rewards += newReward;
    }

    function claimRewardAsMochi() external {
        IUSDM usdm = engine.usdm();
        address[] memory path = new address[](2);
        path[0] = address(usdm);
        path[1] = uniswapRouter.WETH();
        path[2] = address(engine.mochi());
        usdm.approve(address(uniswapRouter), reward[msg.sender]);
        // we are going to ingore the slippages here
        uniswapRouter.swapExactTokensForTokens(
            reward[msg.sender],
            1,
            path,
            address(this),
            type(uint256).max
        );
        engine.mochi().transfer(
            msg.sender,
            engine.mochi().balanceOf(address(this))
        );
    }
}
