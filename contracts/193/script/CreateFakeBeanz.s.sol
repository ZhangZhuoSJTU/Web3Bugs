// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "ERC721A/ERC721A.sol";

contract FakeBeanz is ERC721A {
    constructor() ERC721A("Fake Beanz", "BEANZ") {}

    function mint(address to, uint256 quantity) public {
        _mint(to, quantity);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return string(
            abi.encodePacked(
                "https://ikzttp.mypinata.cloud/ipfs/QmPZKyuRw4nQTD6S6R5HaNAXwoQVMj8YydDmad3rC985WZ/", _toString(tokenId)
            )
        );
    }
}

contract CreateFakeBeanzScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        FakeBeanz fakeBeanz = new FakeBeanz();
        console.log("fake Beanz:", address(fakeBeanz));

        fakeBeanz.mint(msg.sender, 250);
        fakeBeanz.mint(msg.sender, 250);
    }
}
