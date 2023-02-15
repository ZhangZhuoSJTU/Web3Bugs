const _ = require('lodash');
const { expect } = require("chai");
const { BigNumber } = ethers

const deployer = require('../deployer')

const mintAndRedeemFee = BigNumber.from(10)
const PRECISION = BigNumber.from(10000)
const ZERO = BigNumber.from(0)
const _1e18 = ethers.constants.WeiPerEther

describe('BadgerSettPeak (mainnet-fork)', function() {
    before('setup contracts', async function() {
        signers = await ethers.getSigners()
        alice = signers[0].address
        feeSink = '0x5b5cF8620292249669e1DCC73B753d01543D6Ac7' // DeFiDollar DAO Governance Multisig
        artifacts = await deployer.setupMainnetContracts(feeSink)
        ;({ badgerPeak, core, bBTC } = artifacts)
    })

    it('modifyWhitelistedCurvePools', async function() {
        const pools = Object.keys(deployer.crvPools).map(k => _.pick(deployer.crvPools[k], ['swap', 'sett']))
        await badgerPeak.modifyWhitelistedCurvePools(pools)
        expect((await badgerPeak.numPools()).toString()).to.eq('3')
        for (let i = 0; i < 3; i++) {
            const pool = await badgerPeak.pools(i)
            expect(pool.lpToken).to.eq(pools[i].lpToken)
            expect(pool.swap).to.eq(pools[i].swap)
            expect(pool.sett).to.eq(pools[i].sett)
        }
    })

    it('mint with bcrvRenWBTC', async function() {
        const amount = _1e18.mul(10)
        await deployer.mintCrvPoolToken('ren', alice, amount)
        const contracts = await deployer.getPoolContracts('ren')
        const [ lp, _, sett ] = contracts
        await lp.approve(sett.address, amount)
        await sett.deposit(amount)
        await testMint(0, await sett.balanceOf(alice), [badgerPeak].concat(contracts))
    });

    it('mint with bcrvRenWSBTC', async function() {
        let amount = _1e18.mul(10)
        await deployer.mintCrvPoolToken('sbtc', alice, amount)
        const contracts = await deployer.getPoolContracts('sbtc')
        const [ lp, _, sett ] = contracts
        await lp.approve(sett.address, amount)
        await sett.deposit(amount)
        await testMint(1, await sett.balanceOf(alice), [badgerPeak].concat(contracts))
    });

    it('mint with b-tbtc/sbtcCrv', async function() {
        const amount = _1e18.mul(10)
        await deployer.mintCrvPoolToken('tbtc', alice, amount)
        const contracts = await deployer.getPoolContracts('tbtc')
        const [ lp, _, sett ] = contracts
        await lp.approve(sett.address, amount)
        await sett.deposit(amount)
        await testMint(2, await sett.balanceOf(alice), [badgerPeak].concat(contracts))
    });

    it('redeem in bcrvRenWBTC', async function() {
        await testRedeem(0, 'ren', _1e18.mul(5))
    });

    it('redeem in bcrvRenWSBTC', async function() {
        await testRedeem(1, 'sbtc', _1e18.mul(5))
    });

    it('redeem in b-tbtc/sbtcCrv', async function() {
        await testRedeem(2, 'tbtc', _1e18.mul(5))
    });

    async function testRedeem(poolId, pool, amount) {
        const [ curveLPToken, swap, sett ] = await deployer.getPoolContracts(pool)
        const [ virtualPrice, pricePerFullShare, aliceBbtcBal, aliceCrvBal, peakCrvLPBal, peakSettBal, accumulatedFee ] = await Promise.all([
            swap.get_virtual_price(),
            sett.getPricePerFullShare(),
            bBTC.balanceOf(alice),
            curveLPToken.balanceOf(alice),
            curveLPToken.balanceOf(badgerPeak.address),
            sett.balanceOf(badgerPeak.address),
            core.accumulatedFee(),
        ])
        const fee = amount.mul(await core.redeemFee()).div(PRECISION)
        const expected = amount.sub(fee)
            .mul(await core.pricePerShare())
            .mul(_1e18)
            .div(pricePerFullShare)
            .div(virtualPrice)

        await badgerPeak.redeem(poolId, amount)

        await assertions(
            badgerPeak,
            curveLPToken,
            [
                aliceCrvBal, // curveLPToken.balanceOf(alice)
                aliceBbtcBal.sub(amount), // bBTC.balanceOf(alice)
                peakCrvLPBal, // curveLPToken.balanceOf(badgerPeak.address)
                accumulatedFee.add(fee) // core.accumulatedFee()
            ]
        )
        await settAssertions(
            badgerPeak,
            sett,
            [
                expected, // sett.balanceOf(alice)
                peakSettBal.sub(expected), // sett.balanceOf(peak.address)
            ]
        )
    }

    async function testMint(poolId, amount, [ peak, curveLPToken, swap, sett ]) {
        const [
            pricePerFullShare,
            virtualPrice,
            aliceCrvBal,
            aliceBbtcBal,
            peakCrvLPBal,
            peakSettLPBal,
            totalSupply,
            accumulatedFee,
            calcMint
        ] = await Promise.all([
            sett.getPricePerFullShare(),
            swap.get_virtual_price(),
            curveLPToken.balanceOf(alice),
            bBTC.balanceOf(alice),
            curveLPToken.balanceOf(peak.address),
            sett.balanceOf(peak.address),
            bBTC.totalSupply(),
            core.accumulatedFee(),
            badgerPeak.calcMint(poolId, amount)
        ])
        let mintedBbtc = amount
            .mul(pricePerFullShare)
            .mul(virtualPrice)
            .div(_1e18.mul(_1e18))
        if (totalSupply.gt(ZERO)) {
            mintedBbtc = mintedBbtc
                .mul((await bBTC.totalSupply()).add(accumulatedFee))
                .div(await core.totalSystemAssets())
        }
        const fee = mintedBbtc.mul(await core.mintFee()).div(PRECISION)
        const expectedBbtc = mintedBbtc.sub(fee)
        expect(calcMint.bBTC).to.eq(expectedBbtc)

        await sett.approve(peak.address, amount)
        await peak.mint(poolId, amount, [])
        await assertions(
            peak,
            curveLPToken,
            [
                aliceCrvBal, // curveLPToken.balanceOf(alice)
                aliceBbtcBal.add(expectedBbtc), // bBTC.balanceOf(alice)
                peakCrvLPBal, // curveLPToken.balanceOf(peak.address)
                accumulatedFee.add(fee) // core.accumulatedFee()
            ]
        )
        await settAssertions(
            peak,
            sett,
            [
                ZERO, // sett.balanceOf(alice)
                peakSettLPBal.add(amount), // sett.balanceOf(peak.address)
            ]
        )
    }

    async function assertions(peak, curveLPToken, [ aliceCrvLP, alicebtc, peakCrvLP, accumulatedFee ]) {
        const vals = await Promise.all([
            curveLPToken.balanceOf(alice),
            bBTC.balanceOf(alice),
            curveLPToken.balanceOf(peak.address),
            core.accumulatedFee()
        ])
        expect(aliceCrvLP).to.eq(vals[0])
        expect(alicebtc).to.eq(vals[1])
        expect(peakCrvLP).to.eq(vals[2])
        expect(accumulatedFee).to.eq(vals[3])
    }

    async function settAssertions(peak, sett, [ aliceSettLP, peakSettLP ]) {
        expect(aliceSettLP).to.eq(await sett.balanceOf(alice))
        expect(peakSettLP).to.eq(await sett.balanceOf(peak.address))
    }
});
