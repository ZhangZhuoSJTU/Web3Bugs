// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.7;

// import "./libraries/FixedPoint.sol";
// import "./libraries/UniswapV3OracleLibrary/UniswapV3OracleLibraryV2.sol";
// import "./interfaces/IUniswapV3Pool.sol";
// import "./market/OverlayV1Market.sol";

// contract OverlayV1UniswapV3MultiplexMarket is OverlayV1Market {

//     using FixedPoint for uint256;

//     uint32 public immutable macroWindow; // window size for main TWAP
//     uint32 public immutable microWindow; // window size for bid/ask TWAP

//     address public immutable feed0;
//     address public immutable base0;
//     address public immutable quote0;
//     uint128 public immutable in0;

//     address public immutable feed1;
//     address public immutable base1;
//     address public immutable quote1;
//     uint128 public immutable in1;

//     uint256 public toUpdate;
//     uint256 public updated;
//     uint256 public compounded;

//     constructor(
//         address _mothership,
//         address _uniV3Feed0,
//         address _quote0,
//         uint128 _amountIn0,
//         address _uniV3Feed1,
//         address _quote1,
//         uint128 _amountIn1,
//         uint32 _macroWindow,
//         uint32 _microWindow
//     ) OverlayV1Market(
//         _mothership
//     ) {

//         // immutables
//         macroWindow = _macroWindow;
//         microWindow = _microWindow;

//         feed0 = _uniV3Feed0;
//         feed1 = _uniV3Feed0;

//         address _f0Token0 = IUniswapV3Pool(_uniV3Feed0).token0();
//         address _f0Token1 = IUniswapV3Pool(_uniV3Feed0).token1();
//         address _f1Token0 = IUniswapV3Pool(_uniV3Feed1).token0();
//         address _f1Token1 = IUniswapV3Pool(_uniV3Feed1).token1();

//         base0 = _f0Token0 != _quote0 ? _f0Token0 : _f0Token1;
//         base1 = _f1Token0 != _quote0 ? _f1Token0 : _f1Token1;
//         quote0 = _f0Token0 == _quote0 ? _f0Token0 : _f0Token1;
//         quote1 = _f1Token0 == _quote0 ? _f1Token0 : _f1Token1;

//         in0 = _amountIn0;
//         in1 = _amountIn0;

//         uint _price = OracleLibraryV2.getQuoteAtTick(
//             OracleLibraryV2.consult(_uniV3Feed0, uint32(_macroWindow), uint32(0)),
//             uint128(_amountIn0),
//             _f0Token0 != _quote0 ? _f0Token0 : _f0Token1,
//             _f0Token0 == _quote0 ? _f0Token0 : _f0Token1
//         );

//         _price = _price.mulUp(OracleLibraryV2.getQuoteAtTick(
//             OracleLibraryV2.consult(_uniV3Feed1, uint32(_macroWindow), uint32(0)),
//             uint128(_amountIn1),
//             _f1Token0 != _quote1 ? _f1Token0 : _f1Token1,
//             _f1Token0 == _quote1 ? _f1Token0 : _f1Token1
//         ));

//         setpricePointNext(PricePoint(_price, _price, _price));

//         toUpdate = type(uint256).max;
//         updated = block.timestamp;
//         compounded = block.timestamp;

//     }

//     function price (
//         uint32 _at
//     ) public view returns (
//         PricePoint memory
//     ) { 

//         uint32[] memory _secondsAgo = new uint32[](3);
//         _secondsAgo[0] = _at + macroWindow;
//         _secondsAgo[1] = _at + microWindow;
//         _secondsAgo[2] = _at;

//         uint _microPrice;
//         uint _macroPrice;

//         ( int56[] memory _ticks, ) = IUniswapV3Pool(feed0).observe(_secondsAgo);

//         _macroPrice = OracleLibraryV2.getQuoteAtTick(
//             int24((_ticks[2] - _ticks[0]) / int56(int32(macroWindow))),
//             in0,
//             base0,
//             quote0
//         );

//         _microPrice = OracleLibraryV2.getQuoteAtTick(
//             int24((_ticks[2] - _ticks[1]) / int56(int32(microWindow))),
//             in0,
//             base0,
//             quote0
//         );

//         ( _ticks, ) = IUniswapV3Pool(feed1).observe(_secondsAgo);

//         _macroPrice = _macroPrice.mulUp(OracleLibraryV2.getQuoteAtTick(
//             int24((_ticks[2] - _ticks[0]) / int56(int32(macroWindow))),
//             in1,
//             base1,
//             quote1
//         ));

//         _macroPrice = _macroPrice.mulUp(OracleLibraryV2.getQuoteAtTick(
//             int24((_ticks[2] - _ticks[1]) / int56(int32(microWindow))),
//             in1,
//             base1,
//             quote1
//         ));

//         return insertSpread(_microPrice, _macroPrice);

//     }
//         function depth () internal view override returns (uint256 depth_) {}

//     function epochs (
//         uint _time,
//         uint _from,
//         uint _between
//     ) public view returns (
//         uint updatesThen_,
//         uint updatesNow_,
//         uint tUpdate_,
//         uint t1Update_,
//         uint compoundings_,
//         uint tCompounding_,
//         uint t1Compounding_
//     ) { 

//         uint _updatePeriod = updatePeriod;
//         uint _compoundPeriod = compoundingPeriod;
//         uint _compounded = compounded;

//         if (_between < _time) {

//             updatesThen_ = ( _between - _from ) / _updatePeriod;

//             updatesNow_ = ( _time - _between ) / _updatePeriod;

//         } else {

//             updatesNow_ = ( _time - _from ) / _updatePeriod;

//         }
        
//         tUpdate_ = _from + ( ( updatesThen_ + updatesNow_ ) * _updatePeriod );

//         t1Update_ = tUpdate_ + _updatePeriod;

//         compoundings_ = ( _time - compounded ) / _compoundPeriod;

//         tCompounding_ = _compounded + ( compoundings_ * _compoundPeriod );

//         t1Compounding_ = tCompounding_ + _compoundPeriod;

//     }

//     function staticUpdate () internal override returns (bool updated_) {

//         uint _toUpdate = toUpdate;
//         uint _updated = updated;

//         (   uint _updatesThen,,,,
//             uint _compoundings,
//             uint _tCompounding, ) = epochs(block.timestamp, _updated, _toUpdate);

//         // only update if there is a position to update
//         if (0 < _updatesThen) {

//             uint32 _then = uint32(block.timestamp - _toUpdate);
//             PricePoint memory _price = price(_then);
//             setpricePointNext(_price);
//             updated = _toUpdate;
//             toUpdate = type(uint256).max;
//             updated_ = true;

//         }

//         if (0 < _compoundings) {
//             updateFunding(_compoundings);
//             compounded = _tCompounding;
//         }

//     }

//     function entryUpdate () internal override returns (
//         uint256 t1Compounding_
//     ) {

//         uint _toUpdate = toUpdate;

//         (   uint _updatesThen,,,
//             uint _tp1Update,
//             uint _compoundings,
//             uint _tCompounding,
//             uint _t1Compounding ) = epochs(block.timestamp, updated, _toUpdate);

//         if (0 < _updatesThen) {
//             uint32 _then = uint32(block.timestamp - _toUpdate);
//             PricePoint memory _price = price(_then);
//             setpricePointNext(_price);
//             updated = _toUpdate;
//         }

//         if (0 < _compoundings) {
//             updateFunding(_compoundings);
//             compounded = _tCompounding;
//         }

//         if (_toUpdate != _tp1Update) toUpdate = _tp1Update;

//         t1Compounding_ = _t1Compounding;

//     }

//     function exitUpdate () internal override returns (uint tCompounding_) {

//         uint _toUpdate = toUpdate;

//         (   uint _updatesThen,
//             uint _updatesNow,
//             uint _tUpdate,,
//             uint _compoundings,
//             uint _tCompounding, ) = epochs(block.timestamp, updated, _toUpdate);

            
//         if (0 < _updatesThen) {

//             uint32 _then = uint32(block.timestamp - _toUpdate);
//             PricePoint memory _price = price(_then);
//             setpricePointNext(_price);

//         }

//         if (0 < _updatesNow) { 

//             uint32 _then = uint32(block.timestamp - _tUpdate);
//             PricePoint memory _price = price(_then);
//             setpricePointNext(_price);

//             updated = _tUpdate;
//             toUpdate = type(uint256).max;

//         }

//         if (0 < _compoundings) {

//             updateFunding(1);
//             updateFunding(_compoundings - 1);

//         }

//         tCompounding_ = _tCompounding;

//     }

//     function oi () public view returns (
//         uint oiLong_, 
//         uint oiShort_
//     ) {

//         ( ,,,,uint _compoundings,, ) = epochs(block.timestamp, updated, toUpdate);

//         oiLong_ = __oiLong__;
//         oiShort_ = __oiShort__;
//         uint _k = k;
//         uint _queuedOiLong = queuedOiLong;
//         uint _queuedOiShort = queuedOiShort;

//         if (0 < _compoundings) {

//             ( oiLong_, oiShort_, ) = computeFunding(
//                 oiLong_,
//                 oiShort_,
//                 1,
//                 _k
//             );

//             ( oiLong_, oiShort_, ) = computeFunding(
//                 oiLong_ += _queuedOiLong,
//                 oiShort_ += _queuedOiShort,
//                 _compoundings - 1,
//                 _k
//             );

//         } else {

//             oiLong_ += _queuedOiLong;
//             oiShort_ += _queuedOiShort;

//         }

//     }

//     function oiLong () external view returns (uint oiLong_) {
//         (   oiLong_, ) = oi();
//     }

//     function oiShort () external view returns (uint oiShort_) {
//         (  ,oiShort_ ) = oi();
//     }

// }
