// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "ERC721A/ERC721A.sol";

contract FakePudgyPenguins is ERC721A {
    constructor() ERC721A("Fake Pudgy Penguins", "PPG") {}

    function mint(address to, uint256 quantity) public {
        _mint(to, quantity);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return string(
            abi.encodePacked("https://ipfs.io/ipfs/QmWXJXRdExse2YHRY21Wvh4pjRxNRQcWVhcKw4DLVnqGqs/", _toString(tokenId))
        );
    }
}

contract CreateFakePudgyPenguinsScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        FakePudgyPenguins fakePudgyPenguins = new FakePudgyPenguins();
        console.log("fake Pudgy Penguins:", address(fakePudgyPenguins));

        fakePudgyPenguins.mint(msg.sender, 250);
        fakePudgyPenguins.mint(msg.sender, 250);
    }
}
