// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./UniswapV3OracleMock.sol";

contract UniswapV3FactoryMock {

    mapping(address => bool) public isPool;
    address[] public allPools;

    function createPool (
        address _token0, 
        address _token1
    ) external returns (
        UniswapV3OracleMock pool
    ) {

        pool = new UniswapV3OracleMock(_token0, _token1);
        isPool[address(pool)] = true;
        allPools.push(address(pool));

    }

    function loadObservations(
        address pool,
        OracleMock.Observation[] calldata _observations,
        UniswapV3OracleMock.Shim[] calldata _shims
    ) external {
        require(isPool[pool], "!pool");
        UniswapV3OracleMock(pool).loadObservations(_observations, _shims);
    }
}
