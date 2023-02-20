// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20("MockERC20", "ME2") {
    constructor(uint256 _totalSupply) {
        _mint(msg.sender, _totalSupply);
    }

    function mint(address _user, uint256 _amount) public {
        _mint(_user, _amount);
    }
}
