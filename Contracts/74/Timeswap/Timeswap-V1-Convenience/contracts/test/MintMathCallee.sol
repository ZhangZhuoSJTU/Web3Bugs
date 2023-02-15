// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {MintMath} from '../libraries/MintMath.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';

contract MintMathCallee {
    function givenNew(
        uint256 maturity,
        uint112 assetIn,
        uint112 debtIn,
        uint112 collateralIn
    ) public view returns (uint112, uint112) {
        return MintMath.givenNew(maturity, assetIn, debtIn, collateralIn);
    }

    function givenAsset(
        IPair pair,
        uint256 maturity,
        uint112 assetIn
    ) public view returns (uint112, uint112) {
        return MintMath.givenAsset(pair, maturity, assetIn);
    }

    function givenDebt(
        IPair pair,
        uint256 maturity,
        uint112 debtIn
    )
        public
        view
        returns (
            uint112,
            uint112,
            uint112
        )
    {
        return MintMath.givenDebt(pair, maturity, debtIn);
    }

    function givenCollateral(
        IPair pair,
        uint256 maturity,
        uint112 collateralIn
    )
        public
        view
        returns (
            uint112,
            uint112,
            uint112
        )
    {
        return MintMath.givenCollateral(pair, maturity, collateralIn);
    }
}
