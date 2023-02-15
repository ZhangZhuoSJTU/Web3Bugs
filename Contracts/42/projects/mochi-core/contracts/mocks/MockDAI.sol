// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockDAI is ERC20 {
    constructor() ERC20("MockDAI", "MOCKDAI") {
        _mint(msg.sender, 10000000000000000e18);
    }

    function mint(uint256 _amount) external {
        _mint(msg.sender, _amount);
    }
}
