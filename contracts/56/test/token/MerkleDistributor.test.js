const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;

describe('MerkleDistributor', () => {
    const MERKLE_ROOT = '0xbcb3e26fca3db7ebea6fc6796e2e4036ca5957c54d5ef684052197f024e945b9';
    let yaxis, merkle;

    beforeEach(async () => {
        await deployments.fixture(['token', 'merkledrop']);
        const YaxisToken = await deployments.get('YaxisToken');
        yaxis = await ethers.getContractAt('YaxisToken', YaxisToken.address);
        const MerkleDistributor = await deployments.get('MerkleDistributor');
        merkle = await ethers.getContractAt('MerkleDistributor', MerkleDistributor.address);
    });

    it('should deploy with initial state set', async () => {
        expect(await merkle.token()).to.be.equal(yaxis.address);
        expect(await merkle.merkleRoot()).to.be.equal(MERKLE_ROOT);
    });
});
