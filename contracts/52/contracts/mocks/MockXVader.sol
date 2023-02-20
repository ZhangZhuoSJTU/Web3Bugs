// SPDX-License-Identifier: Unlicensed

pragma solidity =0.8.9;

import "../x-vader/XVader.sol";

contract MockXVader is XVader {

    constructor(IERC20 _vader) XVader(_vader) {}

    function mint(address to, uint256 amount) external {
        ERC20Votes._mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        ERC20Votes._burn(from, amount);
    }
}
