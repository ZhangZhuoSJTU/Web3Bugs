// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract XORToken is ERC20 {

    constructor (uint amount)  ERC20('XOR', 'XOR') {
        mint(msg.sender, amount);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
