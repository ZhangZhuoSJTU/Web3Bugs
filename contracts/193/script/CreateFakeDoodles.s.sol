// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "ERC721A/ERC721A.sol";

contract FakeDoodles is ERC721A {
    constructor() ERC721A("Fake Doodles", "DOODLE") {}

    function mint(address to, uint256 quantity) public {
        _mint(to, quantity);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return string(abi.encodePacked("ipfs://QmPMc4tcBsMqLRuCQtPmPe84bpSjrC3Ky7t3JWuHXYB4aS/", _toString(tokenId)));
    }
}

contract CreateFakeDoodlesScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        FakeDoodles fakeDoodles = new FakeDoodles();
        console.log("fake doodles:", address(fakeDoodles));

        fakeDoodles.mint(msg.sender, 250);
        fakeDoodles.mint(msg.sender, 250);
    }
}
