const Controllable = artifacts.require('Controllable')
const { constants } = require('../utils/constants')
const { expect } = require('../utils/common-utils');

contract('Controllable', function (accounts) {
    const [deployer, noGovernance, newContorller] = accounts;

    let controllable;

    describe('Controllable Test', function () {
        beforeEach('Init new Controllable instance', async function () {
            controllable = await Controllable.new({ from: deployer });
        })

        it('The controller is empty after deployed', function () {
            return expect(controllable.controller()).to.eventually.equal(constants.ZERO_ADDRESS);
        })

        it('setController: Should revert when not governance to call', function () {
            return expect(controllable.setController(newContorller, { from: noGovernance }))
                .to.be.rejected;
        })

        it('setController: Should revert when new controller is zero address', function () {
            return expect(controllable.setController(constants.ZERO_ADDRESS, { from: deployer }))
                .to.be.rejected;
        })

        it('setController: Should ok', async function () {
            await controllable.setController(newContorller, { from: deployer });
            return expect(controllable.controller()).to.eventually.equal(newContorller);
        })
    });
})
