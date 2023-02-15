// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../interfaces/IMochiEngine.sol";
import "../interfaces/ICurveVotingEscrow.sol";

contract MochiTreasuryV0 {
    IMochiEngine public immutable engine;

    IUniswapV2Router02 public immutable uniswapRouter;

    IERC20 public immutable crv;
    ICurveVotingEscrow public immutable veCrv;
    bool public lockCrv;
    uint256 public operationShare;
    uint256 public veCRVShare;

    constructor(
        address _engine,
        address _uniswap,
        address _crv,
        address _veCrv
    ) {
        engine = IMochiEngine(_engine);
        uniswapRouter = IUniswapV2Router02(_uniswap);
        crv = IERC20(_crv);
        veCrv = ICurveVotingEscrow(_veCrv);
        lockCrv = false;
    }

    receive() external payable {}

    function withdrawCRV() external {
        require(msg.sender == engine.governance(), "!gov");
        crv.transfer(msg.sender, crv.balanceOf(address(this)));
    }

    function withdrawLock() external {
        veCrv.withdraw();
    }

    function veCRVInitialize() external {
        require(lockCrv, "!lock");
        updateFee();
        _buyCRV();
        veCrv.create_lock(
            crv.balanceOf(address(this)),
            block.timestamp + 90 days
        );
    }

    function toggleLocking() external {
        require(msg.sender == engine.governance(), "!gov");
        lockCrv = !lockCrv;
    }

    function updateFee() public {
        uint256 updatedFee = engine.usdm().balanceOf(address(this)) -
            operationShare -
            veCRVShare;
        operationShare += updatedFee / 2;
        veCRVShare += updatedFee / 2;
    }

    function claimOperationCost() external {
        updateFee();
        engine.usdm().transfer(engine.operationWallet(), operationShare);
        operationShare = 0;
    }

    function veCRVlock() external {
        require(lockCrv, "!lock");
        updateFee();
        _buyCRV();
        _lockCRV();
        veCRVShare = 0;
    }

    function _buyCRV() internal {
        IUSDM usdm = engine.usdm();
        address[] memory path = new address[](2);
        path[0] = address(usdm);
        path[1] = address(crv);
        usdm.approve(address(uniswapRouter), veCRVShare);
        uniswapRouter.swapExactTokensForTokens(
            veCRVShare,
            1,
            path,
            address(this),
            type(uint256).max
        );
    }

    function _lockCRV() internal {
        crv.approve(address(veCrv), crv.balanceOf(address(this)));
        veCrv.increase_amount(crv.balanceOf(address(this)));
        veCrv.increase_unlock_time(block.timestamp + 90 days);
    }
}
