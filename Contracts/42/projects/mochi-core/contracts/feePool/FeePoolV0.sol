// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../interfaces/IFeePool.sol";
import "../interfaces/IUSDM.sol";
import "../interfaces/IMochiEngine.sol";

contract FeePoolV0 is IFeePool {
    IMochiEngine public immutable engine;

    IUniswapV2Router02 public immutable uniswapRouter;

    address public crvVoterRewardPool;

    uint256 public treasuryRatio;

    uint256 public vMochiRatio;

    uint256 public mochiShare;

    uint256 public treasuryShare;

    constructor(address _engine, address _uniswap) {
        engine = IMochiEngine(_engine);
        uniswapRouter = IUniswapV2Router02(_uniswap);
        treasuryRatio = 20e16;
        vMochiRatio = 80e16;
    }

    function updateReserve() external override {
        uint256 newReserve = engine.usdm().balanceOf(address(this)) -
            mochiShare -
            treasuryShare;
        treasuryShare += (newReserve * treasuryRatio) / 1e18;
        mochiShare = engine.usdm().balanceOf(address(this)) - treasuryShare;
    }

    function changecrvVoterRewardPool(address _pool) external {
        require(msg.sender == engine.governance(), "!gov");
        crvVoterRewardPool = _pool;
    }

    function changeTreasuryRatio(uint256 _ratio) external {
        require(msg.sender == engine.governance(), "!gov");
        treasuryRatio = _ratio;
    }

    function changevMochiRatio(uint256 _ratio) external {
        require(msg.sender == engine.governance(), "!gov");
        vMochiRatio = _ratio;
    }

    // this will open up arb oppertunity for Mochi
    // so we will not reward the caller, caller can benefit from flashbot
    // should decide which market we should use UniV2?V3? BalancerV2?
    function distributeMochi() external {
        // buy Mochi with mochiShare
        _buyMochi();
        _shareMochi();
    }

    function _buyMochi() internal {
        IUSDM usdm = engine.usdm();
        address[] memory path = new address[](2);
        path[0] = address(usdm);
        path[1] = address(engine.mochi());
        usdm.approve(address(uniswapRouter), mochiShare);
        uniswapRouter.swapExactTokensForTokens(
            mochiShare,
            1,
            path,
            address(this),
            type(uint256).max
        );
    }

    function _shareMochi() internal {
        IMochi mochi = engine.mochi();
        uint256 mochiBalance = mochi.balanceOf(address(this));
        // send Mochi to vMochi Vault
        mochi.transfer(
            address(engine.vMochi()),
            (mochiBalance * vMochiRatio) / 1e18
        );
        // send Mochi to veCRV Holders
        mochi.transfer(
            crvVoterRewardPool,
            (mochiBalance * (1e18 - vMochiRatio)) / 1e18
        );
        // flush mochiShare
        mochiShare = 0;
        treasuryShare = 0;
    }

    function sendToTreasury() external {
        engine.usdm().transfer(engine.treasury(), treasuryShare);
        treasuryShare = 0;
    }
}
