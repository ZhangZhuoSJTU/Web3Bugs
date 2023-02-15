// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../libraries/Position.sol";
import "../libraries/FixedPoint.sol";
import "../interfaces/IOverlayV1Mothership.sol";
import "./OverlayV1Governance.sol";
import "./OverlayV1OI.sol";
import "./OverlayV1PricePoint.sol";
import "../OverlayToken.sol";
import "./OverlayV1Comptroller.sol";

abstract contract OverlayV1Market is OverlayV1Governance {

    using FixedPoint for uint256;

    uint256 constant public MIN_COLLAT = 1e14;

    uint256 private unlocked = 1;

    modifier lock() { require(unlocked == 1, "OVLV1:!unlocked"); unlocked = 0; _; unlocked = 1; }

    constructor(address _mothership) OverlayV1Governance( _mothership) { }

    /// @notice Adds open interest to the market
    /// @dev This is invoked by Overlay collateral manager contracts, which
    /// can be for OVL, ERC20's, Overlay positions, NFTs, or what have you.
    /// The calculations for impact and fees are performed here.
    /// @param _isLong The side of the market to enter open interest on.
    /// @param _collateral The amount of collateral in OVL terms to take the
    /// position out with.
    /// @param _leverage The leverage with which to take out the position.
    /// @return oiAdjusted_ Amount of open interest after impact and fees.
    /// @return collateralAdjusted_ Amount of collateral after impact and fees.
    /// @return debtAdjusted_ Amount of debt after impact and fees.
    /// @return fee_ The protocol fee to be taken.
    /// @return impact_ The market impact for the build.
    /// @return pricePointNext_ The index of the price point for the position.
    function enterOI (
        bool _isLong,
        uint _collateral,
        uint _leverage
    ) external onlyCollateral returns (
        uint oiAdjusted_,
        uint collateralAdjusted_,
        uint debtAdjusted_,
        uint fee_,
        uint impact_,
        uint pricePointNext_
    ) {

        uint _cap = update();

        pricePointNext_ = _pricePoints.length - 1;

        uint _oi = _collateral * _leverage;

        uint _impact = intake(_isLong, _oi, _cap);

        fee_ = _oi.mulDown(mothership.fee());

        impact_ = _impact;

        require(_collateral >= MIN_COLLAT + impact_ + fee_ , "OVLV1:collat<min");

        collateralAdjusted_ = _collateral - _impact - fee_;

        oiAdjusted_ = collateralAdjusted_ * _leverage;

        debtAdjusted_ = oiAdjusted_ - collateralAdjusted_;

        addOi(_isLong, oiAdjusted_, _cap);

    }


    /// @notice First part of the flow to remove OI from the system
    /// @dev This is called by the collateral managers to retrieve
    /// the necessary information to calculate the specifics of each position,
    /// for instance the PnL or if it is liquidatable. 
    /// @param _isLong Whether the data is being retrieved for a long or short.
    /// @param _pricePoint Index of the initial price point
    /// @param oi_ Total outstanding open interest on that side of the market.
    /// @param oiShares_ Total outstanding open interest shares on that side.
    /// @param priceFrame_ The price multiple comprised of the entry and exit
    /// prices for the position, with the exit price being the current one.
    /// Longs receive the bid on exit and the ask on entry shorts the opposite.
    function exitData (
        bool _isLong,
        uint256 _pricePoint
    ) public onlyCollateral returns (
        uint oi_,
        uint oiShares_,
        uint priceFrame_
    ) {

        update();

        if (_isLong) ( oi_ = __oiLong__, oiShares_ = oiLongShares );
        else ( oi_ = __oiShort__, oiShares_ = oiShortShares );

        priceFrame_ = priceFrame(_isLong, _pricePoint);

    }

    /// @notice Removes open interest from the market
    /// @dev Called as the second part of exiting oi, this function
    /// reports the open interest in OVL terms to remove as well as 
    /// open interest shares to remove. It also registers printing
    /// or burning of OVL in the process.
    /// @param _isLong The side from which to remove open interest.
    /// @param _oi The open interest to remove in OVL terms.
    /// @param _oiShares The open interest shares to remove.
    /// @param _brrrr How much was printed on closing the position.
    /// @param _antiBrrrr How much was burnt on closing the position.
    function exitOI (
        bool _isLong,
        uint _oi,
        uint _oiShares,
        uint _brrrr,
        uint _antiBrrrr
    ) external onlyCollateral {

        brrrr( _brrrr, _antiBrrrr );

        if (_isLong) ( __oiLong__ -= _oi, oiLongShares -= _oiShares );
        else ( __oiShort__ -= _oi, oiShortShares -= _oiShares );

    }

    /// @notice Internal update function to price, cap, and pay funding.
    /// @dev This function updates the market with the latest price and
    /// conditionally reads the depth of the market feed. The market needs
    /// an update on the first call of any block.
    /// @return cap_ The open interest cap for the market.
    function update () public virtual returns (
        uint cap_
    ) {

        uint _now = block.timestamp;
        uint _updated = updated;

        if (_now != _updated) {

            PricePoint memory _pricePoint = fetchPricePoint();

            setPricePointNext(_pricePoint);

            updated = _now;

        } 

        (   uint _compoundings,
            uint _tCompounding  ) = epochs(_now, compounded);

        if (0 < _compoundings) {

            payFunding(k, _compoundings);
            compounded = _tCompounding;

        }

        cap_ = oiCap();

    }

    /// @notice The depth of the market feed in OVL terms at the current block.
    /// @dev Returns the time weighted liquidity of the market feed in
    /// OVL terms at the current block.
    /// @return depth_ The time weighted liquidity in OVL terms.
    function depth () public view override returns (
        uint depth_
    ) {

        ( ,,depth_ )= pricePointCurrent();

    }

    /// @notice Exposes important info for calculating position metrics.
    /// @dev These values are required to feed to the position calculations.
    /// @param _isLong Whether position is on short or long side of market.
    /// @param _priceEntry Index of entry price
    /// @return oi_ The current open interest on the chosen side.
    /// @return oiShares_ The current open interest shares on the chosen side.
    /// @return priceFrame_ Price frame resulting from e entry and exit prices.
    function positionInfo (
        bool _isLong,
        uint _priceEntry
    ) external view returns (
        uint256 oi_,
        uint256 oiShares_,
        uint256 priceFrame_
    ) {

        (   uint _compoundings, ) = epochs(block.timestamp, compounded);

        (   uint _oiLong,
            uint _oiShort,
            uint _oiLongShares,
            uint _oiShortShares ) = _oi(_compoundings);

        if (_isLong) ( oi_ = _oiLong, oiShares_ = _oiLongShares );
        else ( oi_ = _oiShort, oiShares_ = _oiShortShares );

        priceFrame_ = priceFrame(
            _isLong,
            _priceEntry
        );

    }


    /// @notice Computes the price frame for a given position
    /// @dev Computes the price frame conditionally giving shorts the bid
    /// on entry and ask on exit and longs the bid on exit and short on
    /// entry. Capped at the priceFrameCap for longs.
    /// @param _isLong If price frame is for a long or a short.
    /// @param _pricePoint The index of the entry price.
    /// @return priceFrame_ The exit price divided by the entry price.
    function priceFrame (
        bool _isLong,
        uint _pricePoint
    ) internal view returns (
        uint256 priceFrame_
    ) {

        ( uint _entryBid, uint _entryAsk, ) = readPricePoint(_pricePoint);

        ( uint _exitBid, uint _exitAsk, ) = pricePointCurrent();

        priceFrame_ = _isLong
            ? Math.min(_exitBid.divDown(_entryAsk), priceFrameCap)
            : _exitAsk.divUp(_entryBid);

    }

}
