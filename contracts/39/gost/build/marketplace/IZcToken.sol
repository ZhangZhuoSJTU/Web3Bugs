// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./IPErc20.sol";

/**
 * @dev Mint and burn interface for the ZCToken
 *
 */
interface IZcToken is IPErc20 {
    /**
     * @dev Mints...
     */
    function mint(address, uint256) external returns(bool);

    /**
     * @dev Burns...
     */
    function burn(address, uint256) external returns(bool);
}
