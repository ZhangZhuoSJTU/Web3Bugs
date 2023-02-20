// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Interface for WETH9
 * @dev https://etherscan.io/address/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2#code
 */
interface IWETH is IERC20 {
    function deposit() external payable;

    function withdraw(uint256 wad) external;
}
