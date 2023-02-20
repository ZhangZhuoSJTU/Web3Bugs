const hre = require("hardhat");
import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PaladinToken } from "../typechain/PaladinToken";
import { HolyPaladinToken } from "../typechain/HolyPaladinToken";
import { PaladinRewardReserve } from "../typechain/PaladinRewardReserve";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
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
let reserveFactory: ContractFactory

const mint_amount = ethers.utils.parseEther('10000000') // 10 M tokens

const rewards_amount = ethers.utils.parseEther('1000000') // 10 M tokens

const UNIT = ethers.utils.parseEther('1')

const WEEK = 604800

const MONTH = 2629800

const startDropPerSecond = ethers.utils.parseEther('0.0005')
const endDropPerSecond = ethers.utils.parseEther('0.00001')

const dropDecreaseDuration = 63115200

const baseLockBonusRatio = ethers.utils.parseEther('1')
const minLockBonusRatio = ethers.utils.parseEther('2')
const maxLockBonusRatio = ethers.utils.parseEther('6')


describe('PaladinToken contract tests - Rewards', () => {
    let deployer: SignerWithAddress
    let admin: SignerWithAddress
    let recipient: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress

    let token: PaladinToken

    let hPAL: HolyPaladinToken

    let reserve: PaladinRewardReserve

    before(async () => {
        tokenFactory = await ethers.getContractFactory("PaladinToken");
        hPAL_Factory = await ethers.getContractFactory("HolyPaladinToken");
        reserveFactory = await ethers.getContractFactory("PaladinRewardReserve");
    })


    beforeEach(async () => {
        [deployer, admin, recipient, user1, user2, user3] = await ethers.getSigners();

        token = (await tokenFactory.connect(deployer).deploy(mint_amount, admin.address, recipient.address)) as PaladinToken;
        await token.deployed();

        await token.connect(admin).setTransfersAllowed(true);

        reserve = (await reserveFactory.connect(deployer).deploy(
            admin.address
        )) as PaladinRewardReserve;
        await reserve.deployed();

        hPAL = (await hPAL_Factory.connect(deployer).deploy(
            token.address,
            admin.address,
            reserve.address,
            startDropPerSecond,
            endDropPerSecond,
            dropDecreaseDuration,
            baseLockBonusRatio,
            minLockBonusRatio,
            maxLockBonusRatio
        )) as HolyPaladinToken;
        await hPAL.deployed();

        await token.connect(recipient).transfer(reserve.address, rewards_amount)

        await reserve.connect(admin).setNewSpender(token.address, hPAL.address, rewards_amount)
    });


    it(' should be deployed & have correct parameters', async () => {

        expect(await hPAL.rewardsVault()).to.be.eq(reserve.address)

        const deploy_block = (await hPAL.deployTransaction).blockNumber
        const deploy_ts = (await ethers.provider.getBlock(deploy_block || 0)).timestamp

        expect(await hPAL.lastRewardUpdate()).to.be.eq(deploy_ts)
        expect(await hPAL.lastDropUpdate()).to.be.eq(deploy_ts)

        expect(await hPAL.startDropTimestamp()).to.be.eq(deploy_ts)

        expect(await hPAL.rewardIndex()).to.be.eq(0)

        expect(await hPAL.startDropPerSecond()).to.be.eq(startDropPerSecond)
        expect(await hPAL.endDropPerSecond()).to.be.eq(endDropPerSecond)
        expect(await hPAL.currentDropPerSecond()).to.be.eq(startDropPerSecond)
        expect(await hPAL.dropDecreaseDuration()).to.be.eq(dropDecreaseDuration)

        expect(await hPAL.baseLockBonusRatio()).to.be.eq(baseLockBonusRatio)
        expect(await hPAL.maxLockBonusRatio()).to.be.eq(maxLockBonusRatio)

        expect(await hPAL.userRewardIndex(user1.address)).to.be.eq(0)
        expect(await hPAL.claimableRewards(user1.address)).to.be.eq(0)
        expect(await hPAL.rewardsLastUpdate(user1.address)).to.be.eq(0)

        expect(await hPAL.userRewardIndex(user2.address)).to.be.eq(0)
        expect(await hPAL.claimableRewards(user2.address)).to.be.eq(0)
        expect(await hPAL.rewardsLastUpdate(user2.address)).to.be.eq(0)

        expect(await hPAL.MONTH()).to.be.eq(2629800)
        expect(await hPAL.ONE_YEAR()).to.be.eq(31557600)
    });


    describe('DropPerSecond updates', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount = ethers.utils.parseEther('700')

        const lock_duration = 31557600

        const transfer_amount = ethers.utils.parseEther('200')

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

        });

        it(' should set the correct lastUpdate timestamp', async () => {

            await advanceTime(MONTH)

            const update_tx = await hPAL.connect(user1).updateRewardState()

            const tx_block = (await update_tx).blockNumber
            const tx_ts = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx_ts)

            expect(await hPAL.lastDropUpdate()).to.be.eq(tx_ts)

        });

        it(' should decrease correctly each month', async () => {
            let monthly_decrease = startDropPerSecond.sub(endDropPerSecond).div(BigNumber.from(dropDecreaseDuration).div(MONTH))

            await advanceTime(MONTH)

            // update 1
            const update_tx1 = await hPAL.connect(user1).updateRewardState()
            const tx1_block = (await update_tx1).blockNumber
            const tx1_ts = (await ethers.provider.getBlock(tx1_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx1_ts)

            const expected_drop1 = startDropPerSecond.sub(monthly_decrease)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(expected_drop1)

            // update 2 => no change
            const update_tx2 = await hPAL.connect(user1).updateRewardState()
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx1_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(expected_drop1)

            await advanceTime(MONTH / 2)

            // update 3 => no change
            const update_tx3 = await hPAL.connect(user1).updateRewardState()
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx1_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(expected_drop1)

            await advanceTime(MONTH / 2)

            // update 4 => change
            const update_tx4 = await hPAL.connect(user1).updateRewardState()
            const tx4_block = (await update_tx4).blockNumber
            const tx4_ts = (await ethers.provider.getBlock(tx4_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx4_ts)

            const expected_drop4 = expected_drop1.sub(monthly_decrease)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(expected_drop4)

            await advanceTime(MONTH)

            // update 5 => change
            const update_tx5 = await hPAL.connect(user1).updateRewardState()
            const tx5_block = (await update_tx5).blockNumber
            const tx5_ts = (await ethers.provider.getBlock(tx5_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx5_ts)

            const expected_drop5 = expected_drop4.sub(monthly_decrease)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(expected_drop5)

            await advanceTime(MONTH * 3)
            
            // update 6 => change multiple time
            const update_tx6 = await hPAL.connect(user1).updateRewardState()
            const tx6_block = (await update_tx6).blockNumber
            const tx6_ts = (await ethers.provider.getBlock(tx6_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx6_ts)

            const expected_drop6 = expected_drop5.sub(monthly_decrease.mul(3))
            expect(await hPAL.currentDropPerSecond()).to.be.eq(expected_drop6)

            // advance to end of the 2 years => using a for loop for each month
            // update 7 -> x => change multiple time
            const remaining_months = 17
            let last_update_ts = tx6_ts;
            let last_currentDrop = expected_drop6;

            const start_ts = await hPAL.startDropTimestamp()
            const duration = await hPAL.dropDecreaseDuration()

            for(let i = 0; i < remaining_months; i++){
                await advanceTime(MONTH)

                let update_tx = await hPAL.connect(user1).updateRewardState()
                let tx_block = (await update_tx).blockNumber
                let tx_ts = (await ethers.provider.getBlock(tx_block || 0)).timestamp
                expect(await hPAL.lastDropUpdate()).to.be.eq(tx_ts)

                let expected_drop = last_currentDrop.sub(monthly_decrease)
                expect(await hPAL.currentDropPerSecond()).to.be.eq(expected_drop)

                last_update_ts = tx_ts
                last_currentDrop = expected_drop
            }

            await advanceTime(MONTH)

            // update last => change
            const update_tx7 = await hPAL.connect(user1).updateRewardState()
            const tx7_block = (await update_tx7).blockNumber
            const tx7_ts = (await ethers.provider.getBlock(tx7_block || 0)).timestamp

            expect(await hPAL.lastDropUpdate()).to.be.eq(tx7_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(endDropPerSecond)

            await advanceTime(MONTH)

            await hPAL.connect(user1).updateRewardState()
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx7_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(endDropPerSecond)

        });

        it(' should not change during the 1 month period', async () => {
            let monthly_decrease = startDropPerSecond.sub(endDropPerSecond).div(BigNumber.from(dropDecreaseDuration).div(MONTH))

            await advanceTime(MONTH)

            const update_tx1 = await hPAL.connect(user1).updateRewardState()
            const tx1_block = (await update_tx1).blockNumber
            const tx1_ts = (await ethers.provider.getBlock(tx1_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx1_ts)

            const expected_drop1 = startDropPerSecond.sub(monthly_decrease)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(expected_drop1)

            const update_tx2 = await hPAL.connect(user1).updateRewardState()
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx1_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(expected_drop1)

            await advanceTime(MONTH / 2)

            const update_tx3 = await hPAL.connect(user1).updateRewardState()
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx1_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(expected_drop1)
        });

        it(' should stop decreasing after dropDecreaseDuration is over', async () => {
            await hPAL.connect(user1).updateRewardState()

            await advanceTime(MONTH * 24)

            const update_tx1 = await hPAL.connect(user1).updateRewardState()
            const tx1_block = (await update_tx1).blockNumber
            const tx1_ts = (await ethers.provider.getBlock(tx1_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx1_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(endDropPerSecond)

            await advanceTime(MONTH)

            const update_tx2 = await hPAL.connect(user1).updateRewardState()
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx1_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(endDropPerSecond)

            await advanceTime(MONTH * 2)

            const update_tx3 = await hPAL.connect(user1).updateRewardState()
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx1_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(endDropPerSecond)
        });

        it(' should stay at 0 if set as 0', async () => {

            await hPAL.connect(user1).updateRewardState()

            await advanceTime(MONTH * 24)

            const update_tx1 = await hPAL.connect(user1).updateRewardState()
            const tx1_block = (await update_tx1).blockNumber
            const tx1_ts = (await ethers.provider.getBlock(tx1_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx1_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(endDropPerSecond)

            await hPAL.connect(admin).setEndDropPerSecond(0)

            await advanceTime(MONTH * 2)

            const update_tx2 = await hPAL.connect(user1).updateRewardState()
            const tx2_block = (await update_tx2).blockNumber
            const tx2_ts = (await ethers.provider.getBlock(tx2_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx2_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(0)

            await advanceTime(MONTH)

            await hPAL.connect(user1).updateRewardState()
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx2_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(0)

            await advanceTime(MONTH * 3)

            await hPAL.connect(user1).updateRewardState()
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx2_ts)
            expect(await hPAL.currentDropPerSecond()).to.be.eq(0)

        });

        it(' should be triggered by all methods updating reward state', async () => {

            await token.connect(recipient).transfer(user2.address, stake_amount)

            await token.connect(user2).approve(hPAL.address, stake_amount)

            await advanceTime(MONTH)

            const stake_tx = await hPAL.connect(user2).stake(stake_amount)
            const tx1_block = (await stake_tx).blockNumber
            const tx1_ts = (await ethers.provider.getBlock(tx1_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx1_ts)

            await advanceTime(MONTH)

            const lock_tx = await hPAL.connect(user2).lock(lock_amount, lock_duration)
            const tx2_block = (await lock_tx).blockNumber
            const tx2_ts = (await ethers.provider.getBlock(tx2_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx2_ts)

            await advanceTime(MONTH)

            const transfer_tx = await hPAL.connect(user1).transfer(user2.address, transfer_amount)
            const tx3_block = (await transfer_tx).blockNumber
            const tx3_ts = (await ethers.provider.getBlock(tx3_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx3_ts)

            await advanceTime(31557600)

            const unlock_tx = await hPAL.connect(user2).unlock()
            const tx4_block = (await unlock_tx).blockNumber
            const tx4_ts = (await ethers.provider.getBlock(tx4_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx4_ts)

            await advanceTime(MONTH)

            await hPAL.connect(user2).cooldown()

            await advanceTime(864000)

            const unstake_tx = await hPAL.connect(user2).unstake(stake_amount, user2.address)
            const tx5_block = (await unstake_tx).blockNumber
            const tx5_ts = (await ethers.provider.getBlock(tx5_block || 0)).timestamp
            expect(await hPAL.lastDropUpdate()).to.be.eq(tx5_ts)

        });

    });

    describe('Global Reward State updates', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount = ethers.utils.parseEther('650')

        const lock_duration = 31557600

        const transfer_amount = ethers.utils.parseEther('200')

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await token.connect(recipient).transfer(user2.address, stake_amount)

            await token.connect(user2).approve(hPAL.address, stake_amount)

        });

        it(' should update the index correctly (based on current TotalSupply)', async () => {

            const currentDrop = await hPAL.currentDropPerSecond()
            const currentBaseDrop = currentDrop.mul(UNIT).div(maxLockBonusRatio)

            const oldIndex = await hPAL.rewardIndex()
            let estimatedIndex = oldIndex

            let currentTotalSupply = await hPAL.totalSupply()

            const stake_tx1 = await hPAL.connect(user1).stake(stake_amount)
            const tx1_block = (await stake_tx1).blockNumber
            const tx1_ts = (await ethers.provider.getBlock(tx1_block || 0)).timestamp

            expect(await hPAL.rewardIndex()).to.be.eq(oldIndex)
            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx1_ts)

            currentTotalSupply = await hPAL.totalSupply()

            const stake_tx2 = await hPAL.connect(user2).stake(stake_amount)
            const tx2_block = (await stake_tx2).blockNumber
            const tx2_ts = (await ethers.provider.getBlock(tx2_block || 0)).timestamp

            let ellapsedTime = (tx2_ts - tx1_ts)
            estimatedIndex = estimatedIndex.add(currentBaseDrop.mul(ellapsedTime).mul(UNIT).div(currentTotalSupply))

            expect(await hPAL.rewardIndex()).to.be.eq(estimatedIndex)
            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx2_ts)

            await advanceTime(500)

            currentTotalSupply = await hPAL.totalSupply()

            const update_tx = await hPAL.connect(deployer).updateRewardState()
            const tx3_block = (await update_tx).blockNumber
            const tx3_ts = (await ethers.provider.getBlock(tx3_block || 0)).timestamp

            ellapsedTime = (tx3_ts - tx2_ts)
            estimatedIndex = estimatedIndex.add(currentBaseDrop.mul(ellapsedTime).mul(UNIT).div(currentTotalSupply))

            expect(await hPAL.rewardIndex()).to.be.eq(estimatedIndex)
            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx3_ts)

        });

        it(' should set the correct timestamp for lastUpdate', async () => {

            await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)

            const update_tx1 = await hPAL.connect(deployer).updateRewardState()
            const tx1_block = (await update_tx1).blockNumber
            const tx1_ts = (await ethers.provider.getBlock(tx1_block || 0)).timestamp
            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx1_ts)

            await mineBlocks(10)

            const update_tx2 = await hPAL.connect(deployer).updateRewardState()
            const tx2_block = (await update_tx2).blockNumber
            const tx2_ts = (await ethers.provider.getBlock(tx2_block || 0)).timestamp
            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx2_ts)

        });

        it(' should not update 2x the index the same block (should only increase the index with accrued rewards once)', async () => {
            const currentDrop = await hPAL.currentDropPerSecond()
            const currentBaseDrop = currentDrop.mul(UNIT).div(maxLockBonusRatio)

            await hPAL.connect(user1).stake(stake_amount)
            const update_tx1 = await hPAL.connect(user2).stake(stake_amount)

            let currentTotalSupply = await hPAL.totalSupply()

            const oldIndex = await hPAL.rewardIndex()

            const old_update_ts = await hPAL.lastRewardUpdate()

            await advanceTime(500)

            await hre.network.provider.send("evm_setAutomine", [false]);

            await hPAL.connect(user2).updateRewardState()
            await hPAL.connect(user2).updateRewardState()

            hre.network.provider.send("evm_mine")

            await hre.network.provider.send("evm_setAutomine", [true]);

            const new_update_ts = await hPAL.lastRewardUpdate()

            let ellapsedTime = new_update_ts.sub(old_update_ts)
            let estimatedIndex = oldIndex.add(currentBaseDrop.mul(ellapsedTime).mul(UNIT).div(currentTotalSupply))

            expect(await hPAL.rewardIndex()).to.be.eq(estimatedIndex)
        });

        it(' should not update the index if TotalSupply is null', async () => {

            const old_index = await hPAL.rewardIndex()

            const update_tx1 = await hPAL.connect(deployer).updateRewardState()
            const tx1_block = (await update_tx1).blockNumber
            const tx1_ts = (await ethers.provider.getBlock(tx1_block || 0)).timestamp
            expect(await hPAL.rewardIndex()).to.be.eq(old_index)
            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx1_ts)

            await mineBlocks(10)

            await hPAL.connect(deployer).updateRewardState()
            expect(await hPAL.rewardIndex()).to.be.eq(old_index)

            await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)

            await hPAL.connect(user1).cooldown()
            await hPAL.connect(user2).cooldown()

            await advanceTime(864000)

            await hPAL.connect(user1).unstake(stake_amount, user1.address)
            await hPAL.connect(user2).unstake(stake_amount, user2.address)

            expect(await hPAL.totalSupply()).to.be.eq(0)

            const new_index = await hPAL.rewardIndex()

            const update_tx2 = await hPAL.connect(deployer).updateRewardState()
            const tx2_block = (await update_tx2).blockNumber
            const tx2_ts = (await ethers.provider.getBlock(tx2_block || 0)).timestamp
            expect(await hPAL.rewardIndex()).to.be.eq(new_index)
            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx2_ts)

            await mineBlocks(10)

            await hPAL.connect(deployer).updateRewardState()
            expect(await hPAL.rewardIndex()).to.be.eq(new_index)
        });

        it(' should be triggered by all methods updating rewards state', async () => {
            await hPAL.connect(user1).stake(stake_amount)

            const stake_tx = await hPAL.connect(user2).stake(stake_amount)
            const tx1_block = (await stake_tx).blockNumber
            const tx1_ts = (await ethers.provider.getBlock(tx1_block || 0)).timestamp
            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx1_ts)

            const lock_tx = await hPAL.connect(user2).lock(lock_amount, lock_duration)
            const tx2_block = (await lock_tx).blockNumber
            const tx2_ts = (await ethers.provider.getBlock(tx2_block || 0)).timestamp
            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx2_ts)

            const transfer_tx = await hPAL.connect(user1).transfer(user2.address, transfer_amount)
            const tx3_block = (await transfer_tx).blockNumber
            const tx3_ts = (await ethers.provider.getBlock(tx3_block || 0)).timestamp
            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx3_ts)

            await advanceTime(31557600)

            const unlock_tx = await hPAL.connect(user2).unlock()
            const tx4_block = (await unlock_tx).blockNumber
            const tx4_ts = (await ethers.provider.getBlock(tx4_block || 0)).timestamp
            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx4_ts)

            await hPAL.connect(user2).cooldown()

            await advanceTime(864000)

            const unstake_tx = await hPAL.connect(user2).unstake(stake_amount, user2.address)
            const tx5_block = (await unstake_tx).blockNumber
            const tx5_ts = (await ethers.provider.getBlock(tx5_block || 0)).timestamp
            expect(await hPAL.lastRewardUpdate()).to.be.eq(tx5_ts)
        });

    });

    describe('User Rewards & claim', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount = ethers.utils.parseEther('650')

        const lock_duration = 31557600

        const bigger_lock_amount = ethers.utils.parseEther('1200')

        const other_lock_amount = ethers.utils.parseEther('300')

        const transfer_amount = ethers.utils.parseEther('200')

        const MIN_LOCK_DURATION = 7889400
        const MAX_LOCK_DURATION = 63115200

        const estimateBonusRatio = async (duration: number) => {
            let durationRatio = UNIT.mul(duration - MIN_LOCK_DURATION).div(MAX_LOCK_DURATION - MIN_LOCK_DURATION)
            let mult = minLockBonusRatio.add((maxLockBonusRatio.sub(minLockBonusRatio)).mul(durationRatio).div(UNIT))
            return mult
        }

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await token.connect(recipient).transfer(user2.address, stake_amount)

            await token.connect(user2).approve(hPAL.address, stake_amount)

        });

        it(' should update user index and timestamp correctly', async () => {

            const update_tx1 = await hPAL.connect(user1).stake(stake_amount)
            const tx1_block = (await update_tx1).blockNumber
            const tx1_ts = (await ethers.provider.getBlock(tx1_block || 0)).timestamp

            const index1 = await hPAL.rewardIndex()

            expect(await hPAL.userRewardIndex(user1.address)).to.be.eq(index1)
            expect(await hPAL.rewardsLastUpdate(user1.address)).to.be.eq(tx1_ts)

            await mineBlocks(10)

            const update_tx2 = await hPAL.connect(user1).lock(lock_amount, lock_duration)
            const tx2_block = (await update_tx2).blockNumber
            const tx2_ts = (await ethers.provider.getBlock(tx2_block || 0)).timestamp

            const index2 = await hPAL.rewardIndex()

            expect(await hPAL.userRewardIndex(user1.address)).to.be.eq(index2)
            expect(await hPAL.rewardsLastUpdate(user1.address)).to.be.eq(tx2_ts)

            await advanceTime(lock_duration)

            const update_tx3 = await hPAL.connect(user1).unlock()
            const tx3_block = (await update_tx3).blockNumber
            const tx3_ts = (await ethers.provider.getBlock(tx3_block || 0)).timestamp

            const index3 = await hPAL.rewardIndex()

            expect(await hPAL.userRewardIndex(user1.address)).to.be.eq(index3)
            expect(await hPAL.rewardsLastUpdate(user1.address)).to.be.eq(tx3_ts)

            await hPAL.connect(user1).cooldown()

            await advanceTime(864000)

            const update_tx4 = await hPAL.connect(user1).unstake(lock_amount, user1.address)
            const tx4_block = (await update_tx4).blockNumber
            const tx4_ts = (await ethers.provider.getBlock(tx4_block || 0)).timestamp

            const index4 = await hPAL.rewardIndex()

            expect(await hPAL.userRewardIndex(user1.address)).to.be.eq(index4)
            expect(await hPAL.rewardsLastUpdate(user1.address)).to.be.eq(tx4_ts)
            
        });

        it(' should not change index for other users', async () => {
            const update_tx1 = await hPAL.connect(user1).stake(stake_amount)
            const tx1_block = (await update_tx1).blockNumber
            const tx1_ts = (await ethers.provider.getBlock(tx1_block || 0)).timestamp

            const index1 = await hPAL.rewardIndex()

            expect(await hPAL.userRewardIndex(user1.address)).to.be.eq(index1)
            expect(await hPAL.rewardsLastUpdate(user1.address)).to.be.eq(tx1_ts)
            expect(await hPAL.userRewardIndex(user2.address)).to.be.eq(0)
            expect(await hPAL.rewardsLastUpdate(user2.address)).to.be.eq(0)

            await mineBlocks(10)

            const update_tx2 = await hPAL.connect(user2).stake(stake_amount)
            const tx2_block = (await update_tx2).blockNumber
            const tx2_ts = (await ethers.provider.getBlock(tx2_block || 0)).timestamp

            const index2 = await hPAL.rewardIndex()

            expect(await hPAL.userRewardIndex(user2.address)).to.be.eq(index2)
            expect(await hPAL.rewardsLastUpdate(user2.address)).to.be.eq(tx2_ts)
            expect(await hPAL.userRewardIndex(user1.address)).to.be.eq(index1)
            expect(await hPAL.rewardsLastUpdate(user1.address)).to.be.eq(tx1_ts)

            await mineBlocks(50)

            await hPAL.connect(user2).cooldown()

            await advanceTime(864000)

            const update_tx3 = await hPAL.connect(user2).unstake(stake_amount, user2.address)
            const tx3_block = (await update_tx3).blockNumber
            const tx3_ts = (await ethers.provider.getBlock(tx3_block || 0)).timestamp

            const index3 = await hPAL.rewardIndex()

            expect(await hPAL.userRewardIndex(user2.address)).to.be.eq(index3)
            expect(await hPAL.rewardsLastUpdate(user2.address)).to.be.eq(tx3_ts)
            expect(await hPAL.userRewardIndex(user1.address)).to.be.eq(index1)
            expect(await hPAL.rewardsLastUpdate(user1.address)).to.be.eq(tx1_ts)

            await hPAL.connect(user1).cooldown()

            await advanceTime(864000)

            const update_tx4 = await hPAL.connect(user1).unstake(lock_amount, user1.address)
            const tx4_block = (await update_tx4).blockNumber
            const tx4_ts = (await ethers.provider.getBlock(tx4_block || 0)).timestamp

            const index4 = await hPAL.rewardIndex()

            expect(await hPAL.userRewardIndex(user1.address)).to.be.eq(index4)
            expect(await hPAL.rewardsLastUpdate(user1.address)).to.be.eq(tx4_ts)
            expect(await hPAL.userRewardIndex(user2.address)).to.be.eq(index3)
            expect(await hPAL.rewardsLastUpdate(user2.address)).to.be.eq(tx3_ts)
        });

        it(' should correctly accrue rewards to users - basic staking', async () => {

            const start_tx = await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)
            const start_index = await hPAL.userRewardIndex(user1.address)

            const user_rewards1 = await hPAL.claimableRewards(user1.address)

            expect(user_rewards1).to.be.eq(0)

            await mineBlocks(125)

            const update_tx = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index = await hPAL.userRewardIndex(user1.address)

            const user_rewards2 = await hPAL.claimableRewards(user1.address)

            let estimated_accrued_rewards = update_index.sub(start_index).mul(stake_amount).div(UNIT)

            expect(user_rewards2).to.be.eq(user_rewards1.add(estimated_accrued_rewards))

            await mineBlocks(75)

            await hPAL.connect(user1).cooldown()

            await advanceTime(864000)

            const unstake_tx = await hPAL.connect(user1).unstake(stake_amount.div(2), user1.address)
            const unstake_index = await hPAL.userRewardIndex(user1.address)

            const user_rewards3 = await hPAL.claimableRewards(user1.address)

            estimated_accrued_rewards = unstake_index.sub(update_index).mul(stake_amount).div(UNIT)

            expect(user_rewards3).to.be.eq(user_rewards2.add(estimated_accrued_rewards))

            await mineBlocks(100)

            const new_user_staked_balance = stake_amount.div(2)

            const update_tx2 = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index2 = await hPAL.userRewardIndex(user1.address)

            const user_rewards4 = await hPAL.claimableRewards(user1.address)

            estimated_accrued_rewards = update_index2.sub(unstake_index).mul(new_user_staked_balance).div(UNIT)

            expect(user_rewards4).to.be.eq(user_rewards3.add(estimated_accrued_rewards))
            
        });

        it(' should correctly accrue rewards to users - all balance locked', async () => {
            const start_tx = await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)
            const start_index = await hPAL.userRewardIndex(user1.address)

            const user_rewards1 = await hPAL.claimableRewards(user1.address)

            expect(user_rewards1).to.be.eq(0)

            await mineBlocks(125)

            const lock_tx = await hPAL.connect(user1).lock(stake_amount, lock_duration)
            const lock_index = await hPAL.userRewardIndex(user1.address)
            const lock_ts = (await ethers.provider.getBlock((await lock_tx).blockNumber || 0)).timestamp

            const start_lock_multiplier = await hPAL.userCurrentBonusRatio(user1.address)
            const decrease_multiplier = await hPAL.userBonusRatioDecrease(user1.address)

            const user_rewards2 = await hPAL.claimableRewards(user1.address)

            let estimated_accrued_rewards = lock_index.sub(start_index).mul(stake_amount).div(UNIT)

            expect(user_rewards2).to.be.eq(user_rewards1.add(estimated_accrued_rewards))

            await mineBlocks(75)

            const update_tx = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index = await hPAL.userRewardIndex(user1.address)
            const update_ts = (await ethers.provider.getBlock((await update_tx).blockNumber || 0)).timestamp

            const user_rewards3 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time = update_ts - lock_ts

            const estimated_current_multiplier = start_lock_multiplier.sub(decrease_multiplier.mul(ellapsed_time))

            const estimated_multiplier_period = estimated_current_multiplier.add(
                decrease_multiplier.mul(ellapsed_time).add(decrease_multiplier).div(2)
            )

            estimated_accrued_rewards = ((update_index.sub(lock_index)).mul(estimated_multiplier_period).div(UNIT)).mul(stake_amount).div(UNIT)

            expect(user_rewards3).to.be.eq(user_rewards2.add(estimated_accrued_rewards))

            await mineBlocks(100)

            const update_tx2 = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index2 = await hPAL.userRewardIndex(user1.address)
            const update2_ts = (await ethers.provider.getBlock((await update_tx2).blockNumber || 0)).timestamp

            const user_rewards4 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time2 = update2_ts - update_ts

            const estimated_current_multiplier2 = estimated_current_multiplier.sub(decrease_multiplier.mul(ellapsed_time2))

            const estimated_multiplier_period2 = estimated_current_multiplier2.add(
                decrease_multiplier.mul(ellapsed_time2).add(decrease_multiplier).div(2)
            )

            estimated_accrued_rewards = ((update_index2.sub(update_index)).mul(estimated_multiplier_period2).div(UNIT)).mul(stake_amount).div(UNIT)

            expect(user_rewards4).to.be.eq(user_rewards3.add(estimated_accrued_rewards))
        });

        it(' should correctly accrue rewards to users - half balance locked', async () => {
            const start_tx = await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)
            const start_index = await hPAL.userRewardIndex(user1.address)

            const user_rewards1 = await hPAL.claimableRewards(user1.address)

            expect(user_rewards1).to.be.eq(0)

            await mineBlocks(125)

            const lock_tx = await hPAL.connect(user1).lock(lock_amount, lock_duration)
            const lock_index = await hPAL.userRewardIndex(user1.address)
            const lock_ts = (await ethers.provider.getBlock((await lock_tx).blockNumber || 0)).timestamp

            const start_lock_multiplier = await hPAL.userCurrentBonusRatio(user1.address)
            const decrease_multiplier = await hPAL.userBonusRatioDecrease(user1.address)

            const user_rewards2 = await hPAL.claimableRewards(user1.address)

            const staked_balance = stake_amount.sub(lock_amount)

            let estimated_accrued_rewards = lock_index.sub(start_index).mul(stake_amount).div(UNIT)

            expect(user_rewards2).to.be.eq(user_rewards1.add(estimated_accrued_rewards))

            await mineBlocks(75)

            const update_tx = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index = await hPAL.userRewardIndex(user1.address)
            const update_ts = (await ethers.provider.getBlock((await update_tx).blockNumber || 0)).timestamp

            const user_rewards3 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time = update_ts - lock_ts

            const estimated_current_multiplier = start_lock_multiplier.sub(decrease_multiplier.mul(ellapsed_time))

            const estimated_multiplier_period = estimated_current_multiplier.add(
                decrease_multiplier.mul(ellapsed_time).add(decrease_multiplier).div(2)
            )

            let estimated_locking_accrued_rewards = ((update_index.sub(lock_index)).mul(estimated_multiplier_period).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(update_index.sub(lock_index).mul(staked_balance).div(UNIT))

            expect(user_rewards3).to.be.eq(user_rewards2.add(estimated_accrued_rewards))

            await mineBlocks(100)

            const update_tx2 = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index2 = await hPAL.userRewardIndex(user1.address)
            const update2_ts = (await ethers.provider.getBlock((await update_tx2).blockNumber || 0)).timestamp

            const user_rewards4 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time2 = update2_ts - update_ts

            const estimated_current_multiplier2 = estimated_current_multiplier.sub(decrease_multiplier.mul(ellapsed_time2))

            const estimated_multiplier_period2 = estimated_current_multiplier2.add(
                decrease_multiplier.mul(ellapsed_time2).add(decrease_multiplier).div(2)
            )

            estimated_locking_accrued_rewards = ((update_index2.sub(update_index)).mul(estimated_multiplier_period2).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(update_index2.sub(update_index).mul(staked_balance).div(UNIT))

            expect(user_rewards4).to.be.eq(user_rewards3.add(estimated_accrued_rewards))
        });

        it(' should correctly accrue rewards to users - max lock duration', async () => {
            const start_tx = await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)
            const start_index = await hPAL.userRewardIndex(user1.address)

            const user_rewards1 = await hPAL.claimableRewards(user1.address)

            expect(user_rewards1).to.be.eq(0)

            await mineBlocks(125)

            const lock_tx = await hPAL.connect(user1).lock(lock_amount, MAX_LOCK_DURATION)
            const lock_index = await hPAL.userRewardIndex(user1.address)
            const lock_ts = (await ethers.provider.getBlock((await lock_tx).blockNumber || 0)).timestamp

            const start_lock_multiplier = await hPAL.userCurrentBonusRatio(user1.address)
            const decrease_multiplier = await hPAL.userBonusRatioDecrease(user1.address)

            expect(start_lock_multiplier).to.be.eq(maxLockBonusRatio)

            const user_rewards2 = await hPAL.claimableRewards(user1.address)

            const staked_balance = stake_amount.sub(lock_amount)

            let estimated_accrued_rewards = lock_index.sub(start_index).mul(stake_amount).div(UNIT)

            expect(user_rewards2).to.be.eq(user_rewards1.add(estimated_accrued_rewards))

            await mineBlocks(75)

            const update_tx = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index = await hPAL.userRewardIndex(user1.address)
            const update_ts = (await ethers.provider.getBlock((await update_tx).blockNumber || 0)).timestamp

            const user_rewards3 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time = update_ts - lock_ts

            const estimated_current_multiplier = start_lock_multiplier.sub(decrease_multiplier.mul(ellapsed_time))

            const estimated_multiplier_period = estimated_current_multiplier.add(
                decrease_multiplier.mul(ellapsed_time).add(decrease_multiplier).div(2)
            )

            let estimated_locking_accrued_rewards = ((update_index.sub(lock_index)).mul(estimated_multiplier_period).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(update_index.sub(lock_index).mul(staked_balance).div(UNIT))

            expect(user_rewards3).to.be.eq(user_rewards2.add(estimated_accrued_rewards))

            await mineBlocks(100)

            const update_tx2 = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index2 = await hPAL.userRewardIndex(user1.address)
            const update2_ts = (await ethers.provider.getBlock((await update_tx2).blockNumber || 0)).timestamp

            const user_rewards4 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time2 = update2_ts - update_ts

            const estimated_current_multiplier2 = estimated_current_multiplier.sub(decrease_multiplier.mul(ellapsed_time2))

            const estimated_multiplier_period2 = estimated_current_multiplier2.add(
                decrease_multiplier.mul(ellapsed_time2).add(decrease_multiplier).div(2)
            )

            estimated_locking_accrued_rewards = ((update_index2.sub(update_index)).mul(estimated_multiplier_period2).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(update_index2.sub(update_index).mul(staked_balance).div(UNIT))

            expect(user_rewards4).to.be.eq(user_rewards3.add(estimated_accrued_rewards))
        });

        it(' should correctly accrue rewards to users - min lock duration', async () => {
            const start_tx = await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)
            const start_index = await hPAL.userRewardIndex(user1.address)

            const user_rewards1 = await hPAL.claimableRewards(user1.address)

            expect(user_rewards1).to.be.eq(0)

            await mineBlocks(125)

            const lock_tx = await hPAL.connect(user1).lock(lock_amount, MIN_LOCK_DURATION)
            const lock_index = await hPAL.userRewardIndex(user1.address)
            const lock_ts = (await ethers.provider.getBlock((await lock_tx).blockNumber || 0)).timestamp

            const start_lock_multiplier = await hPAL.userCurrentBonusRatio(user1.address)
            const decrease_multiplier = await hPAL.userBonusRatioDecrease(user1.address)

            expect(start_lock_multiplier).to.be.eq(minLockBonusRatio)

            const user_rewards2 = await hPAL.claimableRewards(user1.address)

            const staked_balance = stake_amount.sub(lock_amount)

            let estimated_accrued_rewards = lock_index.sub(start_index).mul(stake_amount).div(UNIT)

            expect(user_rewards2).to.be.eq(user_rewards1.add(estimated_accrued_rewards))

            await mineBlocks(75)

            const update_tx = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index = await hPAL.userRewardIndex(user1.address)
            const update_ts = (await ethers.provider.getBlock((await update_tx).blockNumber || 0)).timestamp

            const user_rewards3 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time = update_ts - lock_ts

            const estimated_current_multiplier = start_lock_multiplier.sub(decrease_multiplier.mul(ellapsed_time))

            const estimated_multiplier_period = estimated_current_multiplier.add(
                decrease_multiplier.mul(ellapsed_time).add(decrease_multiplier).div(2)
            )

            let estimated_locking_accrued_rewards = ((update_index.sub(lock_index)).mul(estimated_multiplier_period).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(update_index.sub(lock_index).mul(staked_balance).div(UNIT))

            expect(user_rewards3).to.be.eq(user_rewards2.add(estimated_accrued_rewards))

            await mineBlocks(100)

            const update_tx2 = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index2 = await hPAL.userRewardIndex(user1.address)
            const update2_ts = (await ethers.provider.getBlock((await update_tx2).blockNumber || 0)).timestamp

            const user_rewards4 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time2 = update2_ts - update_ts

            const estimated_current_multiplier2 = estimated_current_multiplier.sub(decrease_multiplier.mul(ellapsed_time2))

            const estimated_multiplier_period2 = estimated_current_multiplier2.add(
                decrease_multiplier.mul(ellapsed_time2).add(decrease_multiplier).div(2)
            )

            estimated_locking_accrued_rewards = ((update_index2.sub(update_index)).mul(estimated_multiplier_period2).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(update_index2.sub(update_index).mul(staked_balance).div(UNIT))

            expect(user_rewards4).to.be.eq(user_rewards3.add(estimated_accrued_rewards))
        });

        it(' should not accrue rewards until the user has a staked balance', async () => {

            expect(await hPAL.claimableRewards(user1.address)).to.be.eq(0)

            await mineBlocks(75)
            
            await hPAL.userRewardIndex(user1.address)

            expect(await hPAL.claimableRewards(user1.address)).to.be.eq(0)

            await mineBlocks(125)
            
            await hPAL.userRewardIndex(user1.address)

            expect(await hPAL.claimableRewards(user1.address)).to.be.eq(0)
            
            await mineBlocks(200)

            await hPAL.connect(user1).stake(stake_amount)

            await hPAL.userRewardIndex(user1.address)

            expect(await hPAL.claimableRewards(user1.address)).to.be.eq(0)
            
        });

        it(' should not accrue more rewards after the user unstaked', async () => {

            await hPAL.connect(user1).stake(stake_amount)

            await mineBlocks(125)

            await hPAL.connect(user1).cooldown()

            await advanceTime(864000)

            await hPAL.connect(user1).unstake(stake_amount, user1.address)

            const accrued_rewards = await hPAL.claimableRewards(user1.address)

            await mineBlocks(150)
            
            await hPAL.userRewardIndex(user1.address)

            expect(await hPAL.claimableRewards(user1.address)).to.be.eq(accrued_rewards)

            await mineBlocks(75)
            
            await hPAL.userRewardIndex(user1.address)

            expect(await hPAL.claimableRewards(user1.address)).to.be.eq(accrued_rewards)

            await mineBlocks(125)
            
            await hPAL.userRewardIndex(user1.address)

            expect(await hPAL.claimableRewards(user1.address)).to.be.eq(accrued_rewards)
            
            await mineBlocks(200)

            await hPAL.userRewardIndex(user1.address)

            expect(await hPAL.claimableRewards(user1.address)).to.be.eq(accrued_rewards)
        });

        it(' should not accrue more rewards than the total DropPerSeconds', async () => {

            await token.connect(recipient).transfer(user2.address, ethers.utils.parseEther('200'))
            await token.connect(recipient).transfer(user3.address, other_lock_amount)

            await token.connect(user2).approve(hPAL.address, 0)
            await token.connect(user2).approve(hPAL.address, bigger_lock_amount)
            await token.connect(user3).approve(hPAL.address, other_lock_amount)

            await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(bigger_lock_amount)
            await hPAL.connect(user3).stake(other_lock_amount)

            await hPAL.connect(user1).lock(lock_amount, MAX_LOCK_DURATION)
            await hPAL.connect(user2).lock(bigger_lock_amount, MAX_LOCK_DURATION)
            await hPAL.connect(user3).lock(other_lock_amount, MAX_LOCK_DURATION)

            await hre.network.provider.send("evm_setAutomine", [false]);

            const start_tx = await hPAL.connect(user1).updateUserRewardState(user1.address)
            await hPAL.connect(user2).updateUserRewardState(user2.address)
            await hPAL.connect(user3).updateUserRewardState(user3.address)

            hre.network.provider.send("evm_mine")

            await hre.network.provider.send("evm_setAutomine", [true]);

            await mineBlocks(150)

            await hre.network.provider.send("evm_setAutomine", [false]);

            const end_tx = await hPAL.connect(user1).updateUserRewardState(user1.address)
            await hPAL.connect(user2).updateUserRewardState(user2.address)
            await hPAL.connect(user3).updateUserRewardState(user3.address)

            hre.network.provider.send("evm_mine")

            await hre.network.provider.send("evm_setAutomine", [true]);


            const start_block = (await start_tx).blockNumber
            const start_ts = (await ethers.provider.getBlock(start_block || 0)).timestamp


            const end_block = (await end_tx).blockNumber
            const end_ts = (await ethers.provider.getBlock(end_block || 0)).timestamp

            let ellapsedTime = (end_ts - start_ts)

            const currentDrop = await hPAL.currentDropPerSecond()

            const total_max_distributed = currentDrop.mul(ellapsedTime)
            
            const user1_accrued = (await hPAL.estimateClaimableRewards(user1.address, { blockTag: end_block })).sub(
                await hPAL.estimateClaimableRewards(user1.address, { blockTag: start_block })
            )
            const user2_accrued = (await hPAL.estimateClaimableRewards(user2.address, { blockTag: end_block })).sub(
                await hPAL.estimateClaimableRewards(user2.address, { blockTag: start_block })
            )
            const user3_accrued = (await hPAL.estimateClaimableRewards(user3.address, { blockTag: end_block })).sub(
                await hPAL.estimateClaimableRewards(user3.address, { blockTag: start_block })
            )

            expect(
                user1_accrued.add(user2_accrued).add(user3_accrued)
            ).to.be.eq(total_max_distributed)


        });

        it(' should not use the multipler after user unlocked', async () => {
            const start_tx = await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)
            const start_index = await hPAL.userRewardIndex(user1.address)

            const user_rewards1 = await hPAL.claimableRewards(user1.address)

            expect(user_rewards1).to.be.eq(0)

            await mineBlocks(125)

            const lock_tx = await hPAL.connect(user1).lock(lock_amount, lock_duration)
            const lock_index = await hPAL.userRewardIndex(user1.address)
            const lock_ts = (await ethers.provider.getBlock((await lock_tx).blockNumber || 0)).timestamp

            const start_lock_multiplier = await hPAL.userCurrentBonusRatio(user1.address)
            const decrease_multiplier = await hPAL.userBonusRatioDecrease(user1.address)

            const user_rewards2 = await hPAL.claimableRewards(user1.address)

            const staked_balance = stake_amount.sub(lock_amount)

            let estimated_accrued_rewards = lock_index.sub(start_index).mul(stake_amount).div(UNIT)

            expect(user_rewards2).to.be.eq(user_rewards1.add(estimated_accrued_rewards))

            await mineBlocks(75)

            const update_tx = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index = await hPAL.userRewardIndex(user1.address)
            const update_ts = (await ethers.provider.getBlock((await update_tx).blockNumber || 0)).timestamp

            const user_rewards3 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time = update_ts - lock_ts

            const estimated_current_multiplier = start_lock_multiplier.sub(decrease_multiplier.mul(ellapsed_time))

            const estimated_multiplier_period = estimated_current_multiplier.add(
                decrease_multiplier.mul(ellapsed_time).add(decrease_multiplier).div(2)
            )

            let estimated_locking_accrued_rewards = ((update_index.sub(lock_index)).mul(estimated_multiplier_period).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(update_index.sub(lock_index).mul(staked_balance).div(UNIT))

            expect(user_rewards3).to.be.eq(user_rewards2.add(estimated_accrued_rewards))

            await advanceTime(lock_duration)

            const unlock_tx = await hPAL.connect(user1).unlock()
            const unlock_index = await hPAL.userRewardIndex(user1.address)
            const unlock_ts = (await ethers.provider.getBlock((await unlock_tx).blockNumber || 0)).timestamp

            const user_rewards4 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time2 = unlock_ts - update_ts

            const estimated_current_multiplier2 = estimated_current_multiplier.sub(decrease_multiplier.mul(ellapsed_time2))

            const estimated_multiplier_period2 = estimated_current_multiplier2.add(
                decrease_multiplier.mul(ellapsed_time2).add(decrease_multiplier).div(2)
            )

            estimated_locking_accrued_rewards = ((unlock_index.sub(update_index)).mul(estimated_multiplier_period2).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(unlock_index.sub(update_index).mul(staked_balance).div(UNIT))

            expect(user_rewards4).to.be.eq(user_rewards3.add(estimated_accrued_rewards))

            await mineBlocks(100)

            const update_tx2 = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index2 = await hPAL.userRewardIndex(user1.address)

            const user_rewards5 = await hPAL.claimableRewards(user1.address)

            estimated_accrued_rewards = update_index2.sub(unlock_index).mul(stake_amount).div(UNIT)

            expect(user_rewards5).to.be.eq(user_rewards4.add(estimated_accrued_rewards))
        });

        it(' should not use the multipler after user was kicked', async () => {
            const start_tx = await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)
            const start_index = await hPAL.userRewardIndex(user1.address)

            const user_rewards1 = await hPAL.claimableRewards(user1.address)

            expect(user_rewards1).to.be.eq(0)

            await mineBlocks(125)

            const lock_tx = await hPAL.connect(user1).lock(lock_amount, lock_duration)
            const lock_index = await hPAL.userRewardIndex(user1.address)
            const lock_ts = (await ethers.provider.getBlock((await lock_tx).blockNumber || 0)).timestamp

            const start_lock_multiplier = await hPAL.userCurrentBonusRatio(user1.address)
            const decrease_multiplier = await hPAL.userBonusRatioDecrease(user1.address)

            const user_rewards2 = await hPAL.claimableRewards(user1.address)

            const staked_balance = stake_amount.sub(lock_amount)

            let estimated_accrued_rewards = lock_index.sub(start_index).mul(stake_amount).div(UNIT)

            expect(user_rewards2).to.be.eq(user_rewards1.add(estimated_accrued_rewards))

            await mineBlocks(75)

            const update_tx = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index = await hPAL.userRewardIndex(user1.address)
            const update_ts = (await ethers.provider.getBlock((await update_tx).blockNumber || 0)).timestamp

            const user_rewards3 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time = update_ts - lock_ts

            const estimated_current_multiplier = start_lock_multiplier.sub(decrease_multiplier.mul(ellapsed_time))

            const estimated_multiplier_period = estimated_current_multiplier.add(
                decrease_multiplier.mul(ellapsed_time).add(decrease_multiplier).div(2)
            )

            let estimated_locking_accrued_rewards = ((update_index.sub(lock_index)).mul(estimated_multiplier_period).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(update_index.sub(lock_index).mul(staked_balance).div(UNIT))

            expect(user_rewards3).to.be.eq(user_rewards2.add(estimated_accrued_rewards))

            await advanceTime(lock_duration + (2 * WEEK))

            const kick_tx = await hPAL.connect(user2).kick(user1.address)
            const kick_index = await hPAL.userRewardIndex(user1.address)
            const kick_ts = (await ethers.provider.getBlock((await kick_tx).blockNumber || 0)).timestamp

            const user_rewards4 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time2 = kick_ts - update_ts

            const estimated_current_multiplier2 = estimated_current_multiplier.sub(decrease_multiplier.mul(ellapsed_time2))

            const estimated_multiplier_period2 = estimated_current_multiplier2.add(
                decrease_multiplier.mul(ellapsed_time2).add(decrease_multiplier).div(2)
            )

            estimated_locking_accrued_rewards = ((kick_index.sub(update_index)).mul(estimated_multiplier_period2).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(kick_index.sub(update_index).mul(staked_balance).div(UNIT))

            expect(user_rewards4).to.be.eq(user_rewards3.add(estimated_accrued_rewards))

            const balance_after_penalty = await hPAL.balanceOf(user1.address)

            await mineBlocks(100)

            const update_tx2 = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index2 = await hPAL.userRewardIndex(user1.address)

            const user_rewards5 = await hPAL.claimableRewards(user1.address)

            estimated_accrued_rewards = update_index2.sub(kick_index).mul(balance_after_penalty).div(UNIT)

            expect(user_rewards5).to.be.eq(user_rewards4.add(estimated_accrued_rewards))
        });
        
        it(' should decrease the Bonus Ratio to 0 if update long after end of Lock duration', async () => {
            const start_tx = await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)
            const start_index = await hPAL.userRewardIndex(user1.address)

            const user_rewards1 = await hPAL.claimableRewards(user1.address)

            expect(user_rewards1).to.be.eq(0)

            await mineBlocks(125)

            const lock_tx = await hPAL.connect(user1).lock(lock_amount, lock_duration)
            const lock_index = await hPAL.userRewardIndex(user1.address)
            const lock_ts = (await ethers.provider.getBlock((await lock_tx).blockNumber || 0)).timestamp

            const start_lock_multiplier = await hPAL.userCurrentBonusRatio(user1.address)
            const decrease_multiplier = await hPAL.userBonusRatioDecrease(user1.address)

            const user_rewards2 = await hPAL.claimableRewards(user1.address)

            const staked_balance = stake_amount.sub(lock_amount)

            let estimated_accrued_rewards = lock_index.sub(start_index).mul(stake_amount).div(UNIT)

            expect(user_rewards2).to.be.eq(user_rewards1.add(estimated_accrued_rewards))

            await mineBlocks(75)

            const update_tx = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index = await hPAL.userRewardIndex(user1.address)
            const update_ts = (await ethers.provider.getBlock((await update_tx).blockNumber || 0)).timestamp

            const user_rewards3 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time = update_ts - lock_ts

            const estimated_current_multiplier = start_lock_multiplier.sub(decrease_multiplier.mul(ellapsed_time))

            const estimated_multiplier_period = estimated_current_multiplier.add(
                decrease_multiplier.mul(ellapsed_time).add(decrease_multiplier).div(2)
            )

            let estimated_locking_accrued_rewards = ((update_index.sub(lock_index)).mul(estimated_multiplier_period).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(update_index.sub(lock_index).mul(staked_balance).div(UNIT))

            expect(user_rewards3).to.be.eq(user_rewards2.add(estimated_accrued_rewards))

            await advanceTime(lock_duration * 2)

            const update2_tx = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update2_index = await hPAL.userRewardIndex(user1.address)
            const update2_ts = (await ethers.provider.getBlock((await update2_tx).blockNumber || 0)).timestamp

            const user_rewards4 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time2 = update2_ts - update_ts

            const estimated_current_multiplier2 = BigNumber.from(0)

            const estimated_multiplier_period2 = estimated_current_multiplier2.add(
                estimated_current_multiplier.add(decrease_multiplier).div(2)
            )

            estimated_locking_accrued_rewards = ((update2_index.sub(update_index)).mul(estimated_multiplier_period2).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(update2_index.sub(update_index).mul(staked_balance).div(UNIT))

            expect(user_rewards4).to.be.eq(user_rewards3.add(estimated_accrued_rewards))

            expect(await hPAL.userCurrentBonusRatio(user1.address)).to.be.eq(0)
        });

        it(' should never accrue rewards for the address 0x0', async () => {

            await hPAL.connect(user1).stake(stake_amount)

            expect(await hPAL.userRewardIndex(ethers.constants.AddressZero)).to.be.eq(0)
            expect(await hPAL.rewardsLastUpdate(ethers.constants.AddressZero)).to.be.eq(0)

            await mineBlocks(10)

            await hPAL.connect(user2).stake(stake_amount)

            expect(await hPAL.userRewardIndex(ethers.constants.AddressZero)).to.be.eq(0)
            expect(await hPAL.rewardsLastUpdate(ethers.constants.AddressZero)).to.be.eq(0)

            await mineBlocks(50)

            await hPAL.connect(user1).cooldown()

            await advanceTime(864000)

            await hPAL.connect(user1).unstake(stake_amount, user1.address)

            expect(await hPAL.userRewardIndex(ethers.constants.AddressZero)).to.be.eq(0)
            expect(await hPAL.rewardsLastUpdate(ethers.constants.AddressZero)).to.be.eq(0)
        });

        it(' should not accrue 2x the rewards in the same block', async () => {

            await hPAL.connect(user1).updateUserRewardState(user1.address)

            const currentIndex = await hPAL.userRewardIndex(user1.address)

            const start_rewards = await hPAL.claimableRewards(user1.address)

            await hre.network.provider.send("evm_setAutomine", [false]);

            await hPAL.connect(user1).updateUserRewardState(user1.address)
            await hPAL.connect(user1).updateUserRewardState(user1.address)

            hre.network.provider.send("evm_mine")

            await hre.network.provider.send("evm_setAutomine", [true]);

            const newIndex = await hPAL.userRewardIndex(user1.address)

            const end_rewards = await hPAL.claimableRewards(user1.address)

            let estimated_accrued_rewards = newIndex.sub(currentIndex).mul(stake_amount).div(UNIT)

            expect(end_rewards).to.be.eq(start_rewards.add(estimated_accrued_rewards))
        });

        it(' should estimate user claimable rewards correctly', async () => {
            const start_tx = await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)
            const start_index = await hPAL.userRewardIndex(user1.address)

            const user_rewards1 = await hPAL.claimableRewards(user1.address)

            expect(user_rewards1).to.be.eq(0)

            await mineBlocks(125)

            const lock_tx = await hPAL.connect(user1).lock(lock_amount, lock_duration)
            const lock_index = await hPAL.userRewardIndex(user1.address)
            const lock_ts = (await ethers.provider.getBlock((await lock_tx).blockNumber || 0)).timestamp

            const start_lock_multiplier = await hPAL.userCurrentBonusRatio(user1.address)
            const decrease_multiplier = await hPAL.userBonusRatioDecrease(user1.address)

            const user_rewards2 = await hPAL.claimableRewards(user1.address)

            const staked_balance = stake_amount.sub(lock_amount)

            let estimated_accrued_rewards = lock_index.sub(start_index).mul(stake_amount).div(UNIT)

            expect(user_rewards2).to.be.eq(user_rewards1.add(estimated_accrued_rewards))

            await mineBlocks(75)

            const update_tx = await hPAL.connect(user1).updateUserRewardState(user1.address)
            const update_index = await hPAL.userRewardIndex(user1.address)
            const update_ts = (await ethers.provider.getBlock((await update_tx).blockNumber || 0)).timestamp

            const user_rewards3 = await hPAL.claimableRewards(user1.address)

            const ellapsed_time = update_ts - lock_ts

            const estimated_current_multiplier = start_lock_multiplier.sub(decrease_multiplier.mul(ellapsed_time))

            const estimated_multiplier_period = estimated_current_multiplier.add(
                decrease_multiplier.mul(ellapsed_time).add(decrease_multiplier).div(2)
            )

            let estimated_locking_accrued_rewards = ((update_index.sub(lock_index)).mul(estimated_multiplier_period).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(update_index.sub(lock_index).mul(staked_balance).div(UNIT))

            expect(user_rewards3).to.be.eq(user_rewards2.add(estimated_accrued_rewards))

            await mineBlocks(100)

            const gloabl_update_tx = await hPAL.connect(user1).updateRewardState()
            const gloabl_update_ts = (await ethers.provider.getBlock((await gloabl_update_tx).blockNumber || 0)).timestamp

            const user_rewards4 = await hPAL.estimateClaimableRewards(user1.address)

            const global_index = await hPAL.rewardIndex()

            const ellapsed_time2 = gloabl_update_ts - update_ts

            const estimated_current_multiplier2 = estimated_current_multiplier.sub(decrease_multiplier.mul(ellapsed_time2))

            const estimated_multiplier_period2 = estimated_current_multiplier2.add(
                decrease_multiplier.mul(ellapsed_time2).add(decrease_multiplier).div(2)
            )

            estimated_locking_accrued_rewards = ((global_index.sub(update_index)).mul(estimated_multiplier_period2).div(UNIT)).mul(lock_amount).div(UNIT)

            estimated_accrued_rewards = estimated_locking_accrued_rewards.add(global_index.sub(update_index).mul(staked_balance).div(UNIT))

            expect(user_rewards4).to.be.eq(user_rewards3.add(estimated_accrued_rewards))
        });

        it(' should claim the correct amount of rewards for user (& emit the correct Event)', async () => {
            await hPAL.connect(user1).stake(stake_amount)

            await mineBlocks(450)

            await hPAL.connect(user1).updateUserRewardState(user1.address)

            await mineBlocks(1200)

            const estimated_accrued_rewards = await hPAL.estimateClaimableRewards(user1.address)

            const claim_amount = estimated_accrued_rewards.div(3)

            const old_balance = await token.balanceOf(user1.address)

            const claim_tx = await hPAL.connect(user1).claim(claim_amount)

            const new_balance = await token.balanceOf(user1.address)

            const received_amount = new_balance.sub(old_balance)

            await expect(claim_tx)
                .to.emit(hPAL, 'ClaimRewards')
                .withArgs(user1.address, claim_amount);

            expect(received_amount).to.be.eq(claim_amount)
        });

        it(' should allow to only claim part of the rewards', async () => {
            await hPAL.connect(user1).stake(stake_amount)

            await mineBlocks(450)

            await hPAL.connect(user1).updateUserRewardState(user1.address)

            const accrued_rewards = await hPAL.claimableRewards(user1.address)

            await mineBlocks(1200)

            const claim_tx = await hPAL.connect(user1).claim(accrued_rewards)

            await expect(claim_tx)
                .to.emit(hPAL, 'ClaimRewards')
                .withArgs(user1.address, accrued_rewards);
                
            expect(await hPAL.claimableRewards(user1.address)).not.to.be.eq(0)
        });

        it(' should allow to claim all available rewards & set claimable to 0', async () => {
            await hPAL.connect(user1).stake(stake_amount)

            await mineBlocks(450)

            await hPAL.connect(user1).cooldown()

            await advanceTime(864000)

            await hPAL.connect(user1).unstake(stake_amount, user1.address)

            const accrued_rewards = await hPAL.claimableRewards(user1.address)

            const claim_tx = await hPAL.connect(user1).claim(accrued_rewards)

            await expect(claim_tx)
                .to.emit(hPAL, 'ClaimRewards')
                .withArgs(user1.address, accrued_rewards);

            expect(await hPAL.claimableRewards(user1.address)).to.be.eq(0)

        });

        it(' should claim it all if given higher amount', async () => {
            await hPAL.connect(user1).stake(stake_amount)

            await mineBlocks(450)

            await hPAL.connect(user1).cooldown()

            await advanceTime(864000)

            await hPAL.connect(user1).unstake(stake_amount, user1.address)

            const estimated_accrued_rewards = await hPAL.estimateClaimableRewards(user1.address)

            const old_balance = await token.balanceOf(user1.address)

            const claim_tx = await hPAL.connect(user1).claim(estimated_accrued_rewards.mul(2))

            const new_balance = await token.balanceOf(user1.address)

            const received_amount = new_balance.sub(old_balance)

            await expect(claim_tx)
                .to.emit(hPAL, 'ClaimRewards')
                .withArgs(user1.address, received_amount);

            expect(await hPAL.claimableRewards(user1.address)).to.be.eq(0)
        });

        it(' should fail if given incorrect amounts', async () => {
            await hPAL.connect(user1).stake(stake_amount)

            await mineBlocks(450)

            await hPAL.connect(user1).cooldown()

            await advanceTime(864000)

            await hPAL.connect(user1).unstake(stake_amount, user1.address)

            await expect(
                hPAL.connect(user1).claim(0)
            ).to.be.revertedWith('hPAL: incorrect amount')
        });

        it(' should do the correct transfer from rewardsVault to user', async () => {
            await hPAL.connect(user1).stake(stake_amount)

            await mineBlocks(450)

            await hPAL.connect(user1).cooldown()

            await advanceTime(864000)

            await hPAL.connect(user1).unstake(stake_amount, user1.address)

            const accrued_rewards = await hPAL.claimableRewards(user1.address)

            const claim_tx = await hPAL.connect(user1).claim(accrued_rewards)

            await expect(claim_tx)
                .to.emit(token, 'Transfer')
                .withArgs(reserve.address, user1.address, accrued_rewards);
        });

    });

});