// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IYaxisBar is IERC20 {
    function availableBalance() external view returns (uint256);
}
