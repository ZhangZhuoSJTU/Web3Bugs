// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {CallbackTest} from './CallbackTest.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ITimeswapBorrowCallback} from '../../interfaces/callback/ITimeswapBorrowCallback.sol';
import {ITimeswapLendCallback} from '../../interfaces/callback/ITimeswapLendCallback.sol';
import {ITimeswapMintCallback} from '../../interfaces/callback/ITimeswapMintCallback.sol';
import {ITimeswapPayCallback} from '../../interfaces/callback/ITimeswapPayCallback.sol';

contract CallbackTestCallee {
    CallbackTest public immutable callbackTestContract;

    constructor(address callbackTest) {
        callbackTestContract = CallbackTest(callbackTest);
    }

    function mint(
        IERC20 asset,
        IERC20 collateral,
        uint112 assetIn,
        uint112 collateralIn,
        bytes calldata data
    ) external returns (bool) {
        callbackTestContract.mint(
            asset,
            collateral,
            assetIn,
            collateralIn,
            data
        );
        return true;
    }

    function lend(
        IERC20 asset,
        uint112 assetIn,
        bytes calldata data
    ) external returns (bool) {
        callbackTestContract.lend(
            asset,
            assetIn,
            data
        );
        return true;
    }

    function borrow(
        IERC20 collateral,
        uint112 collateralIn,
        bytes calldata data
    ) external returns (bool) {
        callbackTestContract.borrow(
            collateral,
            collateralIn,
            data
        );
        return true;
    }

    function pay(
        IERC20 asset,
        uint128 assetIn,
        bytes calldata data
    ) external returns (bool) {
        callbackTestContract.pay(
            asset,
            assetIn,
            data
        );
        return true;
    }
    
    function timeswapMintCallback(
        uint112 assetIn,
        uint112 collateralIn,
        bytes calldata data
    ) external {}

    function timeswapLendCallback(
        uint112 assetIn,
        bytes calldata data
    ) external {}

    function timeswapBorrowCallback(
        uint112 collateralIn,
        bytes calldata data
    ) external {}

    function timeswapPayCallback(
        uint128 assetIn,
        bytes calldata data
    ) external {}
}