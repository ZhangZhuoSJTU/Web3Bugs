// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from '../interfaces/IConvenience.sol';
import {IFactory} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IFactory.sol';
import {IWETH} from '../interfaces/IWETH.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IBurn} from '../interfaces/IBurn.sol';
import {ETH} from './ETH.sol';

library Burn {
    function removeLiquidity(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IFactory factory,
        IBurn.RemoveLiquidity calldata params
    ) external returns (uint256 assetOut, uint128 collateralOut) {
        (assetOut, collateralOut) = _removeLiquidity(
            natives,
            IBurn._RemoveLiquidity(
                factory,
                params.asset,
                params.collateral,
                params.maturity,
                params.assetTo,
                params.collateralTo,
                params.liquidityIn
            )
        );
    }

    function removeLiquidityETHAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IFactory factory,
        IWETH weth,
        IBurn.RemoveLiquidityETHAsset calldata params
    ) external returns (uint256 assetOut, uint128 collateralOut) {
        (assetOut, collateralOut) = _removeLiquidity(
            natives,
            IBurn._RemoveLiquidity(
                factory,
                weth,
                params.collateral,
                params.maturity,
                address(this),
                params.collateralTo,
                params.liquidityIn
            )
        );

        if (assetOut != 0) {
            weth.withdraw(assetOut);
            ETH.transfer(params.assetTo, assetOut);
        }
    }

    function removeLiquidityETHCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IFactory factory,
        IWETH weth,
        IBurn.RemoveLiquidityETHCollateral calldata params
    ) external returns (uint256 assetOut, uint128 collateralOut) {
        (assetOut, collateralOut) = _removeLiquidity(
            natives,
            IBurn._RemoveLiquidity(
                factory,
                params.asset,
                weth,
                params.maturity,
                params.assetTo,
                address(this),
                params.liquidityIn
            )
        );

        if (collateralOut != 0) {
            weth.withdraw(collateralOut);
            ETH.transfer(params.collateralTo, collateralOut);
        }
    }

    function _removeLiquidity(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IBurn._RemoveLiquidity memory params
    ) private returns (uint256 assetOut, uint128 collateralOut) {
        IPair pair = params.factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');

        IConvenience.Native memory native = natives[params.asset][params.collateral][params.maturity];
        require(address(native.liquidity) != address(0), 'E502');

        (assetOut, collateralOut) = pair.burn(
            IPair.BurnParam(params.maturity, params.assetTo, params.collateralTo, params.liquidityIn)
        );

        native.liquidity.burn(msg.sender, params.liquidityIn);
    }
}
