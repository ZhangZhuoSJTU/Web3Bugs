// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../shared/Fixture.t.sol";
import "src/Cally.sol";

contract TestVaultBeneficiary is Test, Fixture {
    uint256 internal vaultId;

    function setUp() public {
        bayc.mint(address(this), 1);
        bayc.setApprovalForAll(address(c), true);
        vaultId = c.createVault(1, address(bayc), 2, 1, 0, 0, Cally.TokenType.ERC721);
    }

    function testItSetsVaultBeneficiary() public {
        // arrange
        address beneficiary = address(0xCafe);

        // act
        c.setVaultBeneficiary(vaultId, beneficiary);
        address vaultBeneficiary = c.getVaultBeneficiary(vaultId);

        // assert
        assertEq(vaultBeneficiary, beneficiary, "Should have set beneficiary to 0xcafe");
    }

    function testCannotSetBeneficiaryIfNotVaultOwner() public {
        // arrange
        vm.prank(babe);

        // act
        vm.expectRevert("Not owner");
        c.setVaultBeneficiary(vaultId, address(0xdead));
    }

    function testCannotSetBeneficiaryIfNotVaultTokenType() public {
        // act
        vm.expectRevert("Not vault type");
        c.setVaultBeneficiary(2, address(0xdead));
    }

    function testItSetsVaultBeneficiaryAsVaultOwnerIfNotSet() public {
        // act
        c.setVaultBeneficiary(vaultId, address(0));
        address vaultBeneficiary = c.getVaultBeneficiary(vaultId);

        // assert
        assertEq(vaultBeneficiary, address(this), "Should have set beneficiary to owner if not set");
    }

    function testItResetsBeneficiaryOnTransfer() public {
        // arrange
        c.setVaultBeneficiary(vaultId, babe);

        // act
        c.transferFrom(address(this), bob, vaultId);
        address vaultBeneficiary = c.getVaultBeneficiary(vaultId);

        // assert
        assertEq(vaultBeneficiary, bob, "Should have cleared babe and set bob as beneficiary");
    }
}
