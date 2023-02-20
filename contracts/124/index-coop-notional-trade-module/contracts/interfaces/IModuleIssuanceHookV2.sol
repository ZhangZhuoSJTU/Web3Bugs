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

import { ISetToken } from "./ISetToken.sol";


/**
 * CHANGELOG:
 *      - Added a module level issue hook that can be used to set state ahead of component level
 *        issue hooks
 *      - Added non-view getter that returns expected positional adjustments during issue/redeem to
 *        the issuance module in order to give more accurate token flow information
 */
interface IModuleIssuanceHookV2 {

    function moduleIssueHook(ISetToken _setToken, uint256 _setTokenQuantity) external;
    function moduleRedeemHook(ISetToken _setToken, uint256 _setTokenQuantity) external;

    function componentIssueHook(
        ISetToken _setToken,
        uint256 _setTokenQuantity,
        IERC20 _component,
        bool _isEquity
    ) external;

    function componentRedeemHook(
        ISetToken _setToken,
        uint256 _setTokenQuantity,
        IERC20 _component,
        bool _isEquity
    ) external;

    /**
     * Adjustments should return the NET CHANGE in POSITION UNITS for each component in the SetToken's
     * components array (i.e. if debt is greater than current debt position unit return negative number).
     * Each entry in the returned arrays should index to the same component in the SetToken's components
     * array (called using getComponents()).
     *
     * NOTE: This getter is non-view to allow module hooks to determine units by simulating state changes in
     * an external protocol and reverting. It should only be called by off-chain methods via static call.
     */
    function getIssuanceAdjustments(
        ISetToken _setToken,
        uint256 _setTokenQuantity
    )
        external
        returns (int256[] memory, int256[] memory);

    /**
     * Adjustments should return the NET CHANGE in POSITION UNITS for each component in the SetToken's
     * components array (i.e. if debt is greater than current debt position unit return negative number).
     * Each entry in the returned arrays should index to the same component in the SetToken's components
     * array (called using getComponents()).
     *
     * NOTE: This getter is non-view to allow module hooks to determine units by simulating state changes in
     * an external protocol and reverting. It should only be called by off-chain methods via static call.
     */
    function getRedemptionAdjustments(
        ISetToken _setToken,
        uint256 _setTokenQuantity
    )
        external
        returns (int256[] memory, int256[] memory);
}