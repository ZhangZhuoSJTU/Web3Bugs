//SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
@notice DO NOT USE IN PRODUCTION. FOR TEST PURPOSES ONLY
 */
contract ElasticMock is ERC20PresetFixedSupply, Ownable {

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner
    ) ERC20PresetFixedSupply(name, symbol, initialSupply, owner) {}

    /**
    @dev Allows us to transfer away tokens from an address in our tests simulating a rebase down occurring
    */
    function simulateRebaseDown(
        address tokenHolder,
        uint256 tokenAmountToRemove
    ) external onlyOwner() {
        _transfer(tokenHolder, address(this), tokenAmountToRemove);
    }
}
