// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/Gauge.sol";

contract MockCurveMinter is Mintr {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 crv;

    constructor(IERC20 _crv) public {
        crv = _crv;
    }

    function mint(address) external override {
        uint _bal = crv.balanceOf(address(this));
        crv.safeTransfer(msg.sender, _bal.div(10)); // always mint 10% amount of balance
    }
}
