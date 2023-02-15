// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

interface IBkdTriHopCvx {
    function setHopImbalanceToleranceIn(uint256 _hopImbalanceToleranceIn) external returns (bool);

    function setHopImbalanceToleranceOut(uint256 _hopImbalanceToleranceOut) external returns (bool);

    function changeConvexPool(
        uint256 convexPid_,
        address curvePool_,
        uint256 curveIndex_
    ) external;
}
