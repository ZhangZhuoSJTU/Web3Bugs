//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18;

    constructor() ERC20("TestToken", "tT") {
        _mint(msg.sender, MAX_SUPPLY);
    }
}
