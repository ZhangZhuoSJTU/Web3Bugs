/*
    Copyright 2022 Set Labs Inc.

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
pragma experimental "ABIEncoderV2";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IAccountBalance } from "../../../../interfaces/external/perp-v2/IAccountBalance.sol";
import { ISetToken } from "../../../../interfaces/ISetToken.sol";
import { PerpV2Positions } from "../../../../protocol/integration/lib/PerpV2Positions.sol";

/**
 * @title PerpV2PositionsMock
 * @author Set Protocol
 *
 * Mock for PerpV2Positions Library contract. Used for testing PerpV2Positions Library contract, as the library
 * contract can't be tested directly using ethers.js
 */
contract PerpV2PositionsMock {

    /* ============ External Functions ============ */

    function testGetNetQuoteBalance(
        ISetToken _setToken,
        address[] memory _baseTokens,
        IAccountBalance _perpAccountBalance
    ) 
        external 
        view 
        returns (int256 netQuoteBalance) 
    {
        return PerpV2Positions.getNetQuoteBalance(
            _setToken, 
            _baseTokens, 
            _perpAccountBalance
        );
    }

    function testGetPositionNotionalInfo(
        ISetToken _setToken,
        address[] memory _baseTokens,
        IAccountBalance _perpAccountBalance
    ) 
        public 
        view 
        returns (PerpV2Positions.PositionNotionalInfo[] memory) 
    {
        return PerpV2Positions.getPositionNotionalInfo(
            _setToken, 
            _baseTokens, 
            _perpAccountBalance
        );
    }
    
    function testGetPositionUnitInfo(
        ISetToken _setToken,
        address[] memory _baseTokens,
        IAccountBalance _perpAccountBalance
    ) 
        external 
        view 
        returns (PerpV2Positions.PositionUnitInfo[] memory) 
    {
        return PerpV2Positions.getPositionUnitInfo(
            _setToken, 
            _baseTokens, 
            _perpAccountBalance
        );
    }

    function testFormatAdjustments(
        ISetToken _setToken,
        address _adjustmentComponent,
        int256 _currentExternalPositionUnit,
        int256 _newExternalPositionUnit
    )
        external
        view
        returns (int256[] memory, int256[] memory)
    {
        return PerpV2Positions.formatAdjustments(
            _setToken,
            _adjustmentComponent,
            _currentExternalPositionUnit,
            _newExternalPositionUnit
        );
    }

    /* ============ Helper Functions ============ */

    function initializeModuleOnSet(ISetToken _setToken) external {
        _setToken.initializeModule();
    }
}