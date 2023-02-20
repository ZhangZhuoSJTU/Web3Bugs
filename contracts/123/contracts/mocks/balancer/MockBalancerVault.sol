// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import "./MockBalancerPoolToken.sol";
import "../../Interfaces.sol";

interface IBalancerVault {
    function joinPool(
        bytes32 poolId,
        address sender,
        address recipient,
        JoinPoolRequest memory request
    ) external payable;

    struct JoinPoolRequest {
        address[] assets;
        uint256[] maxAmountsIn;
        bytes userData;
        bool fromInternalBalance;
    }
}

contract MockBalancerVault {
    address public pool;

    address public poolToken;

    address public tokenA;

    address public tokenB;

    constructor(address _poolToken) {
        poolToken = _poolToken;
    }

    function setTokens(address _tokenA, address _tokenB) external {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    function getPool(bytes32) external view returns (address, IVault.PoolSpecialization) {
        return (poolToken, IVault.PoolSpecialization.GENERAL);
    }

    function joinPool(
        bytes32, /* poolId */
        address, /* sender */
        address recipient,
        IVault.JoinPoolRequest memory request
    ) external payable {
        uint256 amount = request.maxAmountsIn[0];
        uint256 price = MockBalancerPoolToken(poolToken).price();
        MockBalancerPoolToken(poolToken).mint(recipient, (amount * 1e18) / price);
    }

    function swap(
        IVault.SingleSwap memory singleSwap,
        IVault.FundManagement memory funds,
        uint256, /* limit */
        uint256 /* deadline */
    ) external returns (uint256 amountCalculated) {
        require(address(singleSwap.assetOut) == tokenA || address(singleSwap.assetOut) == tokenB, "!token");

        if (address(singleSwap.assetOut) == tokenA) {
            // send tokenA
            IERC20(tokenB).transferFrom(funds.sender, address(this), singleSwap.amount);
            IERC20(tokenA).transfer(funds.recipient, singleSwap.amount);
        } else if (address(singleSwap.assetOut) == tokenB) {
            // send tokenB
            IERC20(tokenA).transferFrom(funds.sender, address(this), singleSwap.amount);
            IERC20(tokenB).transfer(funds.recipient, singleSwap.amount);
        }
    }
}
