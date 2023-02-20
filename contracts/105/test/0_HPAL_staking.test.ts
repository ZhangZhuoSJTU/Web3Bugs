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

const startDropPerSecond = ethers.utils.parseEther('0.0005')
const endDropPerSecond = ethers.utils.parseEther('0.00001')

const dropDecreaseDuration = 63115200

const baseLockBonusRatio = ethers.utils.parseEther('1')
const minLockBonusRatio = ethers.utils.parseEther('2')
const maxLockBonusRatio = ethers.utils.parseEther('6')

describe('PaladinToken contract tests - Base & Staking', () => {
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


    describe('stake', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

        });

        it(' should mint hPAL 1:1 (& emit the correct Event)', async () => {

            const old_PAL_balance = await token.balanceOf(user1.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            const old_totalSupply = await hPAL.totalSupply()

            await token.connect(user1).approve(hPAL.address, stake_amount)

            const stake_tx = await hPAL.connect(user1).stake(stake_amount)

            await expect(stake_tx)
                .to.emit(hPAL, 'Stake')
                .withArgs(user1.address, stake_amount);

            const new_PAL_balance = await token.balanceOf(user1.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            const new_totalSupply = await hPAL.totalSupply()

            expect(old_PAL_balance.sub(new_PAL_balance)).to.be.eq(stake_amount)
            expect(new_hPAL_balance.sub(old_hPAL_balance)).to.be.eq(stake_amount)
            expect(new_totalSupply.sub(old_totalSupply)).to.be.eq(stake_amount)

        });

        it(' should stake again still 1:1', async () => {

            const extra_amount = ethers.utils.parseEther('250')

            await token.connect(recipient).transfer(user1.address, extra_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

            const old_PAL_balance = await token.balanceOf(user1.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            await token.connect(user1).approve(hPAL.address, extra_amount)

            const stake_tx = await hPAL.connect(user1).stake(extra_amount)

            await expect(stake_tx)
                .to.emit(hPAL, 'Stake')
                .withArgs(user1.address, extra_amount);

            const new_PAL_balance = await token.balanceOf(user1.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(old_PAL_balance.sub(new_PAL_balance)).to.be.eq(extra_amount)
            expect(new_hPAL_balance.sub(old_hPAL_balance)).to.be.eq(extra_amount)

        });

        it(' should fail if given a null amount', async () => {

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await expect(
                hPAL.connect(user1).stake(0)
            ).to.be.revertedWith('hPAL: Null amount')

        });

        it(' should fail if not the balance to stake', async () => {

            await token.connect(user2).approve(hPAL.address, stake_amount)

            await expect(
                hPAL.connect(user2).stake(stake_amount)
            ).to.be.revertedWith('ERC20: transfer amount exceeds balance')

        });

        it(' should fail if no allowance', async () => {

            await expect(
                hPAL.connect(user1).stake(stake_amount)
            ).to.be.revertedWith('ERC20: transfer amount exceeds allowance')

        });

        it(' should update delegation checkpoints - self-delegation', async () => {

            await hPAL.connect(user1).delegate(user1.address)

            const old_votes = await hPAL.getCurrentVotes(user1.address)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            const stake_tx = hPAL.connect(user1).stake(stake_amount)

            await expect(stake_tx)
                .to.emit(hPAL, 'DelegateVotesChanged')
                .withArgs(user1.address, old_votes, old_votes.add(stake_amount));

            const new_votes = await hPAL.getCurrentVotes(user1.address)

            expect(new_votes.sub(old_votes)).to.be.eq(stake_amount)

            //check block update in the checkpoint
            const tx_block = (await stake_tx).blockNumber

            const chekcpoint = await hPAL.checkpoints(user1.address, (await hPAL.numCheckpoints(user1.address)).sub(1))

            expect(chekcpoint.fromBlock).to.be.eq(tx_block)
            expect(chekcpoint.votes).to.be.eq(new_votes)

        });

        it(' should update delegation checkpoints - delegation to other account', async () => {

            await hPAL.connect(user1).delegate(user2.address)

            const old_votes = await hPAL.getCurrentVotes(user2.address)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            const stake_tx = hPAL.connect(user1).stake(stake_amount)

            await expect(stake_tx)
                .to.emit(hPAL, 'DelegateVotesChanged')
                .withArgs(user2.address, old_votes, old_votes.add(stake_amount));

            const new_votes = await hPAL.getCurrentVotes(user2.address)

            expect(new_votes.sub(old_votes)).to.be.eq(stake_amount)

            //check block update in the checkpoint
            const tx_block = (await stake_tx).blockNumber

            const chekcpoint = await hPAL.checkpoints(user2.address, (await hPAL.numCheckpoints(user2.address)).sub(1))

            expect(chekcpoint.fromBlock).to.be.eq(tx_block)
            expect(chekcpoint.votes).to.be.eq(new_votes)

        });

    });


    describe('approve', async () => {

        const allowance = ethers.utils.parseEther('150')
        const change_allowance = ethers.utils.parseEther('50')
        const over_allowance = ethers.utils.parseEther('200')

        const stake_amount = ethers.utils.parseEther('1000')

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)
            await token.connect(recipient).transfer(user2.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

            await token.connect(user2).approve(hPAL.address, stake_amount)

            await hPAL.connect(user2).stake(stake_amount)

        });

        it(' should update allowance correctly', async () => {

            await hPAL.connect(user1).approve(user2.address, allowance)

            let newAllowance = await hPAL.connect(user1).allowance(user1.address, user2.address)

            expect(newAllowance).to.be.eq(allowance)

        });

        it(' should increase allowance correctly', async () => {

            await hPAL.connect(user1).approve(user2.address, allowance)

            let oldAllowance = await hPAL.connect(user1).allowance(user1.address, user2.address)

            await hPAL.connect(user1).increaseAllowance(user2.address, change_allowance)

            let newAllowance = await hPAL.connect(user1).allowance(user1.address, user2.address)

            expect(newAllowance.sub(oldAllowance)).to.be.eq(change_allowance)

        });

        it(' should decrease allowance correctly', async () => {

            await hPAL.connect(user1).approve(user2.address, allowance)

            let oldAllowance = await hPAL.connect(user1).allowance(user1.address, user2.address)

            await hPAL.connect(user1).decreaseAllowance(user2.address, change_allowance)

            let newAllowance = await hPAL.connect(user1).allowance(user1.address, user2.address)

            expect(oldAllowance.sub(newAllowance)).to.be.eq(change_allowance)

        });

        it(' should emit the correct Event', async () => {

            await expect(hPAL.connect(user1).approve(user2.address, allowance))
                .to.emit(hPAL, 'Approval')
                .withArgs(user1.address, user2.address, allowance);

        });

        it(' should block address Zero approvals', async () => {

            await expect(
                hPAL.connect(user1).approve(ethers.constants.AddressZero, allowance)
            ).to.be.revertedWith('ERC20: approve to the zero address')

        });

        it(' should fail to decrease allowance under 0', async () => {

            await token.connect(user1).approve(user2.address, allowance)

            await expect(
                token.connect(user1).decreaseAllowance(user2.address, over_allowance)
            ).to.be.revertedWith('ERC20: decreased allowance below zero')

        });

    });


    describe('transfer', async () => {

        const stake_amount = ethers.utils.parseEther('1000')

        const amount = ethers.utils.parseEther('100')

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)
        });

        it(' should transfer the amount', async () => {

            let oldBalance = await hPAL.connect(user2).balanceOf(user2.address)

            await hPAL.connect(user1).transfer(user2.address, amount)

            let newBalance = await hPAL.connect(user2).balanceOf(user2.address)

            expect(amount).to.be.eq(newBalance.sub(oldBalance))

        });

        it(' should emit the correct Event', async () => {

            await expect(hPAL.connect(user1).transfer(user2.address, amount))
                .to.emit(hPAL, 'Transfer')
                .withArgs(user1.address, user2.address, amount);

        });

        it(' should not allow transfer if balance too low', async () => {

            await expect(
                hPAL.connect(user2).transfer(user1.address, amount)
            ).to.be.revertedWith('hPAL: Available balance too low')

        });

        it(' should block transfer to address Zero', async () => {

            await expect(
                hPAL.connect(user1).transfer(ethers.constants.AddressZero, amount)
            ).to.be.revertedWith('ERC20: transfer to the zero address')

        });

        it(' should update delegation if set', async () => {

            await hPAL.connect(user1).delegate(user2.address)

            let oldVotingPower = await hPAL.getCurrentVotes(user2.address)

            await hPAL.connect(user1).transfer(recipient.address, amount)

            let newVotingPower = await hPAL.getCurrentVotes(user2.address)

            expect(amount).to.be.eq(oldVotingPower.sub(newVotingPower))

        });

    });


    describe('transferFrom', async () => {

        const stake_amount = ethers.utils.parseEther('1000')

        const amount = ethers.utils.parseEther('100')
        const allowance = ethers.utils.parseEther('150')

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount);

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)
        });

        it(' should transfer the amount', async () => {

            let oldBalance = await hPAL.connect(user2).balanceOf(user2.address)

            await hPAL.connect(user1).approve(user2.address, allowance)

            await hPAL.connect(user2).transferFrom(user1.address, user2.address, amount)

            let newBalance = await hPAL.connect(user2).balanceOf(user2.address)

            expect(amount).to.be.eq(newBalance.sub(oldBalance))

        });

        it(' should emit the correct Event', async () => {

            await hPAL.connect(user1).approve(user2.address, allowance)

            await expect(hPAL.connect(user2).transferFrom(user1.address, user2.address, amount))
                .to.emit(hPAL, 'Transfer')
                .withArgs(user1.address, user2.address, amount);

        });

        it(' should update the allowance correctly', async () => {

            await hPAL.connect(user1).approve(user2.address, allowance)

            await hPAL.connect(user2).transferFrom(user1.address, user2.address, amount)

            let newAllowance = await hPAL.connect(user1).allowance(user1.address, user2.address)

            expect(allowance.sub(amount)).to.be.eq(newAllowance)

        });

        it(' should not allow transfer if balance too low', async () => {

            await hPAL.connect(user2).approve(user1.address, allowance)

            await expect(
                hPAL.connect(user1).transferFrom(user2.address, user1.address, amount)
            ).to.be.revertedWith('hPAL: Available balance too low')

        });

        it(' should not allow transfer if allowance too low', async () => {

            await hPAL.connect(user1).approve(user2.address, ethers.utils.parseEther('10'))

            await expect(
                hPAL.connect(user2).transferFrom(user1.address, user2.address, amount)
            ).to.be.revertedWith('ERC20: transfer amount exceeds allowance')

        });

        it(' should not allow transfer if no allowance', async () => {

            await expect(
                hPAL.connect(user2).transferFrom(user1.address, user2.address, amount)
            ).to.be.revertedWith('ERC20: transfer amount exceeds allowance')

        });

        it(' should block transfer to/from address Zero', async () => {

            await hPAL.connect(user1).approve(user1.address, allowance)

            await expect(
                hPAL.connect(user1).transferFrom(user1.address, ethers.constants.AddressZero, amount)
            ).to.be.revertedWith('ERC20: transfer to the zero address')

            await expect(
                hPAL.connect(user1).transferFrom(ethers.constants.AddressZero, user2.address, amount)
            ).to.be.revertedWith('ERC20: transfer from the zero address')

        });


    });


    describe('delegate', async () => {

        const stake_amount = ethers.utils.parseEther('1000')

        const transfer_amount = ethers.utils.parseEther('100')

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount);

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)
        });

        it(' should delegate to self', async () => {
            const userBalance = await hPAL.balanceOf(user1.address);

            const oldDelegate = await hPAL.delegates(user1.address);
            const oldCheckpointNb = await hPAL.numCheckpoints(user1.address);
            const oldVotingPower = await hPAL.getCurrentVotes(user1.address);

            expect(oldDelegate).to.be.eq(ethers.constants.AddressZero)
            expect(oldCheckpointNb).to.be.eq(0)
            expect(oldVotingPower).to.be.eq(0)

            await hPAL.connect(user1).delegate(user1.address)

            const newDelegate = await hPAL.delegates(user1.address);
            const newCheckpointNb = await hPAL.numCheckpoints(user1.address);
            const newVotingPower = await hPAL.getCurrentVotes(user1.address);

            expect(newDelegate).to.be.eq(user1.address)
            expect(newCheckpointNb).to.be.eq(1)
            expect(newVotingPower).to.be.eq(userBalance)

        });

        it(' should delegate to other address', async () => {

            const user1Balance = await hPAL.balanceOf(user1.address);

            const oldDelegate = await hPAL.delegates(user1.address);
            const oldCheckpointNb = await hPAL.numCheckpoints(user2.address);
            const oldVotingPower = await hPAL.getCurrentVotes(user2.address);

            expect(oldDelegate).to.be.eq(ethers.constants.AddressZero)
            expect(oldCheckpointNb).to.be.eq(0)
            expect(oldVotingPower).to.be.eq(0)

            await hPAL.connect(user1).delegate(user2.address)

            const newDelegate = await hPAL.delegates(user1.address);
            const newCheckpointNb = await hPAL.numCheckpoints(user2.address);
            const newVotingPower = await hPAL.getCurrentVotes(user2.address);

            expect(newDelegate).to.be.eq(user2.address)
            expect(newCheckpointNb).to.be.eq(1)
            expect(newVotingPower).to.be.eq(user1Balance)

        });

        it(' should update delegation on transfer (self-delegation)', async () => {

            await hPAL.connect(user1).delegate(user1.address)

            const oldVotingPower = await hPAL.getCurrentVotes(user1.address);

            await hPAL.connect(user1).transfer(user2.address, transfer_amount)

            const newVotingPower = await hPAL.getCurrentVotes(user1.address);

            expect(oldVotingPower.sub(newVotingPower)).to.be.eq(transfer_amount)

        });

        it(' should update delegation on transfer', async () => {

            await hPAL.connect(user1).delegate(user2.address)

            const oldVotingPower = await hPAL.getCurrentVotes(user2.address);
            const oldCheckpointNb = await hPAL.numCheckpoints(user2.address);

            await hPAL.connect(user1).transfer(recipient.address, transfer_amount)

            const newVotingPower = await hPAL.getCurrentVotes(user2.address);
            const newCheckpointNb = await hPAL.numCheckpoints(user2.address);

            expect(oldVotingPower.sub(newVotingPower)).to.be.eq(transfer_amount);
            expect(newCheckpointNb).to.be.gt(oldCheckpointNb);

        });

        it(' should update delegation on transferFrom (self-delegation)', async () => {

            await hPAL.connect(user1).delegate(user1.address)

            const oldVotingPower = await hPAL.getCurrentVotes(user1.address);

            await hPAL.connect(user1).approve(recipient.address, transfer_amount)
            await hPAL.connect(recipient).transferFrom(user1.address, recipient.address, transfer_amount)

            const newVotingPower = await hPAL.getCurrentVotes(user1.address);

            expect(oldVotingPower.sub(newVotingPower)).to.be.eq(transfer_amount)

        });

        it(' should update delegation on transferFrom ', async () => {

            await hPAL.connect(user1).delegate(user2.address)

            const oldVotingPower = await hPAL.getCurrentVotes(user2.address);
            const oldCheckpointNb = await hPAL.numCheckpoints(user2.address);

            await hPAL.connect(user1).approve(recipient.address, transfer_amount)
            await hPAL.connect(recipient).transferFrom(user1.address, recipient.address, transfer_amount)

            const newVotingPower = await hPAL.getCurrentVotes(user2.address);
            const newCheckpointNb = await hPAL.numCheckpoints(user2.address);

            expect(oldVotingPower.sub(newVotingPower)).to.be.eq(transfer_amount);
            expect(newCheckpointNb).to.be.gt(oldCheckpointNb);

        });

        it(' should not update delegation on receiving transfer', async () => {

            await hPAL.connect(user2).delegate(user2.address)

            const oldVotingPower = await hPAL.getCurrentVotes(user2.address);

            expect(oldVotingPower).to.be.eq(0)

            await hPAL.connect(user1).transfer(user2.address, transfer_amount)

            const newVotingPower = await hPAL.getCurrentVotes(user2.address);

            expect(newVotingPower).to.be.eq(transfer_amount)
            expect(newVotingPower).to.be.eq(await hPAL.getCurrentVotes(user2.address))

        });

        it(' should not update delegation on transfer if delegation not set', async () => {

            const oldVotingPower = await hPAL.getCurrentVotes(user2.address);

            expect(oldVotingPower).to.be.eq(0)

            await hPAL.connect(user1).transfer(user2.address, transfer_amount)

            const newVotingPower = await hPAL.getCurrentVotes(user2.address);

            expect(newVotingPower).to.be.eq(0)

        });

        it(' should cancel delegation', async () => {

            await hPAL.connect(user1).delegate(user2.address)

            expect(await hPAL.delegates(user1.address)).to.be.eq(user2.address)

            await hPAL.connect(user1).delegate(ethers.constants.AddressZero)

            expect(await hPAL.delegates(user1.address)).to.be.eq(ethers.constants.AddressZero)

        });

    });


    describe('getPastVotes', async () => {

        const stake_amount = ethers.utils.parseEther('1000')

        const transfer_amount = ethers.utils.parseEther('100')

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount);
            await token.connect(recipient).transfer(user2.address, stake_amount);

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

            await token.connect(user2).approve(hPAL.address, stake_amount)

            await hPAL.connect(user2).stake(stake_amount)
        });

        it(' should return 0 if no checkpoints', async () => {

            const currentBlock = await ethers.provider.getBlockNumber()

            const votes = await hPAL.getPastVotes(user2.address, currentBlock - 1)

            expect(votes).to.be.eq(0)

        });

        it(' should return the correct amount of votes', async () => {

            const user1Balance = await hPAL.balanceOf(user1.address)

            const delegate_call = await hPAL.connect(user1).delegate(user2.address)

            const blockNumber1 = delegate_call.blockNumber || 0

            await mineBlocks(10)

            const delegate_call2 = await hPAL.connect(user1).delegate(user1.address)

            const blockNumber2 = delegate_call2.blockNumber || 0

            await mineBlocks(10)

            const delegate_call3 = await hPAL.connect(user1).delegate(user2.address)

            const blockNumber3 = delegate_call3.blockNumber || 0

            await mineBlocks(3)

            expect(await await hPAL.getPastVotes(user2.address, blockNumber1 - 1)).to.be.eq(0)
            expect(await await hPAL.getPastVotes(user2.address, blockNumber1)).to.be.eq(user1Balance)
            expect(await await hPAL.getPastVotes(user2.address, blockNumber1 + 1)).to.be.eq(user1Balance)

            expect(await await hPAL.getPastVotes(user2.address, blockNumber2 - 1)).to.be.eq(user1Balance)
            expect(await await hPAL.getPastVotes(user2.address, blockNumber2)).to.be.eq(0)
            expect(await await hPAL.getPastVotes(user2.address, blockNumber2 + 1)).to.be.eq(0)

            expect(await await hPAL.getPastVotes(user2.address, blockNumber3 - 1)).to.be.eq(0)
            expect(await await hPAL.getPastVotes(user2.address, blockNumber3)).to.be.eq(user1Balance)
            expect(await await hPAL.getPastVotes(user2.address, blockNumber3 + 1)).to.be.eq(user1Balance)

        });

        it(' should return the 1st checkpoint', async () => {

            const delegate_call = await hPAL.connect(user1).delegate(user2.address)

            const blockNumber = delegate_call.blockNumber || 0

            const nexBlock = blockNumber + 1

            await mineBlocks(10)

            await hPAL.connect(user1).delegate(user1.address)

            const oldVotes = await hPAL.getPastVotes(user2.address, nexBlock)

            const oldCheckpoint = await hPAL.checkpoints(user2.address, 0)

            expect(oldCheckpoint.votes).to.be.eq(oldVotes)

        });

        it(' should return the last checkpoint', async () => {
            await hPAL.connect(user1).delegate(user2.address)

            const currentBlock = await ethers.provider.getBlockNumber()

            const votes = await hPAL.getPastVotes(user2.address, currentBlock - 100)

            expect(votes).to.be.eq(0)
        });

        it(' should fail if blockNumber did not happened yet', async () => {

            const currentBlock = await ethers.provider.getBlockNumber()

            await expect(
                hPAL.getPastVotes(user2.address, currentBlock + 1000)
            ).to.be.revertedWith('hPAL: invalid blockNumber')

        });

    });

    
    describe('getPastDelegate', async () => {

        const stake_amount = ethers.utils.parseEther('1000')

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount);
            await token.connect(recipient).transfer(user2.address, stake_amount);

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

            await token.connect(user2).approve(hPAL.address, stake_amount)

            await hPAL.connect(user2).stake(stake_amount)
        });

        it(' should return address 0x000...000 if no checkpoints', async () => {

            const currentBlock = await ethers.provider.getBlockNumber()

            const votes = await hPAL.getPastDelegate(user1.address, currentBlock - 1)

            expect(votes).to.be.eq(ethers.constants.AddressZero)

        });

        it(' should return the correct deelgate address', async () => {

            const delegate_call = await hPAL.connect(user1).delegate(user2.address)

            const blockNumber1 = delegate_call.blockNumber || 0

            await mineBlocks(10)

            const delegate_call2 = await hPAL.connect(user1).delegate(user1.address)

            const blockNumber2 = delegate_call2.blockNumber || 0

            await mineBlocks(10)

            const delegate_call3 = await hPAL.connect(user1).delegate(ethers.constants.AddressZero)

            const blockNumber3 = delegate_call3.blockNumber || 0

            await mineBlocks(3)

            expect(await await hPAL.getPastDelegate(user1.address, blockNumber1 - 1)).to.be.eq(ethers.constants.AddressZero)
            expect(await await hPAL.getPastDelegate(user1.address, blockNumber1)).to.be.eq(user2.address)
            expect(await await hPAL.getPastDelegate(user1.address, blockNumber1 + 1)).to.be.eq(user2.address)

            expect(await await hPAL.getPastDelegate(user1.address, blockNumber2 - 1)).to.be.eq(user2.address)
            expect(await await hPAL.getPastDelegate(user1.address, blockNumber2)).to.be.eq(user1.address)
            expect(await await hPAL.getPastDelegate(user1.address, blockNumber2 + 1)).to.be.eq(user1.address)

            expect(await await hPAL.getPastDelegate(user1.address, blockNumber3 - 1)).to.be.eq(user1.address)
            expect(await await hPAL.getPastDelegate(user1.address, blockNumber3)).to.be.eq(ethers.constants.AddressZero)
            expect(await await hPAL.getPastDelegate(user1.address, blockNumber3 + 1)).to.be.eq(ethers.constants.AddressZero)

        });

        it(' should return the 1st checkpoint', async () => {

            const delegate_call = await hPAL.connect(user1).delegate(user2.address)

            const blockNumber = delegate_call.blockNumber || 0

            const nexBlock = blockNumber + 1

            await mineBlocks(10)

            await hPAL.connect(user1).delegate(user1.address)

            const oldDelegate = await hPAL.getPastDelegate(user1.address, nexBlock)

            const oldCheckpoint = await hPAL.delegateCheckpoints(user1.address, 0)

            expect(oldCheckpoint.delegate).to.be.eq(oldDelegate)

        });

        it(' should return the last checkpoint', async () => {
            await hPAL.connect(user1).delegate(user2.address)

            const currentBlock = await ethers.provider.getBlockNumber()

            const current_delegate = await hPAL.getPastDelegate(user1.address, currentBlock - 100)

            expect(current_delegate).to.be.eq(ethers.constants.AddressZero)
        });

        it(' should fail if blockNumber did not happened yet', async () => {

            const currentBlock = await ethers.provider.getBlockNumber()

            await expect(
                hPAL.getPastDelegate(user1.address, currentBlock + 1000)
            ).to.be.revertedWith('hPAL: invalid blockNumber')

        });

    });

    describe('unstake', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const unstake_amount = ethers.utils.parseEther('400')

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, stake_amount);

            await token.connect(user1).approve(hPAL.address, stake_amount)

            await hPAL.connect(user1).stake(stake_amount)

        });

        it(' should not allow to unstake if no cooldown triggered', async () => {

            await expect(
                hPAL.connect(user1).unstake(unstake_amount, user1.address)
            ).to.be.revertedWith('hPAL: unstake period expired')

        });

        it(' should not allow to unstake during the cooldown', async () => {

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).div(2)
            await advanceTime(time_to_skip.toNumber())

            await expect(
                hPAL.connect(user1).unstake(unstake_amount, user1.address)
            ).to.be.revertedWith('hPAL: Insufficient cooldown')

        });

        it(' should unstake and burn the token 1:1 (& emit the correct Event)', async () => {

            await hPAL.connect(user1).cooldown()

            const time_to_skip = await hPAL.COOLDOWN_PERIOD()
            await advanceTime(time_to_skip.toNumber())

            const old_PAL_balance = await token.balanceOf(user1.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            const old_totalSupply = await hPAL.totalSupply()

            const unstake_tx = await hPAL.connect(user1).unstake(unstake_amount, user1.address)

            await expect(unstake_tx)
                .to.emit(hPAL, 'Unstake')
                .withArgs(user1.address, unstake_amount);

            const new_PAL_balance = await token.balanceOf(user1.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            const new_totalSupply = await hPAL.totalSupply()

            expect(new_PAL_balance.sub(old_PAL_balance)).to.be.eq(unstake_amount)
            expect(old_hPAL_balance.sub(new_hPAL_balance)).to.be.eq(unstake_amount)
            expect(old_totalSupply.sub(new_totalSupply)).to.be.eq(unstake_amount)

        });

        it(' should allow to unstake multiple times during the Unstake Period', async () => {

            await hPAL.connect(user1).cooldown()

            const time_to_skip = await hPAL.COOLDOWN_PERIOD()
            await advanceTime(time_to_skip.toNumber())

            const old_PAL_balance = await token.balanceOf(user1.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            await hPAL.connect(user1).unstake(unstake_amount, user1.address)

            const new_PAL_balance = await token.balanceOf(user1.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(new_PAL_balance.sub(old_PAL_balance)).to.be.eq(unstake_amount)
            expect(old_hPAL_balance.sub(new_hPAL_balance)).to.be.eq(unstake_amount)

            const unstake_tx = await hPAL.connect(user1).unstake(unstake_amount, user1.address)

            await expect(unstake_tx)
                .to.emit(hPAL, 'Unstake')
                .withArgs(user1.address, unstake_amount);

            const new_PAL_balance2 = await token.balanceOf(user1.address)
            const new_hPAL_balance2 = await hPAL.balanceOf(user1.address)

            expect(new_PAL_balance2.sub(new_PAL_balance)).to.be.eq(unstake_amount)
            expect(new_hPAL_balance.sub(new_hPAL_balance2)).to.be.eq(unstake_amount)

        });

        it(' should not allow to unstake after the Unstake Period', async () => {

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).add(await hPAL.UNSTAKE_PERIOD())
            await advanceTime(time_to_skip.toNumber())

            await expect(
                hPAL.connect(user1).unstake(unstake_amount, user1.address)
            ).to.be.revertedWith('hPAL: unstake period expired')

        });

        it(' should allow to withdraw to another address', async () => {

            await hPAL.connect(user1).cooldown()

            const time_to_skip = await hPAL.COOLDOWN_PERIOD()
            await advanceTime(time_to_skip.toNumber())
            
            const old_PAL_balance = await token.balanceOf(user2.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            const unstake_tx = await hPAL.connect(user1).unstake(unstake_amount, user2.address)

            await expect(unstake_tx)
                .to.emit(hPAL, 'Unstake')
                .withArgs(user1.address, unstake_amount);

            const new_PAL_balance = await token.balanceOf(user2.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(new_PAL_balance.sub(old_PAL_balance)).to.be.eq(unstake_amount)
            expect(old_hPAL_balance.sub(new_hPAL_balance)).to.be.eq(unstake_amount)

        });

        it(' should only withdraw the maximum avaialable balance (override given amount)', async () => {

            await hPAL.connect(user1).cooldown()

            const time_to_skip = await hPAL.COOLDOWN_PERIOD()
            await advanceTime(time_to_skip.toNumber())

            const user_balance = await hPAL.balanceOf(user1.address)

            const old_PAL_balance = await token.balanceOf(user1.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            const unstake_tx = await hPAL.connect(user1).unstake(user_balance.add(500), user1.address)

            await expect(unstake_tx)
                .to.emit(hPAL, 'Unstake')
                .withArgs(user1.address, user_balance);

            const new_PAL_balance = await token.balanceOf(user1.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(new_PAL_balance.sub(old_PAL_balance)).to.be.eq(user_balance)
            expect(old_hPAL_balance.sub(new_hPAL_balance)).to.be.eq(user_balance)

            expect(new_hPAL_balance).to.be.eq(0)

        });

        it(' should only withdraw the maximum avaialable balance (override given amount) - bigger amount', async () => {

            await hPAL.connect(user1).cooldown()

            const time_to_skip = await hPAL.COOLDOWN_PERIOD()
            await advanceTime(time_to_skip.toNumber())

            const user_balance = await hPAL.balanceOf(user1.address)

            const old_PAL_balance = await token.balanceOf(user1.address)
            const old_hPAL_balance = await hPAL.balanceOf(user1.address)

            const unstake_tx = await hPAL.connect(user1).unstake(user_balance.mul(2), user1.address)

            await expect(unstake_tx)
                .to.emit(hPAL, 'Unstake')
                .withArgs(user1.address, user_balance);

            const new_PAL_balance = await token.balanceOf(user1.address)
            const new_hPAL_balance = await hPAL.balanceOf(user1.address)

            expect(new_PAL_balance.sub(old_PAL_balance)).to.be.eq(user_balance)
            expect(old_hPAL_balance.sub(new_hPAL_balance)).to.be.eq(user_balance)

            expect(new_hPAL_balance).to.be.eq(0)

        });

        it(' should fail if given incorrect parameters', async () => {

            await expect(
                hPAL.connect(user1).unstake(0, user1.address)
            ).to.be.revertedWith('hPAL: Null amount')

            await expect(
                hPAL.connect(user1).unstake(unstake_amount, ethers.constants.AddressZero)
            ).to.be.revertedWith('hPAL: Address Zero')

        });

        it(' should reset the cooldown to 0 if unstaking all the balance', async () => {

            await hPAL.connect(user1).cooldown()

            const time_to_skip = await hPAL.COOLDOWN_PERIOD()
            await advanceTime(time_to_skip.toNumber())

            await hPAL.connect(user1).unstake(stake_amount, user1.address)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(0)

        });

        it(' should update delegation checkpoints - self-delegation', async () => {

            await hPAL.connect(user1).delegate(user1.address)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = await hPAL.COOLDOWN_PERIOD()
            await advanceTime(time_to_skip.toNumber())

            const old_votes = await hPAL.getCurrentVotes(user1.address)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            const unstake_tx = await hPAL.connect(user1).unstake(unstake_amount, user1.address)

            await expect(unstake_tx)
                .to.emit(hPAL, 'DelegateVotesChanged')
                .withArgs(user1.address, old_votes, old_votes.sub(unstake_amount));

            const new_votes = await hPAL.getCurrentVotes(user1.address)

            expect(old_votes.sub(new_votes)).to.be.eq(unstake_amount)

            //check block update in the checkpoint
            const tx_block = (await unstake_tx).blockNumber

            const chekcpoint = await hPAL.checkpoints(user1.address, (await hPAL.numCheckpoints(user1.address)).sub(1))

            expect(chekcpoint.fromBlock).to.be.eq(tx_block)
            expect(chekcpoint.votes).to.be.eq(new_votes)

        });

        it(' should update delegation checkpoints - delegation to other account', async () => {

            await hPAL.connect(user1).delegate(user2.address)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = await hPAL.COOLDOWN_PERIOD()
            await advanceTime(time_to_skip.toNumber())

            const old_votes = await hPAL.getCurrentVotes(user2.address)

            await token.connect(user1).approve(hPAL.address, stake_amount)

            const unstake_tx = await hPAL.connect(user1).unstake(unstake_amount, user1.address)

            await expect(unstake_tx)
                .to.emit(hPAL, 'DelegateVotesChanged')
                .withArgs(user2.address, old_votes, old_votes.sub(unstake_amount));

            const new_votes = await hPAL.getCurrentVotes(user2.address)

            expect(old_votes.sub(new_votes)).to.be.eq(unstake_amount)

            //check block update in the checkpoint
            const tx_block = (await unstake_tx).blockNumber

            const chekcpoint = await hPAL.checkpoints(user2.address, (await hPAL.numCheckpoints(user2.address)).sub(1))

            expect(chekcpoint.fromBlock).to.be.eq(tx_block)
            expect(chekcpoint.votes).to.be.eq(new_votes)

        });

    });

    // cooldowns & updates
    // on minting : if no cooldown, if expired, if currently in a cooldown, if during the unstake window
    // on transfer : if no cooldown, if expired, if currently in a cooldown, if during the unstake window
    // on burn : should not change since recevier is address(0x0)
    // + do tests with the view method
    describe('user cooldown updates & cooldown method', async () => {
        
        const stake_amount = ethers.utils.parseEther('1000')

        const unstake_amount = ethers.utils.parseEther('400')

        const big_stake_amount = ethers.utils.parseEther('2000')
        const small_stake_amount = ethers.utils.parseEther('50')

        const transfer_amount = ethers.utils.parseEther('300')

        const weightedCooldownCalculation = async(
            sender: string,
            receiver: string,
            amount: BigNumber,
            tx_block: number
        ) => {
            let sender_cooldown = await hPAL.cooldowns(sender, { blockTag: tx_block - 1 })
            let receiver_balance = await hPAL.balanceOf(receiver, { blockTag: tx_block - 1 })
            let receiver_cooldown = await hPAL.cooldowns(receiver, { blockTag: tx_block - 1 })

            let tx_timestamp = (await ethers.provider.getBlock(tx_block)).timestamp

            let min_valid_cooldown = BigNumber.from(tx_timestamp).sub(await hPAL.COOLDOWN_PERIOD()).sub(await hPAL.UNSTAKE_PERIOD())

            if(sender_cooldown.eq(0) || sender_cooldown.lt(min_valid_cooldown)) sender_cooldown = BigNumber.from(tx_timestamp);

            return (amount.mul(sender_cooldown).add(receiver_balance.mul(receiver_cooldown))).div(amount.add(receiver_balance))
        };

        beforeEach(async () => {

            await token.connect(recipient).transfer(user1.address, ethers.utils.parseEther('10000'));

            await token.connect(user1).approve(hPAL.address, ethers.utils.parseEther('10000'))

            await token.connect(recipient).transfer(user2.address, ethers.utils.parseEther('10000'));

            await token.connect(user2).approve(hPAL.address, ethers.utils.parseEther('10000'))

        });

        it(' mint - should not set a cooldown if already 0', async () => {

            await hPAL.connect(user1).stake(stake_amount)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(0)

        });

        it(' mint - should reset the cooldown if expired', async () => {

            await hPAL.connect(user1).stake(stake_amount)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).add(await hPAL.UNSTAKE_PERIOD()).mul(2)
            await advanceTime(time_to_skip.toNumber())

            await hPAL.connect(user1).stake(stake_amount)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(0)

        });

        it(' mint - should update the cooldown if already triggered - small amount', async () => {

            await hPAL.connect(user1).stake(stake_amount)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).div(2)
            await advanceTime(time_to_skip.toNumber())

            const stake_tx = await hPAL.connect(user1).stake(small_stake_amount)

            const tx_block = (await stake_tx).blockNumber || 0

            const expected_cooldown = await weightedCooldownCalculation(ethers.constants.AddressZero, user1.address, small_stake_amount, tx_block)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(expected_cooldown)

        });

        it(' mint - should update the cooldown if already triggered - big amount', async () => {

            await hPAL.connect(user1).stake(stake_amount)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).div(2)
            await advanceTime(time_to_skip.toNumber())

            const stake_tx = await hPAL.connect(user1).stake(big_stake_amount)

            const tx_block = (await stake_tx).blockNumber || 0

            const expected_cooldown = await weightedCooldownCalculation(ethers.constants.AddressZero, user1.address, big_stake_amount, tx_block)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(expected_cooldown)

        });

        it(' mint - should update the cooldown if in the unstake window - small amount', async () => {

            await hPAL.connect(user1).stake(stake_amount)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).add((await hPAL.UNSTAKE_PERIOD()).div(2))
            await advanceTime(time_to_skip.toNumber())

            const stake_tx = await hPAL.connect(user1).stake(small_stake_amount)

            const tx_block = (await stake_tx).blockNumber || 0

            const expected_cooldown = await weightedCooldownCalculation(ethers.constants.AddressZero, user1.address, small_stake_amount, tx_block)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(expected_cooldown)

        });

        it(' mint - should update the cooldown if in the unstake window - big amount', async () => {

            await hPAL.connect(user1).stake(stake_amount)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).add((await hPAL.UNSTAKE_PERIOD()).div(2))
            await advanceTime(time_to_skip.toNumber())

            const stake_tx = await hPAL.connect(user1).stake(big_stake_amount)

            const tx_block = (await stake_tx).blockNumber || 0

            const expected_cooldown = await weightedCooldownCalculation(ethers.constants.AddressZero, user1.address, big_stake_amount, tx_block)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(expected_cooldown)

        });

        it(' cooldown - should set the user new cooldown (& emit the Event)', async () => {

            await hPAL.connect(user1).stake(stake_amount)

            const cooldown_tx = await hPAL.connect(user1).cooldown()

            await expect(cooldown_tx)
                .to.emit(hPAL, 'Cooldown')
                .withArgs(user1.address);

        });

        it(' cooldown - should fail if the user has no balance', async () => {

            await expect(
                hPAL.connect(user2).cooldown()
            ).to.be.revertedWith('hPAL: No balance')

        });

        it(' transfer - should not set a cooldown if already 0', async () => {

            await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)

            await advanceTime(1000)

            await hPAL.connect(user2).transfer(user1.address, transfer_amount)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(0)

        });

        it(' transfer - should reset the cooldown if expired', async () => {

            await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).add(await hPAL.UNSTAKE_PERIOD()).mul(2)
            await advanceTime(time_to_skip.toNumber())

            await hPAL.connect(user2).transfer(user1.address, transfer_amount)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(0)

        });

        it(' transfer - should update the cooldown if sender has no cooldown', async () => {

            await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).div(2)
            await advanceTime(time_to_skip.toNumber())

            const transfer_tx = await hPAL.connect(user2).transfer(user1.address, transfer_amount)

            const tx_block = (await transfer_tx).blockNumber || 0

            const expected_cooldown = await weightedCooldownCalculation(user2.address, user1.address, transfer_amount, tx_block)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(expected_cooldown)

        });

        it(' transfer - should update the cooldown if already triggered', async () => {

            await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).div(2)
            await advanceTime(time_to_skip.toNumber())

            await advanceTime(50)

            await hPAL.connect(user2).cooldown()

            const transfer_tx = await hPAL.connect(user2).transfer(user1.address, transfer_amount)

            const tx_block = (await transfer_tx).blockNumber || 0

            const expected_cooldown = await weightedCooldownCalculation(user2.address, user1.address, transfer_amount, tx_block)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(expected_cooldown)

        });

        it(' transfer - should update the cooldown if in the unstake window', async () => {

            await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).add((await hPAL.UNSTAKE_PERIOD()).div(2))
            await advanceTime(time_to_skip.toNumber())

            await advanceTime(50)

            await hPAL.connect(user2).cooldown()

            const transfer_tx = await hPAL.connect(user2).transfer(user1.address, transfer_amount)

            const tx_block = (await transfer_tx).blockNumber || 0

            const expected_cooldown = await weightedCooldownCalculation(user2.address, user1.address, transfer_amount, tx_block)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(expected_cooldown)

        });

        it(' transfer - should keep the receiver cooldown is sender cooldown is better', async () => {

            await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)

            await hPAL.connect(user2).cooldown()

            await advanceTime(500)

            await hPAL.connect(user1).cooldown()

            await advanceTime(500)

            const old_cooldown = await hPAL.cooldowns(user1.address)

            await hPAL.connect(user2).transfer(user1.address, transfer_amount)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(old_cooldown)

        });

        it(' burn - should reset cooldown if all is unstaked', async () => {

            await hPAL.connect(user1).stake(stake_amount)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).add((await hPAL.UNSTAKE_PERIOD()).div(2))
            await advanceTime(time_to_skip.toNumber())

            await hPAL.connect(user1).unstake(stake_amount, user1.address)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(0)

        });

        it(' burn - should not change the cooldown if not all unstaked', async () => {

            await hPAL.connect(user1).stake(stake_amount)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).add((await hPAL.UNSTAKE_PERIOD()).div(2))
            await advanceTime(time_to_skip.toNumber())

            const old_cooldown = await hPAL.cooldowns(user1.address)

            await hPAL.connect(user1).unstake(unstake_amount, user1.address)

            expect(await hPAL.cooldowns(user1.address)).to.be.eq(old_cooldown)

        });

        it(' burn - should increase the cooldown if receiving a transfer during the unstake period', async () => {

            const transfer_amount = ethers.utils.parseEther('300')

            await hPAL.connect(user1).stake(stake_amount)
            await hPAL.connect(user2).stake(stake_amount)

            await hPAL.connect(user1).cooldown()

            const time_to_skip = (await hPAL.COOLDOWN_PERIOD()).add((await hPAL.UNSTAKE_PERIOD()).div(2))
            await advanceTime(time_to_skip.toNumber())

            await hPAL.connect(user1).unstake(unstake_amount, user1.address)

            const old_cooldown = await hPAL.cooldowns(user1.address)

            await hPAL.connect(user2).transfer(user1.address, transfer_amount)

            expect(await hPAL.cooldowns(user1.address)).to.be.gt(old_cooldown)

            await expect(
                hPAL.connect(user1).unstake(unstake_amount, user1.address)
            ).to.be.revertedWith('hPAL: Insufficient cooldown')

        });

    });

});