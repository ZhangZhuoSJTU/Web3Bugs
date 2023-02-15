// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockWETH is ERC20 {
    constructor() ERC20("MockWETH", "MOCKWETH") {
        _mint(msg.sender, 10000000000000000e18);
    }

    receive() external payable {}

    function mint(uint256 _amount) external {
        _mint(msg.sender, _amount);
    }
}
