const FIFSRegistrar = artifacts.require('./ethregistrar/FIFSRegistrar.sol');
const ENS = artifacts.require('./registry/ENSRegistry.sol');

const { exceptions } = require("../test-utils");
const sha3 = require('web3-utils').sha3;
const namehash = require('eth-ens-namehash');

contract('FIFSRegistrar', function (accounts) {

    let registrar, ens;

    beforeEach(async () => {
        ens = await ENS.new();
        registrar = await FIFSRegistrar.new(ens.address, '0x0');

        await ens.setOwner('0x0', registrar.address, {from: accounts[0]})
    });

    it('should allow registration of names', async () => {
        await registrar.register(sha3('eth'), accounts[0], {from: accounts[0]});
        assert.equal(await ens.owner('0x0'), registrar.address);
        assert.equal(await ens.owner(namehash.hash('eth')), accounts[0]);
    });

    describe('transferring names', async () => {

        beforeEach(async () => {
            await registrar.register(sha3('eth'), accounts[0], {from: accounts[0]});
        });

        it('should allow transferring name to your own', async () => {
            await registrar.register(sha3('eth'), accounts[1], {from: accounts[0]});
            assert.equal(await ens.owner(namehash.hash('eth')), accounts[1]);
        });

        it('forbids transferring the name you do not own', async () => {
            await exceptions.expectFailure(registrar.register(sha3('eth'), accounts[1], {from: accounts[1]}));
        });
    });
});
