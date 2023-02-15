//const { send } = require('@openzeppelin/test-helpers');
const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { ethers, getNamedAccounts } = hardhat;

describe('StrategyControllerV2: live', () => {
    let userAddr, deployerAddr, dai, usdc, usdt, t3crv, vaultUser;

    before(async () => {
        const { deployer, user, DAI, USDC, USDT, T3CRV, vault3crv } = await getNamedAccounts();
        await network.provider.request({
            method: 'hardhat_reset',
            params: [
                {
                    forking: {
                        jsonRpcUrl: process.env.MAINNET_RPC_URL
                    }
                }
            ]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [user]
        });
        await network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [deployer]
        });
        //await deployments.fixture('live');
        userAddr = user;
        deployerAddr = deployer;
        dai = await ethers.getContractAt('MockERC20', DAI, user);
        usdc = await ethers.getContractAt('MockERC20', USDC, user);
        usdt = await ethers.getContractAt('MockERC20', USDT, user);
        t3crv = await ethers.getContractAt('MockERC20', T3CRV, user);
        vaultUser = await ethers.getContractAt('yAxisMetaVault', vault3crv, user);

        await dai.approve(vaultUser.address, ethers.constants.MaxUint256);
        await usdc.approve(vaultUser.address, ethers.constants.MaxUint256);
        await usdt.approve(vaultUser.address, ethers.constants.MaxUint256);
        await t3crv.approve(vaultUser.address, ethers.constants.MaxUint256);
        await vaultUser.approve(vaultUser.address, ethers.constants.MaxUint256);
    });

    after(async () => {
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [userAddr]
        });
        await network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [deployerAddr]
        });
        await network.provider.request({
            method: 'hardhat_reset',
            params: []
        });
    });

    it('should allow the user to deposit', async () => {
        const tx = await vaultUser.depositAll([0, 0, 1000000000, 0], 1, true);
        const receipt = await tx.wait();
        expect(receipt.status).to.be.equal(1);
    });
});
