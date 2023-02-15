// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { HubbleBase } from "./legos/HubbleBase.sol";
import { IAMM, IInsuranceFund, IMarginAccount, IClearingHouse } from "./Interfaces.sol";
import { VUSD } from "./VUSD.sol";

contract ClearingHouse is IClearingHouse, HubbleBase {
    using SafeCast for uint256;
    using SafeCast for int256;

    uint256 constant PRECISION = 1e6;

    int256 override public maintenanceMargin;
    uint override public tradeFee;
    uint override public liquidationPenalty;
    int256 public minAllowableMargin;

    VUSD public vusd;
    IInsuranceFund public insuranceFund;
    IMarginAccount public marginAccount;
    IAMM[] override public amms;

    uint256[50] private __gap;

    event PositionModified(address indexed trader, uint indexed idx, int256 baseAsset, uint quoteAsset, uint256 timestamp);
    event PositionLiquidated(address indexed trader, uint indexed idx, int256 baseAsset, uint256 quoteAsset, uint256 timestamp);
    event MarketAdded(uint indexed idx, address indexed amm);

    constructor(address _trustedForwarder) HubbleBase(_trustedForwarder) {}

    function initialize(
        address _governance,
        address _insuranceFund,
        address _marginAccount,
        address _vusd,
        int256 _maintenanceMargin,
        int256 _minAllowableMargin,
        uint _tradeFee,
        uint _liquidationPenalty
    ) external initializer {
        _setGovernace(_governance);

        insuranceFund = IInsuranceFund(_insuranceFund);
        marginAccount = IMarginAccount(_marginAccount);
        vusd = VUSD(_vusd);

        require(_maintenanceMargin > 0, "_maintenanceMargin < 0");
        maintenanceMargin = _maintenanceMargin;
        minAllowableMargin = _minAllowableMargin;
        tradeFee = _tradeFee;
        liquidationPenalty = _liquidationPenalty;
    }

    /**
    * @notice Open/Modify/Close Position
    * @param idx AMM index
    * @param baseAssetQuantity Quantity of the base asset to Long (baseAssetQuantity > 0) or Short (baseAssetQuantity < 0)
    * @param quoteAssetLimit Rate at which the trade is executed in the AMM. Used to cap slippage.
    */
    function openPosition(uint idx, int256 baseAssetQuantity, uint quoteAssetLimit) override external whenNotPaused {
        _openPosition(_msgSender(), idx, baseAssetQuantity, quoteAssetLimit);
    }

    function closePosition(uint idx, uint quoteAssetLimit) override external whenNotPaused {
        address trader = _msgSender();
        (int256 size,,) = amms[idx].positions(trader);
        _openPosition(trader, idx, -size, quoteAssetLimit);
    }

    function _openPosition(address trader, uint idx, int256 baseAssetQuantity, uint quoteAssetLimit) internal {
        require(baseAssetQuantity != 0, "CH: baseAssetQuantity == 0");

        updatePositions(trader); // adjust funding payments

        (int realizedPnl, uint quoteAsset, bool isPositionIncreased) = amms[idx].openPosition(trader, baseAssetQuantity, quoteAssetLimit);
        uint _tradeFee = _chargeFeeAndRealizePnL(trader, realizedPnl, quoteAsset, false /* isLiquidation */);
        marginAccount.transferOutVusd(address(insuranceFund), _tradeFee);

        if (isPositionIncreased) {
            require(isAboveMinAllowableMargin(trader), "CH: Below Minimum Allowable Margin");
        }
        emit PositionModified(trader, idx, baseAssetQuantity, quoteAsset, _blockTimestamp());
    }

    /**
    * @notice Add liquidity to the amm. The free margin from margin account is utilized for the same
    *   The liquidity can be provided on leverage.
    * @param idx Index of the AMM
    * @param baseAssetQuantity Amount of the asset to add to AMM. Equivalent amount of USD side is automatically added.
    *   This means that user is actually adding 2 * baseAssetQuantity * markPrice.
    * @param minDToken Min amount of dTokens to receive. Used to cap slippage.
    */
    function addLiquidity(uint idx, uint256 baseAssetQuantity, uint minDToken) override external whenNotPaused {
        address maker = _msgSender();
        updatePositions(maker);
        amms[idx].addLiquidity(maker, baseAssetQuantity, minDToken);
        require(isAboveMinAllowableMargin(maker), "CH: Below Minimum Allowable Margin");
    }

    /**
    * @notice Remove liquidity from the amm.
    * @param idx Index of the AMM
    * @param dToken Measure of the liquidity to remove.
    * @param minQuoteValue Min amount of USD to remove.
    * @param minBaseValue Min amount of base to remove.
    *   Both the above params enable capping slippage in either direction.
    */
    function removeLiquidity(uint idx, uint256 dToken, uint minQuoteValue, uint minBaseValue) override external whenNotPaused {
        address maker = _msgSender();
        updatePositions(maker);
        (int256 realizedPnl,) = amms[idx].removeLiquidity(maker, dToken, minQuoteValue, minBaseValue);
        marginAccount.realizePnL(maker, realizedPnl);
    }

    function updatePositions(address trader) override public whenNotPaused {
        require(address(trader) != address(0), 'CH: 0x0 trader Address');
        int256 fundingPayment;
        for (uint i = 0; i < amms.length; i++) {
            fundingPayment += amms[i].updatePosition(trader);
        }
        // -ve fundingPayment means trader should receive funds
        marginAccount.realizePnL(trader, -fundingPayment);
    }

    function settleFunding() override external whenNotPaused {
        for (uint i = 0; i < amms.length; i++) {
            amms[i].settleFunding();
        }
    }

    /* ****************** */
    /*    Liquidations    */
    /* ****************** */

    function liquidate(address trader) override external whenNotPaused {
        updatePositions(trader);
        if (isMaker(trader)) {
            _liquidateMaker(trader);
        } else {
            _liquidateTaker(trader);
        }
    }

    function liquidateMaker(address maker) override public whenNotPaused {
        updatePositions(maker);
        _liquidateMaker(maker);
    }

    function liquidateTaker(address trader) override public whenNotPaused {
        require(!isMaker(trader), 'CH: Remove Liquidity First');
        updatePositions(trader);
        _liquidateTaker(trader);
    }

    /* ********************* */
    /* Liquidations Internal */
    /* ********************* */

    function _liquidateMaker(address maker) internal {
        require(
            _calcMarginFraction(maker, false) < maintenanceMargin,
            "CH: Above Maintenance Margin"
        );
        int256 realizedPnl;
        uint quoteAsset;
        for (uint i = 0; i < amms.length; i++) {
            (,, uint dToken,,,,) = amms[i].makers(maker);
            // @todo put checks on slippage
            (int256 _realizedPnl, uint _quote) = amms[i].removeLiquidity(maker, dToken, 0, 0);
            realizedPnl += _realizedPnl;
            quoteAsset += _quote;
        }

        _disperseLiquidationFee(
            _chargeFeeAndRealizePnL(
                maker,
                realizedPnl,
                2 * quoteAsset,  // total liquidity value = 2 * quote value
                true // isLiquidation
            )
        );
    }

    function _liquidateTaker(address trader) internal {
        require(_calcMarginFraction(trader, false /* check funding payments again */) < maintenanceMargin, "Above Maintenance Margin");
        int realizedPnl;
        uint quoteAsset;
        int256 size;
        IAMM _amm;
        for (uint i = 0; i < amms.length; i++) { // liquidate all positions
            _amm = amms[i];
            (size,,) = _amm.positions(trader);
            if (size != 0) {
                (int _realizedPnl, uint _quoteAsset) = _amm.liquidatePosition(trader);
                realizedPnl += _realizedPnl;
                quoteAsset += _quoteAsset;
                emit PositionLiquidated(trader, i, size, _quoteAsset, _blockTimestamp());
            }
        }

        _disperseLiquidationFee(
            _chargeFeeAndRealizePnL(trader, realizedPnl, quoteAsset, true /* isLiquidation */)
        );
    }

    function _disperseLiquidationFee(uint liquidationFee) internal {
        if (liquidationFee > 0) {
            uint toInsurance = liquidationFee / 2;
            marginAccount.transferOutVusd(address(insuranceFund), toInsurance);
            marginAccount.transferOutVusd(_msgSender(), liquidationFee - toInsurance);
        }
    }

    function _chargeFeeAndRealizePnL(
        address trader,
        int realizedPnl,
        uint quoteAsset,
        bool isLiquidation
    )
        internal
        returns (uint fee)
    {
        fee = isLiquidation ? _calculateLiquidationPenalty(quoteAsset) : _calculateTradeFee(quoteAsset);
        int256 marginCharge = realizedPnl - fee.toInt256();
        if (marginCharge != 0) {
            marginAccount.realizePnL(trader, marginCharge);
        }
    }

    /* ****************** */
    /*        View        */
    /* ****************** */

    function isAboveMaintenanceMargin(address trader) override external view returns(bool) {
        return getMarginFraction(trader) >= maintenanceMargin;
    }

    function isAboveMinAllowableMargin(address trader) override public view returns(bool) {
        return getMarginFraction(trader) >= minAllowableMargin;
    }

    function getMarginFraction(address trader) override public view returns(int256) {
        return _calcMarginFraction(trader, true /* includeFundingPayments */);
    }

    function isMaker(address trader) override public view returns(bool) {
        for (uint i = 0; i < amms.length; i++) {
            (,, uint dToken,,,,) = amms[i].makers(trader);
            if (dToken > 0) {
                return true;
            }
        }
        return false;
    }

    function getTotalFunding(address trader) override public view returns(int256 totalFunding) {
        int256 takerFundingPayment;
        int256 makerFundingPayment;
        for (uint i = 0; i < amms.length; i++) {
            (takerFundingPayment, makerFundingPayment,,) = amms[i].getPendingFundingPayment(trader);
            totalFunding += (takerFundingPayment + makerFundingPayment);
        }
    }

    function getTotalNotionalPositionAndUnrealizedPnl(address trader)
        override
        public
        view
        returns(uint256 notionalPosition, int256 unrealizedPnl)
    {
        uint256 _notionalPosition;
        int256 _unrealizedPnl;
        for (uint i = 0; i < amms.length; i++) {
            (_notionalPosition, _unrealizedPnl,,) = amms[i].getNotionalPositionAndUnrealizedPnl(trader);
            notionalPosition += _notionalPosition;
            unrealizedPnl += _unrealizedPnl;
        }
    }

    function getNotionalPositionAndMargin(address trader, bool includeFundingPayments)
        override
        public
        view
        returns(uint256 notionalPosition, int256 margin)
    {
        int256 unrealizedPnl;
        (notionalPosition, unrealizedPnl) = getTotalNotionalPositionAndUnrealizedPnl(trader);
        margin = marginAccount.getNormalizedMargin(trader);
        margin += unrealizedPnl;
        if (includeFundingPayments) {
            margin -= getTotalFunding(trader); // -ve fundingPayment means trader should receive funds
        }
    }

    function getAmmsLength() override external view returns(uint) {
        return amms.length;
    }

    function getAMMs() external view returns (IAMM[] memory) {
        return amms;
    }

    /* ****************** */
    /*   Internal View    */
    /* ****************** */

    function _calculateTradeFee(uint quoteAsset) internal view returns (uint) {
        return quoteAsset * tradeFee / PRECISION;
    }

    function _calculateLiquidationPenalty(uint quoteAsset) internal view returns (uint) {
        return quoteAsset * liquidationPenalty / PRECISION;
    }

    function _calcMarginFraction(address trader, bool includeFundingPayments) internal view returns(int256) {
        (uint256 notionalPosition, int256 margin) = getNotionalPositionAndMargin(trader, includeFundingPayments);
        return _getMarginFraction(margin, notionalPosition);
    }

    /* ****************** */
    /*        Pure        */
    /* ****************** */

    function _getMarginFraction(int256 accountValue, uint notionalPosition) private pure returns(int256) {
        if (notionalPosition == 0) {
            return type(int256).max;
        }
        return accountValue * PRECISION.toInt256() / notionalPosition.toInt256();
    }

    /* ****************** */
    /*     Governance     */
    /* ****************** */

    function whitelistAmm(address _amm) external onlyGovernance {
        emit MarketAdded(amms.length, _amm);
        amms.push(IAMM(_amm));
    }

    function setParams(
        int _maintenanceMargin,
        int _minAllowableMargin,
        uint _tradeFee,
        uint _liquidationPenality
    ) external onlyGovernance {
        tradeFee = _tradeFee;
        liquidationPenalty = _liquidationPenality;
        maintenanceMargin = _maintenanceMargin;
        minAllowableMargin = _minAllowableMargin;
    }
}
