// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

contract MockNFT is ERC721Upgradeable {
    uint256 at;

    constructor(string memory _name, string memory _symbol) initializer {
        __ERC721_init_unchained(_name, _symbol);
    }

    function tokenURI(uint256) public pure override returns (string memory) {
        return "";
    }

    function mint() external {
        _mint(msg.sender, at++);
    }

    function totalSupply() external view returns (uint256) {
        return at;
    }
}
