// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "./FixedPoint.sol";

library Position {

    using FixedPoint for uint256;

    struct Info {
        address market; // the market for the position
        bool isLong; // whether long or short
        uint leverage; // discrete initial leverage amount
        uint pricePoint; // pricePointIndex
        uint256 oiShares; // shares of total open interest on long/short side, depending on isLong value
        uint256 debt; // total debt associated with this position
        uint256 cost; // total amount of collateral initially locked; effectively, cost to enter position
    }

    uint256 constant TWO = 2e18;

    function _initialOi (
        Info memory _self
    ) private pure returns (
        uint initialOi_
    ) {

        initialOi_ = _self.cost + _self.debt;

    }

    function _oi (
        Info memory _self,
        uint256 totalOi,
        uint256 totalOiShares
    ) private pure returns (uint256 oi_) {

        oi_ = _self.oiShares
            .mulDown(totalOi)
            .divUp(totalOiShares);

    }

    /// @dev Floors to zero, so won't properly compute if self is underwater
    function _value (
        Info memory _self,
        uint256 totalOi,
        uint256 totalOiShares,
        uint256 priceFrame
    ) private pure returns (uint256 val_) {

        uint256 __oi = _oi(_self, totalOi, totalOiShares);

        if (_self.isLong) { // oi * priceFrame - debt

            val_ = __oi.mulDown(priceFrame);
            val_ -= Math.min(val_, _self.debt); // floor to 0

        } else { // oi * (2 - priceFrame) - debt

            val_ = __oi.mulDown(2e18);
            val_ -= Math.min(val_, _self.debt + __oi.mulDown(priceFrame)); // floor to 0

        }

    }

    /// @dev is true when position value < 0
    function _isUnderwater(
        Info memory _self,
        uint256 totalOi,
        uint256 totalOiShares,
        uint256 priceFrame
    ) private pure returns (bool isUnder) {

        uint256 __oi = _oi(_self, totalOi, totalOiShares);

        bool _long = _self.isLong;

        if (_long) isUnder = __oi.mulDown(priceFrame) < _self.debt;
        else isUnder = __oi.mulDown(priceFrame) + _self.debt < ( __oi * 2 );

    }

    /// @dev Floors to _self.debt, so won't properly compute if _self is underwater
    function _notional (
        Info memory _self,
        uint256 totalOi,
        uint256 totalOiShares,
        uint256 priceFrame
    ) private pure returns (uint256 notion) {

        uint256 val = _value(
            _self,
            totalOi,
            totalOiShares,
            priceFrame
        );

        notion = val + _self.debt;

    }

    /// @dev ceils uint256.max if position value <= 0
    function _openLeverage (
        Info memory _self,
        uint256 totalOi,
        uint256 totalOiShares,
        uint256 priceFrame
    ) private pure returns (uint lev) {

        uint val = _value(
            _self,
            totalOi,
            totalOiShares,
            priceFrame
        );

        if (val != 0) {

            uint256 notion = _notional(
                _self,
                totalOi,
                totalOiShares,
                priceFrame
            );

            lev = notion.divDown(val);

        } else lev = type(uint256).max;

    }

    /// @dev floors zero if position value <= 0; equiv to 1 / open leverage
    function _openMargin (
        Info memory _self,
        uint256 totalOi,
        uint256 totalOiShares,
        uint256 priceFrame
    ) private pure returns (uint margin) {

        uint notion = _notional(
            _self,
            totalOi,
            totalOiShares,
            priceFrame
        );

        if (notion != 0) {

            uint256 val = _value(
                _self,
                totalOi,
                totalOiShares,
                priceFrame
            );

            margin = val.divDown(notion);

        } else margin = 0;

    }

    /// @dev is true when open margin < maintenance margin
    function _isLiquidatable (
        Info memory _self,
        uint256 _totalOi,
        uint256 _totalOiShares,
        uint256 _priceFrame,
        uint256 _marginMaintenance
    ) private pure returns (
        bool can_
    ) {

        uint _val = _value(
            _self,
            _totalOi,
            _totalOiShares,
            _priceFrame
        );

        uint _initOi = _initialOi(_self);

        uint _maintenanceMargin = _initOi.mulUp(_marginMaintenance);

        can_ = _val < _maintenanceMargin;

    }

    function _liquidationPrice (
        Info memory _self,
        uint256 _totalOi,
        uint256 _totalOiShares,
        uint256 _priceEntry,
        uint256 _marginMaintenance
    ) private pure returns (uint256 liqPrice) {

        uint256 _posOi = _oi(_self, _totalOi, _totalOiShares);
        uint256 _posInitialOi = _initialOi(_self);

        uint256 _oiFrame = _posInitialOi.mulUp(_marginMaintenance)
            .add(_self.debt)
            .divDown(_posOi);

        if (_self.isLong) liqPrice = _priceEntry.mulUp(_oiFrame);
        else liqPrice = _priceEntry.mulUp(TWO.sub(_oiFrame));

    }

    function initialOi (
        Info storage self
    ) internal view returns (
        uint256 initialOi_
    ) {

        Info memory _self = self;

        initialOi_ = _initialOi(_self);

    }

    /// @notice Computes the open interest of a position
    function oi (
        Info storage self,
        uint256 totalOi,
        uint256 totalOiShares
    ) internal view returns (uint256) {

        Info memory _self = self;

        return _oi(_self, totalOi, totalOiShares);

    }

    /// @notice Computes the value of a position
    /// @dev Floors to zero, so won't properly compute if self is underwater
    function value(
        Info storage self,
        uint256 totalOi,
        uint256 totalOiShares,
        uint256 priceFrame
    ) internal view returns (uint256) {

        Info memory _self = self;

        return _value(
            _self,
            totalOi,
            totalOiShares,
            priceFrame
        );

    }

    /// @notice Whether position is underwater
    /// @dev is true when position value <= 0
    function isUnderwater(
        Info storage self,
        uint256 totalOi,
        uint256 totalOiShares,
        uint256 priceFrame
    ) internal view returns (bool) {

        Info memory _self = self;

        return _isUnderwater(
            _self,
            totalOi,
            totalOiShares,
            priceFrame
        );

    }

    /// @notice Computes the notional of a position
    /// @dev Floors to _self.debt if value <= 0
    function notional(
        Info storage self,
        uint256 totalOi,
        uint256 totalOiShares,
        uint256 priceFrame
    ) internal view returns (uint256) {

        Info memory _self = self;

        return _notional(
            _self,
            totalOi,
            totalOiShares,
            priceFrame
        );

    }

    /// @notice Computes the open leverage of a position
    /// @dev ceils uint256.max if position value <= 0
    function openLeverage(
        Info storage self,
        uint256 totalOi,
        uint256 totalOiShares,
        uint256 priceFrame
    ) internal view returns (uint) {

        Info memory _self = self;

        return _openLeverage(
            _self,
            totalOi,
            totalOiShares,
            priceFrame
        );

    }

    /// @notice Computes the open margin of a position
    /// @dev floors zero if position value <= 0
    function openMargin(
        Info storage self,
        uint256 totalOi,
        uint256 totalOiShares,
        uint256 priceFrame
    ) internal view returns (uint) {

        Info memory _self = self;

        return _openMargin(
            _self,
            totalOi,
            totalOiShares,
            priceFrame
        );

    }

    /// @notice Whether a position can be liquidated
    /// @dev is true when value < maintenance margin
    function isLiquidatable(
        Info storage self,
        uint256 totalOi,
        uint256 totalOiShares,
        uint256 priceFrame,
        uint256 marginMaintenance
    ) internal view returns (bool) {

        Info memory _self = self;

        return _isLiquidatable(
            _self,
            totalOi,
            totalOiShares,
            priceFrame,
            marginMaintenance
        );

    }

    /// @notice Computes the liquidation price of a position
    /// @dev price when value < maintenance margin
    function liquidationPrice(
        Info storage self,
        uint256 totalOi,
        uint256 totalOiShares,
        uint256 priceEntry,
        uint256 marginMaintenance
    ) internal view returns (
        uint256 liquidationPrice_
    ) {

        Info memory _self = self;

        liquidationPrice_ = _liquidationPrice(
            _self,
            totalOi,
            totalOiShares,
            priceEntry,
            marginMaintenance
        );

    }
}
