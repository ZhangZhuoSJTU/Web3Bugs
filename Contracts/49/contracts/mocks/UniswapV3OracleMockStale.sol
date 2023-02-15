
// SPDX-License-Identifier: Cheese
pragma solidity >=0.5.0;


contract UniswapV3OracleMockStale {

    address public immutable token0;
    address public immutable token1;

    uint public immutable deployed;
    uint public immutable window;

    int56[][] public observations;

    constructor(
        address _token0, 
        address _token1,
        uint _window
    ) {

        token0 = _token0;
        token1 = _token1;
        window = _window;
        deployed = block.timestamp;

    }

    function addObservations (
        int56[][] calldata _observations
    ) external {

        uint len = _observations.length;
        for (uint i = 0; i < len; i++) observations.push(_observations[i]);

    }

    function observe (
        uint32[] calldata __
    ) external view returns (
        int56[] memory, 
        uint160[] memory
    ) {

        uint index = ( block.timestamp - deployed ) / window;

        int56[] memory tickCumulatives_ = observations[index];
        uint160[] memory secondsPerLiquidityCumulativeX128s_;

        return ( tickCumulatives_, secondsPerLiquidityCumulativeX128s_ );

    }

}
