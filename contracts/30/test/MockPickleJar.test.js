const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;
const { setupTestMetavault } = require('../helpers/setup');

describe('MockPickleJar', () => {
    let user, t3crv, pickle, pjar, pchef;

    before(async () => {
        const config = await setupTestMetavault();
        t3crv = config.t3crv;
        user = config.user;

        const PICKLE = await deployments.get('PICKLE');
        pickle = await ethers.getContractAt('MockERC20', PICKLE.address, user);
        const T3CRV = await deployments.get('T3CRV');
        t3crv = await ethers.getContractAt('MockERC20', T3CRV.address, user);
        const PJAR = await deployments.get('MockPickleJar');
        pjar = await ethers.getContractAt('MockPickleJar', PJAR.address, user);
        const PCHEF = await deployments.get('MockPickleMasterChef');
        pchef = await ethers.getContractAt('MockPickleMasterChef', PCHEF.address, user);

        //await pickle.faucet(ethers.utils.parseEther('1000'));
        await t3crv.approve(pjar.address, ethers.utils.parseEther('1000'));
        await pjar.approve(pchef.address, ethers.utils.parseEther('1000'));
    });

    it('pjar deposit', async () => {
        const _amount = ether('10');
        await pjar.deposit(_amount);
        expect(await t3crv.balanceOf(user)).to.equal(ether('990'));
        expect(await pjar.balanceOf(user)).to.equal('9900990099009900990'); // -1%
        expect(await pjar.balance()).to.equal(ether('10'));
        expect(await pjar.available()).to.be.least(ether('9.5'));
        expect(await t3crv.balanceOf(pjar.address)).to.equal(ether('10'));
        expect(await pjar.totalSupply()).to.equal('9900990099009900990');
    });

    it('pjar withdraw', async () => {
        const _amount = ether('1');
        await pjar.withdraw(_amount);
        expect(await t3crv.balanceOf(user)).to.equal(ether('991.01'));
        expect(await pjar.balanceOf(user)).to.equal('8900990099009900990');
        expect(await t3crv.balanceOf(pjar.address)).to.equal(ether('8.99'));
    });

    it('pjar withdrawAll', async () => {
        await pjar.withdrawAll();
        expect(await t3crv.balanceOf(user)).to.equal('999999999999999999999');
        expect(await pjar.balanceOf(user)).to.equal('0');
        expect(await t3crv.balanceOf(pjar.address)).to.equal('1'); // 1 wei left because of div precision math
    });

    it('get PJAR (via pjar deposit)', async () => {
        const _amount = ether('100');
        await pjar.deposit(_amount);
        expect(await pjar.balanceOf(user)).to.be.least(ether('99.00990099009900')); // -1%
    });

    it('pchef deposit', async () => {
        const _pid = 14;
        const _amount = ether('10');
        await pchef.deposit(_pid, _amount);
        expect(await pjar.balanceOf(user)).to.be.least(ether('89.00990099009900'));
        expect(await pjar.balanceOf(pchef.address)).to.equal(ether('10'));
    });

    it('pchef deposit(0) - claim', async () => {
        const _pid = 14;
        await pchef.deposit(_pid, 0);
        expect(await pjar.balanceOf(user)).to.be.least(ether('89.00990099009900'));
        expect(await pjar.balanceOf(pchef.address)).to.equal(ether('10'));
        expect(await pickle.balanceOf(user)).to.equal(ether('1'));
    });

    it('pchef withdraw', async () => {
        const _pid = 14;
        const _amount = ether('1');
        await pchef.withdraw(_pid, _amount);
        expect(await pjar.balanceOf(user)).to.be.least(ether('90.00990099009900'));
        expect(await pjar.balanceOf(pchef.address)).to.equal(ether('9'));
    });

    it('pchef emergencyWithdraw', async () => {
        const _pid = 14;
        await pchef.emergencyWithdraw(_pid);
        expect(await pjar.balanceOf(user)).to.be.least(ether('99.00990099009900'));
        expect(await pjar.balanceOf(pchef.address)).to.equal(ether('0'));
        const userInfo = await pchef.userInfo(14, user);
        expect(userInfo.amount).to.equal('0');
    });
});
