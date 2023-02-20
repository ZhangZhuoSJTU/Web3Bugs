// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "../libraries/FixedPoint.sol";

abstract contract OverlayV1PricePoint {

    using FixedPoint for uint256;

    uint256 private constant E = 0x25B946EBC0B36351;
    uint256 private constant INVERSE_E = 0x51AF86713316A9A;

    struct PricePoint {
        int24 macroTick;
        int24 microTick;
        uint256 depth;
    }

    uint256 public pbnj;

    uint256 public updated;

    uint256 immutable public priceFrameCap;

    // mapping from price point index to realized historical prices
    PricePoint[] internal _pricePoints;

    event NewPricePoint(uint bid, uint ask, uint depth);

    constructor(
        uint256 _priceFrameCap
    ) {

        require(1e18 <= _priceFrameCap, "OVLV1:!priceFrame");

        priceFrameCap = _priceFrameCap;

        updated = block.timestamp;


    }

    function fetchPricePoint () public view virtual returns (PricePoint memory);

    function _tickToPrice (int24 _tick) public virtual view returns (uint quote_);


    /// @notice Get the index of the next price to be realized
    /// @dev Returns the index of the _next_ price
    /// @return nextIndex_ The length of the price point array
    function pricePointNextIndex() public view returns (
        uint nextIndex_
    ) {

        nextIndex_ = _pricePoints.length;

    }


    /// @notice All past price points.
    /// @dev Returns the price point if it exists.
    /// @param _pricePointIndex Index of the price point being queried.
    /// @return bid_ Bid.
    /// @return ask_ Ask.
    /// @return depth_ Market liquidity in OVL terms.
    function pricePoints(
        uint256 _pricePointIndex
    ) external view returns (
        uint256 bid_,
        uint256 ask_,
        uint256 depth_
    ) {

        uint _len = _pricePoints.length;

        require(_pricePointIndex <  _len ||
               (_pricePointIndex == _len && updated != block.timestamp),
               "OVLV1:!price");

        if (_pricePointIndex == _len) {

            ( bid_, ask_, depth_ ) = readPricePoint(fetchPricePoint());

        } else {

            ( bid_, ask_, depth_ ) = readPricePoint(_pricePointIndex);

        }

    }


    /// @notice Current price point.
    /// @dev Returns the price point if it exists.
    /// @return bid_ Bid.
    /// @return ask_ Ask.
    /// @return depth_ Market liquidity in OVL terms.
    function pricePointCurrent () public view returns (
        uint bid_,
        uint ask_,
        uint depth_
    ){

        uint _now = block.timestamp;
        uint _updated = updated;

        if (_now != _updated) {

            ( bid_, ask_, depth_ ) = readPricePoint(fetchPricePoint());

        } else {

            ( bid_, ask_, depth_ ) = readPricePoint(_pricePoints.length - 1);

        }

    }

    /// @notice Allows inheriting contracts to add the latest realized price
    function setPricePointNext(
        PricePoint memory _pricePoint
    ) internal {

        _pricePoints.push(_pricePoint);

        (   uint _bid, 
            uint _ask,  
            uint _depth ) = readPricePoint(_pricePoint);

        emit NewPricePoint(
            _bid, 
            _ask, 
            _depth
        );

    }

    function readPricePoint (
        uint _pricePoint
    ) public view returns (
        uint256 bid_,
        uint256 ask_,
        uint256 depth_
    ) {

        return readPricePoint(_pricePoints[_pricePoint]);

    }

    function readPricePoint(
        PricePoint memory _pricePoint
    ) public view returns (
        uint256 bid_,
        uint256 ask_,
        uint256 depth_
    ) {

        uint _microPrice = _tickToPrice(_pricePoint.microTick);

        uint _macroPrice = _tickToPrice(_pricePoint.macroTick);

        uint _spread = pbnj;

        ask_ = Math.max(_macroPrice, _microPrice).mulUp(E.powUp(_spread));

        bid_ = Math.min(_macroPrice, _microPrice).mulDown(INVERSE_E.powUp(_spread));

        depth_ = _pricePoint.depth;


    }


}
