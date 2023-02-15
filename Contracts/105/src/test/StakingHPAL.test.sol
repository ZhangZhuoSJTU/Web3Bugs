// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.10;

import "ds-test/test.sol";
import "forge-std/Vm.sol";
import "forge-std/console.sol";
import {Utils} from "./utils/Utils.sol";

import {PaladinToken} from "../../contracts/test/PaladinToken.sol";
import {HolyPaladinToken} from "../../contracts/HolyPaladinToken.sol";

contract StakingHPALTest is DSTest {
    Vm internal immutable vm = Vm(HEVM_ADDRESS);

    Utils internal utils;

    address payable[] internal users;

    PaladinToken internal pal;
    HolyPaladinToken internal hpal;

    function setUp() public {
        utils = new Utils();
        users = utils.createUsers(2);

        uint256 palSupply = 50000000 * 1e18;
        pal = new PaladinToken(palSupply, address(this), address(this));
        pal.setTransfersAllowed(true);

        //hPAL constructor parameters
        uint256 startDropPerSecond = 0.0005 * 1e18;
        uint256 endDropPerSecond = 0.00001 * 1e18;
        uint256 dropDecreaseDuration = 63115200;
        uint256 baseLockBonusRatio = 1 * 1e18;
        uint256 minLockBonusRatio = 2 * 1e18;
        uint256 maxLockBonusRatio = 6 * 1e18;

        hpal = new HolyPaladinToken(
            address(pal),
            address(this),
            address(this),
            startDropPerSecond,
            endDropPerSecond,
            dropDecreaseDuration,
            baseLockBonusRatio,
            minLockBonusRatio,
            maxLockBonusRatio
        );
    }

    // using uint72 since we gave only 1 000 PAL to the user
    function testStaking(uint72 amount) public {
        address payable staker = users[0];

        uint256 transferAmount = 1000 * 1e18;

        pal.transfer(staker, transferAmount);

        uint256 previousBalance = pal.balanceOf(staker);
        uint256 previousStakedBalance = hpal.balanceOf(staker);
        uint256 previousContractBalance = pal.balanceOf(address(hpal));
        uint256 previousTotalSupply = hpal.totalSupply();

        vm.prank(staker);

        pal.approve(address(hpal), amount);

        if(amount == 0){
            vm.expectRevert(
                bytes("hPAL: Null amount")
            );
            vm.prank(staker);
            hpal.stake(amount);

            uint256 newBalance = pal.balanceOf(staker);
            uint256 newStakedBalance = hpal.balanceOf(staker);
            uint256 newContractBalance = pal.balanceOf(address(hpal));
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalance, previousBalance);
            assertEq(newStakedBalance, previousStakedBalance);
            assertEq(newContractBalance, previousContractBalance);
            assertEq(newTotalSupply, previousTotalSupply);
        }
        else if(amount > previousBalance) {
            vm.expectRevert(
                bytes("ERC20: transfer amount exceeds balance")
            );
            vm.prank(staker);
            hpal.stake(amount);

            uint256 newBalance = pal.balanceOf(staker);
            uint256 newStakedBalance = hpal.balanceOf(staker);
            uint256 newContractBalance = pal.balanceOf(address(hpal));
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalance, previousBalance);
            assertEq(newStakedBalance, previousStakedBalance);
            assertEq(newContractBalance, previousContractBalance);
            assertEq(newTotalSupply, previousTotalSupply);
        }
        else{
            vm.prank(staker);
            uint256 returnAmount = hpal.stake(amount);

            assertEq(returnAmount, amount);

            uint256 newBalance = pal.balanceOf(staker);
            uint256 newStakedBalance = hpal.balanceOf(staker);
            uint256 newContractBalance = pal.balanceOf(address(hpal));
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalance, previousBalance - amount);
            assertEq(newStakedBalance, previousStakedBalance + amount);
            assertEq(newContractBalance, previousContractBalance + amount);
            assertEq(newTotalSupply, previousTotalSupply + amount);

        }

    }

    // using uint72 since we gave only 1 000 PAL to the user
    function testUnstaking(uint72 amount) public {
        address payable staker = users[0];

        uint256 transferAmount = 1000 * 1e18;

        uint256 stakingAmount = 700 * 1e18;

        pal.transfer(staker, transferAmount);

        vm.prank(staker);
        pal.approve(address(hpal), stakingAmount);
            
        vm.prank(staker);
        hpal.stake(stakingAmount);

        vm.prank(staker);
        hpal.cooldown();

        utils.advanceTime(864100);

        uint256 previousBalance = pal.balanceOf(staker);
        uint256 previousStakedBalance = hpal.balanceOf(staker);
        uint256 previousContractBalance = pal.balanceOf(address(hpal));
        uint256 previousTotalSupply = hpal.totalSupply();

        if(amount == 0){
            vm.expectRevert(
                bytes("hPAL: Null amount")
            );
            vm.prank(staker);
            hpal.unstake(amount, staker);

            uint256 newBalance = pal.balanceOf(staker);
            uint256 newStakedBalance = hpal.balanceOf(staker);
            uint256 newContractBalance = pal.balanceOf(address(hpal));
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalance, previousBalance);
            assertEq(newStakedBalance, previousStakedBalance);
            assertEq(newContractBalance, previousContractBalance);
            assertEq(newTotalSupply, previousTotalSupply);
        }
        else if(amount > previousStakedBalance) {
            vm.prank(staker);
            uint256 returnAmount = hpal.unstake(amount, staker);

            assertLt(returnAmount, amount);
            assertEq(returnAmount, previousStakedBalance);

            uint256 newBalance = pal.balanceOf(staker);
            uint256 newStakedBalance = hpal.balanceOf(staker);
            uint256 newContractBalance = pal.balanceOf(address(hpal));
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalance, previousBalance + returnAmount);
            assertEq(newStakedBalance, 0);
            assertEq(newContractBalance, previousContractBalance - returnAmount);
            assertEq(newTotalSupply, previousTotalSupply - returnAmount);
        }
        else{
            vm.prank(staker);
            uint256 returnAmount = hpal.unstake(amount, staker);

            assertEq(returnAmount, amount);

            uint256 newBalance = pal.balanceOf(staker);
            uint256 newStakedBalance = hpal.balanceOf(staker);
            uint256 newContractBalance = pal.balanceOf(address(hpal));
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalance, previousBalance + amount);
            assertEq(newStakedBalance, previousStakedBalance - amount);
            assertEq(newContractBalance, previousContractBalance - amount);
            assertEq(newTotalSupply, previousTotalSupply - amount);

        }

    }

    function testClaim(uint72 amount) public {
        address payable staker = users[0];

        uint256 transferAmount = 1000 * 1e18;

        uint256 stakingAmount = 700 * 1e18;

        pal.transfer(staker, transferAmount);

        pal.approve(address(hpal), 1000000 * 1e18);

        vm.prank(staker);
        pal.approve(address(hpal), stakingAmount);
            
        vm.prank(staker);
        hpal.stake(stakingAmount);

        vm.prank(staker);
        hpal.cooldown();

        utils.advanceTime(864100);

        vm.prank(staker);
        hpal.unstake(stakingAmount, staker);

        uint256 previousBalance = pal.balanceOf(staker);
        uint256 previousVaultBalance = pal.balanceOf(address(this));

        uint256 claimableAmount = hpal.claimableRewards(staker);

        if(amount == 0){
            vm.expectRevert(
                bytes("hPAL: incorrect amount")
            );
            vm.prank(staker);
            hpal.claim(amount);

            uint256 newBalance = pal.balanceOf(staker);
            uint256 newVaultBalance = pal.balanceOf(address(this));

            assertEq(newBalance, previousBalance);
            assertEq(newVaultBalance, previousVaultBalance);
        }
        else if(amount > claimableAmount) {
            vm.prank(staker);
            hpal.claim(amount);

            uint256 newBalance = pal.balanceOf(staker);
            uint256 newVaultBalance = pal.balanceOf(address(this));

            assertEq(newBalance, previousBalance + claimableAmount);
            assertEq(newVaultBalance, previousVaultBalance - claimableAmount);

            uint256 newClaimableAmount = hpal.claimableRewards(staker);

            assertEq(newClaimableAmount, 0);
        }
        else{
            vm.prank(staker);
            hpal.claim(amount);

            uint256 newBalance = pal.balanceOf(staker);
            uint256 newVaultBalance = pal.balanceOf(address(this));

            assertEq(newBalance, previousBalance + amount);
            assertEq(newVaultBalance, previousVaultBalance - amount);

            uint256 newClaimableAmount = hpal.claimableRewards(staker);

            assertEq(newClaimableAmount, claimableAmount - amount);

        }

    }

    function testTransfer(uint72 amount) public {
        address payable staker = users[0];
        address payable receiver = users[1];

        uint256 transferAmount = 1000 * 1e18;

        uint256 stakingAmount = 700 * 1e18;

        pal.transfer(staker, transferAmount);

        vm.prank(staker);
        pal.approve(address(hpal), stakingAmount);
            
        vm.prank(staker);
        hpal.stake(stakingAmount);

        uint256 previousBalanceStaker = hpal.balanceOf(staker);
        uint256 previousBalanceReceiver = hpal.balanceOf(receiver);
        uint256 previousTotalSupply = hpal.totalSupply();

        if(amount > stakingAmount) {
            vm.expectRevert(
                bytes("hPAL: Available balance too low")
            );
            vm.prank(staker);
            hpal.transfer(receiver, amount);

            uint256 newBalanceStaker = hpal.balanceOf(staker);
            uint256 newBalanceReceiver = hpal.balanceOf(receiver);
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalanceStaker, previousBalanceStaker);
            assertEq(newBalanceReceiver, previousBalanceReceiver);
            assertEq(newTotalSupply, previousTotalSupply);
        }
        else{
            vm.prank(staker);
            bool success = hpal.transfer(receiver, amount);

            assertTrue(success);

            uint256 newBalanceStaker = hpal.balanceOf(staker);
            uint256 newBalanceReceiver = hpal.balanceOf(receiver);
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalanceStaker, previousBalanceStaker - amount);
            assertEq(newBalanceReceiver, previousBalanceReceiver + amount);
            assertEq(newTotalSupply, previousTotalSupply);

        }
    }

}