const Root = artifacts.require('./Root.sol');
const ENS = artifacts.require('@ensdomains/ens/contracts/ENSRegistry.sol');

const { exceptions, evm } = require('@ensdomains/test-utils');
const namehash = require('eth-ens-namehash');
const sha3 = require('js-sha3').keccak_256;

contract('Root', function(accounts) {

    let node;
    let ens, root;

    let now = Math.round(new Date().getTime() / 1000);

    beforeEach(async function() {
        node = namehash.hash('eth');

        ens = await ENS.new();
        root = await Root.new(ens.address);

        await root.setController(accounts[0], true);
        await ens.setSubnodeOwner('0x0', '0x' + sha3('eth'), root.address, {from: accounts[0]});
        await ens.setOwner('0x0', root.address);
    });

    describe('setSubnodeOwner', async () => {

        it('should allow controllers to set subnodes', async () => {
            await root.setSubnodeOwner('0x' + sha3('eth'), accounts[1], {from: accounts[0]});
            assert.equal(accounts[1], await ens.owner(node));
        });

        it('should fail when non-controller tries to set subnode', async () => {
            await exceptions.expectFailure(root.setSubnodeOwner('0x' + sha3('eth'), accounts[1], {from: accounts[1]}));
        });

        it('should not allow setting a locked TLD', async () => {
            await root.lock('0x' + sha3('eth'));
            await exceptions.expectFailure(root.setSubnodeOwner('0x' + sha3('eth'), accounts[1], {from: accounts[0]}));
        });
    });
});
