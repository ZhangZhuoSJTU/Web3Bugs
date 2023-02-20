const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { setupTestToken } = require('../helpers/setup');

describe('Swap', () => {
    let deployer, user2, user;
    let yax, yaxis, syax, swap;

    beforeEach(async () => {
        const config = await setupTestToken();
        yaxis = config.yaxis;
        yax = config.yax;
        syax = config.syax;
        swap = config.swap;
        [deployer, , user2, user] = await ethers.getSigners();

        await yax.connect(user).faucet(ether('100000'));
        await yax.connect(user).approve(syax.address, ethers.constants.MaxUint256);
        await syax.connect(user).enter(ether('50000'));
        await yax.connect(deployer).mint(syax.address, ether('25000'));
        await yax.connect(user).approve(swap.address, ethers.constants.MaxUint256);
        await syax.connect(user).approve(swap.address, ethers.constants.MaxUint256);
        await syax.connect(user2).approve(swap.address, ethers.constants.MaxUint256);
    });

    it('should deploy with initial state set', async () => {
        expect(await swap.YAXIS()).to.be.equal(yaxis.address);
        expect(await swap.YAX()).to.be.equal(yax.address);
        expect(await swap.SYAX()).to.be.equal(syax.address);
        expect(await syax.getPricePerFullShare()).to.be.equal(ether('1.5'));
        expect(await syax.balanceOf(user.address)).to.be.equal(ether('50000'));
        expect(await yax.balanceOf(user.address)).to.be.equal(ether('50000'));
    });

    describe('swap', () => {
        it('should swap all of the YAX and sYAX balance of the user', async () => {
            await swap.connect(user).swap();
            expect(await yaxis.balanceOf(user.address)).to.be.equal(ether('100000'));
            expect(await yax.balanceOf(user.address)).to.be.equal(0);
            expect(await syax.balanceOf(user.address)).to.be.equal(0);
            expect(await yaxis.balanceOf(swap.address)).to.be.equal(ether('900000'));
        });

        it('should swap all of the sYAX that the user is holding', async () => {
            // get rid of the user's YAX
            await yax.connect(user).transfer(deployer.address, ether('50000'));
            expect(await yax.balanceOf(user.address)).to.be.equal(0);

            await swap.connect(user).swap();
            expect(await yaxis.balanceOf(user.address)).to.be.equal(ether('50000'));
            expect(await syax.balanceOf(user.address)).to.be.equal(0);
            expect(await yaxis.balanceOf(swap.address)).to.be.equal(ether('950000'));
        });

        it('should swap all of the YAX that the user is holding', async () => {
            // get rid of the user's sYAX
            await syax.connect(user).transfer(deployer.address, ether('50000'));
            expect(await syax.balanceOf(user.address)).to.be.equal(0);

            await swap.connect(user).swap();
            expect(await yaxis.balanceOf(user.address)).to.be.equal(ether('50000'));
            expect(await yax.balanceOf(user.address)).to.be.equal(0);
            expect(await yaxis.balanceOf(swap.address)).to.be.equal(ether('950000'));
        });

        it('should do nothing if the user is holding no YAX or sYAX', async () => {
            // get rid of the user's sYAX & YAX
            await syax.connect(user).transfer(deployer.address, ether('50000'));
            expect(await syax.balanceOf(user.address)).to.be.equal(0);
            await yax.connect(user).transfer(deployer.address, ether('50000'));
            expect(await yax.balanceOf(user.address)).to.be.equal(0);

            await swap.connect(user).swap();
            expect(await yaxis.balanceOf(user.address)).to.be.equal(0);
            expect(await yaxis.balanceOf(swap.address)).to.be.equal(ether('1000000'));
        });

        it('should swap multiple users', async () => {
            await syax.connect(user).transfer(user2.address, ether('50000'));
            expect(await syax.balanceOf(user.address)).to.be.equal(0);
            expect(await syax.balanceOf(user2.address)).to.be.equal(ether('50000'));

            await swap.connect(user).swap();
            expect(await yaxis.balanceOf(user.address)).to.be.equal(ether('50000'));
            expect(await yax.balanceOf(user.address)).to.be.equal(0);
            expect(await yaxis.balanceOf(swap.address)).to.be.equal(ether('950000'));

            await swap.connect(user2).swap();
            expect(await yaxis.balanceOf(user2.address)).to.be.equal(ether('50000'));
            expect(await syax.balanceOf(user2.address)).to.be.equal(0);
            expect(await yaxis.balanceOf(swap.address)).to.be.equal(ether('900000'));
            expect(await yax.balanceOf(swap.address)).to.be.equal(ether('100000'));
        });
    });
});
