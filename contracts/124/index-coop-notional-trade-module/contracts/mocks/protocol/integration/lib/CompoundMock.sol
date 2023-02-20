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

import { ICErc20 } from "../../../../interfaces/external/ICErc20.sol";
import { IComptroller } from "../../../../interfaces/external/IComptroller.sol";
import { ISetToken } from "../../../../interfaces/ISetToken.sol";
import { Compound } from "../../../../protocol/integration/lib/Compound.sol";

contract CompoundMock {

    /* ============ External Functions ============ */

    function testGetEnterMarketsCalldata(
        ICErc20 _cToken,
        IComptroller _comptroller
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        return Compound.getEnterMarketsCalldata(_cToken, _comptroller);
    }

    function testInvokeEnterMarkets(ISetToken _setToken, ICErc20 _cToken, IComptroller _comptroller) external {
        Compound.invokeEnterMarkets(_setToken, _cToken, _comptroller);
    }

    function testGetExitMarketCalldata(
        ICErc20 _cToken,
        IComptroller _comptroller
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        return Compound.getExitMarketCalldata(_cToken, _comptroller);
    }

    function testInvokeExitMarket(ISetToken _setToken, ICErc20 _cToken, IComptroller _comptroller) external {
        Compound.invokeExitMarket(_setToken, _cToken, _comptroller);
    }

    function testGetMintCEtherCalldata(
       ICErc20 _cEther,
       uint256 _mintNotional
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        return Compound.getMintCEtherCalldata(_cEther, _mintNotional);
    }

    function testInvokeMintCEther(ISetToken _setToken, ICErc20 _cEther, uint256 _mintNotional) external {
        Compound.invokeMintCEther(_setToken, _cEther, _mintNotional);

    }

    function testGetMintCTokenCalldata(
       ICErc20 _cToken,
       uint256 _mintNotional
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        return Compound.getMintCTokenCalldata(_cToken, _mintNotional);
    }

    function testInvokeMintCToken(ISetToken _setToken, ICErc20 _cToken, uint256 _mintNotional) external {
        Compound.invokeMintCToken(_setToken, _cToken, _mintNotional);
    }

    function testGetRedeemUnderlyingCalldata(
       ICErc20 _cToken,
       uint256 _redeemNotional
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        return Compound.getRedeemUnderlyingCalldata(_cToken, _redeemNotional);
    }

    function testInvokeRedeemUnderlying(ISetToken _setToken, ICErc20 _cToken, uint256 _redeemNotional) external {
        Compound.invokeRedeemUnderlying(_setToken, _cToken, _redeemNotional);
    }

    function testGetRedeemCalldata(
       ICErc20 _cToken,
       uint256 _redeemNotional
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        return Compound.getRedeemCalldata(_cToken, _redeemNotional);
    }

    function testInvokeRedeem(ISetToken _setToken, ICErc20 _cToken, uint256 _redeemNotional) external {
        Compound.invokeRedeem(_setToken, _cToken, _redeemNotional);
    }

    function testGetRepayBorrowCEtherCalldata(
       ICErc20 _cToken,
       uint256 _repayNotional
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        return Compound.getRepayBorrowCEtherCalldata(_cToken, _repayNotional);
    }

    function testInvokeRepayBorrowCEther(ISetToken _setToken, ICErc20 _cEther, uint256 _repayNotional) external {
        Compound.invokeRepayBorrowCEther(_setToken, _cEther, _repayNotional);
    }

    function testGetRepayBorrowCTokenCalldata(
       ICErc20 _cToken,
       uint256 _repayNotional
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        return Compound.getRepayBorrowCTokenCalldata(_cToken, _repayNotional);
    }

    function testInvokeRepayBorrowCToken(ISetToken _setToken, ICErc20 _cToken, uint256 _repayNotional) external {
        Compound.invokeRepayBorrowCToken(_setToken, _cToken, _repayNotional);
    }

    function testGetBorrowCalldata(
       ICErc20 _cToken,
       uint256 _notionalBorrowQuantity
    )
        external
        pure
        returns (address, uint256, bytes memory)
    {
        return Compound.getBorrowCalldata(_cToken, _notionalBorrowQuantity);
    }

    function testInvokeBorrow(ISetToken _setToken, ICErc20 _cToken, uint256 _notionalBorrowQuantity) external {
        Compound.invokeBorrow(_setToken, _cToken, _notionalBorrowQuantity);
    }

    /* ============ Helper Functions ============ */

    function initializeModuleOnSet(ISetToken _setToken) external {
        _setToken.initializeModule();
    }
}
