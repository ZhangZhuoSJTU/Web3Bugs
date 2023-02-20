const { expect } = require("chai")
const { BigNumber } = ethers

const deployer = require('../deployer');
const { impersonateAccount } = require('../utils')

const byvWBTCHolder = '0xe9b05bc1fa8684ee3e01460aac2e64c678b9da5d'

let mintAndRedeemFee = BigNumber.from(10)
const PRECISION = BigNumber.from(1e4)
const ZERO = BigNumber.from(0)

describe('BadgerYearnWbtcPeak (mainnet-fork)', function() {
    before('setup contracts', async function() {
        signers = await ethers.getSigners()
        alice = signers[0].address
        feeSink = '0x5b5cF8620292249669e1DCC73B753d01543D6Ac7' // DeFiDollar DAO Governance Multisig
        artifacts = await deployer.setupMainnetContracts(feeSink)
        ;({ badgerPeak, wbtcPeak, byvWBTC, core, bBTC } = artifacts)
    })

    it('BadgerYearnWbtcPeak is whitelisted', async function() {
        expect(await core.peakAddresses(1)).to.eq(wbtcPeak.address)
        expect(await core.peaks(wbtcPeak.address)).to.eq(1) // Active
    })

    it('mint with byvWBTC', async function() {
        let amount = BigNumber.from(4).mul(1e7) // 0.4 byvWBTC
        await impersonateAccount(byvWBTCHolder)
        await byvWBTC.connect(ethers.provider.getSigner(byvWBTCHolder)).transfer(alice, amount)

        const calcMint = await wbtcPeak.calcMint(amount)
        await byvWBTC.approve(wbtcPeak.address, amount)
        await wbtcPeak.mint(amount, [])

        // byvWBTC.pricePerShare() != 1e8, so bBTC amount must be estimated with pps
        const pps = await byvWBTC.pricePerShare()
        let mintedBbtc = amount.mul(pps).mul(100)
        const fee = mintedBbtc.mul(await core.mintFee()).div(PRECISION)
        const expectedBbtc = mintedBbtc.sub(fee)

        expect(calcMint.bBTC).to.eq(expectedBbtc)
        expect(await wbtcPeak.portfolioValue()).to.eq(mintedBbtc)

        await assertions(
            wbtcPeak,
            [
                ZERO,
                expectedBbtc,
                amount,
                fee
            ]
        )
    })

    it('redeem in byvWBTC', async function() {
        let amount = await bBTC.balanceOf(alice)
        const pps = await byvWBTC.pricePerShare()

        const [ calcRedeem, accumulatedFee ] = await Promise.all([
            wbtcPeak.calcRedeem(amount),
            core.accumulatedFee(),
        ])

        await wbtcPeak.redeem(amount)

        const fee = amount.mul(await core.redeemFee()).div(PRECISION) // denominated in bbtc
        // byvWBTC.pricePerShare() != 1e8, so byvWBTC amount must be estimated with pps
        const expected = amount.sub(fee).div(pps).div(100)

        expect(calcRedeem.sett).to.eq(expected)
        expect(calcRedeem.fee).to.eq(fee)

        await assertions(
            wbtcPeak,
            [
                expected,
                ZERO,
                fee.add(accumulatedFee).div(BigNumber.from(1e10).mul(pps).div(1e8)),
                fee.add(accumulatedFee)
            ]
        )
    })

    async function assertions(peak, [ aliceYVwbtc, alicebtc, peakYVwbtc, accumulatedFee ]) {
        const vals = await Promise.all([
            byvWBTC.balanceOf(alice),
            bBTC.balanceOf(alice),
            byvWBTC.balanceOf(peak.address),
            core.accumulatedFee()
        ])
        expect(aliceYVwbtc).to.eq(vals[0])
        expect(alicebtc).to.eq(vals[1])
        expect(peakYVwbtc).to.eq(vals[2])
        expect(accumulatedFee).to.eq(vals[3])
    }
})
