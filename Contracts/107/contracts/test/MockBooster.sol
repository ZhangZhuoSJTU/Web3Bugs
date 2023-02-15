// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IBooster.sol";

contract MockBooster is IBooster {
    IERC20 internal poolToken;
    address internal recipient;

    constructor(IERC20 _poolToken, address _recipient) {
        poolToken = _poolToken;
        recipient = _recipient;
    }

    function depositAll(uint256, bool) external override returns (bool) {
        poolToken.transferFrom(
            msg.sender,
            recipient,
            poolToken.balanceOf(msg.sender)
        );
        return true;
    }
}
