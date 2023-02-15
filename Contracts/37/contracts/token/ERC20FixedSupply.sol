// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20FixedSupply is ERC20 {
    uint8 internal immutable contractDecimals;

    /// TEMP Token constructor, implemented as a fixed supply
    /// @param totalTokenSupply total supply of the token, initially awarded to msg.sender
    constructor(
        uint8 _decimals,
        string memory name,
        string memory symbol,
        uint256 totalTokenSupply
    ) ERC20(name, symbol) {
        contractDecimals = _decimals;
        _mint(msg.sender, totalTokenSupply);
    }

    function decimals() public view override returns (uint8) {
        return contractDecimals;
    }
}
