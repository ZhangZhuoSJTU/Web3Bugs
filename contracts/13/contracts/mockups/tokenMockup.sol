// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import "hardhat/console.sol";

contract tokenMockup is ERC20PresetFixedSupply {
    constructor(
        string memory name,
        string memory symbol,
        uint256 supply,
        address owner
    ) ERC20PresetFixedSupply(name, symbol, supply, owner) {}
}
