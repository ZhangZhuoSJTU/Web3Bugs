// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../shared/Fixture.t.sol";
import "src/Cally.sol";

contract TestHarvest is Fixture {
    event Transfer(address indexed from, address indexed to, uint256 indexed id);
    event Harvested(address indexed from, uint256 amount);

    uint256 internal vaultId;
    uint256 internal strike;
    uint256 internal optionId;
    uint256 internal tokenId;
    Cally.Vault internal vault;

    // solhint-disable-next-line
    receive() external payable {}

    function setUp() public {
        bayc.mint(address(this), 1);
        bayc.setApprovalForAll(address(c), true);

        uint8 strikeIndex = 1;
        strike = c.strikeOptions(strikeIndex);
        tokenId = 1;
        uint8 premiumIndex = 1;
        uint256 premium = c.premiumOptions(premiumIndex);

        vaultId = c.createVault(tokenId, address(bayc), premiumIndex, strikeIndex, 1, 0, Cally.TokenType.ERC721);
        vault = c.vaults(vaultId);

        vm.startPrank(babe);
        vm.deal(babe, 100 ether);
        optionId = c.buyOption{value: premium}(vaultId);
        vm.stopPrank();
    }

    function testItEmitsHarvestedEvent() public {
        // arrange
        uint256 balance = c.ethBalance(address(this));
        vm.expectEmit(true, false, false, true);
        emit Harvested(address(this), balance);

        // act
        c.harvest();
    }

    function testItSendsETHBalanceToOwner() public {
        // arrange
        uint256 expectedChange = c.ethBalance(address(this));
        uint256 balanceBefore = address(this).balance;

        // act
        c.harvest();
        uint256 change = address(this).balance - balanceBefore;

        assertEq(change, expectedChange, "Should have sent ethBalance to owner");
    }

    function testItResetsOwnersETHBalance() public {
        // act
        c.harvest();

        // assert
        assertEq(c.ethBalance(address(this)), 0, "Should have cleared owners eth balance");
    }

    function testItReturnsAmount() public {
        // arrange
        uint256 expectedAmount = c.ethBalance(address(this));

        // act
        uint256 amount = c.harvest();

        // assert
        assertEq(amount, expectedAmount, "Should have returned amount");
    }
}
