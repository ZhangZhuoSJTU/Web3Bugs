const { expect } = require("chai");

const deployer = require('./deployer')

describe('Core', function() {
    let badgerPeak, core

    before('setup contracts', async function() {
        signers = await ethers.getSigners()
        alice = signers[0].address
        feeSink = signers[9].address
        dummyPeak = signers[8]
        artifacts = await deployer.setupContracts(feeSink)
        ;({ badgerPeak, bBtc, core } = artifacts)
    })

    it('can\'t add duplicate peak', async function() {
        await expect(core.whitelistPeak(badgerPeak.address)).to.be.revertedWith('DUPLICATE_PEAK')
    })

    it('whitelistPeak fails from non-admin account', async function() {
        await expect(core.connect(signers[1]).whitelistPeak(signers[8].address)).to.be.revertedWith('NOT_OWNER')
    });

    it('whitelistPeak fails for non-contract account', async function() {
        await expect(core.whitelistPeak(dummyPeak.address)).to.be.revertedWith('Transaction reverted')
    })

    it('setPeakStatus fails from non-admin account', async function() {
        await expect(core.connect(signers[1]).setPeakStatus(badgerPeak.address, 2 /* Dormant */)).to.be.revertedWith('NOT_OWNER')
    });

    it('setPeakStatus', async function() {
        expect(await core.peaks(badgerPeak.address)).to.eq(1) // Active

        await core.setPeakStatus(badgerPeak.address, 2 /* Dormant */)
        expect(await core.peaks(badgerPeak.address)).to.eq(2)

        await core.setPeakStatus(badgerPeak.address, 1 /* Active */)
        expect(await core.peaks(badgerPeak.address)).to.eq(1) // Active

        await core.setPeakStatus(badgerPeak.address, 0 /* Extinct */)
        expect(await core.peaks(badgerPeak.address)).to.eq(0)
    })

    it('mint fails from unwhitelisted peak', async function() {
        await expect(core.mint(1, alice, [])).to.be.revertedWith('PEAK_INACTIVE')
    })

    it('redeem fails from unwhitelisted peak', async function() {
        await expect(core.redeem(1, alice)).to.be.revertedWith('PEAK_EXTINCT')
    })

    it('can\'t set null fee sink', async function() {
        await expect(core.setConfig(10, 10, '0x0000000000000000000000000000000000000000')).to.be.revertedWith('NULL_ADDRESS')
    })
})
