// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from '../interfaces/IConvenience.sol';
import {IFactory} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IFactory.sol';
import {IWETH} from '../interfaces/IWETH.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IBorrow} from '../interfaces/IBorrow.sol';
import {BorrowMath} from './BorrowMath.sol';
import {Deploy} from './Deploy.sol';
import {MsgValue} from './MsgValue.sol';
import {ETH} from './ETH.sol';

library Borrow {
    using BorrowMath for IPair;
    using Deploy for IConvenience.Native;

    function borrowGivenDebt(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IBorrow.BorrowGivenDebt calldata params
    ) external returns (uint256 id, IPair.Due memory dueOut) {
        (id, dueOut) = _borrowGivenDebt(
            natives,
            convenience,
            factory,
            IBorrow._BorrowGivenDebt(
                params.asset,
                params.collateral,
                params.maturity,
                msg.sender,
                params.assetTo,
                params.dueTo,
                params.assetOut,
                params.debtIn,
                params.maxCollateral,
                params.deadline
            )
        );
    }

    function borrowGivenDebtETHAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IBorrow.BorrowGivenDebtETHAsset calldata params
    ) external returns (uint256 id, IPair.Due memory dueOut) {
        (id, dueOut) = _borrowGivenDebt(
            natives,
            convenience,
            factory,
            IBorrow._BorrowGivenDebt(
                weth,
                params.collateral,
                params.maturity,
                msg.sender,
                address(this),
                params.dueTo,
                params.assetOut,
                params.debtIn,
                params.maxCollateral,
                params.deadline
            )
        );

        weth.withdraw(params.assetOut);
        ETH.transfer(params.assetTo, params.assetOut);
    }

    function borrowGivenDebtETHCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IBorrow.BorrowGivenDebtETHCollateral calldata params
    ) external returns (uint256 id, IPair.Due memory dueOut) {
        uint112 maxCollateral = MsgValue.getUint112();

        (id, dueOut) = _borrowGivenDebt(
            natives,
            convenience,
            factory,
            IBorrow._BorrowGivenDebt(
                params.asset,
                weth,
                params.maturity,
                address(this),
                params.assetTo,
                params.dueTo,
                params.assetOut,
                params.debtIn,
                maxCollateral,
                params.deadline
            )
        );

        if (maxCollateral > dueOut.collateral) ETH.transfer(payable(msg.sender), maxCollateral - dueOut.collateral);
    }

    function borrowGivenCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IBorrow.BorrowGivenCollateral calldata params
    ) external returns (uint256 id, IPair.Due memory dueOut) {
        (id, dueOut) = _borrowGivenCollateral(
            natives,
            convenience,
            factory,
            IBorrow._BorrowGivenCollateral(
                params.asset,
                params.collateral,
                params.maturity,
                msg.sender,
                params.assetTo,
                params.dueTo,
                params.assetOut,
                params.collateralIn,
                params.maxDebt,
                params.deadline
            )
        );
    }

    function borrowGivenCollateralETHAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IBorrow.BorrowGivenCollateralETHAsset calldata params
    ) external returns (uint256 id, IPair.Due memory dueOut) {
        (id, dueOut) = _borrowGivenCollateral(
            natives,
            convenience,
            factory,
            IBorrow._BorrowGivenCollateral(
                weth,
                params.collateral,
                params.maturity,
                msg.sender,
                address(this),
                params.dueTo,
                params.assetOut,
                params.collateralIn,
                params.maxDebt,
                params.deadline
            )
        );

        weth.withdraw(params.assetOut);
        ETH.transfer(payable(params.assetTo), params.assetOut);
    }

    function borrowGivenCollateralETHCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IBorrow.BorrowGivenCollateralETHCollateral calldata params
    ) external returns (uint256 id, IPair.Due memory dueOut) {
        uint112 collateralIn = MsgValue.getUint112();

        (id, dueOut) = _borrowGivenCollateral(
            natives,
            convenience,
            factory,
            IBorrow._BorrowGivenCollateral(
                params.asset,
                weth,
                params.maturity,
                address(this),
                params.assetTo,
                params.dueTo,
                params.assetOut,
                collateralIn,
                params.maxDebt,
                params.deadline
            )
        );

        if (collateralIn > dueOut.collateral) ETH.transfer(payable(msg.sender), collateralIn - dueOut.collateral);
    }

    function borrowGivenPercent(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IBorrow.BorrowGivenPercent calldata params
    ) external returns (uint256 id, IPair.Due memory dueOut) {
        (id, dueOut) = _borrowGivenPercent(
            natives,
            convenience,
            factory,
            IBorrow._BorrowGivenPercent(
                params.asset,
                params.collateral,
                params.maturity,
                msg.sender,
                params.assetTo,
                params.dueTo,
                params.assetOut,
                params.percent,
                params.maxDebt,
                params.maxCollateral,
                params.deadline
            )
        );
    }

    function borrowGivenPercentETHAsset(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IBorrow.BorrowGivenPercentETHAsset calldata params
    ) external returns (uint256 id, IPair.Due memory dueOut) {
        (id, dueOut) = _borrowGivenPercent(
            natives,
            convenience,
            factory,
            IBorrow._BorrowGivenPercent(
                weth,
                params.collateral,
                params.maturity,
                msg.sender,
                address(this),
                params.dueTo,
                params.assetOut,
                params.percent,
                params.maxDebt,
                params.maxCollateral,
                params.deadline
            )
        );

        weth.withdraw(params.assetOut);
        ETH.transfer(params.assetTo, params.assetOut);
    }

    function borrowGivenPercentETHCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IWETH weth,
        IBorrow.BorrowGivenPercentETHCollateral calldata params
    ) external returns (uint256 id, IPair.Due memory dueOut) {
        uint112 maxCollateral = MsgValue.getUint112();

        (id, dueOut) = _borrowGivenPercent(
            natives,
            convenience,
            factory,
            IBorrow._BorrowGivenPercent(
                params.asset,
                weth,
                params.maturity,
                address(this),
                params.assetTo,
                params.dueTo,
                params.assetOut,
                params.percent,
                params.maxDebt,
                maxCollateral,
                params.deadline
            )
        );

        if (maxCollateral > dueOut.collateral) ETH.transfer(payable(msg.sender), maxCollateral - dueOut.collateral);
    }

    function _borrowGivenDebt(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IBorrow._BorrowGivenDebt memory params
    ) private returns (uint256 id, IPair.Due memory dueOut) {
        require(params.debtIn > params.assetOut, 'E518');

        IPair pair = factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');

        (uint112 yIncrease, uint112 zIncrease) = pair.givenDebt(params.maturity, params.assetOut, params.debtIn);

        (id, dueOut) = _borrow(
            natives,
            convenience,
            pair,
            IBorrow._Borrow(
                params.asset,
                params.collateral,
                params.maturity,
                params.from,
                params.assetTo,
                params.dueTo,
                params.assetOut,
                yIncrease,
                zIncrease,
                params.deadline
            )
        );

        require(dueOut.collateral <= params.maxCollateral, 'E513');
    }

    function _borrowGivenCollateral(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IBorrow._BorrowGivenCollateral memory params
    ) private returns (uint256 id, IPair.Due memory dueOut) {
        IPair pair = factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');

        (uint112 yIncrease, uint112 zIncrease) = pair.givenCollateral(
            params.maturity,
            params.assetOut,
            params.collateralIn
        );

        (id, dueOut) = _borrow(
            natives,
            convenience,
            pair,
            IBorrow._Borrow(
                params.asset,
                params.collateral,
                params.maturity,
                params.from,
                params.assetTo,
                params.dueTo,
                params.assetOut,
                yIncrease,
                zIncrease,
                params.deadline
            )
        );

        require(dueOut.debt <= params.maxDebt, 'E512');
    }

    function _borrowGivenPercent(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IFactory factory,
        IBorrow._BorrowGivenPercent memory params
    ) private returns (uint256 id, IPair.Due memory dueOut) {
        require(params.percent <= 0x100000000, 'E505');

        IPair pair = factory.getPair(params.asset, params.collateral);
        require(address(pair) != address(0), 'E501');

        (uint112 yIncrease, uint112 zIncrease) = pair.givenPercent(params.maturity, params.assetOut, params.percent);

        (id, dueOut) = _borrow(
            natives,
            convenience,
            pair,
            IBorrow._Borrow(
                params.asset,
                params.collateral,
                params.maturity,
                params.from,
                params.assetTo,
                params.dueTo,
                params.assetOut,
                yIncrease,
                zIncrease,
                params.deadline
            )
        );

        require(dueOut.debt <= params.maxDebt, 'E512');
        require(dueOut.collateral <= params.maxCollateral, 'E513');
    }

    function _borrow(
        mapping(IERC20 => mapping(IERC20 => mapping(uint256 => IConvenience.Native))) storage natives,
        IConvenience convenience,
        IPair pair,
        IBorrow._Borrow memory params
    ) private returns (uint256 id, IPair.Due memory dueOut) {
        require(params.deadline >= block.timestamp, 'E504');
        require(params.maturity > block.timestamp, 'E508');

        IConvenience.Native storage native = natives[params.asset][params.collateral][params.maturity];
        if (address(native.liquidity) == address(0))
            native.deploy(convenience, pair, params.asset, params.collateral, params.maturity);

        (id, dueOut) = pair.borrow(
            params.maturity,
            params.assetTo,
            address(native.collateralizedDebt),
            params.xDecrease,
            params.yIncrease,
            params.zIncrease,
            bytes(abi.encode(params.asset, params.collateral, params.from))
        );

        native.collateralizedDebt.mint(params.dueTo, id);
    }
}
