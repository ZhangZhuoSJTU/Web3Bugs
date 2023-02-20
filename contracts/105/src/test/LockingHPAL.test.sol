// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.10;

import "ds-test/test.sol";
import "forge-std/Vm.sol";
import "forge-std/console.sol";
import {Utils} from "./utils/Utils.sol";

import {PaladinToken} from "../../contracts/test/PaladinToken.sol";
import {HolyPaladinToken} from "../../contracts/HolyPaladinToken.sol";

contract LockingHPALTest is DSTest {
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
    function testLockingAmount(uint72 amount) public {
        address payable locker = users[0];

        uint256 transferAmount = 1000 * 1e18;

        uint256 stakingAmount = 700 * 1e18;

        pal.transfer(locker, transferAmount);

        vm.prank(locker);
        pal.approve(address(hpal), stakingAmount);
            
        vm.prank(locker);
        hpal.stake(stakingAmount);

        uint256 lockDuration = 31557600;

        HolyPaladinToken.TotalLock memory previousTotalLocked = hpal.getCurrentTotalLock();

        if(amount == 0){
            vm.expectRevert(
                bytes("hPAL: Null amount")
            );
            vm.prank(locker);
            hpal.lock(amount, lockDuration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, 0);
            assertEq(userLock.startTimestamp, 0);
            assertEq(userLock.duration, 0);
            assertEq(userLock.fromBlock, 0);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else if(amount > stakingAmount) {
            vm.expectRevert(
                bytes("hPAL: Amount over balance")
            );
            vm.prank(locker);
            hpal.lock(amount, lockDuration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, 0);
            assertEq(userLock.startTimestamp, 0);
            assertEq(userLock.duration, 0);
            assertEq(userLock.fromBlock, 0);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else{
            vm.prank(locker);
            hpal.lock(amount, lockDuration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, amount);
            assertEq(userLock.startTimestamp, block.timestamp);
            assertEq(userLock.duration, lockDuration);
            assertEq(userLock.fromBlock, block.number);
            assertEq(newTotalLocked.total, previousTotalLocked.total + amount);

        }

    }

    function testReLockingAmount(uint72 amount) public {
        address payable locker = users[0];

        uint256 transferAmount = 1000 * 1e18;

        uint256 stakingAmount = 700 * 1e18;

        uint256 lockAmount = 300 * 1e18;

        pal.transfer(locker, transferAmount);

        vm.prank(locker);
        pal.approve(address(hpal), stakingAmount);
            
        vm.prank(locker);
        hpal.stake(stakingAmount);

        uint256 lockDuration = 31557600;

        vm.prank(locker);
        hpal.lock(lockAmount, lockDuration);

        HolyPaladinToken.UserLock memory previousLock = hpal.getUserLock(locker);
        HolyPaladinToken.TotalLock memory previousTotalLocked = hpal.getCurrentTotalLock();

        if(amount == 0){
            vm.expectRevert(
                bytes("hPAL: Null amount")
            );
            vm.prank(locker);
            hpal.lock(amount, lockDuration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else if(amount > stakingAmount) {
            vm.expectRevert(
                bytes("hPAL: Amount over balance")
            );
            vm.prank(locker);
            hpal.lock(amount, lockDuration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else if(amount < lockAmount) {
            vm.expectRevert(
                bytes("hPAL: smaller amount")
            );
            vm.prank(locker);
            hpal.lock(amount, lockDuration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else{
            vm.prank(locker);
            hpal.lock(amount, lockDuration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, amount);
            assertEq(userLock.startTimestamp, block.timestamp);
            assertEq(userLock.duration, lockDuration);
            assertEq(userLock.fromBlock, block.number);
            assertEq(newTotalLocked.total, previousTotalLocked.total + amount - lockAmount);

        }

    }

    function testLockingDuration(uint256 duration) public {
        address payable locker = users[0];

        uint256 transferAmount = 1000 * 1e18;

        uint256 stakingAmount = 700 * 1e18;

        pal.transfer(locker, transferAmount);

        vm.prank(locker);
        pal.approve(address(hpal), stakingAmount);
            
        vm.prank(locker);
        hpal.stake(stakingAmount);

        uint256 lockAmount = 300 * 1e18;

        HolyPaladinToken.TotalLock memory previousTotalLocked = hpal.getCurrentTotalLock();

        if(duration < hpal.MIN_LOCK_DURATION()){
            vm.expectRevert(
                bytes("hPAL: Lock duration under min")
            );
            vm.prank(locker);
            hpal.lock(lockAmount, duration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, 0);
            assertEq(userLock.startTimestamp, 0);
            assertEq(userLock.duration, 0);
            assertEq(userLock.fromBlock, 0);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else if(duration > hpal.MAX_LOCK_DURATION()) {
            vm.expectRevert(
                bytes("hPAL: Lock duration over max")
            );
            vm.prank(locker);
            hpal.lock(lockAmount, duration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, 0);
            assertEq(userLock.startTimestamp, 0);
            assertEq(userLock.duration, 0);
            assertEq(userLock.fromBlock, 0);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else{
            vm.prank(locker);
            hpal.lock(lockAmount, duration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, lockAmount);
            assertEq(userLock.startTimestamp, block.timestamp);
            assertEq(userLock.duration, duration);
            assertEq(userLock.fromBlock, block.number);
            assertEq(newTotalLocked.total, previousTotalLocked.total + lockAmount);

        }
    }

    function testReLockingDuration(uint256 duration) public {
        address payable locker = users[0];

        uint256 transferAmount = 1000 * 1e18;

        uint256 stakingAmount = 700 * 1e18;

        pal.transfer(locker, transferAmount);

        vm.prank(locker);
        pal.approve(address(hpal), stakingAmount);
            
        vm.prank(locker);
        hpal.stake(stakingAmount);

        uint256 lockAmount = 300 * 1e18;

        uint256 lockDuration = 31557600;

        vm.prank(locker);
        hpal.lock(lockAmount, lockDuration);

        HolyPaladinToken.UserLock memory previousLock = hpal.getUserLock(locker);

        HolyPaladinToken.TotalLock memory previousTotalLocked = hpal.getCurrentTotalLock();

        if(duration < hpal.MIN_LOCK_DURATION()){
            vm.expectRevert(
                bytes("hPAL: Lock duration under min")
            );
            vm.prank(locker);
            hpal.lock(lockAmount, duration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else if(duration > hpal.MAX_LOCK_DURATION()) {
            vm.expectRevert(
                bytes("hPAL: Lock duration over max")
            );
            vm.prank(locker);
            hpal.lock(lockAmount, duration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else if(duration < lockDuration) {
            vm.expectRevert(
                bytes("hPAL: smaller duration")
            );
            vm.prank(locker);
            hpal.lock(lockAmount, duration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else{
            vm.prank(locker);
            hpal.lock(lockAmount, duration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);

        }

    }

    function testIncreaseLockAmount(uint72 amount) public {
        address payable locker = users[0];

        uint256 transferAmount = 1000 * 1e18;

        uint256 stakingAmount = 700 * 1e18;

        uint256 lockAmount = 300 * 1e18;

        pal.transfer(locker, transferAmount);

        vm.prank(locker);
        pal.approve(address(hpal), stakingAmount);
            
        vm.prank(locker);
        hpal.stake(stakingAmount);

        uint256 lockDuration = 31557600;

        vm.prank(locker);
        hpal.lock(lockAmount, lockDuration);

        HolyPaladinToken.UserLock memory previousLock = hpal.getUserLock(locker);
        HolyPaladinToken.TotalLock memory previousTotalLocked = hpal.getCurrentTotalLock();
        
        if(amount == 0){
            vm.expectRevert(
                bytes("hPAL: Null amount")
            );
            vm.prank(locker);
            hpal.increaseLock(amount);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else if(amount > stakingAmount) {
            vm.expectRevert(
                bytes("hPAL: Amount over balance")
            );
            vm.prank(locker);
            hpal.increaseLock(amount);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else if(amount < lockAmount) {
            vm.expectRevert(
                bytes("hPAL: smaller amount")
            );
            vm.prank(locker);
            hpal.increaseLock(amount);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else{
            vm.prank(locker);
            hpal.increaseLock(amount);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, lockDuration);
            assertEq(userLock.fromBlock, block.number);
            assertEq(newTotalLocked.total, previousTotalLocked.total + amount - previousLock.amount);

        }

    }

    function testIncreaseLockDuration(uint256 duration) public {
        address payable locker = users[0];

        uint256 transferAmount = 1000 * 1e18;

        uint256 stakingAmount = 700 * 1e18;

        uint256 lockAmount = 300 * 1e18;

        pal.transfer(locker, transferAmount);

        vm.prank(locker);
        pal.approve(address(hpal), stakingAmount);
            
        vm.prank(locker);
        hpal.stake(stakingAmount);

        uint256 lockDuration = 31557600;

        vm.prank(locker);
        hpal.lock(lockAmount, lockDuration);

        HolyPaladinToken.UserLock memory previousLock = hpal.getUserLock(locker);
        HolyPaladinToken.TotalLock memory previousTotalLocked = hpal.getCurrentTotalLock();
        
        if(duration < hpal.MIN_LOCK_DURATION()){
            vm.expectRevert(
                bytes("hPAL: Lock duration under min")
            );
            vm.prank(locker);
            hpal.increaseLockDuration(duration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else if(duration > hpal.MAX_LOCK_DURATION()) {
            vm.expectRevert(
                bytes("hPAL: Lock duration over max")
            );
            vm.prank(locker);
            hpal.increaseLockDuration(duration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else if(duration < lockDuration) {
            vm.expectRevert(
                bytes("hPAL: smaller duration")
            );
            vm.prank(locker);
            hpal.increaseLockDuration(duration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else{
            vm.prank(locker);
            hpal.increaseLockDuration(duration);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, block.timestamp);
            assertEq(userLock.duration, duration);
            assertEq(userLock.fromBlock, block.number);
            assertEq(newTotalLocked.total, previousTotalLocked.total);

        }

    }

    function testLockAndUnlock(uint72 amount) public {
        address payable locker = users[0];

        uint256 transferAmount = 1000 * 1e18;

        uint256 stakingAmount = 700 * 1e18;

        pal.transfer(locker, transferAmount);

        vm.prank(locker);
        pal.approve(address(hpal), stakingAmount);
            
        vm.prank(locker);
        hpal.stake(stakingAmount);

        uint256 lockDuration = 31557600;

        if(amount > stakingAmount || amount == 0) return;

        vm.prank(locker);
        hpal.lock(amount, lockDuration);

        HolyPaladinToken.TotalLock memory previousTotalLocked = hpal.getCurrentTotalLock();

        utils.advanceTime(lockDuration + 10);
        
        vm.prank(locker);
        hpal.unlock();

        HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
        HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

        assertEq(userLock.amount, 0);
        assertEq(userLock.startTimestamp, block.timestamp);
        assertEq(userLock.duration, 0);
        assertEq(userLock.fromBlock, block.number);
        assertEq(newTotalLocked.total, previousTotalLocked.total - amount);

        assertEq(hpal.userCurrentBonusRatio(locker), 0);

    }

    function testLockAndKick(uint72 amount) public {
        address payable locker = users[0];
        address payable kicker = users[1];

        uint256 transferAmount = 1000 * 1e18;

        uint256 stakingAmount = 700 * 1e18;

        pal.transfer(locker, transferAmount);

        vm.prank(locker);
        pal.approve(address(hpal), stakingAmount);
            
        vm.prank(locker);
        hpal.stake(stakingAmount);

        uint256 lockDuration = 31557600;

        if(amount > stakingAmount || amount == 0) return;

        vm.prank(locker);
        hpal.lock(amount, lockDuration);

        uint256 previousLockerBalance = hpal.balanceOf(locker);
        uint256 previousLockerKicker = hpal.balanceOf(kicker);

        HolyPaladinToken.TotalLock memory previousTotalLocked = hpal.getCurrentTotalLock();

        utils.advanceTime(lockDuration + hpal.UNLOCK_DELAY() + 10);
        
        vm.prank(kicker);
        hpal.kick(locker);

        uint256 penaltyAmount = (amount * (hpal.UNLOCK_DELAY() / hpal.WEEK()) * hpal.kickRatioPerWeek()) / hpal.MAX_BPS();

        HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
        HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

        assertEq(userLock.amount, 0);
        assertEq(userLock.startTimestamp, block.timestamp);
        assertEq(userLock.duration, 0);
        assertEq(userLock.fromBlock, block.number);
        assertEq(newTotalLocked.total, previousTotalLocked.total - amount);

        assertEq(hpal.userCurrentBonusRatio(locker), 0);

        uint256 newLockerBalance = hpal.balanceOf(locker);
        uint256 newLockerKicker = hpal.balanceOf(kicker);

        assertEq(newLockerBalance, previousLockerBalance - penaltyAmount);
        assertEq(newLockerKicker, previousLockerKicker + penaltyAmount);

    }

    function testStakeAndLock(uint72 amount) public {
        address payable locker = users[0];

        pal.transfer(locker, 1000 * 1e18);

        uint256 previousBalance = pal.balanceOf(locker);
        uint256 previousStakedBalance = hpal.balanceOf(locker);
        uint256 previousContractBalance = pal.balanceOf(address(hpal));
        uint256 previousTotalSupply = hpal.totalSupply();

        vm.prank(locker);
        pal.approve(address(hpal), amount);

        HolyPaladinToken.TotalLock memory previousTotalLocked = hpal.getCurrentTotalLock();

        if(amount == 0){
            vm.expectRevert(
                bytes("hPAL: Null amount")
            );
            vm.prank(locker);
            hpal.stakeAndLock(amount, 31557600);

            uint256 newBalance = pal.balanceOf(locker);
            uint256 newStakedBalance = hpal.balanceOf(locker);
            uint256 newContractBalance = pal.balanceOf(address(hpal));
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalance, previousBalance);
            assertEq(newStakedBalance, previousStakedBalance);
            assertEq(newContractBalance, previousContractBalance);
            assertEq(newTotalSupply, previousTotalSupply);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, 0);
            assertEq(userLock.startTimestamp, 0);
            assertEq(userLock.duration, 0);
            assertEq(userLock.fromBlock, 0);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else if(amount > previousBalance) {
            vm.expectRevert(
                bytes("ERC20: transfer amount exceeds balance")
            );
            vm.prank(locker);
            hpal.stakeAndLock(amount, 31557600);

            uint256 newBalance = pal.balanceOf(locker);
            uint256 newStakedBalance = hpal.balanceOf(locker);
            uint256 newContractBalance = pal.balanceOf(address(hpal));
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalance, previousBalance);
            assertEq(newStakedBalance, previousStakedBalance);
            assertEq(newContractBalance, previousContractBalance);
            assertEq(newTotalSupply, previousTotalSupply);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, 0);
            assertEq(userLock.startTimestamp, 0);
            assertEq(userLock.duration, 0);
            assertEq(userLock.fromBlock, 0);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else{
            vm.prank(locker);
            uint256 returnAmount = hpal.stakeAndLock(amount, 31557600);

            assertEq(returnAmount, amount);

            uint256 newBalance = pal.balanceOf(locker);
            uint256 newStakedBalance = hpal.balanceOf(locker);
            uint256 newContractBalance = pal.balanceOf(address(hpal));
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalance, previousBalance - amount);
            assertEq(newStakedBalance, previousStakedBalance + amount);
            assertEq(newContractBalance, previousContractBalance + amount);
            assertEq(newTotalSupply, previousTotalSupply + amount);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, amount);
            assertEq(userLock.startTimestamp, block.timestamp);
            assertEq(userLock.duration, 31557600);
            assertEq(userLock.fromBlock, block.number);
            assertEq(newTotalLocked.total, previousTotalLocked.total + amount);
        }
    }

    function testStakeAndIncreaseLock(uint72 amount) public {
        address payable locker = users[0];

        pal.transfer(locker, 1000 * 1e18);

        vm.prank(locker);
        pal.approve(address(hpal), 1000 * 1e18);
            
        vm.prank(locker);
        hpal.stake(700 * 1e18);

        vm.prank(locker);
        hpal.lock(300 * 1e18, 31557600);

        uint256 previousBalance = pal.balanceOf(locker);
        uint256 previousStakedBalance = hpal.balanceOf(locker);
        uint256 previousContractBalance = pal.balanceOf(address(hpal));
        uint256 previousTotalSupply = hpal.totalSupply();

        HolyPaladinToken.UserLock memory previousLock = hpal.getUserLock(locker);
        HolyPaladinToken.TotalLock memory previousTotalLocked = hpal.getCurrentTotalLock();
        
        if(amount == 0){
            vm.expectRevert(
                bytes("hPAL: Null amount")
            );
            vm.prank(locker);
            hpal.stakeAndIncreaseLock(amount, 31557600);

            assertEq(pal.balanceOf(locker), previousBalance);
            assertEq(hpal.balanceOf(locker), previousStakedBalance);
            assertEq(pal.balanceOf(address(hpal)), previousContractBalance);
            assertEq(hpal.totalSupply(), previousTotalSupply);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else if(amount > previousBalance) {
            vm.expectRevert(
                bytes("ERC20: transfer amount exceeds balance")
            );
            vm.prank(locker);
            hpal.stakeAndIncreaseLock(amount, 31557600);

            assertEq(pal.balanceOf(locker), previousBalance);
            assertEq(hpal.balanceOf(locker), previousStakedBalance);
            assertEq(pal.balanceOf(address(hpal)), previousContractBalance);
            assertEq(hpal.totalSupply(), previousTotalSupply);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, previousLock.duration);
            assertEq(userLock.fromBlock, previousLock.fromBlock);
            assertEq(newTotalLocked.total, previousTotalLocked.total);
        }
        else{
            vm.prank(locker);
            uint256 returnAmount = hpal.stakeAndIncreaseLock(amount, 31557600);

            assertEq(returnAmount, amount);

            assertEq(pal.balanceOf(locker), previousBalance - amount);
            assertEq(hpal.balanceOf(locker), previousStakedBalance + amount);
            assertEq(pal.balanceOf(address(hpal)), previousContractBalance + amount);
            assertEq(hpal.totalSupply(), previousTotalSupply + amount);

            HolyPaladinToken.UserLock memory userLock = hpal.getUserLock(locker);
            HolyPaladinToken.TotalLock memory newTotalLocked = hpal.getCurrentTotalLock();

            assertEq(userLock.amount, previousLock.amount + amount);
            assertEq(userLock.startTimestamp, previousLock.startTimestamp);
            assertEq(userLock.duration, 31557600);
            assertEq(userLock.fromBlock, block.number);
            assertEq(newTotalLocked.total, previousTotalLocked.total + amount);

        }

    }

    function testTransferLock(uint72 amount) public {
        address payable locker = users[0];
        address payable receiver = users[1];

        uint256 stakingAmount = 700 * 1e18;

        pal.transfer(locker, 1000 * 1e18);

        vm.prank(locker);
        pal.approve(address(hpal), stakingAmount);
            
        vm.prank(locker);
        hpal.stake(stakingAmount);

        uint256 lockAmount = 300 * 1e18;

        vm.prank(locker);
        hpal.lock(lockAmount, 31557600);

        uint256 previousBalanceLocker = hpal.balanceOf(locker);
        uint256 previousAvailableBalanceLocker = hpal.availableBalanceOf(locker);
        uint256 previousBalanceReceiver = hpal.balanceOf(receiver);
        uint256 previousTotalSupply = hpal.totalSupply();

        if(amount > previousAvailableBalanceLocker) {
            vm.expectRevert(
                bytes("hPAL: Available balance too low")
            );
            vm.prank(locker);
            hpal.transfer(receiver, amount);

            uint256 newBalanceLocker = hpal.balanceOf(locker);
            uint256 newAvailableBalanceLocker = hpal.availableBalanceOf(locker);
            uint256 newBalanceReceiver = hpal.balanceOf(receiver);
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalanceLocker, previousBalanceLocker);
            assertEq(newAvailableBalanceLocker, previousAvailableBalanceLocker);
            assertEq(newBalanceReceiver, previousBalanceReceiver);
            assertEq(newTotalSupply, previousTotalSupply);
        }
        else{
            vm.prank(locker);
            bool success = hpal.transfer(receiver, amount);

            assertTrue(success);

            uint256 newBalanceLocker = hpal.balanceOf(locker);
            uint256 newAvailableBalanceLocker = hpal.availableBalanceOf(locker);
            uint256 newBalanceReceiver = hpal.balanceOf(receiver);
            uint256 newTotalSupply = hpal.totalSupply();

            assertEq(newBalanceLocker, previousBalanceLocker - amount);
            assertEq(newAvailableBalanceLocker, previousAvailableBalanceLocker - amount);
            assertEq(newBalanceReceiver, previousBalanceReceiver + amount);
            assertEq(newTotalSupply, previousTotalSupply);

        }
    }

}