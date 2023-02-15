const hre = require("hardhat");
import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PaladinToken } from "../typechain/PaladinToken";
import { HolyPaladinToken } from "../typechain/HolyPaladinToken";
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

const mint_amount = ethers.utils.parseEther('10000000') // 10 M tokens

const UNIT = ethers.utils.parseEther('1')

const WEEK = 604800

const startDropPerSecond = ethers.utils.parseEther('0.0005')
const endDropPerSecond = ethers.utils.parseEther('0.00001')

const dropDecreaseDuration = 63115200

const baseLockBonusRatio = ethers.utils.parseEther('1')
const minLockBonusRatio = ethers.utils.parseEther('2')
const maxLockBonusRatio = ethers.utils.parseEther('6')


describe('PaladinToken contract tests - Locking', () => {
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

    it(' should have the initial total lock to 0', async () => {
        const initial_totalLock = await hPAL.getCurrentTotalLock()

        const deploy_block = (await hPAL.deployTransaction).blockNumber

        expect(await hPAL.getTotalLockLength()).to.be.eq(1)

        expect(initial_totalLock.total).to.be.eq(0)
        expect(initial_totalLock.fromBlock).to.be.eq(deploy_block)

        expect((await hPAL.totalLocks(0)).total).to.be.eq(initial_totalLock.total)
        expect((await hPAL.totalLocks(0)).fromBlock).to.be.eq(initial_totalLock.fromBlock)

    });


    describe('lock', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount = ethers.utils.parseEther('700')

        const lock_duration = 31557600

        const smaller_lock_amount = ethers.utils.parseEther('500')

        const smaller_lock_duration = 15780000

        const bigger_lock_amount = ethers.utils.parseEther('850')

        const bigger_lock_duration = 47340000

        const estimateBonusRatio = async (duration: number) => {
            const MAX_LOCK_DURATION = 63115200
            const MIN_LOCK_DURATION = 7889400
            let durationRatio = UNIT.mul(duration - MIN_LOCK_DURATION).div(MAX_LOCK_DURATION - MIN_LOCK_DURATION)
            let mult = minLockBonusRatio.add((maxLockBonusRatio.sub(minLockBonusRatio)).mul(durationRatio).div(UNIT))
            return mult
        }

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

        });

        it(' should create a new lock', async () => {

            const old_available_balance = await hPAL.availableBalanceOf(user1.address)
            const old_balance = await hPAL.balanceOf(user1.address)

            expect(old_available_balance).to.be.eq(old_balance)

            const old_lock_count = await hPAL.getUserLockCount(user1.address)

            expect(old_lock_count).to.be.eq(0)

            const lock_tx = await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const current_totalLocked = await hPAL.currentTotalLocked()

            const tx_block = (await lock_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            await expect(lock_tx)
                .to.emit(hPAL, 'Lock')
                .withArgs(user1.address, lock_amount, tx_timestamp, lock_duration, current_totalLocked);

            const new_lock_count = await hPAL.getUserLockCount(user1.address)

            expect(new_lock_count).to.be.eq(old_lock_count.add(1))

            const user_lock = await hPAL.getUserLock(user1.address)

            expect(user_lock.amount).to.be.eq(lock_amount)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(lock_duration)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

            const new_available_balance = await hPAL.availableBalanceOf(user1.address)
            const new_balance = await hPAL.balanceOf(user1.address)

            expect(new_available_balance.add(lock_amount)).to.be.eq(new_balance)

            expect(new_balance).to.be.eq(old_balance)

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            expect(user_allBalances.staked).to.be.eq(new_balance)
            expect(user_allBalances.locked).to.be.eq(lock_amount)
            expect(user_allBalances.available).to.be.eq(new_balance.sub(lock_amount))

        });

        it(' should update the TotalLock correctly', async () => {

            const old_totalLocked = await hPAL.currentTotalLocked()

            const old_totalLocked_count = await hPAL.getTotalLockLength()

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const new_totalLocked = await hPAL.currentTotalLocked()

            const new_totalLocked_count = await hPAL.getTotalLockLength()

            expect(new_totalLocked).to.be.eq(old_totalLocked.add(lock_amount))

            expect(new_totalLocked_count).to.be.eq(old_totalLocked_count.add(1))

        });

        it(' should update an existing lock if values are higher', async () => {

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const old_user_lock = await hPAL.getUserLock(user1.address)

            const old_balance = await hPAL.balanceOf(user1.address)

            const old_lock_count = await hPAL.getUserLockCount(user1.address)

            const lock_tx = await hPAL.connect(user1).lock(bigger_lock_amount, bigger_lock_duration)

            const current_totalLocked = await hPAL.currentTotalLocked()

            const tx_block = (await lock_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            await expect(lock_tx)
                .to.emit(hPAL, 'Lock')
                .withArgs(user1.address, bigger_lock_amount, tx_timestamp, bigger_lock_duration, current_totalLocked);

            const new_lock_count = await hPAL.getUserLockCount(user1.address)

            expect(new_lock_count).to.be.eq(old_lock_count.add(1))

            const user_lock = await hPAL.getUserLock(user1.address)

            expect(user_lock.amount).to.be.eq(bigger_lock_amount)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(bigger_lock_duration)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

            expect(user_lock.amount).to.be.gt(old_user_lock.amount)
            expect(user_lock.amount).to.be.gt(old_user_lock.amount)

            const new_available_balance = await hPAL.availableBalanceOf(user1.address)
            const new_balance = await hPAL.balanceOf(user1.address)

            expect(new_available_balance.add(bigger_lock_amount)).to.be.eq(new_balance)

            expect(new_balance).to.be.eq(old_balance)

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            expect(user_allBalances.staked).to.be.eq(new_balance)
            expect(user_allBalances.locked).to.be.eq(bigger_lock_amount)
            expect(user_allBalances.available).to.be.eq(new_balance.sub(bigger_lock_amount))

        });

        it(' should allow to create a new lock if user unlocked before', async () => {

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            advanceTime(BigNumber.from(lock_duration).mul(2).toNumber())

            await hPAL.connect(user1).unlock()

            const old_available_balance = await hPAL.availableBalanceOf(user1.address)
            const old_balance = await hPAL.balanceOf(user1.address)

            expect(old_available_balance).to.be.eq(old_balance)

            const old_lock_count = await hPAL.getUserLockCount(user1.address)

            const lock_tx = await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const current_totalLocked = await hPAL.currentTotalLocked()

            const tx_block = (await lock_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            await expect(lock_tx)
                .to.emit(hPAL, 'Lock')
                .withArgs(user1.address, lock_amount, tx_timestamp, lock_duration, current_totalLocked);

            const new_lock_count = await hPAL.getUserLockCount(user1.address)

            expect(new_lock_count).to.be.eq(old_lock_count.add(1))

            const user_lock = await hPAL.getUserLock(user1.address)

            expect(user_lock.amount).to.be.eq(lock_amount)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(lock_duration)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

            const new_available_balance = await hPAL.availableBalanceOf(user1.address)
            const new_balance = await hPAL.balanceOf(user1.address)

            expect(new_available_balance.add(lock_amount)).to.be.eq(new_balance)

            expect(new_balance).to.be.eq(old_balance)

        });

        it(' should set the correct BonusRatio & Decrease value', async () => {
            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const estimated_mult1 = await estimateBonusRatio(lock_duration)
            const estimated_decrease1 = estimated_mult1.sub(baseLockBonusRatio).div(lock_duration)

            expect(await hPAL.userCurrentBonusRatio(user1.address)).to.be.eq(estimated_mult1)
            expect(await hPAL.userBonusRatioDecrease(user1.address)).to.be.eq(estimated_decrease1)

            await token.connect(recipient).transfer(user2.address, stake_amount)

            await token.connect(user2).approve(hPAL.address, stake_amount)

            await hPAL.connect(user2).stake(stake_amount)

            await hPAL.connect(user2).lock(smaller_lock_amount, smaller_lock_duration)

            const estimated_mult2 = await estimateBonusRatio(smaller_lock_duration)
            const estimated_decrease2 = estimated_mult2.sub(baseLockBonusRatio).div(smaller_lock_duration)

            expect(await hPAL.userCurrentBonusRatio(user2.address)).to.be.eq(estimated_mult2)
            expect(await hPAL.userBonusRatioDecrease(user2.address)).to.be.eq(estimated_decrease2)
        });

        it(' should update the BonusRatio & Decrease value', async () => {
            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const estimated_mult1 = await estimateBonusRatio(lock_duration)
            const estimated_decrease1 = estimated_mult1.sub(baseLockBonusRatio).div(lock_duration)

            expect(await hPAL.userCurrentBonusRatio(user1.address)).to.be.eq(estimated_mult1)
            expect(await hPAL.userBonusRatioDecrease(user1.address)).to.be.eq(estimated_decrease1)

            await advanceTime(500)

            await hPAL.connect(user1).lock(bigger_lock_amount, bigger_lock_duration)

            const estimated_mult2 = await estimateBonusRatio(bigger_lock_duration)
            const estimated_decrease2 = estimated_mult2.sub(baseLockBonusRatio).div(bigger_lock_duration)

            expect(await hPAL.userCurrentBonusRatio(user1.address)).to.be.eq(estimated_mult2)
            expect(await hPAL.userBonusRatioDecrease(user1.address)).to.be.eq(estimated_decrease2)

        });

        it(' should allow to transfer non locked balance', async () => {

            const transfer_amount = ethers.utils.parseEther('150')

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const old_balances = await hPAL.allBalancesOf(user1.address)
            const old_receiver_balance = await hPAL.balanceOf(user2.address)

            await hPAL.connect(user1).transfer(user2.address, transfer_amount)

            const new_balances = await hPAL.allBalancesOf(user1.address)
            const new_receiver_balance = await hPAL.balanceOf(user2.address)

            expect(new_balances.available).to.be.eq(old_balances.available.sub(transfer_amount))
            expect(new_balances.staked).to.be.eq(old_balances.staked.sub(transfer_amount))
            expect(new_balances.locked).to.be.eq(old_balances.locked)
            expect(new_receiver_balance).to.be.eq(old_receiver_balance.add(transfer_amount))

        });

        it(' should fail if given incorrect durations', async () => {

            const lower_duration = (await hPAL.MIN_LOCK_DURATION()).sub(1)
            const bigger_duration = (await hPAL.MAX_LOCK_DURATION()).add(1)

            await expect(
                hPAL.connect(user1).lock(lock_amount, lower_duration)
            ).to.be.revertedWith('hPAL: Lock duration under min')

            await expect(
                hPAL.connect(user1).lock(lock_amount, bigger_duration)
            ).to.be.revertedWith('hPAL: Lock duration over max')

        });

        it(' should fail if given null amount', async () => {

            await expect(
                hPAL.connect(user1).lock(0, lock_duration)
            ).to.be.revertedWith('hPAL: Null amount')

        });

        it(' should fail if user has no staked balance', async () => {

            await expect(
                hPAL.connect(user2).lock(lock_amount, lock_duration)
            ).to.be.revertedWith('hPAL: Amount over balance')

        });

        it(' should fail if trying to lock more than balance', async () => {

            const user_balance = await hPAL.balanceOf(user1.address)

            await expect(
                hPAL.connect(user1).lock(user_balance.add(1), lock_duration)
            ).to.be.revertedWith('hPAL: Amount over balance')

        });

        it(' should fail if trying to lock more than available balance + locked balance', async () => {

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const extra_amount = await hPAL.availableBalanceOf(user1.address)

            await expect(
                hPAL.connect(user1).lock(lock_amount.add(extra_amount.add(10)), lock_duration)
            ).to.be.revertedWith('hPAL: Amount over balance')

        });

        it(' should fail if lock value are less than current Lock', async () => {

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            await expect(
                hPAL.connect(user1).lock(smaller_lock_amount, lock_duration)
            ).to.be.revertedWith('hPAL: smaller amount')

            await expect(
                hPAL.connect(user1).lock(lock_amount, smaller_lock_duration)
            ).to.be.revertedWith('hPAL: smaller duration')

        });

        it(' should recreate a new lock if precedent is expired ', async () => {

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            await advanceTime(lock_duration)

            const old_balance = await hPAL.balanceOf(user1.address)

            const old_lock_count = await hPAL.getUserLockCount(user1.address)

            const lock_tx = await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const current_totalLocked = await hPAL.currentTotalLocked()

            const tx_block = (await lock_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            await expect(lock_tx)
                .to.emit(hPAL, 'Lock')
                .withArgs(user1.address, lock_amount, tx_timestamp, lock_duration, current_totalLocked);

            const new_lock_count = await hPAL.getUserLockCount(user1.address)

            expect(new_lock_count).to.be.eq(old_lock_count.add(1))

            const user_lock = await hPAL.getUserLock(user1.address)

            expect(user_lock.amount).to.be.eq(lock_amount)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(lock_duration)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

            const new_available_balance = await hPAL.availableBalanceOf(user1.address)
            const new_balance = await hPAL.balanceOf(user1.address)

            expect(new_available_balance.add(lock_amount)).to.be.eq(new_balance)

            expect(new_balance).to.be.eq(old_balance)

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            expect(user_allBalances.staked).to.be.eq(new_balance)
            expect(user_allBalances.locked).to.be.eq(lock_amount)
            expect(user_allBalances.available).to.be.eq(new_balance.sub(lock_amount))

        });

        it(' should create a smaller lock if precedent is expired ', async () => {

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            await advanceTime(lock_duration)

            const old_balance = await hPAL.balanceOf(user1.address)

            const old_lock_count = await hPAL.getUserLockCount(user1.address)

            const lock_tx = await hPAL.connect(user1).lock(smaller_lock_amount, smaller_lock_duration)

            const current_totalLocked = await hPAL.currentTotalLocked()

            const tx_block = (await lock_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            await expect(lock_tx)
                .to.emit(hPAL, 'Lock')
                .withArgs(user1.address, smaller_lock_amount, tx_timestamp, smaller_lock_duration, current_totalLocked);

            const new_lock_count = await hPAL.getUserLockCount(user1.address)

            expect(new_lock_count).to.be.eq(old_lock_count.add(1))

            const user_lock = await hPAL.getUserLock(user1.address)

            expect(user_lock.amount).to.be.eq(smaller_lock_amount)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(smaller_lock_duration)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

            const new_available_balance = await hPAL.availableBalanceOf(user1.address)
            const new_balance = await hPAL.balanceOf(user1.address)

            expect(new_available_balance.add(smaller_lock_amount)).to.be.eq(new_balance)

            expect(new_balance).to.be.eq(old_balance)

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            expect(user_allBalances.staked).to.be.eq(new_balance)
            expect(user_allBalances.locked).to.be.eq(smaller_lock_amount)
            expect(user_allBalances.available).to.be.eq(new_balance.sub(smaller_lock_amount))

        });

        it(' should count bonus voting power correctly', async () => {

            const bonus_ratio = await hPAL.bonusLockVoteRatio()

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            const expected_votes = user_allBalances.staked.add(user_allBalances.locked.mul(bonus_ratio).div(UNIT))

            const new_votes = await hPAL.getCurrentVotes(user1.address)

            expect(new_votes).to.be.eq(expected_votes)

        });

        it(' should not get bonus voting power if lock duration is less than a year', async () => {

            await hPAL.connect(user1).lock(lock_amount, smaller_lock_duration)

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            const expected_votes = user_allBalances.staked

            const new_votes = await hPAL.getCurrentVotes(user1.address)

            expect(new_votes).to.be.eq(expected_votes)

        });

        it(' should count bonus voting power correctly (with received delegation)', async () => {

            await token.connect(recipient).transfer(user2.address, stake_amount)

            await token.connect(user2).approve(hPAL.address, stake_amount)

            await hPAL.connect(user2).stake(stake_amount)

            await hPAL.connect(user2).delegate(user1.address)
            await hPAL.connect(user1).delegate(user1.address)

            const bonus_ratio = await hPAL.bonusLockVoteRatio()

            const past_votes = await hPAL.getCurrentVotes(user1.address)

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const expected_votes = past_votes.add(lock_amount.mul(bonus_ratio).div(UNIT))

            const new_votes = await hPAL.getCurrentVotes(user1.address)

            expect(new_votes).to.be.eq(expected_votes)

        });

        it(' should automatically self-delegate votes', async () => {

            const old_delegate = await hPAL.delegates(user1.address)

            expect(old_delegate).to.be.eq(ethers.constants.AddressZero)

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const new_delegate = await hPAL.delegates(user1.address)

            expect(new_delegate).to.be.eq(user1.address)

        });

        it(' should not change delegation if set before (& not count bonus voting power)', async () => {

            await hPAL.connect(user1).delegate(user2.address)

            const old_votes = await hPAL.getCurrentVotes(user2.address)

            const old_delegate = await hPAL.delegates(user1.address)

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

            const new_delegate = await hPAL.delegates(user1.address)

            expect(new_delegate).to.be.eq(old_delegate)

            const new_votes = await hPAL.getCurrentVotes(user2.address)

            expect(new_votes).to.be.eq(old_votes)

            expect(await hPAL.getCurrentVotes(user1.address)).to.be.eq(0)

        });

    });


    describe('increaseLock', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount = ethers.utils.parseEther('700')

        const lock_duration = 31557600

        const smaller_lock_amount = ethers.utils.parseEther('500')

        const bigger_lock_amount = ethers.utils.parseEther('850')

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

        });

        it(' should update the lock correctly', async () => {

            const old_user_lock = await hPAL.getUserLock(user1.address)

            const old_current_totalLocked = await hPAL.currentTotalLocked()

            const old_totalLocked_count = await hPAL.getTotalLockLength()

            const increase_tx = await hPAL.connect(user1).increaseLock(bigger_lock_amount)

            const current_totalLocked = await hPAL.currentTotalLocked()

            await expect(increase_tx)
                .to.emit(hPAL, 'Lock')
                .withArgs(user1.address, bigger_lock_amount, old_user_lock.startTimestamp, lock_duration, current_totalLocked);

            const user_lock = await hPAL.getUserLock(user1.address)

            const tx_block = (await increase_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            expect(user_lock.amount).to.be.eq(bigger_lock_amount)
            expect(user_lock.startTimestamp).to.be.eq(old_user_lock.startTimestamp)
            expect(user_lock.duration).to.be.eq(lock_duration)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

            expect(user_lock.duration).to.be.eq(old_user_lock.duration)

            expect(current_totalLocked).to.be.eq(old_current_totalLocked.add(bigger_lock_amount.sub(lock_amount)))

            const new_totalLocked_count = await hPAL.getTotalLockLength()

            expect(new_totalLocked_count).to.be.eq(old_totalLocked_count.add(1))

        });

        it(' should fail if no lock exists for the user', async () => {

            await expect(
                hPAL.connect(user2).increaseLock(bigger_lock_amount)
            ).to.be.revertedWith('hPAL: No Lock')

        });

        it(' should fail if the value is less than the current lock', async () => {

            await expect(
                hPAL.connect(user1).increaseLock(smaller_lock_amount)
            ).to.be.revertedWith('hPAL: smaller amount')

        });

    });


    describe('increaseLockDuration', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount = ethers.utils.parseEther('700')

        const lock_duration = 31557600

        const smaller_lock_duration = 15780000

        const bigger_lock_duration = 47340000

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

        });

        it(' should update the lock correctly', async () => {

            const old_user_lock = await hPAL.getUserLock(user1.address)

            const old_current_totalLocked = await hPAL.currentTotalLocked()

            const increase_tx = await hPAL.connect(user1).increaseLockDuration(bigger_lock_duration)

            const current_totalLocked = await hPAL.currentTotalLocked()

            const tx_block = (await increase_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            await expect(increase_tx)
                .to.emit(hPAL, 'Lock')
                .withArgs(user1.address, lock_amount, tx_timestamp, bigger_lock_duration, current_totalLocked);

            const user_lock = await hPAL.getUserLock(user1.address)

            expect(user_lock.amount).to.be.eq(lock_amount)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(bigger_lock_duration)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

            expect(user_lock.amount).to.be.eq(old_user_lock.amount)

            expect(current_totalLocked).to.be.eq(old_current_totalLocked)

        });

        it(' should not update the TotalLock', async () => {

            const old_totalLocked = await hPAL.currentTotalLocked()

            const old_totalLocked_count = await hPAL.getTotalLockLength()

            await hPAL.connect(user1).increaseLockDuration(bigger_lock_duration)

            const new_totalLocked = await hPAL.currentTotalLocked()

            const new_totalLocked_count = await hPAL.getTotalLockLength()

            expect(new_totalLocked).to.be.eq(old_totalLocked)

            expect(new_totalLocked_count).to.be.eq(old_totalLocked_count)

        });

        it(' should fail if no lock exists for the user', async () => {

            await expect(
                hPAL.connect(user2).increaseLockDuration(bigger_lock_duration)
            ).to.be.revertedWith('hPAL: No Lock')

        });

        it(' should fail if the value is less than the current lock', async () => {

            await expect(
                hPAL.connect(user1).increaseLockDuration(smaller_lock_duration)
            ).to.be.revertedWith('hPAL: smaller duration')

        });

    });


    describe('unlock', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount = ethers.utils.parseEther('1000')

        const lock_duration = 31557600

        const bigger_lock_duration = 47340000

        const half_lock_duration = 15778800

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

        });

        it(' should reset the lock (& emit the correct Event)', async () => {

            const old_user_lock = await hPAL.getUserLock(user1.address)

            const old_lock_count = await hPAL.getUserLockCount(user1.address)

            await advanceTime(lock_duration)

            const unlock_tx = await hPAL.connect(user1).unlock()

            const current_totalLocked = await hPAL.currentTotalLocked()

            await expect(unlock_tx)
                .to.emit(hPAL, 'Unlock')
                .withArgs(user1.address, old_user_lock.amount, current_totalLocked);

            const user_lock = await hPAL.getUserLock(user1.address)

            const tx_block = (await unlock_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            expect(user_lock.amount).to.be.eq(0)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(0)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

            const new_lock_count = await hPAL.getUserLockCount(user1.address)

            expect(new_lock_count).to.be.eq(old_lock_count.add(1))

            const user_available_balance = await hPAL.availableBalanceOf(user1.address)
            const user_balance = await hPAL.balanceOf(user1.address)

            expect(user_available_balance).to.be.eq(user_balance)

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            expect(user_allBalances.staked).to.be.eq(user_balance)
            expect(user_allBalances.locked).to.be.eq(0)
            expect(user_allBalances.available).to.be.eq(user_balance)
            
            expect(await hPAL.userCurrentBonusRatio(user1.address)).to.be.eq(0)
            expect(await hPAL.userBonusRatioDecrease(user1.address)).to.be.eq(0)

        });

        it(' should update TotalLocked correctly', async () => {

            const old_current_totalLocked = await hPAL.currentTotalLocked()

            const old_totalLocked_count = await hPAL.getTotalLockLength()

            await advanceTime(lock_duration)

            await hPAL.connect(user1).unlock()

            const current_totalLocked = await hPAL.currentTotalLocked()

            const new_totalLocked_count = await hPAL.getTotalLockLength()

            expect(current_totalLocked).to.be.eq(old_current_totalLocked.sub(lock_amount))

            expect(new_totalLocked_count).to.be.eq(old_totalLocked_count.add(1))

        });

        it(' should fail if user has no lock', async () => {

            await expect(
                hPAL.connect(user2).unlock()
            ).to.be.revertedWith('hPAL: No Lock')

        });

        it(' should not change BonusRatio & Decrease anymore', async () => {

            await advanceTime(lock_duration)

            await hPAL.connect(user1).unlock()

            await advanceTime(lock_duration / 2)
            
            expect(await hPAL.userCurrentBonusRatio(user1.address)).to.be.eq(0)
            expect(await hPAL.userBonusRatioDecrease(user1.address)).to.be.eq(0)

            await advanceTime(lock_duration)
            
            expect(await hPAL.userCurrentBonusRatio(user1.address)).to.be.eq(0)
            expect(await hPAL.userBonusRatioDecrease(user1.address)).to.be.eq(0)

        });

        it(' should fail if the current user lock is 0', async () => {

            await advanceTime(lock_duration)

            await hPAL.connect(user1).unlock()

            await expect(
                hPAL.connect(user1).unlock()
            ).to.be.revertedWith('hPAL: No Lock')

        });

        it(' should fail if trying to unlock before lock expiry', async () => {

            await expect(
                hPAL.connect(user1).unlock()
            ).to.be.revertedWith('hPAL: Not expired')

            await advanceTime(half_lock_duration)

            await expect(
                hPAL.connect(user1).unlock()
            ).to.be.revertedWith('hPAL: Not expired')

        });

        it(' should not allow ot unlock if duration was extended', async () => {

            await advanceTime(half_lock_duration)
            
            await hPAL.connect(user1).increaseLockDuration(bigger_lock_duration)

            await advanceTime(half_lock_duration)

            await expect(
                hPAL.connect(user1).unlock()
            ).to.be.revertedWith('hPAL: Not expired')

        });

        it(' should remove the bonus voting power', async () => {

            await advanceTime(lock_duration)

            await hPAL.connect(user1).unlock()

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            const expected_votes = user_allBalances.staked

            const new_votes = await hPAL.getCurrentVotes(user1.address)

            expect(new_votes).to.be.eq(expected_votes)

        });

        it(' should not change delegated voting power', async () => {

            await hPAL.connect(user1).delegate(user2.address)

            const old_votes = await hPAL.getCurrentVotes(user2.address)

            const old_delegate = await hPAL.delegates(user1.address)

            await advanceTime(lock_duration)

            await hPAL.connect(user1).unlock()

            const new_delegate = await hPAL.delegates(user1.address)

            expect(new_delegate).to.be.eq(old_delegate)

            const new_votes = await hPAL.getCurrentVotes(user2.address)

            expect(new_votes).to.be.eq(old_votes)

            expect(await hPAL.getCurrentVotes(user1.address)).to.be.eq(0)

        });

    });


    describe('kick', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount = ethers.utils.parseEther('700')

        const lock_duration = 31557600

        const bigger_lock_duration = 47340000

        const bigger_lock_amount = ethers.utils.parseEther('850')

        const half_lock_duration = 15778800

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

            await token.connect(recipient).transfer(user2.address, ethers.utils.parseEther('300'))

            await token.connect(user2).approve(hPAL.address, ethers.utils.parseEther('300'))

            await hPAL.connect(user2).stake(ethers.utils.parseEther('300'))

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

        });

        it(' should remove the lock correctly (& emit the correct Event)', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            const old_user_balance = await hPAL.balanceOf(user1.address)

            const old_user_lock = await hPAL.getUserLock(user1.address)

            const old_lock_count = await hPAL.getUserLockCount(user1.address)

            const old_kicker_balance = await  hPAL.balanceOf(user2.address)

            await advanceTime(unlock_delay.add(lock_duration).toNumber())

            const kick_tx = await hPAL.connect(user2).kick(user1.address)

            const current_totalLocked = await hPAL.currentTotalLocked()

            const new_kicker_balance = await  hPAL.balanceOf(user2.address)

            const penalty_amount = new_kicker_balance.sub(old_kicker_balance)

            await expect(kick_tx)
                .to.emit(hPAL, 'Kick')
                .withArgs(user1.address, user2.address, old_user_lock.amount, penalty_amount, current_totalLocked);

            const user_lock = await hPAL.getUserLock(user1.address)

            const tx_block = (await kick_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            expect(user_lock.amount).to.be.eq(0)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(0)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

            const new_lock_count = await hPAL.getUserLockCount(user1.address)

            expect(new_lock_count).to.be.eq(old_lock_count.add(1))

            const user_available_balance = await hPAL.availableBalanceOf(user1.address)
            const user_balance = await hPAL.balanceOf(user1.address)

            expect(user_available_balance).to.be.eq(user_balance)

            expect(user_balance).to.be.eq(old_user_balance.sub(penalty_amount))

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            expect(user_allBalances.staked).to.be.eq(user_balance)
            expect(user_allBalances.locked).to.be.eq(0)
            expect(user_allBalances.available).to.be.eq(user_balance)
            
            expect(await hPAL.userCurrentBonusRatio(user1.address)).to.be.eq(0)
            expect(await hPAL.userBonusRatioDecrease(user1.address)).to.be.eq(0)

        });

        it(' should update TotalLocked correctly', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            const old_current_totalLocked = await hPAL.currentTotalLocked()

            const old_totalLocked_count = await hPAL.getTotalLockLength()

            await advanceTime(unlock_delay.add(lock_duration).toNumber())

            await hPAL.connect(user2).kick(user1.address)

            const current_totalLocked = await hPAL.currentTotalLocked()

            const new_totalLocked_count = await hPAL.getTotalLockLength()

            expect(current_totalLocked).to.be.eq(old_current_totalLocked.sub(lock_amount))

            expect(new_totalLocked_count).to.be.eq(old_totalLocked_count.add(1))

        });

        it(' should apply the correct penality & send it to the kicker (2 weeks)', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            const MAX_BPS = await hPAL.MAX_BPS()

            const user_lock = await hPAL.getUserLock(user1.address)

            const old_kicker_balance = await  hPAL.balanceOf(user2.address)

            const old_locker_balance = await  hPAL.balanceOf(user1.address)

            await advanceTime(unlock_delay.add(lock_duration).toNumber())

            await hPAL.connect(user2).kick(user1.address)

            const penalty_ratio = await hPAL.kickRatioPerWeek()

            const expected_penalty = user_lock.amount.mul(penalty_ratio.mul(unlock_delay.div(WEEK))).div(MAX_BPS)

            const new_kicker_balance = await  hPAL.balanceOf(user2.address)

            const new_locker_balance = await  hPAL.balanceOf(user1.address)

            expect(new_kicker_balance).to.be.eq(old_kicker_balance.add(expected_penalty))

            expect(new_locker_balance).to.be.eq(old_locker_balance.sub(expected_penalty))

        });

        it(' should apply the correct penality & send it to the kicker (6 weeks)', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            const MAX_BPS = await hPAL.MAX_BPS()

            const user_lock = await hPAL.getUserLock(user1.address)

            const old_kicker_balance = await  hPAL.balanceOf(user2.address)

            const old_locker_balance = await  hPAL.balanceOf(user1.address)

            const extra_unlock_delay = unlock_delay.mul(3) // = 6 weeks

            await advanceTime(extra_unlock_delay.add(lock_duration).toNumber())

            await hPAL.connect(user2).kick(user1.address)

            const penalty_ratio = await hPAL.kickRatioPerWeek()

            const expected_penalty = user_lock.amount.mul(penalty_ratio.mul(extra_unlock_delay.div(WEEK))).div(MAX_BPS)

            const new_kicker_balance = await  hPAL.balanceOf(user2.address)

            const new_locker_balance = await  hPAL.balanceOf(user1.address)

            expect(new_kicker_balance).to.be.eq(old_kicker_balance.add(expected_penalty))

            expect(new_locker_balance).to.be.eq(old_locker_balance.sub(expected_penalty))

        });

        it(' should apply the correct penality & send it to the kicker (max penalty)', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            const MAX_BPS = await hPAL.MAX_BPS()

            const extra_unlock_delay = unlock_delay.mul(50) // = 100 weeks

            const user_lock = await hPAL.getUserLock(user1.address)

            const old_locker_balance = await  hPAL.balanceOf(user1.address)

            const old_kicker_balance = await  hPAL.balanceOf(user2.address)

            await advanceTime(extra_unlock_delay.add(lock_duration).toNumber())

            await hPAL.connect(user2).kick(user1.address)

            const expected_penalty = user_lock.amount

            const new_kicker_balance = await  hPAL.balanceOf(user2.address)

            const new_locker_balance = await  hPAL.balanceOf(user1.address)

            expect(new_kicker_balance).to.be.eq(old_kicker_balance.add(expected_penalty))

            expect(new_locker_balance).to.be.eq(old_locker_balance.sub(expected_penalty))

        });

        it(' should not apply more penalty than the locked balance', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            const extra_unlock_delay = unlock_delay.mul(75) // = more than 100 weeks

            const user_lock = await hPAL.getUserLock(user1.address)

            const old_locker_balance = await  hPAL.balanceOf(user1.address)

            const old_kicker_balance = await  hPAL.balanceOf(user2.address)

            await advanceTime(extra_unlock_delay.add(lock_duration).toNumber())

            await hPAL.connect(user2).kick(user1.address)

            const expected_penalty = user_lock.amount

            const new_kicker_balance = await  hPAL.balanceOf(user2.address)

            const new_locker_balance = await  hPAL.balanceOf(user1.address)

            expect(new_kicker_balance).to.be.eq(old_kicker_balance.add(expected_penalty))

            expect(new_locker_balance).to.be.eq(old_locker_balance.sub(expected_penalty))

        });

        it(' should remove the bonus voting power', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            await advanceTime(unlock_delay.add(lock_duration).toNumber())

            await hPAL.connect(user2).kick(user1.address)

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            const expected_votes = user_allBalances.staked

            const new_votes = await hPAL.getCurrentVotes(user1.address)

            expect(new_votes).to.be.eq(expected_votes)

        });

        it(' should update the delegated voting power correctly', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            await hPAL.connect(user1).delegate(user2.address)

            const old_kicker_balance = await  hPAL.balanceOf(user2.address)

            const old_votes = await hPAL.getCurrentVotes(user2.address)

            const old_delegate = await hPAL.delegates(user1.address)

            await advanceTime(unlock_delay.add(lock_duration).toNumber())

            await hPAL.connect(user2).kick(user1.address)

            const new_delegate = await hPAL.delegates(user1.address)

            const new_kicker_balance = await  hPAL.balanceOf(user2.address)

            const penalty_amount = new_kicker_balance.sub(old_kicker_balance)

            expect(new_delegate).to.be.eq(old_delegate)

            const new_votes = await hPAL.getCurrentVotes(user2.address)

            expect(new_votes).to.be.eq(old_votes.sub(penalty_amount))

            expect(await hPAL.getCurrentVotes(user1.address)).to.be.eq(0)

        });

        it(' should fail if trying to kick itself', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            await advanceTime(unlock_delay.add(lock_duration).toNumber())

            await expect(
                hPAL.connect(user1).kick(user1.address)
            ).to.be.revertedWith('hPAL: cannot kick yourself')

        });

        it(' should fail if given address 0x0', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            await advanceTime(unlock_delay.add(lock_duration).toNumber())

            await expect(
                hPAL.connect(user2).kick(ethers.constants.AddressZero)
            ).to.be.revertedWith('hPAL: Address Zero')

        });

        it(' should fail if user already unlocked', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            await advanceTime(lock_duration)

            await hPAL.connect(user1).unlock()

            await advanceTime(unlock_delay.toNumber())

            await expect(
                hPAL.connect(user2).kick(user1.address)
            ).to.be.revertedWith('hPAL: No Lock')

        });

        it(' should fail if user has no Lock', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            await advanceTime(unlock_delay.add(lock_duration).toNumber())

            await expect(
                hPAL.connect(user1).kick(user2.address)
            ).to.be.revertedWith('hPAL: No Lock')

        });

        it(' should fail if the lock is not expired yet', async () => {

            await advanceTime(half_lock_duration)

            await expect(
                hPAL.connect(user2).kick(user1.address)
            ).to.be.revertedWith('hPAL: Not expired')

        });

        it(' should fail if still in the unlock delay', async () => {

            await advanceTime(lock_duration)

            await expect(
                hPAL.connect(user2).kick(user1.address)
            ).to.be.revertedWith('hPAL: Not kickable')

        });

        it(' should not allow to kick before the correct period if lock was extended', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            await advanceTime(half_lock_duration)

            await hPAL.connect(user1).increaseLockDuration(bigger_lock_duration)

            await advanceTime(unlock_delay.add(half_lock_duration).toNumber())

            await expect(
                hPAL.connect(user2).kick(user1.address)
            ).to.be.revertedWith('hPAL: Not expired')

            const remaining_time_to_wait = bigger_lock_duration - half_lock_duration

            await advanceTime(remaining_time_to_wait)

            const kick_tx = await hPAL.connect(user2).kick(user1.address)

            const user_lock = await hPAL.getUserLock(user1.address)

            const tx_block = (await kick_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            expect(user_lock.amount).to.be.eq(0)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(0)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

        });

        it(' should apply the correct penalty if lock was increased', async () => {

            const unlock_delay = await hPAL.UNLOCK_DELAY()

            const MAX_BPS = await hPAL.MAX_BPS()

            await advanceTime(half_lock_duration)

            await hPAL.connect(user1).increaseLock(bigger_lock_amount)

            await advanceTime(unlock_delay.add(half_lock_duration).toNumber())

            const old_kicker_balance = await  hPAL.balanceOf(user2.address)

            const old_locker_balance = await  hPAL.balanceOf(user1.address)

            await hPAL.connect(user2).kick(user1.address)

            const penalty_ratio = await hPAL.kickRatioPerWeek()

            const expected_penalty = BigNumber.from(bigger_lock_amount).mul(penalty_ratio.mul(unlock_delay.div(WEEK))).div(MAX_BPS)

            const new_kicker_balance = await  hPAL.balanceOf(user2.address)

            const new_locker_balance = await  hPAL.balanceOf(user1.address)

            expect(new_kicker_balance).to.be.eq(old_kicker_balance.add(expected_penalty))

            expect(new_locker_balance).to.be.eq(old_locker_balance.sub(expected_penalty))

        });

    });


    describe('getUserPastLock', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount1 = ethers.utils.parseEther('700')

        const lock_amount2 = ethers.utils.parseEther('300')

        const lock_duration = 31557600

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

            await token.connect(recipient).transfer(user2.address, stake_amount)

            await token.connect(user2).approve(hPAL.address, stake_amount)

            await hPAL.connect(user2).stake(stake_amount)

        });

        it(' should return 0 if no Lock', async () => {

            const currentBlock = await ethers.provider.getBlockNumber()

            const user_lock = await hPAL.getUserPastLock(user1.address, currentBlock - 1)

            expect(user_lock.amount).to.be.eq(0)
            expect(user_lock.startTimestamp).to.be.eq(0)
            expect(user_lock.duration).to.be.eq(0)
            expect(user_lock.fromBlock).to.be.eq(0)

        });

        it(' should return the correct Lock', async () => {

            const tx1 = await hPAL.connect(user1).lock(lock_amount1, lock_duration)

            const blockNumber1 = tx1.blockNumber || 0

            await mineBlocks(10)

            const tx2 = await hPAL.connect(user2).lock(lock_amount2, lock_duration)

            const blockNumber2 = tx2.blockNumber || 0

            await advanceTime(lock_duration)

            const tx3 = await hPAL.connect(user1).unlock()

            const blockNumber3 = tx3.blockNumber || 0

            await mineBlocks(15)

            const tx4 = await hPAL.connect(user2).increaseLock(lock_amount2.mul(2))

            const blockNumber4 = tx4.blockNumber || 0

            await mineBlocks(7)

            expect((await hPAL.getUserPastLock(user1.address, blockNumber1 - 1)).fromBlock).to.be.eq(0)
            expect((await hPAL.getUserPastLock(user1.address, blockNumber1 - 1)).amount).to.be.eq(0)
            expect((await hPAL.getUserPastLock(user1.address, blockNumber1)).fromBlock).to.be.eq(blockNumber1)
            expect((await hPAL.getUserPastLock(user1.address, blockNumber1)).amount).to.be.eq(lock_amount1)
            expect((await hPAL.getUserPastLock(user1.address, blockNumber1 + 1)).fromBlock).to.be.eq(blockNumber1)
            expect((await hPAL.getUserPastLock(user1.address, blockNumber1 + 1)).amount).to.be.eq(lock_amount1)

            expect((await hPAL.getUserPastLock(user2.address, blockNumber2 - 1)).fromBlock).to.be.eq(0)
            expect((await hPAL.getUserPastLock(user2.address, blockNumber2 - 1)).amount).to.be.eq(0)
            expect((await hPAL.getUserPastLock(user2.address, blockNumber2)).fromBlock).to.be.eq(blockNumber2)
            expect((await hPAL.getUserPastLock(user2.address, blockNumber2)).amount).to.be.eq(lock_amount2)
            expect((await hPAL.getUserPastLock(user2.address, blockNumber2 + 1)).fromBlock).to.be.eq(blockNumber2)
            expect((await hPAL.getUserPastLock(user2.address, blockNumber2 + 1)).amount).to.be.eq(lock_amount2)

            expect((await hPAL.getUserPastLock(user1.address, blockNumber3 - 1)).fromBlock).to.be.eq(blockNumber1)
            expect((await hPAL.getUserPastLock(user1.address, blockNumber3 - 1)).amount).to.be.eq(lock_amount1)
            expect((await hPAL.getUserPastLock(user1.address, blockNumber3)).fromBlock).to.be.eq(blockNumber3)
            expect((await hPAL.getUserPastLock(user1.address, blockNumber3)).amount).to.be.eq(0)
            expect((await hPAL.getUserPastLock(user1.address, blockNumber3 + 1)).fromBlock).to.be.eq(blockNumber3)
            expect((await hPAL.getUserPastLock(user1.address, blockNumber3 + 1)).amount).to.be.eq(0)

            expect((await hPAL.getUserPastLock(user2.address, blockNumber4 - 1)).fromBlock).to.be.eq(blockNumber2)
            expect((await hPAL.getUserPastLock(user2.address, blockNumber4 - 1)).amount).to.be.eq(lock_amount2)
            expect((await hPAL.getUserPastLock(user2.address, blockNumber4)).fromBlock).to.be.eq(blockNumber4)
            expect((await hPAL.getUserPastLock(user2.address, blockNumber4)).amount).to.be.eq(lock_amount2.mul(2))
            expect((await hPAL.getUserPastLock(user2.address, blockNumber4 + 1)).fromBlock).to.be.eq(blockNumber4)
            expect((await hPAL.getUserPastLock(user2.address, blockNumber4 + 1)).amount).to.be.eq(lock_amount2.mul(2))

        });

        it(' should return the 1st Lock', async () => {

            const lock_call = await hPAL.connect(user1).lock(lock_amount1, lock_duration)

            const blockNumber = lock_call.blockNumber || 0

            const nextBlock = blockNumber + 1

            await mineBlocks(10)

            await hPAL.connect(user1).lock(lock_amount1, lock_duration)

            const user_lock = await hPAL.getUserPastLock(user1.address, nextBlock)

            const oldCheckpoint = await hPAL.userLocks(user1.address, 0)

            expect(user_lock.amount).to.be.eq(oldCheckpoint.amount)
            expect(user_lock.startTimestamp).to.be.eq(oldCheckpoint.startTimestamp)
            expect(user_lock.duration).to.be.eq(oldCheckpoint.duration)
            expect(user_lock.fromBlock).to.be.eq(oldCheckpoint.fromBlock)

        });

        it(' should return the last Lock', async () => {
            const lock_tx = await hPAL.connect(user1).lock(lock_amount1, lock_duration)

            const blockNumber = lock_tx.blockNumber || 0

            await mineBlocks(10)

            const currentBlock = await ethers.provider.getBlockNumber()

            const user_lock = await hPAL.getUserPastLock(user1.address, currentBlock - 1)

            expect(user_lock.fromBlock).to.be.eq(blockNumber)
        });

        it(' should fail if blockNumber did not happened yet', async () => {

            const currentBlock = await ethers.provider.getBlockNumber()

            await expect(
                hPAL.getPastVotes(user2.address, currentBlock + 1000)
            ).to.be.revertedWith('hPAL: invalid blockNumber')

        });

    });


    describe('getPastTotalLock', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount1 = ethers.utils.parseEther('700')

        const lock_amount2 = ethers.utils.parseEther('500')

        const lock_duration = 31557600

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

            await token.connect(recipient).transfer(user2.address, stake_amount)

            await token.connect(user2).approve(hPAL.address, stake_amount)

            await hPAL.connect(user2).stake(stake_amount)

        });

        it(' should return the empty TotalLocked', async () => {

            const currentBlock = await ethers.provider.getBlockNumber()

            const user_lock = await hPAL.getPastTotalLock(currentBlock - 1)

            const deploy_block = (await hPAL.deployTransaction).blockNumber

            expect(user_lock.total).to.be.eq(0)
            expect(user_lock.fromBlock).to.be.eq(deploy_block)

        });

        it(' should return the correct TotalLocked', async () => {

            const deploy_block = (await hPAL.deployTransaction).blockNumber

            const tx1 = await hPAL.connect(user1).lock(lock_amount1, lock_duration)

            const blockNumber1 = tx1.blockNumber || 0

            await mineBlocks(10)

            const tx2 = await hPAL.connect(user2).lock(lock_amount2, lock_duration)

            const blockNumber2 = tx2.blockNumber || 0

            await advanceTime(lock_duration)

            const tx3 = await hPAL.connect(user2).increaseLockDuration(lock_duration * 2)

            const blockNumber3 = tx3.blockNumber || 0

            await mineBlocks(15)

            const tx4 = await hPAL.connect(user1).unlock()

            const blockNumber4 = tx4.blockNumber || 0

            await mineBlocks(7)

            const tx5 = await hPAL.connect(user2).increaseLock(lock_amount2.mul(2))

            const blockNumber5 = tx5.blockNumber || 0

            await mineBlocks(3)

            expect((await hPAL.getPastTotalLock(blockNumber1 - 1)).fromBlock).to.be.eq(deploy_block)
            expect((await hPAL.getPastTotalLock(blockNumber1 - 1)).total).to.be.eq(0)
            expect((await hPAL.getPastTotalLock(blockNumber1)).fromBlock).to.be.eq(blockNumber1)
            expect((await hPAL.getPastTotalLock(blockNumber1)).total).to.be.eq(lock_amount1)
            expect((await hPAL.getPastTotalLock(blockNumber1 + 1)).fromBlock).to.be.eq(blockNumber1)
            expect((await hPAL.getPastTotalLock(blockNumber1 + 1)).total).to.be.eq(lock_amount1)

            expect((await hPAL.getPastTotalLock(blockNumber2 - 1)).fromBlock).to.be.eq(blockNumber1)
            expect((await hPAL.getPastTotalLock(blockNumber2 - 1)).total).to.be.eq(lock_amount1)
            expect((await hPAL.getPastTotalLock(blockNumber2)).fromBlock).to.be.eq(blockNumber2)
            expect((await hPAL.getPastTotalLock(blockNumber2)).total).to.be.eq(lock_amount1.add(lock_amount2))
            expect((await hPAL.getPastTotalLock(blockNumber2 + 1)).fromBlock).to.be.eq(blockNumber2)
            expect((await hPAL.getPastTotalLock(blockNumber2 + 1)).total).to.be.eq(lock_amount1.add(lock_amount2))

            expect((await hPAL.getPastTotalLock(blockNumber3 - 1)).fromBlock).to.be.eq(blockNumber2)
            expect((await hPAL.getPastTotalLock(blockNumber3 - 1)).total).to.be.eq(lock_amount1.add(lock_amount2))
            expect((await hPAL.getPastTotalLock(blockNumber3)).fromBlock).to.be.eq(blockNumber2)
            expect((await hPAL.getPastTotalLock(blockNumber3)).total).to.be.eq(lock_amount1.add(lock_amount2))
            expect((await hPAL.getPastTotalLock(blockNumber3 + 1)).fromBlock).to.be.eq(blockNumber2)
            expect((await hPAL.getPastTotalLock(blockNumber3 + 1)).total).to.be.eq(lock_amount1.add(lock_amount2))

            expect((await hPAL.getPastTotalLock(blockNumber4 - 1)).fromBlock).to.be.eq(blockNumber2)
            expect((await hPAL.getPastTotalLock(blockNumber4 - 1)).total).to.be.eq(lock_amount1.add(lock_amount2))
            expect((await hPAL.getPastTotalLock(blockNumber4)).fromBlock).to.be.eq(blockNumber4)
            expect((await hPAL.getPastTotalLock(blockNumber4)).total).to.be.eq(lock_amount2)
            expect((await hPAL.getPastTotalLock(blockNumber4 + 1)).fromBlock).to.be.eq(blockNumber4)
            expect((await hPAL.getPastTotalLock(blockNumber4 + 1)).total).to.be.eq(lock_amount2)

            expect((await hPAL.getPastTotalLock(blockNumber5 - 1)).fromBlock).to.be.eq(blockNumber4)
            expect((await hPAL.getPastTotalLock(blockNumber5 - 1)).total).to.be.eq(lock_amount2)
            expect((await hPAL.getPastTotalLock(blockNumber5)).fromBlock).to.be.eq(blockNumber5)
            expect((await hPAL.getPastTotalLock(blockNumber5)).total).to.be.eq(lock_amount2.mul(2))
            expect((await hPAL.getPastTotalLock(blockNumber5 + 1)).fromBlock).to.be.eq(blockNumber5)
            expect((await hPAL.getPastTotalLock(blockNumber5 + 1)).total).to.be.eq(lock_amount2.mul(2))

        });

        it(' should return the last TotalLocked', async () => {
            const lock_tx = await hPAL.connect(user1).lock(lock_amount1, lock_duration)

            const blockNumber = lock_tx.blockNumber || 0

            await mineBlocks(10)

            const currentBlock = await ethers.provider.getBlockNumber()

            const total_lock = await hPAL.getPastTotalLock(currentBlock - 1)

            expect(total_lock.fromBlock).to.be.eq(blockNumber)
        });

        it(' should fail if blockNumber did not happened yet', async () => {

            const currentBlock = await ethers.provider.getBlockNumber()

            await expect(
                hPAL.getPastTotalLock(currentBlock + 1000)
            ).to.be.revertedWith('hPAL: invalid blockNumber')

        });

    });

    describe('stakeAndLock', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount = ethers.utils.parseEther('700')

        const lock_duration = 31557600

        const smaller_lock_amount = ethers.utils.parseEther('500')

        const smaller_lock_duration = 15780000

        const bigger_lock_amount = ethers.utils.parseEther('850')

        const bigger_lock_duration = 47340000

        const estimateBonusRatio = async (duration: number) => {
            const MAX_LOCK_DURATION = 63115200
            const MIN_LOCK_DURATION = 7889400
            let durationRatio = UNIT.mul(duration - MIN_LOCK_DURATION).div(MAX_LOCK_DURATION - MIN_LOCK_DURATION)
            let mult = minLockBonusRatio.add((maxLockBonusRatio.sub(minLockBonusRatio)).mul(durationRatio).div(UNIT))
            return mult
        }

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

        });

        it(' should stake amount & create a new lock', async () => {

            const old_available_balance = await hPAL.availableBalanceOf(user1.address)
            const old_balance = await hPAL.balanceOf(user1.address)

            const old_PAL_balance = await token.balanceOf(user1.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(old_available_balance).to.be.eq(old_balance)

            const old_lock_count = await hPAL.getUserLockCount(user1.address)

            expect(old_lock_count).to.be.eq(0)

            const lock_tx = await hPAL.connect(user1).stakeAndLock(lock_amount, lock_duration)

            await expect(lock_tx)
                .to.emit(hPAL, 'Stake')
                .withArgs(user1.address, lock_amount);

            const new_PAL_balance = await token.balanceOf(user1.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(old_PAL_balance.sub(new_PAL_balance)).to.be.eq(lock_amount)
            expect(new_hPAL_balance.sub(old_hPAL_balance)).to.be.eq(lock_amount)

            const current_totalLocked = await hPAL.currentTotalLocked()

            const tx_block = (await lock_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            await expect(lock_tx)
                .to.emit(hPAL, 'Lock')
                .withArgs(user1.address, lock_amount, tx_timestamp, lock_duration, current_totalLocked);

            const new_lock_count = await hPAL.getUserLockCount(user1.address)

            expect(new_lock_count).to.be.eq(old_lock_count.add(1))

            const user_lock = await hPAL.getUserLock(user1.address)

            expect(user_lock.amount).to.be.eq(lock_amount)
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(lock_duration)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

            const new_available_balance = await hPAL.availableBalanceOf(user1.address)
            const new_balance = await hPAL.balanceOf(user1.address)

            expect(new_available_balance.add(lock_amount)).to.be.eq(new_balance)

            expect(new_balance).to.be.eq(old_balance.add(lock_amount))

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            expect(user_allBalances.staked).to.be.eq(new_balance)
            expect(user_allBalances.locked).to.be.eq(lock_amount)
            expect(user_allBalances.available).to.be.eq(new_balance.sub(lock_amount))

        });

        it(' should update the TotalLock correctly', async () => {

            const old_totalLocked = await hPAL.currentTotalLocked()

            const old_totalLocked_count = await hPAL.getTotalLockLength()

            await hPAL.connect(user1).stakeAndLock(lock_amount, lock_duration)

            const new_totalLocked = await hPAL.currentTotalLocked()

            const new_totalLocked_count = await hPAL.getTotalLockLength()

            expect(new_totalLocked).to.be.eq(old_totalLocked.add(lock_amount))

            expect(new_totalLocked_count).to.be.eq(old_totalLocked_count.add(1))

        });

        it(' should set the correct BonusRatio & Decrease value', async () => {
            await hPAL.connect(user1).stakeAndLock(lock_amount, lock_duration)

            const estimated_mult1 = await estimateBonusRatio(lock_duration)
            const estimated_decrease1 = estimated_mult1.sub(baseLockBonusRatio).div(lock_duration)

            expect(await hPAL.userCurrentBonusRatio(user1.address)).to.be.eq(estimated_mult1)
            expect(await hPAL.userBonusRatioDecrease(user1.address)).to.be.eq(estimated_decrease1)

            await token.connect(recipient).transfer(user2.address, stake_amount)

            await token.connect(user2).approve(hPAL.address, stake_amount)

            await hPAL.connect(user2).stakeAndLock(smaller_lock_amount, smaller_lock_duration)

            const estimated_mult2 = await estimateBonusRatio(smaller_lock_duration)
            const estimated_decrease2 = estimated_mult2.sub(baseLockBonusRatio).div(smaller_lock_duration)

            expect(await hPAL.userCurrentBonusRatio(user2.address)).to.be.eq(estimated_mult2)
            expect(await hPAL.userBonusRatioDecrease(user2.address)).to.be.eq(estimated_decrease2)
        });

        it(' should fail if given incorrect durations', async () => {

            const lower_duration = (await hPAL.MIN_LOCK_DURATION()).sub(1)
            const bigger_duration = (await hPAL.MAX_LOCK_DURATION()).add(1)

            await expect(
                hPAL.connect(user1).stakeAndLock(lock_amount, lower_duration)
            ).to.be.revertedWith('hPAL: Lock duration under min')

            await expect(
                hPAL.connect(user1).stakeAndLock(lock_amount, bigger_duration)
            ).to.be.revertedWith('hPAL: Lock duration over max')

        });

        it(' should fail if given null amount', async () => {

            await expect(
                hPAL.connect(user1).stakeAndLock(0, lock_duration)
            ).to.be.revertedWith('hPAL: Null amount')

        });

        it(' should count bonus voting power correctly', async () => {

            const bonus_ratio = await hPAL.bonusLockVoteRatio()

            await hPAL.connect(user1).stakeAndLock(lock_amount, lock_duration)

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            const expected_votes = user_allBalances.staked.add(user_allBalances.locked.mul(bonus_ratio).div(UNIT))

            const new_votes = await hPAL.getCurrentVotes(user1.address)

            expect(new_votes).to.be.eq(expected_votes)

        });

        it(' should not get bonus voting power if lock duration is less than a year', async () => {

            await hPAL.connect(user1).stakeAndLock(lock_amount, smaller_lock_duration)

            const user_allBalances = await hPAL.allBalancesOf(user1.address)

            const expected_votes = user_allBalances.staked

            const new_votes = await hPAL.getCurrentVotes(user1.address)

            expect(new_votes).to.be.eq(expected_votes)

        });

        it(' should count bonus voting power correctly (with received delegation)', async () => {

            await token.connect(recipient).transfer(user2.address, stake_amount)

            await token.connect(user2).approve(hPAL.address, stake_amount)

            await hPAL.connect(user2).stake(stake_amount)

            await hPAL.connect(user2).delegate(user1.address)
            await hPAL.connect(user1).delegate(user1.address)

            const bonus_ratio = await hPAL.bonusLockVoteRatio()

            const past_votes = await hPAL.getCurrentVotes(user1.address)

            await hPAL.connect(user1).stakeAndLock(lock_amount, lock_duration)

            const expected_votes = past_votes.add(lock_amount.add(lock_amount.mul(bonus_ratio).div(UNIT)))

            const new_votes = await hPAL.getCurrentVotes(user1.address)

            expect(new_votes).to.be.eq(expected_votes)

        });

        it(' should automatically self-delegate votes', async () => {

            const old_delegate = await hPAL.delegates(user1.address)

            expect(old_delegate).to.be.eq(ethers.constants.AddressZero)

            await hPAL.connect(user1).stakeAndLock(lock_amount, lock_duration)

            const new_delegate = await hPAL.delegates(user1.address)

            expect(new_delegate).to.be.eq(user1.address)

        });

    });

    describe('stakeAndIncreaseLock', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const lock_amount = ethers.utils.parseEther('700')

        const lock_duration = 31557600

        const extra_lock_amount = ethers.utils.parseEther('250')

        const bigger_lock_amount = ethers.utils.parseEther('450')

        const smaller_lock_duration = 15780000

        const bigger_lock_duration = 47340000

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(lock_amount)

            await hPAL.connect(user1).lock(lock_amount, lock_duration)

        });

        it(' should stake the amount & update the lock correctly', async () => {

            const old_user_lock = await hPAL.getUserLock(user1.address)

            const old_PAL_balance = await token.balanceOf(user1.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            const old_current_totalLocked = await hPAL.currentTotalLocked()

            const old_totalLocked_count = await hPAL.getTotalLockLength()

            const increase_tx = await hPAL.connect(user1).stakeAndIncreaseLock(extra_lock_amount, lock_duration)

            await expect(increase_tx)
                .to.emit(hPAL, 'Stake')
                .withArgs(user1.address, extra_lock_amount);

            const new_PAL_balance = await token.balanceOf(user1.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(old_PAL_balance.sub(new_PAL_balance)).to.be.eq(extra_lock_amount)
            expect(new_hPAL_balance.sub(old_hPAL_balance)).to.be.eq(extra_lock_amount)

            const current_totalLocked = await hPAL.currentTotalLocked()

            await expect(increase_tx)
                .to.emit(hPAL, 'Lock')
                .withArgs(user1.address, old_user_lock.amount.add(extra_lock_amount), old_user_lock.startTimestamp, lock_duration, current_totalLocked);

            const user_lock = await hPAL.getUserLock(user1.address)

            const tx_block = (await increase_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            expect(user_lock.amount).to.be.eq(old_user_lock.amount.add(extra_lock_amount))
            expect(user_lock.startTimestamp).to.be.eq(old_user_lock.startTimestamp)
            expect(user_lock.duration).to.be.eq(lock_duration)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

            expect(user_lock.duration).to.be.eq(old_user_lock.duration)

            expect(current_totalLocked).to.be.eq(old_current_totalLocked.add(extra_lock_amount))

            const new_totalLocked_count = await hPAL.getTotalLockLength()

            expect(new_totalLocked_count).to.be.eq(old_totalLocked_count.add(1))

        });

        it(' should stake the amount & increase the lock duration', async () => {

            const old_user_lock = await hPAL.getUserLock(user1.address)

            const old_current_totalLocked = await hPAL.currentTotalLocked()

            const increase_tx = await hPAL.connect(user1).stakeAndIncreaseLock(extra_lock_amount, bigger_lock_duration)

            const current_totalLocked = await hPAL.currentTotalLocked()

            const tx_block = (await increase_tx).blockNumber
            const tx_timestamp = (await ethers.provider.getBlock(tx_block || 0)).timestamp

            await expect(increase_tx)
                .to.emit(hPAL, 'Lock')
                .withArgs(user1.address, old_user_lock.amount.add(extra_lock_amount), tx_timestamp, bigger_lock_duration, current_totalLocked);

            const user_lock = await hPAL.getUserLock(user1.address)

            expect(user_lock.amount).to.be.eq(old_user_lock.amount.add(extra_lock_amount))
            expect(user_lock.startTimestamp).to.be.eq(tx_timestamp)
            expect(user_lock.duration).to.be.eq(bigger_lock_duration)
            expect(user_lock.fromBlock).to.be.eq(tx_block)

            expect(current_totalLocked).to.be.eq(old_current_totalLocked.add(extra_lock_amount))

        });

        it(' should fail if no lock exists for the user', async () => {

            await expect(
                hPAL.connect(user2).stakeAndIncreaseLock(extra_lock_amount, lock_duration)
            ).to.be.revertedWith('hPAL: No Lock')

        });

        it(' should fail if given a smaller duration than current lock', async () => {

            await expect(
                hPAL.connect(user1).stakeAndIncreaseLock(extra_lock_amount, smaller_lock_duration)
            ).to.be.revertedWith('hPAL: smaller duration')

        });

        it(' should fail if trying to stake & re-lock more than current balance', async () => {

            await expect(
                hPAL.connect(user1).stakeAndIncreaseLock(bigger_lock_amount, lock_duration)
            ).to.be.revertedWith('ERC20: transfer amount exceeds balance')

        });

    });

});