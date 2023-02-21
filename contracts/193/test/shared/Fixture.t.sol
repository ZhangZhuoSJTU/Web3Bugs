// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "forge-std/Test.sol";
import "solmate/tokens/ERC721.sol";

import "../../src/Caviar.sol";
import "../../src/Pair.sol";
import "./mocks/MockERC721.sol";
import "./mocks/MockERC20.sol";
import "../../script/CreatePair.s.sol";

contract Fixture is Test, ERC721TokenReceiver {
    MockERC721 public bayc;
    MockERC20 public usd;

    CreatePairScript public createPairScript;
    Caviar public c;
    Pair public p;
    LpToken public lpToken;
    Pair public ethPair;
    LpToken public ethPairLpToken;

    address public babe = address(0xbabe);

    constructor() {
        createPairScript = new CreatePairScript();

        c = new Caviar();

        bayc = new MockERC721("yeet", "YEET");
        usd = new MockERC20("us dollar", "USD");

        p = c.create(address(bayc), address(usd), bytes32(0));
        lpToken = LpToken(p.lpToken());

        ethPair = c.create(address(bayc), address(0), bytes32(0));
        ethPairLpToken = LpToken(ethPair.lpToken());

        vm.label(babe, "babe");
        vm.label(address(c), "caviar");
        vm.label(address(bayc), "bayc");
        vm.label(address(usd), "usd");
        vm.label(address(p), "pair");
        vm.label(address(lpToken), "LP-token");
        vm.label(address(ethPair), "ethPair");
        vm.label(address(ethPairLpToken), "ethPair-LP-token");
    }

    receive() external payable {}
}
