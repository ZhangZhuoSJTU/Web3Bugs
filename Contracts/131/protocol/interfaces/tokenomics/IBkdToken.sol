// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBkdToken is IERC20 {
    function mint(address account, uint256 amount) external;
}
