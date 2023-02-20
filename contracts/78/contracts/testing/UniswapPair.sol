// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../ERC677/ERC677.sol";

contract UniswapPair is ERC677 {
    address public factory;

    constructor(
        address _factory,
        string memory name,
        string memory symbol
    ) ERC677(name, symbol) {
        factory = _factory;
        _mint(_msgSender(), 10 ether);
    }
}
