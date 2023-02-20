// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase
// solhint-disable var-name-mixedcase

pragma solidity 0.6.12;

interface IStableSwap3Pool {
    function get_virtual_price() external view returns (uint);
    function balances(uint) external view returns (uint);
    function get_dy(int128 i, int128 j, uint dx) external view returns (uint dy);
    function exchange(int128 i, int128 j, uint dx, uint min_dy) external;
    function add_liquidity(uint[3] calldata amounts, uint min_mint_amount) external;
    function remove_liquidity(uint _amount, uint[3] calldata amounts) external;
    function remove_liquidity_one_coin(uint _token_amount, int128 i, uint min_amount) external;
    function calc_token_amount(uint[3] calldata amounts, bool deposit) external view returns (uint);
    function calc_withdraw_one_coin(uint _token_amount, int128 i) external view returns (uint);
}
