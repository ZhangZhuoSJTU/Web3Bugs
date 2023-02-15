// SPDX-License-Identifier: MIT

pragma solidity >= 0.5.0 <= 0.9.0;

import {IERC20} from "../erc20/IERC20.sol";

interface ICitadelToken is IERC20 {
    function mint(address dest, uint256 amount) external;
}
