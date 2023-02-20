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

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { PreciseUnitMath } from "../../../lib/PreciseUnitMath.sol";
import { IYearnVault } from "../../../interfaces/external/IYearnVault.sol";
import { IOracle } from "../../../interfaces/IOracle.sol";


/**
 * @title YearnVaultOracle
 * @author Set Protocol, Ember Fund
 *
 * Oracle built to retrieve the Yearn vault price
 */
contract YearnVaultOracle is IOracle
{
    using SafeMath for uint256;
    using PreciseUnitMath for uint256;


    /* ============ State Variables ============ */
    IYearnVault public immutable vault;
    IOracle public immutable underlyingOracle; // Underlying token oracle
    string public dataDescription;

    // Underlying Asset Full Unit
    uint256 public immutable underlyingFullUnit;

    /* ============ Constructor ============ */

    /*
     * @param  _vault               The address of Yearn Vault Token
     * @param  _underlyingOracle    The address of the underlying oracle
     * @param  _underlyingFullUnit  The full unit of the underlying asset
     * @param  _dataDescription     Human readable description of oracle
     */
    constructor(
        IYearnVault _vault,
        IOracle _underlyingOracle,
        uint256 _underlyingFullUnit,
        string memory _dataDescription
    )
        public
    {
        vault = _vault;
        underlyingFullUnit = _underlyingFullUnit;
        underlyingOracle = _underlyingOracle;
        dataDescription = _dataDescription;
    }

    /**
     * Returns the price value of a full vault token denominated in underlyingOracle value.
     * The derived price of the vault token is the price of a share multiplied divided by
     * underlying full unit and multiplied by the underlying price.
     */
    function read()
        external
        override
        view
        returns (uint256)
    {
        // Retrieve the price of the underlying
        uint256 underlyingPrice = underlyingOracle.read();

        // Price per share is the amount of the underlying asset per 1 full vaultToken
        uint256 pricePerShare = vault.pricePerShare();

        return pricePerShare.mul(underlyingPrice).div(underlyingFullUnit);
    }
}
