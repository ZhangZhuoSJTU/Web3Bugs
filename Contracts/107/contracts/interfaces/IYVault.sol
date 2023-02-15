// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IYVault is IERC20 {
    function token() external view returns (address);

    function controller() external view returns (address);

    function deposit(uint256 amount) external;

    function withdraw(uint256 shares) external;

    function withdrawJPEG() external;

    function balanceOfJPEG() external view returns (uint256);
}
