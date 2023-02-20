// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../shared/Fixture.t.sol";
import "src/Cally.sol";

contract TestInitiateWithdraw is Fixture {
    event InitiatedWithdrawal(uint256 indexed vaultId, address indexed from);

    uint256 internal vaultId;
    Cally.Vault internal vault;

    function setUp() public {
        bayc.mint(address(this), 1);
        bayc.setApprovalForAll(address(c), true);

        vaultId = c.createVault(1, address(bayc), 1, 1, 1, 0, Cally.TokenType.ERC721);
    }

    function testItEmitsInitiateWithdrawalEvent() public {
        // arrange
        vm.expectEmit(true, true, false, false);
        emit InitiatedWithdrawal(vaultId, address(this));

        // act
        c.initiateWithdraw(vaultId);
    }

    function testItMarksVaultAsWithdrawing() public {
        // act
        c.initiateWithdraw(vaultId);

        // assert
        bool isWithdrawing = c.vaults(vaultId).isWithdrawing;
        assertTrue(isWithdrawing, "Should have marked vault as withdrawing");
    }

    function testItCannotWithdrawVaultYouDontOwn() public {
        // arrange
        vm.prank(babe);

        // act
        vm.expectRevert("You are not the owner");
        c.initiateWithdraw(vaultId);
    }

    function testCannotInitiateWithdrawalForInvalidVaultId() public {
        // act
        vm.expectRevert("Not vault type");
        c.initiateWithdraw(vaultId + 1);
    }
}
