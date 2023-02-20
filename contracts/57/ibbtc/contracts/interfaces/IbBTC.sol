// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IbBTC is IERC20 {
    function mint(address account, uint amount) external;
    function burn(address account, uint amount) external;
}
