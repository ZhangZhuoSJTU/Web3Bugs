// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ICurveRegistry {
    /*
     * @notice Get the number of coins in a pool
     * @dev For non-metapools, both returned values are identical even when the pool does not use wrapping/lending
     * @param _pool Pool address
     * @return Number of wrapped coins, number of underlying coins
     */
    function get_n_coins(address _pool)
        external
        view
        returns (uint256[2] memory _count);

    function get_pool_from_lp_token(address _lp)
        external
        view
        returns (address);
}
