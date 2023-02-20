// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

interface IBasePool {
    /* ========== STRUCTS ========== */

    struct Position {
        uint256 creation;
        uint256 liquidity;
        uint256 originalNative;
        uint256 originalForeign;
    }

    /* ========== FUNCTIONS ========== */

    function swap(
        uint256 nativeAmountIn,
        uint256 foreignAmountIn,
        address to
    ) external returns (uint256);

    function swap(
        uint256 nativeAmountIn,
        uint256 foreignAmountIn,
        address to,
        bytes calldata
    ) external returns (uint256);

    function mint(address to) external returns (uint256 liquidity);

    function getReserves() external view returns (
            uint112 reserveNative,
            uint112 reserveForeign,
            uint32 blockTimestampLast
        );

    /* ========== EVENTS ========== */

    event Mint(
        address indexed sender,
        address indexed to,
        uint256 amount0,
        uint256 amount1
    ); // Adjustment -> new argument to which didnt exist
    event Burn(
        address indexed sender,
        uint256 amount0,
        uint256 amount1,
        address indexed to
    );
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint256 reserve0, uint256 reserve1); // Adjustment -> 112 to 256
    event PositionOpened(address indexed sender, uint256 id, uint256 liquidity);
    event PositionClosed(
        address indexed sender,
        uint256 id,
        uint256 liquidity,
        uint256 loss
    );
}
