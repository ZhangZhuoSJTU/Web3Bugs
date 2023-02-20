const hre = require("hardhat");
import { ethers, waffle } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { PaladinToken } from "../typechain/PaladinToken";
import { PaladinRewardReserve } from "../typechain/PaladinRewardReserve";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";
import { BigNumber } from "@ethersproject/bignumber";
import { advanceTime } from "./utils/utils";

chai.use(solidity);
const { expect } = chai;

let tokenFactory: ContractFactory
let reserveFactory: ContractFactory

const mint_amount = ethers.utils.parseEther('10000000') // 10 M tokens

const reserve_amount = ethers.utils.parseEther('1000000') // 1 M tokens

const UNIT = ethers.utils.parseEther('1')


describe('PaladinRewardReserve contract tests', () => {
    let deployer: SignerWithAddress
    let admin: SignerWithAddress
    let recipient: SignerWithAddress
    let spender1: SignerWithAddress
    let spender2: SignerWithAddress
    let externalUser: SignerWithAddress

    let token: PaladinToken

    let reserve: PaladinRewardReserve

    before(async () => {
        tokenFactory = await ethers.getContractFactory("PaladinToken");
        reserveFactory = await ethers.getContractFactory("PaladinRewardReserve");
    })


    beforeEach(async () => {
        [deployer, admin, recipient, spender1, spender2, externalUser] = await ethers.getSigners();

        token = (await tokenFactory.connect(deployer).deploy(mint_amount, admin.address, recipient.address)) as PaladinToken;
        await token.deployed();

        await token.connect(admin).setTransfersAllowed(true);

        reserve = (await reserveFactory.connect(deployer).deploy(
            admin.address
        )) as PaladinRewardReserve;
        await reserve.deployed();
    });


    it(' should be deployed & have correct parameters', async () => {
        expect(reserve.address).to.properAddress

        expect(await reserve.owner()).to.be.eq(admin.address)

        expect(await reserve.approvedSpenders(spender1.address)).to.be.false
        expect(await reserve.approvedSpenders(spender2.address)).to.be.false

    });

    describe('setNewSpender', async () => {

        const allowance_amount = ethers.utils.parseEther('750')

        const allowance_amount2 = ethers.utils.parseEther('500')

        beforeEach(async () => {
            await token.connect(recipient).transfer(reserve.address, reserve_amount)
        });

        it(' should set a new spender and the correct allowance', async () => {
            expect(await token.allowance(reserve.address, spender1.address)).to.be.eq(0)

            await expect(reserve.connect(admin).setNewSpender(token.address, spender1.address, allowance_amount))
                .to.emit(reserve, 'NewSpender')
                .withArgs(token.address, spender1.address, allowance_amount);

            expect(await reserve.approvedSpenders(spender1.address)).to.be.true
            expect(await reserve.approvedSpenders(spender2.address)).to.be.false
                
            expect(await token.allowance(reserve.address, spender1.address)).to.be.eq(allowance_amount)
        });

        it(' should allow to set other spenders (& not impact the previous ones)', async () => {

            await reserve.connect(admin).setNewSpender(token.address, spender1.address, allowance_amount)

            expect(await token.allowance(reserve.address, spender2.address)).to.be.eq(0)
                
            expect(await token.allowance(reserve.address, spender1.address)).to.be.eq(allowance_amount)

            await expect(reserve.connect(admin).setNewSpender(token.address, spender2.address, allowance_amount2))
                .to.emit(reserve, 'NewSpender')
                .withArgs(token.address, spender2.address, allowance_amount2);

            expect(await reserve.approvedSpenders(spender1.address)).to.be.true
            expect(await reserve.approvedSpenders(spender2.address)).to.be.true

            expect(await token.allowance(reserve.address, spender2.address)).to.be.eq(allowance_amount2)
                
            expect(await token.allowance(reserve.address, spender1.address)).to.be.eq(allowance_amount)

        });

        it(' should fail if spender already approved', async () => {

            await reserve.connect(admin).setNewSpender(token.address, spender1.address, allowance_amount)

            await expect(
                reserve.connect(admin).setNewSpender(token.address, spender1.address, allowance_amount)
            ).to.be.revertedWith('Already Spender')
        });

        it(' should only be callable by admin', async () => {
            await expect(
                reserve.connect(externalUser).setNewSpender(token.address, externalUser.address, allowance_amount)
            ).to.be.revertedWith('Ownable: caller is not the owner')
        });

    });

    describe('updateSpenderAllowance', async () => {

        const allowance_amount = ethers.utils.parseEther('750')

        const allowance_amount2 = ethers.utils.parseEther('500')

        const new_allowance_amount = ethers.utils.parseEther('1200')

        const new_allowance_amount2 = ethers.utils.parseEther('400')

        beforeEach(async () => {
            await token.connect(recipient).transfer(reserve.address, reserve_amount)

            await reserve.connect(admin).setNewSpender(token.address, spender1.address, allowance_amount)

            await reserve.connect(admin).setNewSpender(token.address, spender2.address, allowance_amount2)
        });

        it(' should update the spender allowance amount correctly', async () => {

            expect(await token.allowance(reserve.address, spender1.address)).to.be.eq(allowance_amount)
                
            expect(await token.allowance(reserve.address, spender2.address)).to.be.eq(allowance_amount2)

            await expect(reserve.connect(admin).updateSpenderAllowance(token.address, spender1.address, new_allowance_amount))
                .to.emit(reserve, 'UpdateSpender')
                .withArgs(token.address, spender1.address, new_allowance_amount);

            expect(await reserve.approvedSpenders(spender1.address)).to.be.true
            expect(await reserve.approvedSpenders(spender2.address)).to.be.true
            
            expect(await token.allowance(reserve.address, spender1.address)).to.be.eq(new_allowance_amount)
                
            expect(await token.allowance(reserve.address, spender2.address)).to.be.eq(allowance_amount2)

        });

        it(' should not change the other spenders allowance', async () => {

            await reserve.connect(admin).updateSpenderAllowance(token.address, spender1.address, new_allowance_amount)

            expect(await token.allowance(reserve.address, spender1.address)).to.be.eq(new_allowance_amount)
                
            expect(await token.allowance(reserve.address, spender2.address)).to.be.eq(allowance_amount2)

            await expect(reserve.connect(admin).updateSpenderAllowance(token.address, spender2.address, allowance_amount2))
                .to.emit(reserve, 'UpdateSpender')
                .withArgs(token.address, spender2.address, allowance_amount2);

            expect(await reserve.approvedSpenders(spender1.address)).to.be.true
            expect(await reserve.approvedSpenders(spender2.address)).to.be.true
                
            expect(await token.allowance(reserve.address, spender1.address)).to.be.eq(new_allowance_amount)
                
            expect(await token.allowance(reserve.address, spender2.address)).to.be.eq(allowance_amount2)
        });

        it(' should fail if spender not approved', async () => {
            await expect(
                reserve.connect(admin).updateSpenderAllowance(token.address, externalUser.address, allowance_amount)
            ).to.be.revertedWith('Not approved Spender')
        });

        it(' should only be callable by admin', async () => {
            await expect(
                reserve.connect(externalUser).updateSpenderAllowance(token.address, spender2.address, new_allowance_amount2)
            ).to.be.revertedWith('Ownable: caller is not the owner')
        });

    });

    describe('removeSpender', async () => {

        const allowance_amount = ethers.utils.parseEther('750')

        const allowance_amount2 = ethers.utils.parseEther('500')

        beforeEach(async () => {
            await token.connect(recipient).transfer(reserve.address, reserve_amount)

            await reserve.connect(admin).setNewSpender(token.address, spender1.address, allowance_amount)

            await reserve.connect(admin).setNewSpender(token.address, spender2.address, allowance_amount2)
        });

        it(' should remove the spender correctly', async () => {

            await expect(reserve.connect(admin).removeSpender(token.address, spender1.address))
                .to.emit(reserve, 'RemovedSpender')
                .withArgs(token.address, spender1.address);

            expect(await reserve.approvedSpenders(spender1.address)).to.be.false
            expect(await reserve.approvedSpenders(spender2.address)).to.be.true

        });

        it(' should set the allowance back to 0', async () => {

            expect(await token.allowance(reserve.address, spender1.address)).to.be.eq(allowance_amount)

            await expect(reserve.connect(admin).removeSpender(token.address, spender1.address))
                .to.emit(reserve, 'RemovedSpender')
                .withArgs(token.address, spender1.address);
                
            expect(await token.allowance(reserve.address, spender1.address)).to.be.eq(0)

        });

        it(' should not change allowance for the other spenders', async () => {

            expect(await token.allowance(reserve.address, spender1.address)).to.be.eq(allowance_amount)
                
            expect(await token.allowance(reserve.address, spender2.address)).to.be.eq(allowance_amount2)

            await expect(reserve.connect(admin).removeSpender(token.address, spender1.address))
                .to.emit(reserve, 'RemovedSpender')
                .withArgs(token.address, spender1.address);
                
            expect(await token.allowance(reserve.address, spender1.address)).to.be.eq(0)
                
            expect(await token.allowance(reserve.address, spender2.address)).to.be.eq(allowance_amount2)
        });

        it(' should fail if spender not approved', async () => {
            await expect(
                reserve.connect(admin).removeSpender(token.address, externalUser.address)
            ).to.be.revertedWith('Not approved Spender')
        });

        it(' should only be callable by admin', async () => {
            await expect(
                reserve.connect(externalUser).removeSpender(token.address, spender1.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')
        });

    });

    describe('transferToken', async () => {

        const transfer_amount = ethers.utils.parseEther('1500')

        beforeEach(async () => {
            await token.connect(recipient).transfer(reserve.address, reserve_amount)
        });

        it(' should transfer the correct amount', async () => {
            const old_user_balance = await token.balanceOf(externalUser.address)
            const old_reserve_balance = await token.balanceOf(reserve.address)

            await reserve.connect(admin).transferToken(token.address, externalUser.address, transfer_amount)

            const new_user_balance = await token.balanceOf(externalUser.address)
            const new_reserve_balance = await token.balanceOf(reserve.address)

            expect(new_user_balance).to.be.eq(old_user_balance.add(transfer_amount))
            expect(new_reserve_balance).to.be.eq(old_reserve_balance.sub(transfer_amount))
        });

        it(' should only be callable by admin', async () => {
            await expect(
                reserve.connect(externalUser).transferToken(token.address, externalUser.address, transfer_amount)
            ).to.be.revertedWith('Ownable: caller is not the owner')
        });

    });

});