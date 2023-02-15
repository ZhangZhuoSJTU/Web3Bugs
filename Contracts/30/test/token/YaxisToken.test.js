const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('YaxisToken', () => {
    const emptyBytes = '0x00';
    const MAX = ethers.constants.MaxUint256;
    let deployer, user;
    let yaxis;

    beforeEach(async () => {
        [deployer, , , user] = await ethers.getSigners();

        const YaxisToken = await ethers.getContractFactory('YaxisToken');
        yaxis = await YaxisToken.deploy();
        await yaxis.deployed();
    });

    it('should deploy with initial state set', async () => {
        expect(await yaxis.name()).to.be.equal('yAxis V2');
        expect(await yaxis.symbol()).to.be.equal('YAXIS');
        expect(await yaxis.totalSupply()).to.be.equal(ether('11000000'));
    });

    describe('transfer', () => {
        it('should transfer tokens', async () => {
            expect(await yaxis.balanceOf(user.address)).to.be.equal(0);
            await yaxis.transfer(user.address, ether('1'));
            expect(await yaxis.balanceOf(user.address)).to.be.equal(ether('1'));
        });

        it('should not allow transfer to the token contract', async () => {
            expect(await yaxis.balanceOf(yaxis.address)).to.be.equal(0);
            await expect(yaxis.transfer(yaxis.address, ether('1'))).to.be.revertedWith(
                '!validAddress'
            );
        });

        it('should not allow transfer more than balance', async () => {
            await expect(yaxis.transfer(user.address, MAX)).to.be.revertedWith(
                'ERC20: transfer amount exceeds balance'
            );
        });
    });

    describe('transferFrom', () => {
        it('should not transfer tokens without allowance', async () => {
            expect(await yaxis.balanceOf(user.address)).to.be.equal(0);
            await expect(
                yaxis.transferFrom(deployer.address, user.address, ether('1'))
            ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
        });

        it('should transfer tokens', async () => {
            expect(await yaxis.balanceOf(user.address)).to.be.equal(0);
            await yaxis.increaseApproval(deployer.address, ether('1'));
            await yaxis.transferFrom(deployer.address, user.address, ether('1'));
            expect(await yaxis.balanceOf(user.address)).to.be.equal(ether('1'));
        });

        it('should not allow transfer to the token contract', async () => {
            expect(await yaxis.balanceOf(yaxis.address)).to.be.equal(0);
            await expect(
                yaxis.transferFrom(deployer.address, yaxis.address, ether('1'))
            ).to.be.revertedWith('!validAddress');
        });

        it('should not allow transfer more than balance', async () => {
            await expect(
                yaxis.transferFrom(deployer.address, user.address, MAX)
            ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
        });
    });

    describe('transferAndCall', () => {
        it('should transfer tokens', async () => {
            expect(await yaxis.balanceOf(user.address)).to.be.equal(0);
            await yaxis.transferAndCall(user.address, ether('1'), emptyBytes);
            expect(await yaxis.balanceOf(user.address)).to.be.equal(ether('1'));
        });

        it('should not allow transfer more than balance', async () => {
            await expect(
                yaxis.transferAndCall(user.address, MAX, emptyBytes)
            ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
        });
    });
});
