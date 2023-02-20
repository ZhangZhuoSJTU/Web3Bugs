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
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, id, dueOut) = _newLiquidity(
            natives,
            convenience,
            factory,
            IMint._NewLiquidity(
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
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 assetIn = MsgValue.getUint112();

        (liquidityOut, id, dueOut) = _newLiquidity(
            natives,
            convenience,
            factory,
            IMint._NewLiquidity(
                weth,
                params.collateral,
                params.maturity,
                address(this),
                msg.sender,
                params.liquidityTo,
                params.dueTo,
                assetIn,
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
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 collateralIn = MsgValue.getUint112();

        (liquidityOut, id, dueOut) = _newLiquidity(
            natives,
            convenience,
            factory,
            IMint._NewLiquidity(
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

    function _newLiquidity(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IMint._NewLiquidity memory params
    )
        private
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        require(params.debtIn > params.assetIn, 'E516');

        IPair pair = factory.getPair(params.asset, params.collateral);

        if (address(pair) == address(0)) pair = factory.createPair(params.asset, params.collateral);

        require(pair.totalLiquidity(params.maturity) == 0, 'E506');

        (uint112 yIncrease, uint112 zIncrease) = MintMath.givenNew(
            params.maturity,
            params.assetIn,
            params.debtIn,
            params.collateralIn
        );
        (liquidityOut, id, dueOut) = _mint(
            natives,
            convenience,
            pair,
            IMint._Mint(
                params.asset,
                params.collateral,
                params.maturity,
                params.assetFrom,
                params.collateralFrom,
                params.liquidityTo,
                params.dueTo,
                params.assetIn,
                yIncrease,
                zIncrease,
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
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, id, dueOut) = _liquidityGivenAsset(
            natives,
            convenience,
            factory,
            IMint._LiquidityGivenAsset(
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
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 assetIn = MsgValue.getUint112();

        (liquidityOut, id, dueOut) = _liquidityGivenAsset(
            natives,
            convenience,
            factory,
            IMint._LiquidityGivenAsset(
                weth,
                params.collateral,
                params.maturity,
                address(this),
                msg.sender,
                params.liquidityTo,
                params.dueTo,
                assetIn,
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
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 maxCollateral = MsgValue.getUint112();

        (liquidityOut, id, dueOut) = _liquidityGivenAsset(
            natives,
            convenience,
            factory,
            IMint._LiquidityGivenAsset(
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

        if (maxCollateral > dueOut.collateral) ETH.transfer(payable(msg.sender), maxCollateral - dueOut.collateral);
    }

    function _liquidityGivenAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IMint._LiquidityGivenAsset memory params
    )
        private
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        IPair pair = factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');
        require(pair.totalLiquidity(params.maturity) > 0, 'E507');

        (uint112 yIncrease, uint112 zIncrease) = pair.givenAsset(params.maturity, params.assetIn);

        (liquidityOut, id, dueOut) = _mint(
            natives,
            convenience,
            pair,
            IMint._Mint(
                params.asset,
                params.collateral,
                params.maturity,
                params.assetFrom,
                params.collateralFrom,
                params.liquidityTo,
                params.dueTo,
                params.assetIn,
                yIncrease,
                zIncrease,
                params.deadline
            )
        );

        require(liquidityOut >= params.minLiquidity, 'E511');
        require(dueOut.debt <= params.maxDebt, 'E512');
        require(dueOut.collateral <= params.maxCollateral, 'E513');
    }

    function liquidityGivenDebt(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IMint.LiquidityGivenDebt memory params
    )
        external
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, assetIn, id, dueOut) = _liquidityGivenDebt(
            natives,
            convenience,
            factory,
            IMint._LiquidityGivenDebt(
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
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 maxAsset = MsgValue.getUint112();

        (liquidityOut, assetIn, id, dueOut) = _liquidityGivenDebt(
            natives,
            convenience,
            factory,
            IMint._LiquidityGivenDebt(
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

        if (maxAsset > assetIn) ETH.transfer(payable(msg.sender), maxAsset - assetIn);
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
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 maxCollateral = MsgValue.getUint112();

        (liquidityOut, assetIn, id, dueOut) = _liquidityGivenDebt(
            natives,
            convenience,
            factory,
            IMint._LiquidityGivenDebt(
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

        if (maxCollateral > dueOut.collateral) ETH.transfer(payable(msg.sender), maxCollateral - dueOut.collateral);
    }

    function _liquidityGivenDebt(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IMint._LiquidityGivenDebt memory params
    )
        private
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        IPair pair = factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');
        require(pair.totalLiquidity(params.maturity) > 0, 'E507');

        (uint112 xIncrease, uint112 yIncrease, uint112 zIncrease) = pair.givenDebt(params.maturity, params.debtIn);

        assetIn = xIncrease;

        (liquidityOut, id, dueOut) = _mint(
            natives,
            convenience,
            pair,
            IMint._Mint(
                params.asset,
                params.collateral,
                params.maturity,
                params.assetFrom,
                params.collateralFrom,
                params.liquidityTo,
                params.dueTo,
                assetIn,
                yIncrease,
                zIncrease,
                params.deadline
            )
        );

        require(liquidityOut >= params.minLiquidity, 'E511');
        require(xIncrease <= params.maxAsset, 'E513');
        require(dueOut.collateral <= params.maxCollateral, 'E512');
    }

    function liquidityGivenCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IMint.LiquidityGivenCollateral memory params
    )
        external
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, assetIn, id, dueOut) = _liquidityGivenCollateral(
            natives,
            convenience,
            factory,
            IMint._LiquidityGivenCollateral(
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
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 maxAsset = MsgValue.getUint112();

        (liquidityOut, assetIn, id, dueOut) = _liquidityGivenCollateral(
            natives,
            convenience,
            factory,
            IMint._LiquidityGivenCollateral(
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

        if (maxAsset > assetIn) ETH.transfer(payable(msg.sender), maxAsset - assetIn);
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
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        uint112 collateralIn = MsgValue.getUint112();

        (liquidityOut, assetIn, id, dueOut) = _liquidityGivenCollateral(
            natives,
            convenience,
            factory,
            IMint._LiquidityGivenCollateral(
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

    function _liquidityGivenCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IMint._LiquidityGivenCollateral memory params
    )
        private
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        IPair pair = factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');
        require(pair.totalLiquidity(params.maturity) > 0, 'E507');

        (uint112 xIncrease, uint112 yIncrease, uint112 zIncrease) = pair.givenCollateral(
            params.maturity,
            params.collateralIn
        );

        assetIn = xIncrease;

        (liquidityOut, id, dueOut) = _mint(
            natives,
            convenience,
            pair,
            IMint._Mint(
                params.asset,
                params.collateral,
                params.maturity,
                params.assetFrom,
                params.collateralFrom,
                params.liquidityTo,
                params.dueTo,
                assetIn,
                yIncrease,
                zIncrease,
                params.deadline
            )
        );

        require(liquidityOut >= params.minLiquidity, 'E511');
        require(xIncrease <= params.maxAsset, 'E513');
        require(dueOut.debt <= params.maxDebt, 'E512');
    }

    function _mint(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IPair pair,
        IMint._Mint memory params
    )
        private
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        require(params.deadline >= block.timestamp, 'E504');
        require(params.maturity > block.timestamp, 'E508');

        IConvenience.Native storage native = natives[params.asset][params.collateral][params.maturity];
        if (address(native.liquidity) == address(0)) {
            native.deploy(convenience, pair, params.asset, params.collateral, params.maturity);
        }
        (liquidityOut, id, dueOut) = pair.mint(
            params.maturity,
            address(native.liquidity),
            address(native.collateralizedDebt),
            params.xIncrease,
            params.yIncrease,
            params.zIncrease,
            bytes(abi.encode(params.asset, params.collateral, params.assetFrom, params.collateralFrom))
        );
        native.liquidity.mint(params.liquidityTo, liquidityOut);
        native.collateralizedDebt.mint(params.dueTo, id);
    }
}
