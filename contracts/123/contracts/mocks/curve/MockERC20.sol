// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-0.8/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 dec;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _initialRecipient,
        uint256 _initialMint
    ) ERC20(_name, _symbol) {
        dec = _decimals;
        _mint(_initialRecipient, _initialMint * (10**uint256(_decimals)));
    }

    function decimals() public view override returns (uint8) {
        return dec;
    }

    function mint(uint256 amount) public {
        _mint(msg.sender, amount);
    }
}
