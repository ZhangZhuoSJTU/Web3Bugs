// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

interface ISwap {
    function get_virtual_price() external view returns (uint);
    function exchange(int128 i, int128 j, uint dx, uint min_dy) external;
}

interface ISaddleSwap {
    function getVirtualPrice() external view returns (uint);
}

interface renDeposit {
    function add_liquidity(uint[2] calldata amounts, uint min_mint_amount) external returns (uint);
}

interface sbtcDeposit {
    function add_liquidity(uint[3] calldata amounts, uint min_mint_amount) external returns (uint);
}

interface tbtcDeposit {
    function add_liquidity(uint[4] calldata amounts, uint min_mint_amount) external returns (uint);
}
