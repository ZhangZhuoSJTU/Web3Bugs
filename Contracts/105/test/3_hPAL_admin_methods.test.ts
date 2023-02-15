const hre = require("hardhat");
import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PaladinToken } from "../typechain/PaladinToken";
import { HolyPaladinToken } from "../typechain/HolyPaladinToken";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { advanceTime } from "./utils/utils";

chai.use(solidity);
const { expect } = chai;


const mineBlocks = async (n: number): Promise<any> => {
    for (let i = 0; i < n; i++) {
        await ethers.provider.send("evm_mine", [])
    }
    return Promise.resolve()
}

let tokenFactory: ContractFactory
let hPAL_Factory: ContractFactory

const mint_amount = ethers.utils.parseEther('10000000') // 10 M tokens

const startDropPerSecond = ethers.utils.parseEther('0.0005')
const endDropPerSecond = ethers.utils.parseEther('0.00001')

const dropDecreaseDuration = 63115200

const MONTH = 2629800

const baseLockBonusRatio = ethers.utils.parseEther('1')
const minLockBonusRatio = ethers.utils.parseEther('2')
const maxLockBonusRatio = ethers.utils.parseEther('6')

describe('PaladinToken contract tests - Admin', () => {
    let deployer: SignerWithAddress
    let admin: SignerWithAddress
    let recipient: SignerWithAddress
    let mockRewardsVault: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress

    let token: PaladinToken

    let hPAL: HolyPaladinToken

    before(async () => {
        tokenFactory = await ethers.getContractFactory("PaladinToken");
        hPAL_Factory = await ethers.getContractFactory("HolyPaladinToken");
    })


    beforeEach(async () => {
        [deployer, admin, recipient, mockRewardsVault, user1, user2] = await ethers.getSigners();

        token = (await tokenFactory.connect(deployer).deploy(mint_amount, admin.address, recipient.address)) as PaladinToken;
        await token.deployed();

        await token.connect(admin).setTransfersAllowed(true);

        hPAL = (await hPAL_Factory.connect(deployer).deploy(
            token.address,
            admin.address,
            mockRewardsVault.address,
            startDropPerSecond,
            endDropPerSecond,
            dropDecreaseDuration,
            baseLockBonusRatio,
            minLockBonusRatio,
            maxLockBonusRatio
        )) as HolyPaladinToken;
        await hPAL.deployed();
    });


    it(' should be deployed & have correct parameters', async () => {
        expect(hPAL.address).to.properAddress

        const tokenName = await hPAL.name()
        const tokenSymbol = await hPAL.symbol()
        const tokenDecimals = await hPAL.decimals()

        expect(tokenName).to.be.eq("Holy Paladin Token")
        expect(tokenSymbol).to.be.eq("hPAL")
        expect(tokenDecimals).to.be.eq(18)

        expect(await hPAL.pal()).to.be.eq(token.address)

        expect(await hPAL.kickRatioPerWeek()).to.be.eq(1000)
        expect(await hPAL.bonusLockVoteRatio()).to.be.eq(ethers.utils.parseEther('0.5'))
        expect(await hPAL.emergency()).to.be.false

        //constants
        expect(await hPAL.COOLDOWN_PERIOD()).to.be.eq(864000)
        expect(await hPAL.UNSTAKE_PERIOD()).to.be.eq(432000)
        expect(await hPAL.UNLOCK_DELAY()).to.be.eq(1209600)
        expect(await hPAL.MIN_LOCK_DURATION()).to.be.eq(7889400)
        expect(await hPAL.MAX_LOCK_DURATION()).to.be.eq(63115200)

    });

    describe('setKickRatio', async () => {

        const newRatio = 200

        it(' should update the ratio correctly', async () => {

            await hPAL.connect(admin).setKickRatio(newRatio)

            expect(await hPAL.kickRatioPerWeek()).to.be.eq(newRatio)

        });

        it(' should fail if given incorrect parameters', async () => {

            await expect(
                hPAL.connect(admin).setKickRatio(0)
            ).to.be.reverted

            await expect(
                hPAL.connect(admin).setKickRatio(5100)
            ).to.be.reverted

        });

        it(' should only be callable by admin', async () => {

            await expect(
                hPAL.connect(user1).setKickRatio(newRatio)
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

    });

    describe('setEndDropPerSecond', async () => {

        const newDrop = ethers.utils.parseEther('0.000005')

        it(' should update the ratio correctly', async () => {

            await advanceTime(MONTH * 24)


            await hPAL.connect(admin).setEndDropPerSecond(newDrop)

            expect(await hPAL.endDropPerSecond()).to.be.eq(newDrop)

            await hPAL.connect(user1).updateRewardState()
            expect(await hPAL.currentDropPerSecond()).to.be.eq(newDrop)


            await advanceTime(MONTH * 2)

            await hPAL.connect(admin).setEndDropPerSecond(0)

            expect(await hPAL.endDropPerSecond()).to.be.eq(0)

            await hPAL.connect(user1).updateRewardState()
            expect(await hPAL.currentDropPerSecond()).to.be.eq(0)

        });

        it(' should fail if before the end of dropDecreaseDuration', async () => {

            await expect(
                hPAL.connect(admin).setEndDropPerSecond(0)
            ).to.be.reverted

        });

        it(' should only be callable by admin', async () => {

            await advanceTime(MONTH * 24)

            await expect(
                hPAL.connect(user1).setEndDropPerSecond(newDrop)
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

    });

    describe('emergencyWithdraw', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount = ethers.utils.parseEther('700')

        const lock_duration = 31556952

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

        });

        it(' should fail if emergency not set', async () => {

            const user_balance = await hPAL.balanceOf(user1.address)

            await expect(
                hPAL.connect(user1).emergencyWithdraw(user_balance, user1.address)
            ).to.be.revertedWith('hPAL: Not emergency')

        });

        it(' should allow to withdraw and override the cooldown', async () => {

            await hPAL.connect(admin).triggerEmergencyWithdraw(true)

            expect(await hPAL.emergency()).to.be.true

            const user_balance = await hPAL.balanceOf(user1.address)

            const old_PAL_balance = await token.balanceOf(user1.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            const withdraw_tx = await hPAL.connect(user1).emergencyWithdraw(user_balance, user1.address)

            await expect(withdraw_tx)
                .to.emit(hPAL, 'EmergencyUnstake')
                .withArgs(user1.address, user_balance);

            const new_PAL_balance = await token.balanceOf(user1.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(new_PAL_balance.sub(old_PAL_balance)).to.be.eq(user_balance)
            expect(old_hPAL_balance.sub(new_hPAL_balance)).to.be.eq(user_balance)

            expect(new_hPAL_balance).to.be.eq(0)
            

        });

        it(' should allow to partially withdraw and override the cooldown', async () => {

            await hPAL.connect(admin).triggerEmergencyWithdraw(true)

            expect(await hPAL.emergency()).to.be.true

            const withdraw_amount = (await hPAL.balanceOf(user1.address)).div(2)

            const old_PAL_balance = await token.balanceOf(user1.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            const withdraw_tx = await hPAL.connect(user1).emergencyWithdraw(withdraw_amount, user1.address)

            await expect(withdraw_tx)
                .to.emit(hPAL, 'EmergencyUnstake')
                .withArgs(user1.address, withdraw_amount);

            const new_PAL_balance = await token.balanceOf(user1.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(new_PAL_balance.sub(old_PAL_balance)).to.be.eq(withdraw_amount)
            expect(old_hPAL_balance.sub(new_hPAL_balance)).to.be.eq(withdraw_amount)
            

        });

        it(' should allow to withdraw and cancel the lock', async () => {

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            await hPAL.connect(admin).triggerEmergencyWithdraw(true)

            expect(await hPAL.emergency()).to.be.true

            const user_balance = await hPAL.balanceOf(user1.address)

            const old_PAL_balance = await token.balanceOf(user1.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            const withdraw_tx = await hPAL.connect(user1).emergencyWithdraw(user_balance, user1.address)

            await expect(withdraw_tx)
                .to.emit(hPAL, 'EmergencyUnstake')
                .withArgs(user1.address, user_balance);

            const new_PAL_balance = await token.balanceOf(user1.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(new_PAL_balance.sub(old_PAL_balance)).to.be.eq(user_balance)
            expect(old_hPAL_balance.sub(new_hPAL_balance)).to.be.eq(user_balance)

            expect(new_hPAL_balance).to.be.eq(0)

            const lock_count = await hPAL.getUserLockCount(user1.address)
            const user_lock = await hPAL.userLocks(user1.address, lock_count.sub(1))

            const tx_block = (await withdraw_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            expect(user_lock.amount).to.be.eq(0)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(0)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

        });

        it(' should only withdraw user balance at maximum', async () => {

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            await hPAL.connect(admin).triggerEmergencyWithdraw(true)

            expect(await hPAL.emergency()).to.be.true

            const user_balance = await hPAL.balanceOf(user1.address)

            const old_PAL_balance = await token.balanceOf(user1.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            const withdraw_tx = await hPAL.connect(user1).emergencyWithdraw(user_balance.add(500), user1.address)

            await expect(withdraw_tx)
                .to.emit(hPAL, 'EmergencyUnstake')
                .withArgs(user1.address, user_balance);

            const new_PAL_balance = await token.balanceOf(user1.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(new_PAL_balance.sub(old_PAL_balance)).to.be.eq(user_balance)
            expect(old_hPAL_balance.sub(new_hPAL_balance)).to.be.eq(user_balance)

            expect(new_hPAL_balance).to.be.eq(0)

            const lock_count = await hPAL.getUserLockCount(user1.address)
            const user_lock = await hPAL.userLocks(user1.address, lock_count.sub(1))

            const tx_block = (await withdraw_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            expect(user_lock.amount).to.be.eq(0)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(0)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

        });

        it(' should block methods to be executed', async () => {
            
            await hPAL.connect(admin).triggerEmergencyWithdraw(true)

            await expect(
                hPAL.connect(user1).stake(stake_amount)
            ).to.be.revertedWith('EmergencyBlock')

            await expect(
                hPAL.connect(user1).unstake(stake_amount, user1.address)
            ).to.be.revertedWith('EmergencyBlock')

            await expect(
                hPAL.connect(user1).lock(lock_amount, lock_duration)
            ).to.be.revertedWith('EmergencyBlock')

            await expect(
                hPAL.connect(user1).increaseLockDuration(lock_duration * 2)
            ).to.be.revertedWith('EmergencyBlock')

            await expect(
                hPAL.connect(user1).increaseLock(lock_amount.add(100))
            ).to.be.revertedWith('EmergencyBlock')

            await expect(
                hPAL.connect(user1).unlock()
            ).to.be.revertedWith('EmergencyBlock')

            await expect(
                hPAL.connect(user1).kick(user2.address)
            ).to.be.revertedWith('EmergencyBlock')

            await expect(
                hPAL.connect(user1).stakeAndLock(lock_amount, lock_duration)
            ).to.be.revertedWith('EmergencyBlock')

            await expect(
                hPAL.connect(user1).stakeAndIncreaseLock(lock_amount, lock_duration)
            ).to.be.revertedWith('EmergencyBlock')

            await expect(
                hPAL.connect(user1).claim(500)
            ).to.be.revertedWith('EmergencyBlock')

            await expect(
                hPAL.connect(user1).delegate(user2.address)
            ).to.be.revertedWith('EmergencyBlock')

            await expect(
                hPAL.connect(user1).updateRewardState()
            ).to.be.revertedWith('EmergencyBlock')

            await expect(
                hPAL.connect(user1).updateUserRewardState(user1.address)
            ).to.be.revertedWith('EmergencyBlock')

        });

        it(' should return empty values after emergency is set', async () => {

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            await hPAL.connect(admin).triggerEmergencyWithdraw(true)

            const user_balances = await hPAL.allBalancesOf(user1.address)

            const user_lock = await hPAL.getUserLock(user1.address)

            const total_locked = await hPAL.getCurrentTotalLock()

            const user_votes = await hPAL.getCurrentVotes(user1.address)

            expect(user_balances.locked).to.be.eq(0)
            expect(user_balances.staked).to.be.eq(stake_amount)
            expect(user_balances.available).to.be.eq(stake_amount)
            expect(user_balances.available).to.be.eq(user_balances.staked)

            expect(user_lock.amount).to.be.eq(0)
            expect(user_lock.duration).to.be.eq(0)

            expect(total_locked.total).to.be.eq(0)

            expect(user_votes).to.be.eq(0)

        });

        it(' should fail if given incorrect parameters', async () => {

            await hPAL.connect(admin).triggerEmergencyWithdraw(true)

            expect(await hPAL.emergency()).to.be.true

            const user_balance = await hPAL.balanceOf(user1.address)

            await expect(
                hPAL.connect(user1).emergencyWithdraw(0, user1.address)
            ).to.be.revertedWith('hPAL: Null amount')

            await expect(
                hPAL.connect(user1).emergencyWithdraw(user_balance, ethers.constants.AddressZero)
            ).to.be.revertedWith('hPAL: Address Zero')

        });

        it(' should allow to send to different receiver', async () => {

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            await hPAL.connect(admin).triggerEmergencyWithdraw(true)

            expect(await hPAL.emergency()).to.be.true

            const user_balance = await hPAL.balanceOf(user1.address)

            const old_PAL_balance = await token.balanceOf(user2.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            const withdraw_tx = await hPAL.connect(user1).emergencyWithdraw(user_balance, user2.address)

            await expect(withdraw_tx)
                .to.emit(hPAL, 'EmergencyUnstake')
                .withArgs(user1.address, user_balance);

            const new_PAL_balance = await token.balanceOf(user2.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(new_PAL_balance.sub(old_PAL_balance)).to.be.eq(user_balance)
            expect(old_hPAL_balance.sub(new_hPAL_balance)).to.be.eq(user_balance)

            expect(new_hPAL_balance).to.be.eq(0)

            const lock_count = await hPAL.getUserLockCount(user1.address)
            const user_lock = await hPAL.userLocks(user1.address, lock_count.sub(1))

            const tx_block = (await withdraw_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            expect(user_lock.amount).to.be.eq(0)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(0)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

        });

        it(' should only be callable by admin', async () => {

            await expect(
                hPAL.connect(user1).triggerEmergencyWithdraw(true)
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

    });

});