// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "ERC721A/ERC721A.sol";

contract FakeBasedGhouls is ERC721A {
    constructor() ERC721A("Fake Based Ghouls", "GHOUL") {}

    function mint(address to, uint256 quantity) public {
        _mint(to, quantity);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return string(
            abi.encodePacked(
                "ipfs://bafybeibtw646yhcbfqiox46qcoforbq6rndurbnqx2slueso7gvdtmioty/", _toString(tokenId), ".json"
            )
        );
    }
}

contract CreateFakeBasedGhoulsScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        FakeBasedGhouls fakeBasedGhouls = new FakeBasedGhouls();
        console.log("fake ghoul:", address(fakeBasedGhouls));

        fakeBasedGhouls.mint(msg.sender, 250);
        fakeBasedGhouls.mint(msg.sender, 250);
    }
}
