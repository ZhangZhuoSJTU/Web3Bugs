// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {BorrowMath} from '../libraries/BorrowMath.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';

contract BorrowMathCallee {
    function givenDebt(
        IPair pair,
        uint256 maturity,
        uint112 assetOut,
        uint112 debtIn
    )
        public
        view
        returns (
            uint256,
            uint112,
            uint112
        )
    {
        return BorrowMath.givenDebt(pair, maturity, assetOut, debtIn);
    }

    function givenCollateral(
        IPair pair,
        uint256 maturity,
        uint112 assetOut,
        uint112 collateralIn
    )
        public
        view
        returns (
            uint256,
            uint112,
            uint112
        )
    {
        return BorrowMath.givenCollateral(pair, maturity, assetOut, collateralIn);
    }

    function givenPercent(
        IPair pair,
        uint256 maturity,
        uint112 assetOut,
        uint40 percent
    )
        public
        view
        returns (
            uint256,
            uint112,
            uint112
        )
    {
        return BorrowMath.givenPercent(pair, maturity, assetOut, percent);
    }
}
