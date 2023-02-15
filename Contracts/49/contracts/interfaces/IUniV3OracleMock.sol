// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IUniswapV3OracleMock {

    struct Shim {
        uint timestamp;
        uint128 liquidity;
        int24 tick;
        uint16 cardinality;
    }
    struct Observation {
        uint32 blockTimestamp;
        int56 tickCumulative;
        uint160 secondsPerLiquidityCumulativeX128;
        bool initialized;
    }

    function token0() external view returns (address);
    function token1() external view returns (address);
    function observationsLength() external view returns (uint);
    function loadObservations(Observation[] calldata, Shim[] calldata) external;
    function shims(uint) external view returns (Shim memory);
    function observations(uint) external view returns (Observation memory);
    function observe(uint32[] calldata) external view returns (int56[] memory, uint160[] memory);
    function cardinality() external view returns(uint16);

}
