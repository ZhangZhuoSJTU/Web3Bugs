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

import { IPerpV2LeverageModuleV2 } from "./IPerpV2LeverageModuleV2.sol";
import { ISetToken } from "./ISetToken.sol";

/**
 * @title IPerpV2BasisTradingModule
 * @author Set Protocol
 *
 * Interface for the PerpV2BasisTradingModule. Only specifies Manager permissioned functions, events
 * and getters. PerpV2BasisTradingModule also inherits from ModuleBaseV2 and SetTokenAccessible which support
 * additional methods.
 */
interface IPerpV2BasisTradingModule is IPerpV2LeverageModuleV2 {

    /* ============ Structs ============ */

    struct FeeState {
        address feeRecipient;                     // Address to accrue fees to
        uint256 maxPerformanceFeePercentage;      // Max performance fee manager commits to using (1% = 1e16, 100% = 1e18)
        uint256 performanceFeePercentage;         // Performance fees accrued to manager (1% = 1e16, 100% = 1e18)
    }

    /* ============ Events ============ */

    /**
     * @dev Emitted on performance fee update
     * @param _setToken             Instance of SetToken
     * @param _newPerformanceFee    New performance fee percentage (1% = 1e16)
     */
    event PerformanceFeeUpdated(ISetToken indexed _setToken, uint256 _newPerformanceFee);

    /**
     * @dev Emitted on fee recipient update
     * @param _setToken             Instance of SetToken
     * @param _newFeeRecipient      New performance fee recipient
     */
    event FeeRecipientUpdated(ISetToken indexed _setToken, address _newFeeRecipient);

    /**
     * @dev Emitted on funding withdraw
     * @param _setToken             Instance of SetToken
     * @param _collateralToken      Token being withdrawn as funding (USDC)
     * @param _amountWithdrawn      Amount of funding being withdrawn from Perp (USDC)
     * @param _managerFee           Amount of performance fee accrued to manager (USDC)
     * @param _protocolFee          Amount of performance fee accrued to protocol (USDC)
     */
    event FundingWithdrawn(
        ISetToken indexed  _setToken,
        IERC20 _collateralToken,
        uint256 _amountWithdrawn,
        uint256 _managerFee,
        uint256 _protocolFee
    );

    /* ============ State Variable Getters ============ */

    // Mapping to store fee settings for each SetToken
    function feeSettings(ISetToken _setToken) external view returns(FeeState memory);

    // Mapping to store funding that has been settled on Perpetual Protocol due to actions via this module
    // and hasn't been withdrawn for reinvesting yet. Values are stored in precise units (10e18).
    function settledFunding(ISetToken _settledFunding) external view returns (uint256);

    /* ============ External Functions ============ */

    /**
     * @dev MANAGER ONLY: Initializes this module to the SetToken and sets fee settings. Either the SetToken needs to
     * be on the allowed list or anySetAllowed needs to be true.
     *
     * @param _setToken             Instance of the SetToken to initialize
     */
    function initialize(
        ISetToken _setToken,
        FeeState memory _settings
    )
        external;

    /**
     * @dev MANAGER ONLY: Similar to PerpV2LeverageModuleV2#trade. Allows manager to buy or sell perps to change exposure
     * to the underlying baseToken. Any pending funding that would be settled during opening a position on Perpetual
     * protocol is added to (or subtracted from) `settledFunding[_setToken]` and can be withdrawn later using
     * `withdrawFundingAndAccrueFees` by the SetToken manager.
     * NOTE: Calling a `nonReentrant` function from another `nonReentrant` function is not supported. Hence, we can't
     * add the `nonReentrant` modifier here because `PerpV2LeverageModuleV2#trade` function has a reentrancy check.
     * NOTE: This method doesn't update the externalPositionUnit because it is a function of UniswapV3 virtual
     * token market prices and needs to be generated on the fly to be meaningful.
     *
     * @param _setToken                     Instance of the SetToken
     * @param _baseToken                    Address virtual token being traded
     * @param _baseQuantityUnits            Quantity of virtual token to trade in position units
     * @param _quoteBoundQuantityUnits      Max/min of vQuote asset to pay/receive when buying or selling
     */
    function tradeAndTrackFunding(
        ISetToken _setToken,
        address _baseToken,
        int256 _baseQuantityUnits,
        uint256 _quoteBoundQuantityUnits
    )
        external;

    /**
     * @dev MANAGER ONLY: Withdraws tracked settled funding (in USDC) from the PerpV2 Vault to a default position
     * on the SetToken. Collects manager and protocol performance fees on the withdrawn amount.
     * This method is useful when withdrawing funding to be reinvested into the Basis Trading product.
     *
     * NOTE: Within PerpV2, `withdraw` settles `owedRealizedPnl` and any pending funding payments
     * to the Perp vault prior to transfer.
     *
     * @param _setToken                 Instance of the SetToken
     * @param _notionalFunding          Notional amount of funding to withdraw (in USDC decimals)
     */
    function withdrawFundingAndAccrueFees(
        ISetToken _setToken,
        uint256 _notionalFunding
    )
        external;

    /* ============ External Setter Functions ============ */

    /**
     * @dev MANAGER ONLY. Update performance fee percentage.
     *
     * @param _setToken         Instance of SetToken
     * @param _newFee           New performance fee percentage in precise units (1e16 = 1%)
     */
    function updatePerformanceFee(
        ISetToken _setToken,
        uint256 _newFee
    )
        external;

    /**
     * @dev MANAGER ONLY. Update performance fee recipient (address to which performance fees are sent).
     *
     * @param _setToken             Instance of SetToken
     * @param _newFeeRecipient      Address of new fee recipient
     */
    function updateFeeRecipient(ISetToken _setToken, address _newFeeRecipient)
        external;

    /* ============ External Getter Functions ============ */

    /**
     * @dev Adds pending funding payment to tracked settled funding. Returns updated settled funding value in precise units (10e18).
     *
     * NOTE: Tracked settled funding value can not be less than zero, hence it is reset to zero if pending funding
     * payment is negative and |pending funding payment| >= |settledFunding[_setToken]|.
     *
     * NOTE: Returned updated settled funding value is correct only for the current block since pending funding payment
     * updates every block.
     *
     * @param _setToken             Instance of SetToken
     */
    function getUpdatedSettledFunding(ISetToken _setToken) external view returns (uint256);
}