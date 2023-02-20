const Controller = artifacts.require('Controller');
const { expect } = require('../utils/common-utils');
const MockGvtTokenToken = artifacts.require('MockGvtToken');
const MockPWRDToken = artifacts.require('MockPWRDToken');
const MockDAI = artifacts.require('MockDAI');
const MockUSDC = artifacts.require('MockUSDC');
const MockUSDT = artifacts.require('MockUSDC');

contract('Pausable', function (accounts) {
    const [deployer, noGovernance, dai, usdc, usdt] = accounts;

    let controller, mockDAI, mockUSDC, mockUSDT, mockVault, mockPWRD;

    describe('Pausable', function (accounts) {
        beforeEach('Init new Controller instance with pausable', async function () {
            mockVault = await MockGvtTokenToken.new();
            mockPWRD = await MockPWRDToken.new();
            mockDAI = await MockDAI.new();
            mockUSDC = await MockUSDC.new();
            mockUSDT = await MockUSDT.new();
            let tokens = [mockDAI.address, mockUSDC.address, mockUSDT.address]
            let decimals = [10, 10, 10]
            controller = await Controller.new(mockPWRD.address, mockVault.address, tokens, decimals);
            await controller.addToWhitelist(deployer);
        })

        it('The paused is false after deployed', function () {
            return expect(controller.paused()).to.eventually.to.be.false;
        })

        it('pause: Should revert when not governance to call', function () {
            return expect(controller.pause({ from: noGovernance }))
                .to.be.rejectedWith('only whitelist');
        })

        it('unpause: Should revert when not governance to call', function () {
            return expect(controller.unpause({ from: noGovernance }))
                .to.be.rejected;
        })

        it('unpause: Should revert when paused is false', function () {
            return expect(controller.unpause({ from: deployer }))
                .to.be.rejected;
        })

        it('pause: Should ok', async function () {
            await controller.pause({ from: deployer });
            return expect(controller.paused()).to.eventually.to.be.true;
        })

        it('pause: Should revert when paused is true', async function () {
            await controller.pause({ from: deployer })
            return expect(controller.pause({ from: deployer }))
                .to.be.rejectedWith('Pausable: paused');
        })

        it('unpause: Should ok', async function () {
            await controller.pause({ from: deployer })
            await controller.unpause({ from: deployer });
            return expect(controller.paused()).to.eventually.to.be.false;
        })

    });

})
