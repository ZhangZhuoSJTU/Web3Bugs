// SPDX-License-Identifier: MIT

pragma solidity =0.8.10;

import { ERC20PresetFixedSupply } from "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";

/// @dev Mock XDEFI ERC20 token contract used only for testing.
contract XDEFI is ERC20PresetFixedSupply {

    constructor(string memory name_, string memory symbol_, uint256 initialSupply_) ERC20PresetFixedSupply(name_, symbol_, initialSupply_, msg.sender) {}

}
