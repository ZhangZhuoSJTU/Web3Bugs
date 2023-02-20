const { expect } = require("chai");
const { BigNumber } = ethers

const deployer = require('./deployer')

let fee = BigNumber.from(10)
const PRECISION = BigNumber.from(10000)
const ZERO = BigNumber.from(0)
const _1e18 = ethers.constants.WeiPerEther

describe('BadgerSettPeak', function() {
    before('setup contracts', async function() {
        signers = await ethers.getSigners()
        alice = signers[0].address
        feeSink = signers[9].address
        artifacts = await deployer.setupContracts(feeSink)
        ;({ curveLPToken, badgerPeak, bBTC, swap, sett, core } = artifacts)
    })

    it('mint', async function() {
        const amount = _1e18.mul(10)
        await Promise.all([
            curveLPToken.mint(alice, amount),
            curveLPToken.approve(sett.address, amount)
        ])
        await sett.deposit(amount)

        await sett.approve(badgerPeak.address, amount)
        await badgerPeak.mint(0, amount, [])

        const bBtc = amount//.sub(1) // round-down
        const _fee = bBtc.mul(fee).div(PRECISION)
        const aliceBtc = bBtc.sub(_fee)

        expect(await sett.balanceOf(alice)).to.eq(ZERO)
        expect(await sett.balanceOf(badgerPeak.address)).to.eq(amount)
        expect(await bBTC.balanceOf(alice)).to.eq(aliceBtc)
        expect(await core.accumulatedFee()).to.eq(_fee)
    })

    it('setPeakStatus', async function() {
        expect(await core.peaks(badgerPeak.address)).to.eq(1)
        await core.setPeakStatus(badgerPeak.address, 2 /* Dormant */)
        expect(await core.peaks(badgerPeak.address)).to.eq(2)
    })

    it('cant mark peak with funds as extinct', async function() {
        await expect(
            core.setPeakStatus(badgerPeak.address, 0 /* Extinct */)
        ).to.be.revertedWith('NON_TRIVIAL_FUNDS_IN_PEAK')
    })

    // redeem works for dormant peak
    it('redeem', async function() {
        const [ aliceBbtc, accumulatedFee ] = await Promise.all([
            bBTC.balanceOf(alice),
            core.accumulatedFee()
        ])
        const amount = aliceBbtc

        await badgerPeak.redeem(0, amount)

        const _fee = amount.mul(fee).div(PRECISION)
        expect(aliceBbtc.sub(amount)).to.eq(await bBTC.balanceOf(alice));
        expect(amount.sub(_fee)).to.eq(await sett.balanceOf(alice));
        expect(await core.accumulatedFee()).to.eq(_fee.add(accumulatedFee))
    })

    it('collectFee', async function() {
        const accumulatedFee = await core.accumulatedFee()

        await core.collectFee()

        expect(await bBTC.balanceOf(feeSink)).to.eq(accumulatedFee);
        expect(await core.accumulatedFee()).to.eq(ZERO)

        await badgerPeak.connect(ethers.provider.getSigner(feeSink)).redeem(0, accumulatedFee)
    })

    it('redeem fails for Extinct peak', async function() {
        await core.setPeakStatus(badgerPeak.address, 0 /* Extinct */)
        expect(await core.peaks(badgerPeak.address)).to.eq(0)

        await expect(badgerPeak.redeem(0, _1e18 /* dummy value */)).to.be.revertedWith('PEAK_EXTINCT')
    })

    it('modifyWhitelistedCurvePools', async function() {
        let pool = await badgerPeak.pools(0)
        expect(pool.swap).to.eq(swap.address)
        expect(pool.sett).to.eq(sett.address)
        expect((await badgerPeak.numPools()).toString()).to.eq('1')

        const [ Swap, Sett ] = await Promise.all([
            ethers.getContractFactory("Swap"),
            ethers.getContractFactory("Sett")
        ])
        const swap2 = await Swap.deploy()
        const sett2 = await Sett.deploy(curveLPToken.address)
        await badgerPeak.modifyWhitelistedCurvePools([
            { swap: swap2.address, sett: sett2.address },
            { swap: swap.address, sett: sett.address }
        ])
        expect((await badgerPeak.numPools()).toString()).to.eq('2')

        pool = await badgerPeak.pools(0)
        expect(pool.swap).to.eq(swap2.address)
        expect(pool.sett).to.eq(sett2.address)

        pool = await badgerPeak.pools(1)
        expect(pool.swap).to.eq(swap.address)
        expect(pool.sett).to.eq(sett.address)

        await badgerPeak.modifyWhitelistedCurvePools([
            { swap: swap.address, sett: sett.address }
        ])
        expect((await badgerPeak.numPools()).toString()).to.eq('1')

        pool = await badgerPeak.pools(0)
        expect(pool.swap).to.eq(swap.address)
        expect(pool.sett).to.eq(sett.address)

        pool = await badgerPeak.pools(1)
        expect(pool.swap).to.eq('0x0000000000000000000000000000000000000000')
        expect(pool.sett).to.eq('0x0000000000000000000000000000000000000000')
    })
});

describe('Zero fee and redeem all', function() {
    before('setup contracts', async function() {
        signers = await ethers.getSigners()
        alice = signers[0].address
        feeSink = signers[9].address
        artifacts = await deployer.setupContracts(feeSink)
        ;({ curveLPToken, badgerPeak, bBTC, sett, core } = artifacts)
    })

    it('setConfig', async function() {
        await core.setConfig(0, 0, feeSink)
        expect(await core.mintFee()).to.eq(ZERO)
        expect(await core.redeemFee()).to.eq(ZERO)
        expect(await core.feeSink()).to.eq(feeSink)
        fee = ZERO
    })

    it('mint', async function() {
        const amount = _1e18.mul(10)
        await Promise.all([
            curveLPToken.mint(alice, amount),
            curveLPToken.approve(sett.address, amount)
        ])
        await sett.deposit(amount)

        const aliceBtc = amount
        const calcMint = await badgerPeak.calcMint(0, amount)
        expect(calcMint.bBTC).to.eq(aliceBtc)

        await sett.approve(badgerPeak.address, amount)
        await badgerPeak.mint(0, amount, [])

        expect(await bBTC.balanceOf(alice)).to.eq(aliceBtc)
        expect(await sett.balanceOf(alice)).to.eq(ZERO)
        expect(await sett.balanceOf(badgerPeak.address)).to.eq(amount)
        expect(await core.accumulatedFee()).to.eq(ZERO)
    })

    it('redeem', async function() {
        const amount = await bBTC.balanceOf(alice)

        const calcRedeem = await badgerPeak.calcRedeem(0, amount)
        // with 0 fee, everything can be redeemed
        expect(calcRedeem.sett).to.eq(amount)

        await badgerPeak.redeem(0, amount)

        expect(await bBTC.balanceOf(alice)).to.eq(ZERO)
        expect(await sett.balanceOf(alice)).to.eq(amount)
        expect(await sett.balanceOf(badgerPeak.address)).to.eq(ZERO)
        expect(await core.accumulatedFee()).to.eq(ZERO)
    })

    it('collectFee reverts when fee=0', async function() {
        await expect(core.collectFee()).to.be.revertedWith('NO_FEE')
    })
})
