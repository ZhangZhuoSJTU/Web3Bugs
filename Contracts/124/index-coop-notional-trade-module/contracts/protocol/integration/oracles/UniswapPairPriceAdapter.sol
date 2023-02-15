/*
    Copyright 2020 Set Labs Inc.

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

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

import { AddressArrayUtils } from "../../../lib/AddressArrayUtils.sol";
import { IController } from "../../../interfaces/IController.sol";
import { IPriceOracle } from "../../../interfaces/IPriceOracle.sol";
import { IUniswapV2Pair } from "../../../interfaces/external/IUniswapV2Pair.sol";
import { UniswapV2Library } from "../../../../external/contracts/uniswap/v2/lib/UniswapV2Library.sol";
import { PreciseUnitMath } from "../../../lib/PreciseUnitMath.sol";
import { ResourceIdentifier } from "../../lib/ResourceIdentifier.sol";

contract UniswapPairPriceAdapter is Ownable {
    using AddressArrayUtils for address[];
    using SafeMath for uint256;
    using PreciseUnitMath for uint256;
    using ResourceIdentifier for IController;

    /* ============ Structs ============ */
    
    /**
     * Struct containing information for get price function
     */
    struct PoolSettings {
        address tokenOne;                   // Address of first token in reserve
        address tokenTwo;                   // Address of second token in reserve
        uint256 tokenOneBaseUnit;           // Token one base unit. E.g. ETH is 10e18, USDC is 10e6
        uint256 tokenTwoBaseUnit;           // Token two base unit.
        bool isValid;                       // Boolean that returns if Uniswap pool is allowed
    }

    /* ============ State Variables ============ */

    // Instance of the Controller contract
    IController public controller;

    // Uniswap allowed pools to settings mapping
    mapping(address => PoolSettings) public uniswapPoolsToSettings;

    // Uniswap allowed pools
    address[] public allowedUniswapPools;

    // Address of Uniswap factory
    address public uniswapFactory;

    /* ============ Constructor ============ */

    /**
     * Set state variables
     *
     * @param _controller         Instance of controller contract
     * @param _uniswapFactory     Address of Uniswap factory
     * @param _uniswapPools       Array of allowed Uniswap pools
     */
    constructor(
        IController _controller,
        address _uniswapFactory,
        IUniswapV2Pair[] memory _uniswapPools
    )
        public
    {
        controller = _controller;
        uniswapFactory = _uniswapFactory;

        // Add each of initial addresses to state
        for (uint256 i = 0; i < _uniswapPools.length; i++) {
            IUniswapV2Pair uniswapPoolToAdd = _uniswapPools[i];

            // Require pools are unique
            require(
                !uniswapPoolsToSettings[address(uniswapPoolToAdd)].isValid,
                "Uniswap pool address must be unique."
            );

            // Initialize pool settings
            PoolSettings memory poolSettings;
            poolSettings.tokenOne = uniswapPoolToAdd.token0();
            poolSettings.tokenTwo = uniswapPoolToAdd.token1();
            uint256 tokenOneDecimals = ERC20(poolSettings.tokenOne).decimals();
            poolSettings.tokenOneBaseUnit = 10 ** tokenOneDecimals;
            uint256 tokenTwoDecimals = ERC20(poolSettings.tokenTwo).decimals();
            poolSettings.tokenTwoBaseUnit = 10 ** tokenTwoDecimals;
            poolSettings.isValid = true;

            // Add to storage
            allowedUniswapPools.push(address(uniswapPoolToAdd));
            uniswapPoolsToSettings[address(uniswapPoolToAdd)] = poolSettings;
        } 
    }

    /* ============ External Functions ============ */

    /**
     * Calculate price from Uniswap. Note: must be system contract to be able to retrieve price. If both assets are
     * not Uniswap pool, return false.
     *
     * @param _assetOne         Address of first asset in pair
     * @param _assetTwo         Address of second asset in pair
     */
    function getPrice(address _assetOne, address _assetTwo) external view returns (bool, uint256) {
        require(controller.isSystemContract(msg.sender), "Must be system contract");

        bool isAllowedUniswapPoolOne = uniswapPoolsToSettings[_assetOne].isValid;
        bool isAllowedUniswapPoolTwo = uniswapPoolsToSettings[_assetTwo].isValid;

        // If assetOne and assetTwo are both not Uniswap pools, then return false
        if (!isAllowedUniswapPoolOne && !isAllowedUniswapPoolTwo) {
            return (false, 0);
        }

        IPriceOracle priceOracle = controller.getPriceOracle();
        address masterQuoteAsset = priceOracle.masterQuoteAsset();

        uint256 assetOnePriceToMaster;
        if(isAllowedUniswapPoolOne) {
            assetOnePriceToMaster = _getUniswapPrice(priceOracle, _assetOne, masterQuoteAsset);
        } else {
            assetOnePriceToMaster = priceOracle.getPrice(_assetOne, masterQuoteAsset);
        }

        uint256 assetTwoPriceToMaster;
        if(isAllowedUniswapPoolTwo) {
            assetTwoPriceToMaster = _getUniswapPrice(priceOracle, _assetTwo, masterQuoteAsset);
        } else {
            assetTwoPriceToMaster = priceOracle.getPrice(_assetTwo, masterQuoteAsset);
        }

        return (true, assetOnePriceToMaster.preciseDiv(assetTwoPriceToMaster));
    }

    function addPool(address _poolAddress) external onlyOwner {
        require (
            !uniswapPoolsToSettings[_poolAddress].isValid,
            "Uniswap pool address already added"
        );
        IUniswapV2Pair poolToken = IUniswapV2Pair(_poolAddress);

        uniswapPoolsToSettings[_poolAddress].tokenOne = poolToken.token0();
        uniswapPoolsToSettings[_poolAddress].tokenTwo = poolToken.token1();
        uint256 tokenOneDecimals = ERC20(uniswapPoolsToSettings[_poolAddress].tokenOne).decimals();
        uniswapPoolsToSettings[_poolAddress].tokenOneBaseUnit = 10 ** tokenOneDecimals;
        uint256 tokenTwoDecimals = ERC20(uniswapPoolsToSettings[_poolAddress].tokenTwo).decimals();
        uniswapPoolsToSettings[_poolAddress].tokenTwoBaseUnit = 10 ** tokenTwoDecimals;
        uniswapPoolsToSettings[_poolAddress].isValid = true;

        allowedUniswapPools.push(_poolAddress);
    }

    function removePool(address _poolAddress) external onlyOwner {
        require (
            uniswapPoolsToSettings[_poolAddress].isValid,
            "Uniswap pool address does not exist"
        );

        allowedUniswapPools = allowedUniswapPools.remove(_poolAddress);
        delete uniswapPoolsToSettings[_poolAddress];
    }

    function getAllowedUniswapPools() external view returns (address[] memory) {
        return allowedUniswapPools;
    }


    /* ============ Internal Functions ============ */

    function _getUniswapPrice(
        IPriceOracle _priceOracle,
        address _poolAddress,
        address _masterQuoteAsset
    )
        internal
        view
        returns (uint256)
    {
        PoolSettings memory poolInfo = uniswapPoolsToSettings[_poolAddress];
        IUniswapV2Pair poolToken = IUniswapV2Pair(_poolAddress);
        
        // Get prices against master quote asset. Note: if prices do not exist, function will revert
        uint256 tokenOnePriceToMaster = _priceOracle.getPrice(poolInfo.tokenOne, _masterQuoteAsset);
        uint256 tokenTwoPriceToMaster = _priceOracle.getPrice(poolInfo.tokenTwo, _masterQuoteAsset);

        // Get reserve amounts
        (
            uint256 tokenOneReserves,
            uint256 tokenTwoReserves
        ) = UniswapV2Library.getReserves(uniswapFactory, poolInfo.tokenOne, poolInfo.tokenTwo);

        uint256 normalizedTokenOneBaseUnit = tokenOneReserves.preciseDiv(poolInfo.tokenOneBaseUnit);
        uint256 normalizedTokenBaseTwoUnits = tokenTwoReserves.preciseDiv(poolInfo.tokenTwoBaseUnit);

        uint256 totalNotionalToMaster = normalizedTokenOneBaseUnit.preciseMul(tokenOnePriceToMaster).add(normalizedTokenBaseTwoUnits.preciseMul(tokenTwoPriceToMaster));
        uint256 totalSupply = poolToken.totalSupply();

        return totalNotionalToMaster.preciseDiv(totalSupply);
    }
}