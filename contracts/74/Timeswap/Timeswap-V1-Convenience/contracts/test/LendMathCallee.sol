// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {LendMath} from '../libraries/LendMath.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';

contract LendMathCallee{
     function givenBond(
         IPair pair,
        uint256 maturity,
        uint112 assetIn,
        uint128 bondOut
    ) view public returns (uint112, uint112){
        return LendMath.givenBond(pair,maturity,assetIn,bondOut);
    }
     function givenInsurance(
        IPair pair,
        uint256 maturity,
        uint112 assetIn,
        uint128 insuranceOut
    ) public view returns (uint112, uint112) {
        return LendMath.givenInsurance(pair,maturity,assetIn,insuranceOut);
    }   
    function givenPercent(
        IPair pair,
        uint256 maturity,
        uint112 assetIn,
        uint40 percent
    ) public view returns (uint112,uint112){
        return LendMath.givenPercent(pair,maturity,assetIn,percent);
    }
}