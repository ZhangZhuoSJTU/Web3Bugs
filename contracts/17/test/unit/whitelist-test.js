const Whitelist = artifacts.require('Whitelist')
const { constants } = require('../utils/constants')
const { expect } = require('../utils/common-utils');

contract('Whitelist', function (accounts) {
    const [deployer, noGovernance, whitelist1, whitelist2] = accounts;

    let whitelist;

    describe('Whitelist Test', function () {
        beforeEach('Init new Whitelist instance', async function () {
            whitelist = await Whitelist.new({ from: deployer });
        })

        it('addToWhitelist: Should revert when not governance to call', function () {
            return expect(whitelist.addToWhitelist(whitelist1, { from: noGovernance }))
                .to.be.rejected;
        })

        it('addToWhitelist: Should revert when whitelist is zero address', function () {
            return expect(whitelist.addToWhitelist(constants.ZERO_ADDRESS, { from: deployer }))
                .to.be.rejected;
        })

        it('addToWhitelist: Should ok', function () {
            return whitelist.addToWhitelist(whitelist1, { from: deployer }).should.be.fulfilled;
        })

        it('inWhitelist: Should return false when checking if zero address is in whitelist', function () {
            return expect(whitelist.whitelist(constants.ZERO_ADDRESS)).to.eventually.be.false;
        })

        it('inWhitelist: Should ok', async function () {
            await whitelist.addToWhitelist(whitelist1, { from: deployer })
            await expect(whitelist.whitelist(whitelist1)).to.eventually.be.true;
            return expect(whitelist.whitelist(whitelist2)).to.eventually.be.false;
        })

        it('removeFromWhitelist: Should revert when not governance to call', function () {
            return expect(whitelist.removeFromWhitelist(whitelist1, { from: noGovernance }))
                .to.be.rejected;
        })

        it('removeFromWhitelist: Should revert passed account is zero address', function () {
            return expect(whitelist.removeFromWhitelist(constants.ZERO_ADDRESS, { from: deployer }))
                .to.be.rejected;
        })

        it('removeFromWhitelist: Should ok', async function () {
            await whitelist.addToWhitelist(whitelist1, { from: deployer })
            await whitelist.removeFromWhitelist(whitelist1, { from: deployer });
            return expect(whitelist.whitelist(whitelist1)).to.eventually.be.false;
        })

    });

})
