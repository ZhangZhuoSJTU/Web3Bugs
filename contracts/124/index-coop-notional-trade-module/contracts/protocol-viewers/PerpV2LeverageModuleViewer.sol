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
pragma experimental "ABIEncoderV2";


import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/SafeCast.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { SignedSafeMath } from "@openzeppelin/contracts/math/SignedSafeMath.sol";

import { IAccountBalance } from "../interfaces/external/perp-v2/IAccountBalance.sol";
import { IClearingHouseConfig } from "../interfaces/external/perp-v2/IClearingHouseConfig.sol";
import { IIndexPrice } from "../interfaces/external/perp-v2/IIndexPrice.sol";
import { IPerpV2LeverageModuleV2 } from "../interfaces/IPerpV2LeverageModuleV2.sol";
import { ISetToken } from "../interfaces/ISetToken.sol";
import { PerpV2Positions } from "../protocol/integration/lib/PerpV2Positions.sol";
import { PreciseUnitMath } from "../lib/PreciseUnitMath.sol";


/**
 * @title PerpV2LeverageModuleViewer
 * @author Set Protocol
 *
 * PerpV2LeverageModuleViewer enables queries of information regarding open PerpV2 positions
 * specifically for leverage ratios and issuance maximums.
 */
contract PerpV2LeverageModuleViewer {
    using SafeCast for int256;
    using SafeCast for uint256;
    using SafeMath for uint256;
    using PreciseUnitMath for uint256;
    using PreciseUnitMath for int256;
    using SignedSafeMath for int256;

    /* ============ Structs ============ */

    struct VAssetDisplayInfo {
        string symbol;                  // Symbol of vAsset
        address vAssetAddress;          // Address of vAsset
        int256 positionUnit;            // Position unit of vAsset
        uint256 indexPrice;             // Current index price of vAsset
        int256 currentLeverageRatio;    // Current leverage ratio of vAsset (using total collateral value)
    }

    /* ============ State Variables ============ */

    IPerpV2LeverageModuleV2 public immutable perpModule;              // PerpV2LeverageModule instance
    IAccountBalance public immutable perpAccountBalance;            // Perp's Account Balance contract
    IClearingHouseConfig public immutable perpClearingHouseConfig;  // PerpV2's ClearingHouseConfig contract
    ERC20 public immutable vQuoteToken;                             // Virtual Quote asset for PerpV2 (vUSDC)
    IERC20 public immutable collateralToken;                        // Address of collateral token used by Perp (USDC)

    /* ============ Constructor ============ */

    /**
     * @dev Sets passed state variable and grabs collateral asset from perpModule.
     *
     * @param _perpModule                   Address of PerpV2LeverageModule contract
     * @param _perpAccountBalance           Address of PerpV2's AccountBalance contract
     * @param _perpClearingHouseConfig      Address of PerpV2's ClearingHouseConfig contract
     * @param _vQuoteToken                  Address of virtual Quote asset for PerpV2 (vUSDC)
     */
    constructor(
        IPerpV2LeverageModuleV2 _perpModule,
        IAccountBalance _perpAccountBalance,
        IClearingHouseConfig _perpClearingHouseConfig,
        ERC20 _vQuoteToken
    ) public {
        perpModule = _perpModule;
        perpAccountBalance = _perpAccountBalance;
        perpClearingHouseConfig = _perpClearingHouseConfig;
        vQuoteToken = _vQuoteToken;
        collateralToken = _perpModule.collateralToken();
    }

    /* ============ External View Functions ============ */

    /**
     * @dev Returns the maximum amount of Sets that can be issued. Because upon issuance we lever up the Set
     * before depositing collateral there is a ceiling on the amount of Sets that can be issued before the max
     * leverage ratio is met. In order to accurately predict this amount the user must pass in an expected
     * slippage amount, this amount should be calculated relative to Index price(s) of vAssets held by the Set,
     * not the mid-market prices. The formulas used here are based on the "conservative" definition of free
     * collateral as defined in PerpV2's docs: freeCollateral = min(totalCollateral, accountValue) - totalDebt * initialMarginRatio
     *
     * We want to find the point where freeCollateral = 0 after all trades have been executed.
     * freeCollateral = 0 => totalDebt = min(totalCollateral, accountValue) / initialMarginRatio
     * and, availableDebt = totalDebt - currentDebt
     *
     * Now, accountValue = totalCollateral + unrealizedPnl
     * if unrealizedPnl >=0:
     *     min(totalCollateral, accountValue) = totalCollateral
     *     availableDebt = (totalCollateral / imRatio) - currentDebt
     * if unrealizedPnl < 0:
     *     min(totalCollateral, accountValue) = accountValue
     *     availableDebt = ((totalCollateral + unrealizedPnl) / imRatio) - currentDebt
     *
     * We also know that any slippage gets accrued to unrealizedPnl BEFORE any new collateral is being deposited so
     * we need to account for our expected slippage accrual impact on accountValue by subtracting our expected amount
     * of slippage divided by the imRatio from the availableDebt. We can then divide the availableDebtWithSlippage by
     * the absolute value of our current position and multiply by our totalSupply to get the max issue amount.
     *
     * @param _setToken             Instance of SetToken
     * @param _slippage             Expected slippage from entering position in precise units (1% = 10^16)
     *
     * @return                      Maximum amount of Sets that can be issued
     */
    function getMaximumSetTokenIssueAmount(ISetToken _setToken, int256 _slippage) external view returns (uint256) {
        uint256 totalAbsPositionValue = perpAccountBalance.getTotalAbsPositionValue(address(_setToken));

        if (totalAbsPositionValue == 0) { return PreciseUnitMath.maxUint256(); }

        // Scale imRatio to 10 ** 18 (preciseUnits)
        int256 imRatio = uint256(perpClearingHouseConfig.getImRatio()).mul(1e12).toInt256();

        (, int256 unrealizedPnl, ) = perpAccountBalance.getPnlAndPendingFee(address(_setToken));
        int256 totalDebtValue = perpAccountBalance.getTotalDebtValue(address(_setToken)).toInt256();

        int256 totalCollateralValue = _calculateTotalCollateralValue(_setToken);

        int256 availableDebt = unrealizedPnl >= 0
            ? totalCollateralValue.preciseDiv(imRatio).sub(totalDebtValue)
            : totalCollateralValue.add(unrealizedPnl).preciseDiv(imRatio).sub(totalDebtValue);

        int256 availableDebtWithSlippage = availableDebt.sub(availableDebt.preciseMul(_slippage).preciseDiv(imRatio));

        // max issue amount = available debt in USD (with slippage) / increase in totalDebtValue per Set issued
        //                  = (availableDebtWithSlippage / totalAbsPositionValue) * setTotalSupply
        return availableDebtWithSlippage.toUint256().preciseDiv(totalAbsPositionValue).preciseMul(_setToken.totalSupply());
    }

    /**
     * @dev Returns the position unit for total collateral value as defined by Perpetual Protocol. TCV = collateral + owedRealizedPnl + pendingFunding.
     *
     * @param _setToken             Instance of SetToken
     *
     * @return                      Collateral token address
     * @return                      Total collateral value position unit
     */
    function getTotalCollateralUnit(ISetToken _setToken) external view returns (IERC20, int256) {
        int256 setTotalSupply = _setToken.totalSupply().toInt256();
        return (collateralToken, _calculateTotalCollateralValue(_setToken).preciseDiv(setTotalSupply));
    }

    /**
     * @dev Returns relevant data for displaying current positions. Identifying info for each position plus current
     * size, index price, and leverage of each vAsset with an open position is returned. The sum quantity of vUSDC
     * is returned along with identifying info in last index of array.
     *
     * @param _setToken             Instance of SetToken
     *
     * @return assetInfo            Array of info concerning size and leverage of current vAsset positions
     */
    function getVirtualAssetsDisplayInfo(
        ISetToken _setToken
    )
        external
        view
        returns (VAssetDisplayInfo[] memory assetInfo)
    {
        uint256 setTotalSupply = _setToken.totalSupply();
        PerpV2Positions.PositionNotionalInfo[] memory positionInfo = perpModule.getPositionNotionalInfo(_setToken);

        int256 totalCollateralValue = _calculateTotalCollateralValue(_setToken);

        uint256 positionsLength = positionInfo.length;
        assetInfo = new VAssetDisplayInfo[](positionsLength.add(1));

        int256 vQuoteBalance;
        for (uint256 i = 0; i < positionsLength; i++) {
            PerpV2Positions.PositionNotionalInfo memory position = positionInfo[i];
            uint256 indexPrice = IIndexPrice(position.baseToken).getIndexPrice(0);
            assetInfo[i] = VAssetDisplayInfo({
                symbol: ERC20(position.baseToken).symbol(),
                vAssetAddress: position.baseToken,
                positionUnit: position.baseBalance.preciseDiv(setTotalSupply.toInt256()),
                indexPrice: indexPrice,
                currentLeverageRatio: _calculateCurrentLeverageRatio(position, indexPrice, totalCollateralValue)
            });

            vQuoteBalance = vQuoteBalance.add(position.quoteBalance);
        }

        assetInfo[positionsLength] = VAssetDisplayInfo({
            symbol: vQuoteToken.symbol(),
            vAssetAddress: address(vQuoteToken),
            positionUnit: vQuoteBalance.preciseDiv(setTotalSupply.toInt256()),
            indexPrice: PreciseUnitMath.preciseUnit(),
            currentLeverageRatio: 0
        });
    }

    /* ============ Internal Functions ============ */

    /**
     * @dev Returns total collateral value attributed to SetToken. TCV = collateral + owedRealizedPnl + funding.
     *
     * @param _setToken         Instance of SetToken
     *
     * @return                  Total collateral value attributed to SetToken
     */
    function _calculateTotalCollateralValue(ISetToken _setToken) internal view returns (int256) {
        IPerpV2LeverageModuleV2.AccountInfo memory accountInfo = perpModule.getAccountInfo(_setToken);

        return accountInfo.collateralBalance
            .add(accountInfo.owedRealizedPnl)
            .add(accountInfo.pendingFundingPayments);
    }

    /**
     * @dev Returns leverage of passed position relative total collateral value of Set. Leverage ratio is defined as follows:
     * lr_asset = positionValue / accountValue where,
     * positionValue = indexPrice_asset * notionalBaseTokenAmount_asset and
     * accountValue = collateral + owedRealizedPnl + funding + positionValue_asset + quoteBalance_asset
     *
     * @param _position                 Struct containing position info for the vAsset
     * @param _indexPrice               Index price of vAsset
     * @param _totalCollateralValue     Value of total collateral attributed to SetToken
     *
     * @return                          Leverage ratio of vAsset relative to current total collateral
     */
    function _calculateCurrentLeverageRatio(
        PerpV2Positions.PositionNotionalInfo memory _position,
        uint256 _indexPrice,
        int256 _totalCollateralValue
    )
        internal
        pure
        returns (int256)
    {
        int256 positionValue = _indexPrice.toInt256().preciseMul(_position.baseBalance);
        int256 accountValue = positionValue.add(_totalCollateralValue).add(_position.quoteBalance);
        return positionValue.preciseDiv(accountValue);
    }
}