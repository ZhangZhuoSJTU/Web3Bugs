// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {Callback} from '../../libraries/Callback.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract CallbackTest {
    function mint(
        IERC20 asset,
        IERC20 collateral,
        uint112 assetIn,
        uint112 collateralIn,
        bytes calldata data
    ) external {
        Callback.mint(
            asset,
            collateral,
            assetIn,
            collateralIn,
            data
        );
    }

    function lend(
        IERC20 asset,
        uint112 assetIn,
        bytes calldata data
    ) external {
        Callback.lend(
            asset,
            assetIn,
            data
        );
    }

    function borrow(
        IERC20 collateral,
        uint112 collateralIn,
        bytes calldata data
    ) external {
        Callback.borrow(
            collateral,
            collateralIn,
            data
        );
    }

    function pay(
        IERC20 asset,
        uint128 assetIn,
        bytes calldata data
    ) external {
        Callback.pay(
            asset,
            assetIn,
            data
        );
    }
}