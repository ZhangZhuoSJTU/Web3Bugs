// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from '../interfaces/IConvenience.sol';
import {IFactory} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IFactory.sol';
import {IWETH} from '../interfaces/IWETH.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IMint} from '../interfaces/IMint.sol';
import {MintMath} from './MintMath.sol';
import {Deploy} from './Deploy.sol';
import {MsgValue} from './MsgValue.sol';
import {ETH} from './ETH.sol';

library Mint {
    using MintMath for IPair;
    using Deploy for IConvenience.Native;

    function newLiquidity(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IMint.NewLiquidity calldata params
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (assetIn, liquidityOut, id, dueOut) = _newLiquidity(
            natives,
            IMint._NewLiquidity(
                convenience,
                factory,
                params.asset,
                params.collateral,
                params.maturity,
                msg.sender,
                msg.sender,
                params.liquidityTo,
                params.dueTo,
                params.assetIn,
                params.debtIn,
                params.collateralIn,
                params.deadline
            )
        );
    }

    function newLiquidityETHAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IMint.NewLiquidityETHAsset calldata params
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 assetInETH = MsgValue.getUint112();

        (assetIn, liquidityOut, id, dueOut) = _newLiquidity(
            natives,
            IMint._NewLiquidity(
                convenience,
                factory,
                weth,
                params.collateral,
                params.maturity,
                address(this),
                msg.sender,
                params.liquidityTo,
                params.dueTo,
                assetInETH,
                params.debtIn,
                params.collateralIn,
                params.deadline
            )
        );
    }

    function newLiquidityETHCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IMint.NewLiquidityETHCollateral calldata params
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 collateralIn = MsgValue.getUint112();

        (assetIn, liquidityOut, id, dueOut) = _newLiquidity(
            natives,
            IMint._NewLiquidity(
                convenience,
                factory,
                params.asset,
                weth,
                params.maturity,
                msg.sender,
                address(this),
                params.liquidityTo,
                params.dueTo,
                params.assetIn,
                params.debtIn,
                collateralIn,
                params.deadline
            )
        );
    }

    function liquidityGivenAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IMint.LiquidityGivenAsset calldata params
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (assetIn, liquidityOut, id, dueOut) = _liquidityGivenAsset(
            natives,
            IMint._LiquidityGivenAsset(
                convenience,
                factory,
                params.asset,
                params.collateral,
                params.maturity,
                msg.sender,
                msg.sender,
                params.liquidityTo,
                params.dueTo,
                params.assetIn,
                params.minLiquidity,
                params.maxDebt,
                params.maxCollateral,
                params.deadline
            )
        );
    }

    function liquidityGivenAssetETHAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IMint.LiquidityGivenAssetETHAsset calldata params
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 assetInETH = MsgValue.getUint112();

        (assetIn, liquidityOut, id, dueOut) = _liquidityGivenAsset(
            natives,
            IMint._LiquidityGivenAsset(
                convenience,
                factory,
                weth,
                params.collateral,
                params.maturity,
                address(this),
                msg.sender,
                params.liquidityTo,
                params.dueTo,
                assetInETH,
                params.minLiquidity,
                params.maxDebt,
                params.maxCollateral,
                params.deadline
            )
        );
    }

    function liquidityGivenAssetETHCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IMint.LiquidityGivenAssetETHCollateral calldata params
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 maxCollateral = MsgValue.getUint112();

        (assetIn, liquidityOut, id, dueOut) = _liquidityGivenAsset(
            natives,
            IMint._LiquidityGivenAsset(
                convenience,
                factory,
                params.asset,
                weth,
                params.maturity,
                msg.sender,
                address(this),
                params.liquidityTo,
                params.dueTo,
                params.assetIn,
                params.minLiquidity,
                params.maxDebt,
                maxCollateral,
                params.deadline
            )
        );

        if (maxCollateral > dueOut.collateral) {
            uint256 excess = maxCollateral;
            unchecked {
                excess -= dueOut.collateral;
            }
            ETH.transfer(payable(msg.sender), excess);
        }
    }

    function liquidityGivenDebt(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IMint.LiquidityGivenDebt memory params
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (assetIn, liquidityOut, id, dueOut) = _liquidityGivenDebt(
            natives,
            IMint._LiquidityGivenDebt(
                convenience,
                factory,
                params.asset,
                params.collateral,
                params.maturity,
                msg.sender,
                msg.sender,
                params.liquidityTo,
                params.dueTo,
                params.debtIn,
                params.minLiquidity,
                params.maxAsset,
                params.maxCollateral,
                params.deadline
            )
        );
    }

    function liquidityGivenDebtETHAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IMint.LiquidityGivenDebtETHAsset memory params
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 maxAsset = MsgValue.getUint112();

        (assetIn, liquidityOut, id, dueOut) = _liquidityGivenDebt(
            natives,
            IMint._LiquidityGivenDebt(
                convenience,
                factory,
                weth,
                params.collateral,
                params.maturity,
                msg.sender,
                msg.sender,
                params.liquidityTo,
                params.dueTo,
                params.debtIn,
                params.minLiquidity,
                maxAsset,
                params.maxCollateral,
                params.deadline
            )
        );

        if (maxAsset > assetIn) {
            uint256 excess = maxAsset;
            unchecked {
                excess -= assetIn;
            }
            ETH.transfer(payable(msg.sender), excess);
        }
    }

    function liquidityGivenDebtETHCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IMint.LiquidityGivenDebtETHCollateral memory params
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 maxCollateral = MsgValue.getUint112();

        (assetIn, liquidityOut, id, dueOut) = _liquidityGivenDebt(
            natives,
            IMint._LiquidityGivenDebt(
                convenience,
                factory,
                params.asset,
                weth,
                params.maturity,
                msg.sender,
                msg.sender,
                params.liquidityTo,
                params.dueTo,
                params.debtIn,
                params.minLiquidity,
                params.maxAsset,
                maxCollateral,
                params.deadline
            )
        );

        if (maxCollateral > dueOut.collateral) {
            uint256 excess = maxCollateral;
            unchecked {
                excess -= dueOut.collateral;
            }
            ETH.transfer(payable(msg.sender), excess);
        }
    }

    function liquidityGivenCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IMint.LiquidityGivenCollateral memory params
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (assetIn, liquidityOut, id, dueOut) = _liquidityGivenCollateral(
            natives,
            IMint._LiquidityGivenCollateral(
                convenience,
                factory,
                params.asset,
                params.collateral,
                params.maturity,
                msg.sender,
                msg.sender,
                params.liquidityTo,
                params.dueTo,
                params.collateralIn,
                params.minLiquidity,
                params.maxAsset,
                params.maxDebt,
                params.deadline
            )
        );
    }

    function liquidityGivenCollateralETHAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IMint.LiquidityGivenCollateralETHAsset memory params
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 maxAsset = MsgValue.getUint112();

        (assetIn, liquidityOut, id, dueOut) = _liquidityGivenCollateral(
            natives,
            IMint._LiquidityGivenCollateral(
                convenience,
                factory,
                weth,
                params.collateral,
                params.maturity,
                msg.sender,
                msg.sender,
                params.liquidityTo,
                params.dueTo,
                params.collateralIn,
                params.minLiquidity,
                maxAsset,
                params.maxDebt,
                params.deadline
            )
        );

        if (maxAsset > assetIn) {
            uint256 excess = maxAsset;
            unchecked {
                excess -= assetIn;
            }
            ETH.transfer(payable(msg.sender), excess);
        }
    }

    function liquidityGivenCollateralETHCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IMint.LiquidityGivenCollateralETHCollateral memory params
    )
        external
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 collateralIn = MsgValue.getUint112();

        (assetIn, liquidityOut, id, dueOut) = _liquidityGivenCollateral(
            natives,
            IMint._LiquidityGivenCollateral(
                convenience,
                factory,
                params.asset,
                weth,
                params.maturity,
                msg.sender,
                msg.sender,
                params.liquidityTo,
                params.dueTo,
                collateralIn,
                params.minLiquidity,
                params.maxAsset,
                params.maxDebt,
                params.deadline
            )
        );
    }

    function _newLiquidity(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IMint._NewLiquidity memory params
    )
        private
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        require(params.debtIn > params.assetIn, 'E516');
        require(params.maturity > block.timestamp, 'E508');
        IPair pair = params.factory.getPair(params.asset, params.collateral);
        if (address(pair) == address(0)) pair = params.factory.createPair(params.asset, params.collateral);

        require(pair.totalLiquidity(params.maturity) == 0, 'E506');

        (uint112 xIncrease, uint112 yIncrease, uint112 zIncrease) = MintMath.givenNew(
            params.maturity,
            params.assetIn,
            params.debtIn,
            params.collateralIn
        );

        (assetIn, liquidityOut, id, dueOut) = _mint(
            natives,
            IMint._Mint(
                params.convenience,
                pair,
                params.asset,
                params.collateral,
                params.maturity,
                params.assetFrom,
                params.collateralFrom,
                params.liquidityTo,
                params.dueTo,
                xIncrease,
                yIncrease,
                zIncrease,
                params.deadline
            )
        );
    }

    function _liquidityGivenAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IMint._LiquidityGivenAsset memory params
    )
        private
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        IPair pair = params.factory.getPair(params.asset, params.collateral);
        if(address(pair)==address(0)){pair=params.factory.createPair(params.asset,params.collateral);}
        require(pair.totalLiquidity(params.maturity) != 0, 'E507');

        (uint112 xIncrease, uint112 yIncrease, uint112 zIncrease) = pair.givenAsset(params.maturity, params.assetIn);

        (assetIn, liquidityOut, id, dueOut) = _mint(
            natives,
            IMint._Mint(
                params.convenience,
                pair,
                params.asset,
                params.collateral,
                params.maturity,
                params.assetFrom,
                params.collateralFrom,
                params.liquidityTo,
                params.dueTo,
                xIncrease,
                yIncrease,
                zIncrease,
                params.deadline
            )
        );

        require(liquidityOut >= params.minLiquidity, 'E511');
        require(dueOut.debt <= params.maxDebt, 'E512');
        require(dueOut.collateral <= params.maxCollateral, 'E513');
    }

    function _liquidityGivenDebt(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IMint._LiquidityGivenDebt memory params
    )
        private
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        IPair pair = params.factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');
        require(pair.totalLiquidity(params.maturity) != 0, 'E507');

        (uint112 xIncrease, uint112 yIncrease, uint112 zIncrease) = pair.givenDebt(params.maturity, params.debtIn);

        (assetIn, liquidityOut, id, dueOut) = _mint(
            natives,
            IMint._Mint(
                params.convenience,
                pair,
                params.asset,
                params.collateral,
                params.maturity,
                params.assetFrom,
                params.collateralFrom,
                params.liquidityTo,
                params.dueTo,
                xIncrease,
                yIncrease,
                zIncrease,
                params.deadline
            )
        );

        require(liquidityOut >= params.minLiquidity, 'E511');
        require(xIncrease <= params.maxAsset, 'E519');
        require(dueOut.collateral <= params.maxCollateral, 'E513');
    }

    function _liquidityGivenCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IMint._LiquidityGivenCollateral memory params
    )
        private
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        IPair pair = params.factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');
        require(pair.totalLiquidity(params.maturity) != 0, 'E507');

        (uint112 xIncrease, uint112 yIncrease, uint112 zIncrease) = pair.givenCollateral(
            params.maturity,
            params.collateralIn
        );
        (assetIn, liquidityOut, id, dueOut) = _mint(
            natives,
            IMint._Mint(
                params.convenience,
                pair,
                params.asset,
                params.collateral,
                params.maturity,
                params.assetFrom,
                params.collateralFrom,
                params.liquidityTo,
                params.dueTo,
                xIncrease,
                yIncrease,
                zIncrease,
                params.deadline
            )
        );
        require(liquidityOut >= params.minLiquidity, 'E511');
        require(xIncrease <= params.maxAsset, 'E519');
        require(dueOut.debt <= params.maxDebt, 'E512');
    }

    function _mint(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IMint._Mint memory params
    )
        private
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        require(params.deadline >= block.timestamp, 'E504');
        require(params.maturity > block.timestamp, 'E508');
        IConvenience.Native storage native = natives[params.asset][params.collateral][params.maturity];
        if (address(native.liquidity) == address(0))
            native.deploy(params.convenience, params.pair, params.asset, params.collateral, params.maturity);
        (assetIn, liquidityOut, id, dueOut) = params.pair.mint(
            IPair.MintParam(
                params.maturity,
                address(this),
                address(this),
                params.xIncrease,
                params.yIncrease,
                params.zIncrease,
                bytes(abi.encode(params.asset, params.collateral, params.assetFrom, params.collateralFrom))
            )
        );
        native.liquidity.mint(params.liquidityTo, liquidityOut);
        native.collateralizedDebt.mint(params.dueTo, id);
 
    }
}
