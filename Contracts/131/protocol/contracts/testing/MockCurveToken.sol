// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./MockErc20.sol";

contract MockCurveToken is MockErc20 {
    constructor(uint8 _decimals) MockErc20(_decimals) {}

    function burnFrom(address to, uint256 value) external returns (bool) {
        _burn(to, value);
        return true;
    }
}
