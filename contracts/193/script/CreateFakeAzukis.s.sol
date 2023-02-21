// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "ERC721A/ERC721A.sol";

contract FakeAzukis is ERC721A {
    constructor() ERC721A("Fake Azuki", "AZUKI") {}

    function mint(address to, uint256 quantity) public {
        _mint(to, quantity);
    }

    function tokenURI(uint256 tokenId) public pure override returns (string memory) {
        return string(
            abi.encodePacked(
                "https://ikzttp.mypinata.cloud/ipfs/QmQFkLSQysj94s5GvTHPyzTxrawwtjgiiYS2TBLgrvw8CW/", _toString(tokenId)
            )
        );
    }
}

contract CreateFakeAzukisScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        FakeAzukis fakeAzukis = new FakeAzukis();
        console.log("fake Azuki:", address(fakeAzukis));

        fakeAzukis.mint(msg.sender, 250);
        fakeAzukis.mint(msg.sender, 250);
    }
}
