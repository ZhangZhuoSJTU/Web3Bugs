// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "./IVaderPoolV2.sol";

interface IVaderPoolFactoryV2 {
    /* ========== STRUCTS ========== */

    /* ========== FUNCTIONS ========== */

    function createPool(address tokenA, address tokenB)
        external
        returns (IVaderPoolV2);

    function getPool(address tokenA, address tokenB)
        external
        returns (IVaderPoolV2);

    function nativeAsset() external view returns (address);

    /* ========== EVENTS ========== */

    event PoolCreated(
        address token0,
        address token1,
        IVaderPoolV2 pool,
        uint256 totalPools
    );
}
