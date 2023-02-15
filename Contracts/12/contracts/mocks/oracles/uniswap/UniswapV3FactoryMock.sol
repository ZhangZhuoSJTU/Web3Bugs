// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./UniswapV3PoolMock.sol";


contract UniswapV3FactoryMock {

    mapping(address => mapping(address => mapping(uint24 => address))) public getPool;

    /// @notice Creates a pool for the given two tokens and fee
    /// @param tokenA One of the two tokens in the desired pool
    /// @param tokenB The other of the two tokens in the desired pool
    /// @param fee The desired fee for the pool
    /// @dev tokenA and tokenB may be passed in either order: token0/token1 or token1/token0. tickSpacing is retrieved
    /// from the fee. The call will revert if the pool already exists, the fee is invalid, or the token arguments
    /// are invalid.
    /// @return pool The address of the newly created pool
    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external returns (address pool) {
        require(tokenA != tokenB, "Cannot create pool of same tokens");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "No nil token address");
        require(getPool[token0][token1][fee] == address(0), "Pool already exists");
        pool = address(new UniswapV3PoolMock(address(this), token0, token1, fee));
        getPool[token0][token1][fee] = pool;
        // populate mapping in the reverse direction, deliberate choice to avoid the cost of comparing addresses
        getPool[token1][token0][fee] = pool;
    }
}