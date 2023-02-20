// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../shared/Fixture.t.sol";
import "src/Cally.sol";

contract TestExercise is Fixture {
    event Transfer(address indexed from, address indexed to, uint256 indexed id);
    event ExercisedOption(uint256 indexed optionId, address indexed from);

    uint256 internal vaultId;
    uint256 internal strike;
    uint256 internal optionId;
    uint256 internal tokenId;
    uint256 internal tokenAmount;
    uint256 internal premium;
    Cally.Vault internal vault;

    function setUp() public {
        // create vault for babe
        vm.startPrank(babe);

        tokenId = 1;
        bayc.mint(babe, tokenId);
        bayc.setApprovalForAll(address(c), true);

        tokenAmount = 1337;
        link.mint(babe, tokenAmount);
        link.approve(address(c), type(uint256).max);

        uint8 strikeIndex = 1;
        strike = c.strikeOptions(strikeIndex);
        uint8 premiumIndex = 1;
        premium = c.premiumOptions(premiumIndex);

        vaultId = c.createVault(tokenId, address(bayc), premiumIndex, 1, strikeIndex, 0, Cally.TokenType.ERC721);
        vault = c.vaults(vaultId);
        vm.stopPrank();

        optionId = c.buyOption{value: premium}(vaultId);
    }

    function testItEmitsExercisedEvent() public {
        // arrange
        vm.expectEmit(true, true, true, false);
        emit ExercisedOption(optionId, address(this));

        // act
        c.exercise{value: strike}(optionId);
    }

    function testItShouldTransferERC721ToOptionOwner() public {
        // arrange
        uint256 balanceBefore = bayc.balanceOf(address(this));

        // act
        c.exercise{value: strike}(optionId);

        // assert
        assertEq(bayc.ownerOf(tokenId), address(this), "Should have transferred NFT to exerciser");
        assertEq(bayc.balanceOf(address(this)), balanceBefore + 1, "Should have transferred NFT to exerciser");
    }

    function testItShouldTransferERC20ToOptionOwner() public {
        // arrange
        vm.prank(babe);
        vaultId = c.createVault(tokenAmount, address(link), 1, 1, 1, 0, Cally.TokenType.ERC20);
        vault = c.vaults(vaultId);
        optionId = c.buyOption{value: premium}(vaultId);
        uint256 balanceBefore = link.balanceOf(address(this));

        // act
        c.exercise{value: strike}(optionId);
        uint256 change = link.balanceOf(address(this)) - balanceBefore;

        // assert
        assertEq(change, tokenAmount, "Should have transferred LINK to exerciser");
        assertEq(link.balanceOf(address(c)), 0, "Should have transferred LINK from Cally");
    }

    function testItIncrementsEthBalanceOfVaultOwner() public {
        // arrange
        uint256 expectedChange = strike;
        uint256 balanceBefore = c.ethBalance(babe);

        // act
        c.exercise{value: strike}(optionId);
        uint256 balanceChange = c.ethBalance(babe) - balanceBefore;

        // assert
        assertEq(balanceChange, expectedChange, "Should have incremented vault owner's eth balance");
    }

    function testItShouldMarkVaultAsExercised() public {
        // act
        c.exercise{value: strike}(optionId);

        // assert
        bool isExercised = c.vaults(vaultId).isExercised;
        assertTrue(isExercised, "Should have marked vault as exercised");
    }

    function testItShouldBurnOptionERC721() public {
        // act
        vm.expectEmit(true, true, true, false);
        emit Transfer(address(this), address(0), optionId);
        c.exercise{value: strike}(optionId);

        // assert
        vm.expectRevert("NOT_MINTED");
        c.ownerOf(optionId);
    }

    function testCannotExerciseExpiredOption() public {
        // arrange
        skip(vault.durationDays * 1 days);

        // act
        vm.expectRevert("Option has expired");
        c.exercise{value: strike}(optionId);
    }

    function testCannotExerciseOptionYouDontOwn() public {
        // arrange
        vm.deal(babe, strike);
        vm.prank(babe);

        // act
        vm.expectRevert("You are not the owner");
        c.exercise{value: strike}(optionId);
    }

    function testCannotExerciseOptionTwice() public {
        // arrange
        c.exercise{value: strike}(optionId);

        // act
        vm.expectRevert("NOT_MINTED");
        c.exercise{value: strike}(optionId);
    }

    function testItCreditsStrikeToBeneficiary() public {
        // arrange
        vm.prank(babe);
        c.setVaultBeneficiary(vaultId, bob);

        // act
        c.exercise{value: strike}(optionId);
        uint256 bobEthBalance = c.ethBalance(bob);

        // assert
        assertEq(bobEthBalance, strike, "Should have credited strike to beneficiary (bob)");
    }

    function testCannotExerciseInvalidOptionId() public {
        // act
        vm.expectRevert("Not option type");
        c.exercise{value: strike}(optionId - 1);
    }
}
