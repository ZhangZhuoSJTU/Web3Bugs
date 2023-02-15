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
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IClearingHouse } from "../../../../interfaces/external/perp-v2/IClearingHouse.sol";
import { IVault } from "../../../../interfaces/external/perp-v2/IVault.sol";
import { IQuoter } from "../../../../interfaces/external/perp-v2/IQuoter.sol";

import { PerpV2LibraryV2 } from "../../../../protocol/integration/lib/PerpV2LibraryV2.sol";
import { ISetToken } from "../../../../interfaces/ISetToken.sol";

/**
 * @title PerpV2LibraryV2Mock
 * @author Set Protocol
 *
 * Mock for PerpV2LibraryV2 Library contract. Used for testing PerpV2LibraryV2 Library contract, as the library
 * contract can't be tested directly using ethers.js.
 */
contract PerpV2LibraryV2Mock {

    /* ============ External ============ */

    function testGetDepositCalldata(
        IVault _vault,
        IERC20 _asset,
        uint256 _amountNotional
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        return PerpV2LibraryV2.getDepositCalldata(_vault, _asset, _amountNotional);
    }

    function testInvokeDeposit(
        ISetToken _setToken,
        IVault _vault,
        IERC20 _asset,
        uint256 _amountNotional
    )
        external
    {
        return PerpV2LibraryV2.invokeDeposit(_setToken, _vault, _asset, _amountNotional);
    }

    function testGetWithdrawCalldata(
        IVault _vault,
        IERC20 _asset,
        uint256 _amountNotional
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        return PerpV2LibraryV2.getWithdrawCalldata(_vault, _asset, _amountNotional);
    }

    function testInvokeWithdraw(
        ISetToken _setToken,
        IVault _vault,
        IERC20 _asset,
        uint256 _amountNotional
    )
        external
    {
        return PerpV2LibraryV2.invokeWithdraw(_setToken, _vault, _asset, _amountNotional);
    }

    function testGetOpenPositionCalldata(
        IClearingHouse _clearingHouse,
        IClearingHouse.OpenPositionParams memory _params
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        return PerpV2LibraryV2.getOpenPositionCalldata(_clearingHouse, _params);
    }

    function testInvokeOpenPosition(
        ISetToken _setToken,
        IClearingHouse _clearingHouse,
        IClearingHouse.OpenPositionParams memory _params
    )
        external
        returns (uint256 deltaBase, uint256 deltaQuote)
    {
        return PerpV2LibraryV2.invokeOpenPosition(_setToken, _clearingHouse, _params);
    }

    function testGetSwapCalldata(
        IQuoter _quoter,
        IQuoter.SwapParams memory _params
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        return PerpV2LibraryV2.getSwapCalldata(_quoter, _params);
    }

    function testInvokeSwap(
        ISetToken _setToken,
        IQuoter _quoter,
        IQuoter.SwapParams memory _params
    )
        external
        returns (IQuoter.SwapResponse memory)
    {
        return PerpV2LibraryV2.invokeSwap(_setToken, _quoter, _params);
    }

    function testSimulateTrade(
        PerpV2LibraryV2.ActionInfo memory _actionInfo,
        IQuoter _perpQuoter
    )
        external
        returns (uint256, uint256)
    {
        return PerpV2LibraryV2.simulateTrade(_actionInfo, _perpQuoter);
    }

    function testExecuteTrade(
        PerpV2LibraryV2.ActionInfo memory _actionInfo,
        IClearingHouse _perpClearingHouse
    )
        external
        returns (uint256, uint256)
    {
        return PerpV2LibraryV2.executeTrade(_actionInfo, _perpClearingHouse);   
    }

    /* ============ Helper Functions ============ */

    function initializeModuleOnSet(ISetToken _setToken) external {
        _setToken.initializeModule();
    }
}
