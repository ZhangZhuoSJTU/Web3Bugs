//SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract INestedToken is IERC20 {
    function burn(uint256 amount) public virtual;
}
