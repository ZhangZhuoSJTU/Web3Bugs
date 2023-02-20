// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IPair} from '../interfaces/IPair.sol';
import {ITimeswapMintCallback} from '../interfaces/callback/ITimeswapMintCallback.sol';
import {ITimeswapLendCallback} from '../interfaces/callback/ITimeswapLendCallback.sol';
import {ITimeswapBorrowCallback} from '../interfaces/callback/ITimeswapBorrowCallback.sol';
import {ITimeswapPayCallback} from '../interfaces/callback/ITimeswapPayCallback.sol';
import {SafeBalance} from './SafeBalance.sol';
import {SafeCast} from './SafeCast.sol';

library Callback {
    using SafeBalance for IERC20;
    using SafeCast for uint256;

    function mint(
        IERC20 asset,
        IERC20 collateral,
        uint112 assetIn,
        uint112 collateralIn,
        bytes calldata data
    ) internal {
        uint256 assetReserve = asset.safeBalance();
        uint256 collateralReserve = collateral.safeBalance();
        ITimeswapMintCallback(msg.sender).timeswapMintCallback(assetIn, collateralIn, data);
        uint256 _assetReserve = asset.safeBalance();
        uint256 _collateralReserve = collateral.safeBalance();
        require(_assetReserve >= assetReserve + assetIn, 'E304');
        require(_collateralReserve >= collateralReserve + collateralIn, 'E305');
    }

    function lend(
        IERC20 asset,
        uint112 assetIn,
        bytes calldata data
    ) internal {
        uint256 assetReserve = asset.safeBalance();
        ITimeswapLendCallback(msg.sender).timeswapLendCallback(assetIn, data);
        uint256 _assetReserve = asset.safeBalance();
        require(_assetReserve >= assetReserve + assetIn, 'E304');
    }

    function borrow(
        IERC20 collateral,
        uint112 collateralIn,
        bytes calldata data
    ) internal {
        uint256 collateralReserve = collateral.safeBalance();
        ITimeswapBorrowCallback(msg.sender).timeswapBorrowCallback(collateralIn, data);
        uint256 _collateralReserve = collateral.safeBalance();
        require(_collateralReserve >= collateralReserve + collateralIn, 'E305');
    }
    
    function pay(
        IERC20 asset,
        uint128 assetIn,
        bytes calldata data
    ) internal {
        uint256 assetReserve = asset.safeBalance();
        ITimeswapPayCallback(msg.sender).timeswapPayCallback(assetIn, data);
        uint256 _assetReserve = asset.safeBalance();
        require(_assetReserve >= assetReserve + assetIn, 'E304');
    }
}
