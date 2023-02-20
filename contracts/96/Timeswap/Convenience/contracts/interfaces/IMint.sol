// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from './IConvenience.sol';
import {IFactory} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IFactory.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';

interface IMint {
    struct NewLiquidity {
        IERC20 asset;
        IERC20 collateral;
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint112 assetIn;
        uint112 debtIn;
        uint112 collateralIn;
        uint256 deadline;
    }

    struct NewLiquidityETHAsset {
        IERC20 collateral;
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint112 debtIn;
        uint112 collateralIn;
        uint256 deadline;
    }

    struct NewLiquidityETHCollateral {
        IERC20 asset;
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint112 assetIn;
        uint112 debtIn;
        uint256 deadline;
    }

    struct _NewLiquidity {
        IConvenience convenience;
        IFactory factory;
        IERC20 asset;
        IERC20 collateral;
        uint256 maturity;
        address assetFrom;
        address collateralFrom;
        address liquidityTo;
        address dueTo;
        uint112 assetIn;
        uint112 debtIn;
        uint112 collateralIn;
        uint256 deadline;
    }

    struct LiquidityGivenAsset {
        IERC20 asset;
        IERC20 collateral;
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint112 assetIn;
        uint256 minLiquidity;
        uint112 maxDebt;
        uint112 maxCollateral;
        uint256 deadline;
    }

    struct LiquidityGivenAssetETHAsset {
        IERC20 collateral;
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint256 minLiquidity;
        uint112 maxDebt;
        uint112 maxCollateral;
        uint256 deadline;
    }

    struct LiquidityGivenAssetETHCollateral {
        IERC20 asset;
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint112 assetIn;
        uint256 minLiquidity;
        uint112 maxDebt;
        uint256 deadline;
    }

    struct _LiquidityGivenAsset {
        IConvenience convenience;
        IFactory factory;
        IERC20 asset;
        IERC20 collateral;
        uint256 maturity;
        address assetFrom;
        address collateralFrom;
        address liquidityTo;
        address dueTo;
        uint112 assetIn;
        uint256 minLiquidity;
        uint112 maxDebt;
        uint112 maxCollateral;
        uint256 deadline;
    }

    struct LiquidityGivenDebt {
        IERC20 asset;
        IERC20 collateral;
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint112 debtIn;
        uint256 minLiquidity;
        uint112 maxAsset;
        uint112 maxCollateral;
        uint256 deadline;
    }

    struct LiquidityGivenDebtETHAsset {
        IERC20 collateral;
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint112 debtIn;
        uint256 minLiquidity;
        uint112 maxCollateral;
        uint256 deadline;
    }

    struct LiquidityGivenDebtETHCollateral {
        IERC20 asset;
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint112 debtIn;
        uint256 minLiquidity;
        uint112 maxAsset;
        uint256 deadline;
    }

    struct _LiquidityGivenDebt {
        IConvenience convenience;
        IFactory factory;
        IERC20 asset;
        IERC20 collateral;
        uint256 maturity;
        address assetFrom;
        address collateralFrom;
        address liquidityTo;
        address dueTo;
        uint112 debtIn;
        uint256 minLiquidity;
        uint112 maxAsset;
        uint112 maxCollateral;
        uint256 deadline;
    }

    struct LiquidityGivenCollateral {
        IERC20 asset;
        IERC20 collateral;
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint112 collateralIn;
        uint256 minLiquidity;
        uint112 maxAsset;
        uint112 maxDebt;
        uint256 deadline;
    }

    struct LiquidityGivenCollateralETHAsset {
        IERC20 collateral;
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint112 collateralIn;
        uint256 minLiquidity;
        uint112 maxDebt;
        uint256 deadline;
    }

    struct LiquidityGivenCollateralETHCollateral {
        IERC20 asset;
        uint256 maturity;
        address liquidityTo;
        address dueTo;
        uint256 minLiquidity;
        uint112 maxAsset;
        uint112 maxDebt;
        uint256 deadline;
    }

    struct _LiquidityGivenCollateral {
        IConvenience convenience;
        IFactory factory;
        IERC20 asset;
        IERC20 collateral;
        uint256 maturity;
        address assetFrom;
        address collateralFrom;
        address liquidityTo;
        address dueTo;
        uint112 collateralIn;
        uint256 minLiquidity;
        uint112 maxAsset;
        uint112 maxDebt;
        uint256 deadline;
    }

    struct _Mint {
        IConvenience convenience;
        IPair pair;
        IERC20 asset;
        IERC20 collateral;
        uint256 maturity;
        address assetFrom;
        address collateralFrom;
        address liquidityTo;
        address dueTo;
        uint112 xIncrease;
        uint112 yIncrease;
        uint112 zIncrease;
        uint256 deadline;
    }
}
