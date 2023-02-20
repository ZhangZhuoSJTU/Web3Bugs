// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../libraries/FixedPoint.sol";

contract OverlayV1OI {

    event log(string k , uint v);

    using FixedPoint for uint256;

    uint256 private constant ONE = 1e18;

    uint256 public compoundingPeriod;
    uint256 public compounded;

    uint256 internal __oiLong__; // total long open interest
    uint256 internal __oiShort__; // total short open interest

    uint256 public oiLongShares; // total shares of long open interest outstanding
    uint256 public oiShortShares; // total shares of short open interest outstanding

    uint256 public k;

    event FundingPaid(uint oiLong, uint oiShort, int fundingPaid);

    constructor (
        uint256 _compoundingPeriod
    ) {

        compoundingPeriod = _compoundingPeriod;

        compounded = block.timestamp;

    }

    /// @notice The compounding information for computing funding.
    /// @dev This returns the number of compoundings that have passed since
    /// the last time funding was paid as well as the timestamp of the
    /// current compounding epoch, which come at regular intervals according
    /// to the compounding period.
    /// @param _now The timestamp of the current block.
    /// @param _compounded The last time compounding occurred.
    /// @return compoundings_ The number of compounding periods passed since
    /// the last time funding was compounded.
    /// @return tCompounding_ The current compounding epoch.
    function epochs (
        uint _now,
        uint _compounded
    ) public view returns (
        uint compoundings_,
        uint tCompounding_
    ) {

        uint _compoundPeriod = compoundingPeriod;

        compoundings_ = ( _now - _compounded ) / _compoundPeriod;

        tCompounding_ = _compounded + ( compoundings_ * _compoundPeriod );

    }


    /// @notice Internal utility to pay funding from heavier to ligher side.
    /// @dev Pure function accepting current open interest, compoundings
    /// to perform, and funding constant.
    /// @dev oiImbalance(period_m) = oiImbalance(period_now) * (1 - 2k) ** period_m
    /// @param _oiLong Current open interest on the long side.
    /// @param _oiShort Current open interest on the short side.
    /// @param _epochs The number of compounding periods to compute for.
    /// @param _k The funding constant.
    /// @return oiLong_ Open interest on the long side after funding is paid.
    /// @return oiShort_ Open interest on the short side after funding is paid.
    /// @return fundingPaid_ Signed integer of funding paid, negative if longs
    /// are paying shorts.
    function computeFunding (
        uint256 _oiLong,
        uint256 _oiShort,
        uint256 _epochs,
        uint256 _k
    ) internal pure returns (
        uint256 oiLong_,
        uint256 oiShort_,
        int256  fundingPaid_
    ) {

        if (_oiLong == 0 && 0 == _oiShort) return (0, 0, 0);

        if (0 == _epochs) return ( _oiLong, _oiShort, 0 );

        uint _fundingFactor = ONE.sub(_k.mulUp(ONE*2));

        _fundingFactor = _fundingFactor.powUp(ONE*_epochs);

        uint _funder = _oiLong;
        uint _funded = _oiShort;
        bool payingLongs = _funder <= _funded;
        if (payingLongs) (_funder, _funded) = (_funded, _funder);

        if (_funded == 0) {

            uint _oiNow = _fundingFactor.mulDown(_funder);
            fundingPaid_ = int(_funder - _oiNow);
            _funder = _oiNow;

        } else {

            // TODO: we can make an unsafe mul function here
            uint256 _oiImbNow = _fundingFactor.mulDown(_funder - _funded);
            uint256 _total = _funder + _funded;

            fundingPaid_ = int( ( _funder - _funded ) / 2 );
            _funder = ( _total + _oiImbNow ) / 2;
            _funded = ( _total - _oiImbNow ) / 2;

        }

        ( oiLong_, oiShort_, fundingPaid_) = payingLongs
            ? ( _funded, _funder, fundingPaid_ )
            : ( _funder, _funded, -fundingPaid_ );

    }


    /// @notice Pays funding.
    /// @dev Invokes internal computeFunding and sets oiLong and oiShort.
    /// @param _k The funding constant.
    /// @param _epochs The number of compounding periods to compute.
    /// @return fundingPaid_ Signed integer of how much funding was paid.
    function payFunding (
        uint256 _k,
        uint256 _epochs
    ) internal returns (
        int256 fundingPaid_
    ) {

        uint _oiLong;
        uint _oiShort;

        ( _oiLong, _oiShort, fundingPaid_ ) = computeFunding(
            __oiLong__,
            __oiShort__,
            _epochs,
            _k
        );

        __oiLong__ = _oiLong;
        __oiShort__ = _oiShort;

        emit FundingPaid(_oiLong, _oiShort, fundingPaid_);

    }

    /// @notice Adds open interest to one side
    /// @dev Adds open interest to one side, asserting the cap is not breached.
    /// @param _isLong If open interest is adding to the long or short side.
    /// @param _openInterest Open interest to add.
    /// @param _oiCap Open interest cap to require not to be breached.
    function addOi(
        bool _isLong,
        uint256 _openInterest,
        uint256 _oiCap
    ) internal {

        if (_isLong) {

            oiLongShares += _openInterest;

            uint _oiLong = __oiLong__ + _openInterest;

            require(_oiLong <= _oiCap, "OVLV1:>cap");

            __oiLong__ = _oiLong;

        } else {

            oiShortShares += _openInterest;

            uint _oiShort = __oiShort__ + _openInterest;

            require(_oiShort <= _oiCap, "OVLV1:>cap");

            __oiShort__ = _oiShort;

        }

    }

    /// @notice Internal function to retrieve up to date open interest.
    /// @dev Computes the current open interest values and returns them.
    /// @param _compoundings Number of compoundings yet to be paid in funding.
    /// @return oiLong_ Current open interest on the long side.
    /// @return oiShort_ Current open interest on the short side.
    /// @return oiLongShares_ Current open interest shares on the long side.
    /// @return oiShortShares_ Current open interest shares on the short side.
    function _oi (
        uint _compoundings
    ) internal view returns (
        uint oiLong_,
        uint oiShort_,
        uint oiLongShares_,
        uint oiShortShares_
    ) {

        oiLong_ = __oiLong__;
        oiShort_ = __oiShort__;
        oiLongShares_ = oiLongShares;
        oiShortShares_ = oiShortShares;

        if (0 < _compoundings) {

            ( oiLong_, oiShort_, ) = computeFunding(
                oiLong_,
                oiShort_,
                _compoundings,
                k
            );

        }

    }

    /// @notice The current open interest on both sides of the market.
    /// @dev Returns all up to date open interest data for the market.
    /// @return oiLong_ Current open interest on long side.
    /// @return oiShort_ Current open interest on short side.
    /// @return oiLongShares_ Current open interest shares on the long side.
    /// @return oiShortShares_ Current open interest shares on the short side.
    function oi () public view returns (
        uint oiLong_,
        uint oiShort_,
        uint oiLongShares_,
        uint oiShortShares_
    ) {

        ( uint _compoundings, ) = epochs(block.timestamp, compounded);

        (   oiLong_,
            oiShort_,
            oiLongShares_,
            oiShortShares_ ) = _oi(_compoundings);

    }


    /// @notice The current open interest on the long side.
    /// @return oiLong_ The current open interest on the long side.
    function oiLong () external view returns (uint oiLong_) {
        (   oiLong_,,, ) = oi();
    }


    /// @notice The current open interest on the short side.
    /// @return oiShort_ The current open interest on the short side.
    function oiShort () external view returns (uint oiShort_) {
        (  ,oiShort_,, ) = oi();
    }

}