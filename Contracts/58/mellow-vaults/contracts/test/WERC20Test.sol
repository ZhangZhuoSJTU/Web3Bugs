// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IWrapped {
    function deposit() external payable;

    function withdraw(uint256 wad) external;
}

contract WERC20Test is IWrapped, ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        _mint(msg.sender, (10**18) * (10**18));
    }

    function deposit() external payable {}

    function withdraw(uint256 wad) external {}
}
