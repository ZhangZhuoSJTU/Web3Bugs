// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "ERC721A/ERC721A.sol";

contract FakeBoredApeYachtClub is ERC721A {
    constructor() ERC721A("Fake Bored Ape Yacht Club", "FBAYC") {}

    function mint(address to, uint256 quantity) public {
        _mint(to, quantity);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return string(abi.encodePacked("ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/", _toString(tokenId)));
    }
}

contract CreateFakeBoredApeYachtClubScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        FakeBoredApeYachtClub fakeBoredApeYachtClub = new FakeBoredApeYachtClub();
        console.log("fake bayc:", address(fakeBoredApeYachtClub));

        fakeBoredApeYachtClub.mint(msg.sender, 250);
        fakeBoredApeYachtClub.mint(msg.sender, 250);
        fakeBoredApeYachtClub.mint(msg.sender, 250);
        fakeBoredApeYachtClub.mint(msg.sender, 250);
        fakeBoredApeYachtClub.mint(msg.sender, 250);
        fakeBoredApeYachtClub.mint(msg.sender, 250);
    }
}
