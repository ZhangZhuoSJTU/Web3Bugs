//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockSpender {
    function transferTokens(
        address _from,
        address _token,
        uint256 _amount
    ) external {
        IERC20(_token).transferFrom(_from, address(this), _amount);
    }
}
