// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../shared/Fixture.t.sol";
import "src/Cally.sol";

contract TestBuyOption is Fixture {
    event BoughtOption(uint256 indexed optionId, address indexed from, address indexed token);

    uint256 internal vaultId;
    uint256 internal premium;
    uint256 internal strike;

    uint8 internal premiumIndex;
    uint8 internal strikeIndex;
    Cally.Vault internal vault;

    function setUp() public {
        // create vault for babe
        vm.startPrank(babe);

        bayc.mint(babe, 1);
        bayc.setApprovalForAll(address(c), true);

        premiumIndex = 1;
        premium = c.premiumOptions(premiumIndex);
        strikeIndex = 1;
        strike = c.strikeOptions(strikeIndex);

        vaultId = c.createVault(1, address(bayc), premiumIndex, 1, strikeIndex, 0, Cally.TokenType.ERC721);
        vault = c.vaults(vaultId);
        vm.stopPrank();
    }

    function testItEmitsBoughtOptionEvent() public {
        // arrange
        vm.expectEmit(true, true, true, false);
        emit BoughtOption(4, address(this), address(bayc));

        // act
        c.buyOption{value: premium}(vaultId);
    }

    function testItIncrementsVaultOwnersUncollectedPremiums() public {
        // arrange
        uint256 expectedChange = premium;
        uint256 uncollectedPremiumsBefore = c.ethBalance(babe);

        // act
        c.buyOption{value: premium}(vaultId);
        uint256 uncollectedPremiumsAfter = c.ethBalance(babe);

        // assert
        uint256 uncollectedPremiumsChange = uncollectedPremiumsAfter - uncollectedPremiumsBefore;
        assertEq(uncollectedPremiumsChange, expectedChange, "Should have incremented uncollected premiums for owner");
    }

    function testItSendsPremiumETHToContract() public {
        // arrange
        uint256 expectedChange = premium;
        uint256 balanceBefore = address(c).balance;

        // act
        c.buyOption{value: premium}(vaultId);
        uint256 balanceAfter = address(c).balance;
        uint256 balanceChange = balanceAfter - balanceBefore;

        // assert
        assertEq(balanceChange, expectedChange, "Should have sent ETH to contract");
    }

    function testItMintsOptionERC721ToBuyer() public {
        // act
        uint256 optionId = c.buyOption{value: premium}(vaultId);

        // assert
        assertEq(c.ownerOf(optionId), address(this), "Should have minted option to buyer");
    }

    function testItSetsStrikeToReserveIfDutchAuctionStrikeIsSmaller() public {
        // arrange
        vm.startPrank(babe);
        bayc.mint(babe, 2);
        uint256 reserveStrike = 1.1337 ether;
        vaultId = c.createVault(2, address(bayc), premiumIndex, 1, strikeIndex, reserveStrike, Cally.TokenType.ERC721);
        vm.stopPrank();
        skip(24 hours);

        // act
        c.buyOption{value: premium}(vaultId);
        strike = c.vaults(vaultId).currentStrike;

        // assert
        assertEq(strike, reserveStrike, "Incorrect strike");
    }

    function testItSetsStrikeToCurrentDutchAuctionPrice() public {
        // arrange
        uint256 expectedStrike = strike;

        // act
        c.buyOption{value: premium}(vaultId);
        strike = c.vaults(vaultId).currentStrike;

        // assert
        assertEq(strike, expectedStrike, "Incorrect strike");
    }

    function testItSetsStrikeToCurrentDutchAuctionPriceAfterElapsedTime() public {
        // arrange
        skip(0.5 days);
        uint256 expectedStrike = strike / 4; // 0.5^2 * strike == strike / 4

        // act
        c.buyOption{value: premium}(vaultId);
        strike = c.vaults(vaultId).currentStrike;

        // assert
        assertEq(strike, expectedStrike, "Incorrect strike");
    }

    function testItSetsStrikeTo0AfterAuctionEnd() public {
        // arrange
        skip(1.1 days);
        uint256 expectedStrike = 0;

        // act
        c.buyOption{value: premium}(vaultId);
        strike = c.vaults(vaultId).currentStrike;

        // assert
        assertEq(strike, expectedStrike, "Incorrect strike");
    }

    function testItUpdatesExpiration() public {
        // arrange
        uint256 expectedExpiration = block.timestamp + vault.durationDays * 1 days;

        // act
        c.buyOption{value: premium}(vaultId);
        uint256 expiration = c.vaults(vaultId).currentExpiration;

        // assert
        assertEq(expiration, expectedExpiration, "Should have set expiration duration days in the future");
    }

    function testItCannotBuyIfAuctionHasNotStarted() public {
        // arrange
        vm.warp(block.timestamp - 100);

        // assert
        vm.expectRevert("Auction not started");
        c.buyOption{value: premium}(vaultId);
    }

    function testItCannotBuyIfVaultIsWithdrawing() public {
        // arrange
        vm.prank(babe);
        c.initiateWithdraw(vaultId);

        // assert
        vm.expectRevert("Vault is being withdrawn");
        c.buyOption{value: premium}(vaultId);
    }

    function testItCannotBuyIfVaultHasAlreadyBeenExercised() public {
        // arrange
        uint256 optionId = c.buyOption{value: premium}(vaultId);
        c.exercise{value: strike}(optionId);

        // assert
        vm.expectRevert("Vault already exercised");
        c.buyOption{value: premium}(vaultId);
    }

    function testItCannotBuyOptionTwice() public {
        // arrange
        c.buyOption{value: premium}(vaultId);

        // assert
        skip(300);
        vm.expectRevert("Auction not started");
        c.buyOption{value: premium}(vaultId);
    }

    function testItCreditsPremiumToBeneficiary() public {
        // arrange
        vm.prank(babe);
        c.setVaultBeneficiary(vaultId, bob);

        // act
        c.buyOption{value: premium}(vaultId);
        uint256 bobEthBalance = c.ethBalance(bob);

        // assert
        assertEq(bobEthBalance, premium, "Should have credited premium to beneficiary (bob)");
    }

    function testItOnlyBuysValidFromValidVaultId() public {
        // act
        vm.expectRevert("Not vault type");
        c.buyOption{value: premium}(2);
    }

    function testItBuysOption(uint256 vaultId_) public {
        // arrange
        vm.assume(vaultId_ % 2 != 0);
        vm.assume(c.vaults(vaultId_).currentExpiration > 0);

        // act
        uint256 optionId = c.buyOption{value: premium}(vaultId_);

        // assert
        assertEq(optionId, vaultId_ + 1, "Option ID should be 1 less than vault ID");
    }
}
