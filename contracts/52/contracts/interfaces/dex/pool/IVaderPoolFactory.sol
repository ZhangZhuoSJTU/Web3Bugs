// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "./IVaderPool.sol";

interface IVaderPoolFactory {
    /* ========== STRUCTS ========== */

    /* ========== FUNCTIONS ========== */

    function createPool(address tokenA, address tokenB)
        external
        returns (IVaderPool);

    function getPool(address tokenA, address tokenB)
        external
        view
        returns (IVaderPool);

    function nativeAsset() external view returns (address);

    /* ========== EVENTS ========== */

    event PoolCreated(
        address token0,
        address token1,
        IVaderPool pool,
        uint256 index
    );
}
