/*
    Copyright 2021 Set Labs Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

    SPDX-License-Identifier: Apache License, Version 2.0
*/

pragma solidity 0.6.10;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { ISetToken } from "../../interfaces/ISetToken.sol";
import { PreciseUnitMath } from "../../lib/PreciseUnitMath.sol";

/**
 * @title IssuanceValidationUtils
 * @author Set Protocol
 *
 * A collection of utility functions to help during issuance/redemption of SetToken.
 */
library IssuanceValidationUtils {
    using SafeMath for uint256;
    using SafeCast for int256;
    using PreciseUnitMath for uint256;

    /**
     * Validates component transfer IN to SetToken during issuance/redemption. Reverts if Set is undercollateralized post transfer.
     * NOTE: Call this function immediately after transfer IN but before calling external hooks (if any).
     *
     * @param _setToken             Instance of the SetToken being issued/redeemed
     * @param _component            Address of component being transferred in/out
     * @param _initialSetSupply     Initial SetToken supply before issuance/redemption
     * @param _componentQuantity    Amount of component transferred into SetToken
     */
    function validateCollateralizationPostTransferInPreHook(
        ISetToken _setToken, 
        address _component, 
        uint256 _initialSetSupply,
        uint256 _componentQuantity
    )
        internal
        view
    {
        uint256 newComponentBalance = IERC20(_component).balanceOf(address(_setToken));

        uint256 defaultPositionUnit = _setToken.getDefaultPositionRealUnit(address(_component)).toUint256();
        
        require(
            // Use preciseMulCeil to increase the lower bound and maintain over-collateralization
            newComponentBalance >= _initialSetSupply.preciseMulCeil(defaultPositionUnit).add(_componentQuantity),
            "Invalid transfer in. Results in undercollateralization"
        );
    }

    /**
     * Validates component transfer OUT of SetToken during issuance/redemption. Reverts if Set is undercollateralized post transfer.
     *
     * @param _setToken         Instance of the SetToken being issued/redeemed
     * @param _component        Address of component being transferred in/out
     * @param _finalSetSupply   Final SetToken supply after issuance/redemption
     */
    function validateCollateralizationPostTransferOut(
        ISetToken _setToken, 
        address _component, 
        uint256 _finalSetSupply
    )
        internal 
        view 
    {
        uint256 newComponentBalance = IERC20(_component).balanceOf(address(_setToken));

        uint256 defaultPositionUnit = _setToken.getDefaultPositionRealUnit(address(_component)).toUint256();

        require(
            // Use preciseMulCeil to increase lower bound and maintain over-collateralization
            newComponentBalance >= _finalSetSupply.preciseMulCeil(defaultPositionUnit),
            "Invalid transfer out. Results in undercollateralization"
        );
    }
}