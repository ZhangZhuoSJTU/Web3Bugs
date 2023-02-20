// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "../libraries/Position.sol";

interface IOverlayV1Market is IERC1155 {

    event log(string k, uint v);

    struct PricePoint {
        uint256 bid;
        uint256 ask;
        uint256 index;
    }

    event NewPrice(uint bid, uint ask, uint index);
    event FundingPaid(uint oiLong, uint oiShort, int fundingPaid);

    function ovl () external view returns (address);
    function factory () external view returns (address);

    function feed () external view returns (address);
    function impactWindow () external view returns (uint256);
    function updated () external view returns (uint256);
    function update () external;
    function compounded () external view returns (uint256);
    function compoundingPeriod () external view returns (uint256);

    function leverageMax () external view returns (uint8);

    function k() external view returns (uint256);

    function oi () external view returns (
        uint oiLong_,
        uint oiShort_,
        uint oiLongShares_,
        uint oiShortShares_
    );

    function oiLong() external view returns (uint256);
    function oiShort() external view returns (uint256);
    function oiLongShares() external view returns (uint256);
    function oiShortShares() external view returns (uint256);

    function oiCap () external view returns (uint256);

    function brrrrd () external view returns (int256);
    function pressure (
        bool _isLong,
        uint _oi,
        uint _cap
    ) external view returns (uint256);
    function impact (
        bool _isLong,
        uint _oi,
        uint _cap
    ) external view returns (uint256);

    function pbnj () external view returns (uint256);
    function priceFrameCap() external view returns (int256);

    function lmbda() external view returns (uint256);

    function brrrrdExpected() external view returns (uint256);
    function brrrrdWindowMacro() external view returns (uint256);
    function brrrrdWindowMicro() external view returns (uint256);

    function getBrrrrd() external view returns (uint256);

    function epochs() external view returns (
        uint compoundings_,
        uint tCompounding_
    );

    function epochs(
        uint _now,
        uint _compounded
    ) external view returns (
        uint compoundings_,
        uint tCompounding_
    );

    function pricePointNextIndex() external view returns (uint256);

    function pricePoints (
        uint256 index
    ) external view returns (
        uint bid_,
        uint ask_,
        uint depth_
    );

    function MAX_FUNDING_COMPOUND() external view returns (uint16);

    function addCollateral (
        address _collateral
    ) external;

    function adjustParams (
        uint256 _compoundingPeriod,
        uint144 _oiCap,
        uint112 _fundingKNumerator,
        uint112 _fundingKDenominator,
        uint8 _leverageMax
    ) external;

    function enterOI (
        bool _isLong,
        uint _collateral,
        uint _leverage
    ) external returns (
        uint oiAdjusted_,
        uint collateralAdjusted_,
        uint debtAdjusted_,
        uint fee_,
        uint impact_,
        uint pricePointNext_
    );

    function exitData (
        bool _isLong,
        uint256 _pricePoint
    ) external returns (
        uint oi_,
        uint oiShares_,
        uint priceFrame_
    );

    function exitOI (
        bool _isLong,
        uint _oi,
        uint _oiShares,
        uint _brrrr,
        uint _antibrrrr
    ) external;

    function positionInfo (
        bool _isLong,
        uint _entryIndex
    ) external view returns (
        uint256 oi_,
        uint256 oiShares_,
        uint256 priceFrame_
    );

    function setEverything (
        uint256 _k,
        uint256 _pbnj,
        uint256 _compoundPeriod,
        uint256 _lmbda,
        uint256 _staticCap,
        uint256 _brrrrExpected,
        uint256 _brrrrWindowMacro,
        uint256 _brrrrWindowMicro
    ) external;

    function setK (
        uint256 _k
    ) external;

    function setSpread(
        uint256 _pbnj
    ) external;

    function setPeriods(
        uint256 _compoundingPeriod
    ) external;

    function setComptrollerParams (
        uint256 _lmbda,
        uint256 _staticCap,
        uint256 _brrrrExpected,
        uint256 _brrrrWindowMacro,
        uint256 _brrrrWindowMicro
    ) external;



}
