// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./IBasePool.sol";

interface IVaderPool is IBasePool, IERC721 {
    /* ========== STRUCTS ========== */
    /* ========== FUNCTIONS ========== */

    function burn(uint256 id, address to)
        external
        returns (
            uint256 amountNative,
            uint256 amountForeign,
            uint256 coveredLoss
        );

    function toggleQueue() external;

    /* ========== EVENTS ========== */

    event QueueActive(bool activated);
}
