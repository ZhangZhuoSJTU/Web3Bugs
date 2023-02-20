// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/Gauge.sol";

contract MockCurveGauge is Gauge {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 want;

    mapping(address => uint) public amounts;

    constructor(IERC20 _want) public {
        want = _want;
    }

    function deposit(uint _amount) external override {
        want.safeTransferFrom(msg.sender, address(this), _amount);
        amounts[msg.sender] = amounts[msg.sender].add(_amount);
    }

    function balanceOf(address _account) external override view returns (uint) {
        return amounts[_account];
    }

    function claimable_tokens(address _account) external override view returns (uint) {
        return amounts[_account].div(10); // always return 10% of staked
    }

    function withdraw(uint _amount) external override {
        want.safeTransfer(msg.sender, _amount);
        amounts[msg.sender] = amounts[msg.sender].sub(_amount);
    }
}
