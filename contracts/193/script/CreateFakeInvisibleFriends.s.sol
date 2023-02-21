// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "ERC721A/ERC721A.sol";

contract FakeInvisibleFriends is ERC721A {
    constructor() ERC721A("Fake Invisible Friends", "INVSBLE") {}

    function mint(address to, uint256 quantity) public {
        _mint(to, quantity);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return string(abi.encodePacked(" ipfs://QmarGRwVKPaCe2s5QSSTMEdbYDwKxFz6bAn58YZPPcWc7k/", _toString(tokenId)));
    }
}

contract CreateFakeInvisibleFriendsScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        FakeInvisibleFriends fakeInvisibleFriends = new FakeInvisibleFriends();
        console.log("fake Invisble friends:", address(fakeInvisibleFriends));

        fakeInvisibleFriends.mint(msg.sender, 250);
        fakeInvisibleFriends.mint(msg.sender, 250);
    }
}
