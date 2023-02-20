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

import { AaveV2 } from "../../../../protocol/integration/lib/AaveV2.sol";
import { ILendingPool } from "../../../../interfaces/external/aave-v2/ILendingPool.sol";
import { ISetToken } from "../../../../interfaces/ISetToken.sol";

/**
 * @title AaveV2Mock
 * @author Set Protocol
 *
 * Mock for AaveV2 Library contract. Used for testing AaveV2 Library contract, as the library
 * contract can't be tested directly using ethers.js
 */
contract AaveV2Mock {

    /* ============ External ============ */
    
    function testGetDepositCalldata(
        ILendingPool _lendingPool,
        address _asset, 
        uint256 _amountNotional,
        address _onBehalfOf,
        uint16 _referralCode
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        return AaveV2.getDepositCalldata(_lendingPool, _asset, _amountNotional, _onBehalfOf, _referralCode);
    }
    
    function testInvokeDeposit(
        ISetToken _setToken,
        ILendingPool _lendingPool,
        address _asset,
        uint256 _amountNotional
    )
        external
    {
        return AaveV2.invokeDeposit(_setToken, _lendingPool, _asset, _amountNotional);
    }
    
    function testGetWithdrawCalldata(
        ILendingPool _lendingPool,
        address _asset, 
        uint256 _amountNotional,
        address _receiver
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        return AaveV2.getWithdrawCalldata(_lendingPool, _asset, _amountNotional, _receiver);
    }
    
    function testInvokeWithdraw(
        ISetToken _setToken,
        ILendingPool _lendingPool,
        address _asset,
        uint256 _amountNotional
    )
        external
        returns (uint256)
    {
        return AaveV2.invokeWithdraw(_setToken, _lendingPool, _asset, _amountNotional);
    }
    
    function testGetBorrowCalldata(
        ILendingPool _lendingPool,
        address _asset, 
        uint256 _amountNotional,
        uint256 _interestRateMode,
        uint16 _referralCode,
        address _onBehalfOf
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        return AaveV2.getBorrowCalldata(_lendingPool, _asset, _amountNotional, _interestRateMode, _referralCode, _onBehalfOf);
    }
    
    function testInvokeBorrow(
        ISetToken _setToken,
        ILendingPool _lendingPool,
        address _asset,
        uint256 _amountNotional,
        uint256 _interestRateMode
    )
        external
    {
        return AaveV2.invokeBorrow(_setToken, _lendingPool, _asset, _amountNotional, _interestRateMode);
    }

    function testGetRepayCalldata(
        ILendingPool _lendingPool,
        address _asset, 
        uint256 _amountNotional,
        uint256 _interestRateMode,        
        address _onBehalfOf
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        return AaveV2.getRepayCalldata(_lendingPool, _asset, _amountNotional, _interestRateMode, _onBehalfOf);
    }
    
    function testInvokeRepay(
        ISetToken _setToken,
        ILendingPool _lendingPool,
        address _asset,
        uint256 _amountNotional,
        uint256 _interestRateMode
    )
        external
        returns (uint256)
    {
        return AaveV2.invokeRepay(_setToken, _lendingPool, _asset, _amountNotional, _interestRateMode);
    }

    function testGetSetUserUseReserveAsCollateralCalldata(
        ILendingPool _lendingPool,
        address _asset,
        bool _useAsCollateral
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        return AaveV2.getSetUserUseReserveAsCollateralCalldata(_lendingPool, _asset, _useAsCollateral);
    }

    function testInvokeSetUserUseReserveAsCollateral(
        ISetToken _setToken,
        ILendingPool _lendingPool,
        address _asset,
        bool _useAsCollateral
    )
        external
    {
        return AaveV2.invokeSetUserUseReserveAsCollateral(_setToken, _lendingPool, _asset, _useAsCollateral);
    }

    function testGetSwapBorrowRateModeCalldata(
        ILendingPool _lendingPool,
        address _asset,
        uint256 _rateMode
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        return AaveV2.getSwapBorrowRateModeCalldata(_lendingPool, _asset, _rateMode);
    }

    function testInvokeSwapBorrowRateMode(
        ISetToken _setToken,
        ILendingPool _lendingPool,
        address _asset,
        uint256 _rateMode
    )
        external
    {
        return AaveV2.invokeSwapBorrowRateMode(_setToken, _lendingPool, _asset, _rateMode);
    }

    /* ============ Helper Functions ============ */

    function initializeModuleOnSet(ISetToken _setToken) external {
        _setToken.initializeModule();
    }
}