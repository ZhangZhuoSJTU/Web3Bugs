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
import { IClearingHouse } from "../../../interfaces/external/perp-v2/IClearingHouse.sol";
import { IVault } from "../../../interfaces/external/perp-v2/IVault.sol";
import { IQuoter } from "../../../interfaces/external/perp-v2/IQuoter.sol";
import { ISetToken } from "../../../interfaces/ISetToken.sol";

/**
 * @title PerpV2
 * @author Set Protocol
 *
 * Collection of helper functions for interacting with PerpV2 integrations.
 */
library PerpV2 {

    /* ============ External ============ */

    /**
     * Gets Perp vault `deposit` calldata
     *
     * When invoked, calldata deposits an `_amountNotional` of collateral asset into the Perp Protocol vault
     *
     * @param  _vault               Perp protocol vault
     * @param  _asset               Collateral asset to deposit
     * @param  _amountNotional      Notional amount in collateral decimals to deposit
     *
     * @return address              Vault address
     * @return uint256              Call value
     * @return calldata             Deposit calldata
     */
    function getDepositCalldata(
        IVault _vault,
        IERC20 _asset,
        uint256 _amountNotional
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature(
            "deposit(address,uint256)",
            _asset,
            _amountNotional
        );

        return (address(_vault), 0, callData);
    }

    /**
     * Invoke `deposit` on Vault from SetToken
     *
     * Deposits an `_amountNotional` of collateral asset into the Perp Protocol vault
     *
     * @param _setToken             Address of the SetToken
     * @param _vault                Address of Perp Protocol vault contract
     * @param _asset                The address of the collateral asset to deposit
     * @param _amountNotional       Notional amount in collateral decimals to deposit
     */
    function invokeDeposit(
        ISetToken _setToken,
        IVault _vault,
        IERC20 _asset,
        uint256 _amountNotional
    )
        external
    {
        ( , , bytes memory depositCalldata) = getDepositCalldata(
            _vault,
            _asset,
            _amountNotional
        );

        _setToken.invoke(address(_vault), 0, depositCalldata);
    }

    /**
     * Get Perp Vault `withdraw` method calldata
     *
     * When invoked, calldata withdraws an `_amountNotional` of collateral asset from the Perp protocol vault
     *
     * @param _vault                Address of the Perp Protocol vault contract
     * @param _asset                The address of the collateral asset to withdraw
     * @param _amountNotional       The notional amount in collateral decimals to be withdrawn
     *
     * @return address              Vault contract address
     * @return uint256              Call value
     * @return bytes                Withdraw calldata
     */
    function getWithdrawCalldata(
        IVault _vault,
        IERC20 _asset,
        uint256 _amountNotional
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature(
            "withdraw(address,uint256)",
            _asset,
            _amountNotional
        );

        return (address(_vault), 0, callData);
    }

    /**
     * Invoke `withdraw` on Vault from SetToken
     *
     * Withdraws an `_amountNotional` of collateral asset from the Perp protocol vault
     *
     * @param _setToken         Address of the SetToken
     * @param _vault            Address of the Perp Protocol vault contract
     * @param _asset            The address of the collateral asset to withdraw
     * @param _amountNotional   The notional amount in collateral decimals to be withdrawn     *
     */
    function invokeWithdraw(
        ISetToken _setToken,
        IVault _vault,
        IERC20 _asset,
        uint256 _amountNotional
    )
        external
    {
        ( , , bytes memory withdrawCalldata) = getWithdrawCalldata(
            _vault,
            _asset,
            _amountNotional
        );

        _setToken.invoke(address(_vault), 0, withdrawCalldata);
    }

    /**
     * Get Perp ClearingHouse `openPosition` method calldata
     *
     * When invoked, calldata executes a trade via the Perp protocol ClearingHouse contract
     *
     * @param _clearingHouse        Address of the Clearinghouse contract
     * @param _params               OpenPositionParams struct. For details see definition
     *                              in contracts/interfaces/external/perp-v2/IClearingHouse.sol
     *
     * @return address              ClearingHouse contract address
     * @return uint256              Call value
     * @return bytes                `openPosition` calldata
     */
    function getOpenPositionCalldata(
        IClearingHouse _clearingHouse,
        IClearingHouse.OpenPositionParams memory _params
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature(
            "openPosition((address,bool,bool,uint256,uint256,uint256,uint160,bytes32))",
            _params
        );

        return (address(_clearingHouse), 0, callData);
    }

    /**
     * Invoke `openPosition` on ClearingHouse from SetToken
     *
     * Executes a trade via the Perp protocol ClearingHouse contract
     *
     * @param _setToken             Address of the SetToken
     * @param _clearingHouse        Address of the Clearinghouse contract
     * @param _params               OpenPositionParams struct. For details see definition
     *                              in contracts/interfaces/external/perp-v2/IClearingHouse.sol
     *
     * @return deltaBase            Positive or negative change in base token balance resulting from trade
     * @return deltaQuote           Positive or negative change in quote token balance resulting from trade
     */
    function invokeOpenPosition(
        ISetToken _setToken,
        IClearingHouse _clearingHouse,
        IClearingHouse.OpenPositionParams memory _params
    )
        external
        returns (uint256 deltaBase, uint256 deltaQuote)
    {
        ( , , bytes memory openPositionCalldata) = getOpenPositionCalldata(
            _clearingHouse,
            _params
        );

        bytes memory returnValue = _setToken.invoke(address(_clearingHouse), 0, openPositionCalldata);
        return abi.decode(returnValue, (uint256,uint256));
    }

    /**
     * Get Perp Quoter `swap` method calldata
     *
     * When invoked, calldata simulates a trade on the Perp exchange via the Perp periphery contract Quoter
     *
     * @param _quoter               Address of the Quoter contract
     * @param _params               SwapParams struct. For details see definition
     *                              in contracts/interfaces/external/perp-v2/IQuoter.sol
     *
     * @return address              ClearingHouse contract address
     * @return uint256              Call value
     * @return bytes                `swap` calldata
     */
    function getSwapCalldata(
        IQuoter _quoter,
        IQuoter.SwapParams memory _params
    )
        public
        pure
        returns (address, uint256, bytes memory)
    {
        bytes memory callData = abi.encodeWithSignature(
            "swap((address,bool,bool,uint256,uint160))",
            _params
        );

        return (address(_quoter), 0, callData);
    }

    /**
     * Invoke `swap` method on Perp Quoter contract
     *
     * Simulates a trade on the Perp exchange via the Perp periphery contract Quoter
     *
     * @param _setToken             Address of the SetToken
     * @param _quoter               Address of the Quoter contract
     * @param _params               SwapParams struct. For details see definition
     *                              in contracts/interfaces/external/perp-v2/IQuoter.sol
     *
     * @return swapResponse         Struct which includes deltaAvailableBase and deltaAvailableQuote
     *                              properties (equiv. to deltaQuote, deltaBase) returned from `openPostion`
     */
    function invokeSwap(
        ISetToken _setToken,
        IQuoter _quoter,
        IQuoter.SwapParams memory _params
    )
        external
        returns (IQuoter.SwapResponse memory)
    {
        ( , , bytes memory swapCalldata) = getSwapCalldata(
            _quoter,
            _params
        );

        bytes memory returnValue = _setToken.invoke(address(_quoter), 0, swapCalldata);
        return abi.decode(returnValue, (IQuoter.SwapResponse));
    }
}