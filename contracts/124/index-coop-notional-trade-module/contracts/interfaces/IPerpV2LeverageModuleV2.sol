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

import { ISetToken } from "./ISetToken.sol";
import { IDebtIssuanceModule } from "./IDebtIssuanceModule.sol";
import { IAccountBalance } from "./external/perp-v2/IAccountBalance.sol";
import { IClearingHouse } from "./external/perp-v2/IClearingHouse.sol";
import { IExchange } from "./external/perp-v2/IExchange.sol";
import { IVault } from "./external/perp-v2/IVault.sol";
import { IQuoter } from "./external/perp-v2/IQuoter.sol";
import { IMarketRegistry } from "./external/perp-v2/IMarketRegistry.sol";
import { PerpV2Positions } from "../protocol/integration/lib/PerpV2Positions.sol";

/**
 * @title IPerpV2LeverageModuleV2
 * @author Set Protocol
 *
 * Interface for the PerpV2LeverageModuleV2. Only specifies Manager permissioned functions, events
 * and getters. PerpV2LeverageModuleV2 also inherits from ModuleBase and SetTokenAccessible which support
 * additional methods.
 */
interface IPerpV2LeverageModuleV2 {

    /* ============ Structs ============ */

    // Note: when `pendingFundingPayments` is positive it will be credited to account on settlement,
    // when negative it's a debt owed that will be repaid on settlement. (PerpProtocol.Exchange returns the value
    // with the opposite meaning, e.g positively signed payments are owed by account to system).
    struct AccountInfo {
        int256 collateralBalance;       // Quantity of collateral deposited in Perp vault in 10**18 decimals
        int256 owedRealizedPnl;         // USDC quantity of profit and loss in 10**18 decimals not yet settled to vault
        int256 pendingFundingPayments;  // USDC quantity of pending funding payments in 10**18 decimals
        int256 netQuoteBalance;         // USDC quantity of net quote balance for all open positions in Perp account
    }

    /* ============ Events ============ */

    /**
     * @dev Emitted on trade
     * @param _setToken         Instance of SetToken
     * @param _baseToken        Virtual token minted by the Perp protocol
     * @param _deltaBase        Change in baseToken position size resulting from trade
     * @param _deltaQuote       Change in vUSDC position size resulting from trade
     * @param _protocolFee      Quantity in collateral decimals sent to fee recipient during lever trade
     * @param _isBuy            True when baseToken is being bought, false when being sold
     */
    event PerpTraded(
        ISetToken indexed _setToken,
        address indexed _baseToken,
        uint256 _deltaBase,
        uint256 _deltaQuote,
        uint256 _protocolFee,
        bool _isBuy
    );

    /**
     * @dev Emitted on deposit (not issue or redeem)
     * @param _setToken             Instance of SetToken
     * @param _collateralToken      Token being deposited as collateral (USDC)
     * @param _amountDeposited      Amount of collateral being deposited into Perp
     */
    event CollateralDeposited(
        ISetToken indexed _setToken,
        IERC20 _collateralToken,
        uint256 _amountDeposited
    );

    /**
     * @dev Emitted on withdraw (not issue or redeem)
     * @param _setToken             Instance of SetToken
     * @param _collateralToken      Token being withdrawn as collateral (USDC)
     * @param _amountWithdrawn      Amount of collateral being withdrawn from Perp
     */
    event CollateralWithdrawn(
        ISetToken indexed _setToken,
        IERC20 _collateralToken,
        uint256 _amountWithdrawn
    );

    /* ============ State Variable Getters ============ */

    // PerpV2 contract which provides getters for base, quote, and owedRealizedPnl balances
    function perpAccountBalance() external view returns(IAccountBalance);

    // PerpV2 contract which provides a trading API
    function perpClearingHouse() external view returns(IClearingHouse);

    // PerpV2 contract which manages trading logic. Provides getters for UniswapV3 pools and pending funding balances
    function perpExchange() external view returns(IExchange);

    // PerpV2 contract which handles deposits and withdrawals. Provides getter for collateral balances
    function perpVault() external view returns(IVault);

    // PerpV2 contract which makes it possible to simulate a trade before it occurs
    function perpQuoter() external view returns(IQuoter);

    // PerpV2 contract which provides a getter for baseToken UniswapV3 pools
    function perpMarketRegistry() external view returns(IMarketRegistry);

    // Token (USDC) used as a vault deposit, Perp currently only supports USDC as it's settlement and collateral token
    function collateralToken() external view returns(IERC20);

    // Decimals of collateral token. We set this in the constructor for later reading
    function collateralDecimals() external view returns(uint8);

    /* ============ External Functions ============ */

    /**
     * @dev MANAGER ONLY: Initializes this module to the SetToken. Either the SetToken needs to be on the
     * allowed list or anySetAllowed needs to be true.
     *
     * @param _setToken             Instance of the SetToken to initialize
     */
    function initialize(ISetToken _setToken) external;

    /**
     * @dev MANAGER ONLY: Allows manager to buy or sell perps to change exposure to the underlying baseToken.
     * Providing a positive value for `_baseQuantityUnits` buys vToken on UniswapV3 via Perp's ClearingHouse,
     * Providing a negative value sells the token. `_quoteBoundQuantityUnits` defines a min-receive-like slippage
     * bound for the amount of vUSDC quote asset the trade will either pay or receive as a result of the action.
     *
     * NOTE: This method doesn't update the externalPositionUnit because it is a function of UniswapV3 virtual
     * token market prices and needs to be generated on the fly to be meaningful.
     *
     * As a user when levering, e.g increasing the magnitude of your position, you'd trade as below
     * | ----------------------------------------------------------------------------------------------- |
     * | Type  |  Action | Goal                      | `quoteBoundQuantity`        | `baseQuantityUnits` |
     * | ----- |-------- | ------------------------- | --------------------------- | ------------------- |
     * | Long  | Buy     | pay least amt. of vQuote  | upper bound of input quote  | positive            |
     * | Short | Sell    | get most amt. of vQuote   | lower bound of output quote | negative            |
     * | ----------------------------------------------------------------------------------------------- |
     *
     * As a user when delevering, e.g decreasing the magnitude of your position, you'd trade as below
     * | ----------------------------------------------------------------------------------------------- |
     * | Type  |  Action | Goal                      | `quoteBoundQuantity`        | `baseQuantityUnits` |
     * | ----- |-------- | ------------------------- | --------------------------- | ------------------- |
     * | Long  | Sell    | get most amt. of vQuote   | upper bound of input quote  | negative            |
     * | Short | Buy     | pay least amt. of vQuote  | lower bound of output quote | positive            |
     * | ----------------------------------------------------------------------------------------------- |
     *
     * @param _setToken                     Instance of the SetToken
     * @param _baseToken                    Address virtual token being traded
     * @param _baseQuantityUnits            Quantity of virtual token to trade in position units
     * @param _quoteBoundQuantityUnits      Max/min of vQuote asset to pay/receive when buying or selling
     */
    function trade(
        ISetToken _setToken,
        address _baseToken,
        int256 _baseQuantityUnits,
        uint256 _quoteBoundQuantityUnits
    )
        external;

    /**
     * @dev MANAGER ONLY: Deposits default position collateral token into the PerpV2 Vault, increasing
     * the size of the Perp account external position. This method is useful for establishing initial
     * collateralization ratios, e.g the flow when setting up a 2X external position would be to deposit
     * 100 units of USDC and execute a lever trade for ~200 vUSDC worth of vToken with the difference
     * between these made up as automatically "issued" margin debt in the PerpV2 system.
     *
     * @param  _setToken                    Instance of the SetToken
     * @param  _collateralQuantityUnits     Quantity of collateral to deposit in position units
     */
    function deposit(ISetToken _setToken, uint256 _collateralQuantityUnits) external;


    /**
     * @dev MANAGER ONLY: Withdraws collateral token from the PerpV2 Vault to a default position on
     * the SetToken. This method is useful when adjusting the overall composition of a Set which has
     * a Perp account external position as one of several components.
     *
     * NOTE: Within PerpV2, `withdraw` settles `owedRealizedPnl` and any pending funding payments
     * to the Perp vault prior to transfer.
     *
     * @param  _setToken                    Instance of the SetToken
     * @param  _collateralQuantityUnits     Quantity of collateral to withdraw in position units
     */
    function withdraw(ISetToken _setToken, uint256 _collateralQuantityUnits) external;


    /* ============ External Getter Functions ============ */

    /**
     * @dev Gets the positive equity collateral externalPositionUnit that would be calculated for
     * issuing a quantity of SetToken, representing the amount of collateral that would need to
     * be transferred in per SetToken. Values in the returned arrays map to the same index in the
     * SetToken's components array
     *
     * @param _setToken             Instance of SetToken
     * @param _setTokenQuantity     Number of sets to issue
     *
     * @return equityAdjustments array containing a single element and an empty debtAdjustments array
     */
    function getIssuanceAdjustments(ISetToken _setToken, uint256 _setTokenQuantity)
        external
        returns (int256[] memory, int256[] memory);


    /**
     * @dev Gets the positive equity collateral externalPositionUnit that would be calculated for
     * redeeming a quantity of SetToken representing the amount of collateral returned per SetToken.
     * Values in the returned arrays map to the same index in the SetToken's components array.
     *
     * @param _setToken             Instance of SetToken
     * @param _setTokenQuantity     Number of sets to issue
     *
     * @return equityAdjustments array containing a single element and an empty debtAdjustments array
     */
    function getRedemptionAdjustments(ISetToken _setToken, uint256 _setTokenQuantity)
        external
        returns (int256[] memory, int256[] memory);

    /**
     * @dev Returns a PositionUnitNotionalInfo array representing all positions open for the SetToken.
     *
     * @param _setToken         Instance of SetToken
     *
     * @return PositionUnitInfo array, in which each element has properties:
     *
     *         + baseToken: address,
     *         + baseBalance:  baseToken balance as notional quantity (10**18)
     *         + quoteBalance: USDC quote asset balance as notional quantity (10**18)
     */
    function getPositionNotionalInfo(ISetToken _setToken) external view returns (PerpV2Positions.PositionNotionalInfo[] memory);

    /**
     * @dev Returns a PositionUnitInfo array representing all positions open for the SetToken.
     *
     * @param _setToken         Instance of SetToken
     *
     * @return PositionUnitInfo array, in which each element has properties:
     *
     *         + baseToken: address,
     *         + baseUnit:  baseToken balance as position unit (10**18)
     *         + quoteUnit: USDC quote asset balance as position unit (10**18)
     */
    function getPositionUnitInfo(ISetToken _setToken) external view returns (PerpV2Positions.PositionUnitInfo[] memory);

    /**
     * @dev Gets Perp account info for SetToken. Returns an AccountInfo struct containing account wide
     * (rather than position specific) balance info
     *
     * @param  _setToken            Instance of the SetToken
     *
     * @return accountInfo          struct with properties for:
     *
     *         + collateral balance (10**18, regardless of underlying collateral decimals)
     *         + owed realized Pnl` (10**18)
     *         + pending funding payments (10**18)
     *         + net quote balance (10**18)
     */
    function getAccountInfo(ISetToken _setToken) external view returns (AccountInfo memory accountInfo);
}