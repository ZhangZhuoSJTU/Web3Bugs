// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "ERC721A/ERC721A.sol";

contract FakeMoonbirds is ERC721A {
    constructor() ERC721A("Fake Bored Ape Yacht Club", "FBAYC") {}

    function mint(address to, uint256 quantity) public {
        _mint(to, quantity);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return string(abi.encodePacked("https://live---metadata-5covpqijaa-uc.a.run.app/metadata/", _toString(tokenId)));
    }
}

contract CreateFakeMoonbirdsScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        FakeMoonbirds fakeMoonbirds = new FakeMoonbirds();
        console.log("fake moonbirds:", address(fakeMoonbirds));

        fakeMoonbirds.mint(msg.sender, 250);
        fakeMoonbirds.mint(msg.sender, 250);
        // fakeMoonbirds.mint(msg.sender, 250);
        // fakeMoonbirds.mint(msg.sender, 250);
        // fakeMoonbirds.mint(msg.sender, 250);
        // fakeMoonbirds.mint(msg.sender, 250);
    }
}
