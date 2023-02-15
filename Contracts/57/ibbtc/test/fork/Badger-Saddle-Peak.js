const _ = require('lodash');
const { expect } = require("chai");
const { BigNumber } = ethers

const deployer = require('../deployer')
const { impersonateAccount } = require('../utils')

let mintAndRedeemFee = BigNumber.from(10)
const PRECISION = BigNumber.from(10000)
const ZERO = BigNumber.from(0)
const _1e18 = ethers.constants.WeiPerEther

const saddle = {
    lpToken: '0xC28DF698475dEC994BE00C9C9D8658A548e6304F', // saddleTWRenSBTC
    swap: '0x4f6A43Ad7cba042606dECaCA730d4CE0A57ac62e'
}
const saddleTWRenSBTCWhale = '0x28d804bf2212e220bc2b7b6252993db8286df07f'

describe('BadgerSettPeak + SaddlePeak (mainnet-fork)', function() {
    before('setup contracts', async function() {
        signers = await ethers.getSigners()
        alice = signers[0].address
        feeSink = '0x5b5cF8620292249669e1DCC73B753d01543D6Ac7' // DeFiDollar DAO Governance Multisig
        artifacts = await deployer.setupMainnetContracts(feeSink)
        ;({ badgerPeak, core, bBTC } = artifacts)
    })

    it('saddlePeak.modifyWhitelistedCurvePools', async function() {
        const SaddlePeak = await ethers.getContractFactory('SaddlePeak')
        saddlePeak = await SaddlePeak.deploy(core.address)
        ;([ saddlePeak, saddleTWRenSBTC, saddleSwap ] = await Promise.all([
            ethers.getContractAt('SaddlePeak', saddlePeak.address),
            ethers.getContractAt('CurveLPToken', saddle.lpToken),
            ethers.getContractAt('ISaddleSwap', saddle.swap)
        ]))
        const pools = [saddle]
        await saddlePeak.modifyWhitelistedCurvePools(pools)
        expect((await saddlePeak.numPools()).toString()).to.eq('1')
        const pool = await saddlePeak.pools(0)
        expect(pool.lpToken).to.eq(pool.lpToken)
        expect(pool.swap).to.eq(pool.swap)
    })

    it('whitelist saddle peak', async function() {
        expect(await core.peaks(saddlePeak.address)).to.eq(0) // Extinct

        await core.whitelistPeak(saddlePeak.address)

        expect(await core.peakAddresses(2)).to.eq(saddlePeak.address)
        expect(await core.peaks(saddlePeak.address)).to.eq(1) // Active
    })

    it('badgerPeak.modifyWhitelistedCurvePools', async function() {
        const pools = Object.keys(deployer.crvPools).map(k => _.pick(deployer.crvPools[k], ['swap', 'sett']))
        await badgerPeak.modifyWhitelistedCurvePools(pools)
        expect((await badgerPeak.numPools()).toString()).to.eq('3')
        for (let i = 0; i < 3; i++) {
            const pool = await badgerPeak.pools(i)
            expect(pool.swap).to.eq(pools[i].swap)
            expect(pool.sett).to.eq(pools[i].sett)
        }
    })

    it('setConfig', async function() {
        await core.setConfig(0, 0, feeSink)
        expect(await core.mintFee()).to.eq(ZERO)
        expect(await core.redeemFee()).to.eq(ZERO)
        expect(await core.feeSink()).to.eq(feeSink)
        mintAndRedeemFee = ZERO
    })

    it('mint with saddleTWRenSBTC', async function() {
        let amount = _1e18.mul(10)
        await impersonateAccount(saddleTWRenSBTCWhale)
        // transfer from whale
        await saddleTWRenSBTC.connect(ethers.provider.getSigner(saddleTWRenSBTCWhale)).transfer(alice, amount)
        await testMintWithCurveLP(0, amount, [ saddlePeak, saddleTWRenSBTC, saddleSwap ])
    });

    it('mint with bcrvRenWBTC', async function() {
        const amount = _1e18.mul(10)
        await deployer.mintCrvPoolToken('ren', alice, amount)
        const [ lp, swap, sett ] = await deployer.getPoolContracts('ren')
        renWbtcSwap = swap
        await lp.approve(sett.address, amount)
        await sett.deposit(amount)
        await testMint(0, await sett.balanceOf(alice), [ badgerPeak, lp, swap, sett ])
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

    it('pricePerShare should increase after a trade', async function() {
        let amount = BigNumber.from(15).mul(1e8) // wbtc has 8 decimals
        const wbtc = await deployer.getWbtc(alice, amount)

        let ppfs = await core.pricePerShare()
        for (let i = 0; i < 10; i++) {
            await tradeWbtcxRen(wbtc)
            // trades will increase the virtual price; so ppfs should increase
            const _ppfs = await core.pricePerShare()
            expect(_ppfs.gt(ppfs)).to.be.true
            ppfs = _ppfs
        }
    })

    async function tradeWbtcxRen(wbtc) {
        let amount = await wbtc.balanceOf(alice)
        await wbtc.approve(renWbtcSwap.address, amount)
        await renWbtcSwap.exchange(1 /* wbtc */, 0 /* ren */, amount, 0)

        const ren = await ethers.getContractAt('IERC20', '0xeb4c2781e4eba804ce9a9803c67d0893436bb27d')
        amount = await ren.balanceOf(alice)
        await ren.approve(renWbtcSwap.address, amount)
        await renWbtcSwap.exchange(0, 1, amount, 0)
    }

    it('redeem in bcrvRenWBTC', async function() {
        await testRedeem(0, 'ren')
    });

    it('redeem in bcrvRenWSBTC', async function() {
        await testRedeem(1, 'sbtc')
    });

    it('redeem in b-tbtc/sbtcCrv', async function() {
        await testRedeem(2, 'tbtc')
    });

    it('redeem in saddleTWRenSBTC', async function() {
        // const bbtcAmount = (await saddleTWRenSBTC.balanceOf(saddlePeak.address))
        //     .mul(await saddleSwap.getVirtualPrice())
        //     .div(await core.pricePerShare())
        await testRedeemInCurveLP(0, await bBTC.balanceOf(alice), [ saddlePeak, saddleTWRenSBTC, saddleSwap ])
        expect((await saddleTWRenSBTC.balanceOf(saddlePeak.address)).lte(BigNumber.from(8))).to.be.true // dust
    });

    it('sanity checks', async function() {
        expect(await bBTC.balanceOf(alice)).to.eq(ZERO)
        expect(await bBTC.totalSupply()).to.eq(ZERO)
        expect(await bBTC.pricePerShare()).to.eq(_1e18)
        expect(await core.pricePerShare()).to.eq(_1e18)
        expect((await core.totalSystemAssets()).lte(BigNumber.from(8))).to.be.true // dust
        expect(await core.accumulatedFee()).to.eq(ZERO)
    })

    async function testMintWithCurveLP(poolId, amount, [ peak, curveLPToken, swap ]) {
        const [ virtualPrice, totalSupply, aliceBbtcBal, accumulatedFee ] = await Promise.all([
            swap.getVirtualPrice(),
            bBTC.totalSupply(),
            bBTC.balanceOf(alice),
            core.accumulatedFee()
        ])

        await curveLPToken.approve(peak.address, amount)
        await peak.mint(poolId, amount, [])

        let mintedBbtc = amount.mul(virtualPrice).div(_1e18)
        if (totalSupply.gt(ZERO)) {
            mintedBbtc = mintedBbtc
                .mul((await bBTC.totalSupply()).add(accumulatedFee))
                .div(await core.totalSystemAssets())
        }
        const fee = mintedBbtc.mul(mintAndRedeemFee).div(PRECISION)
        const aliceBbtc = mintedBbtc.sub(fee)

        await assertions(
            saddlePeak,
            curveLPToken,
            [
                ZERO, // curveLPToken.balanceOf(alice)
                aliceBbtcBal.add(aliceBbtc), // bBTC.balanceOf(alice)
                amount, // curveLPToken.balanceOf(peak.address)
                accumulatedFee.add(fee)
            ]
        )
    }

    async function testRedeemInCurveLP(poolId, amount, [ peak, curveLPToken, swap ]) {
        const [ virtualPrice, aliceBbtc, peakCrvLPBal, accumulatedFee ] = await Promise.all([
            swap.getVirtualPrice(),
            bBTC.balanceOf(alice),
            curveLPToken.balanceOf(peak.address),
            core.accumulatedFee(),
        ])
        const fee = amount.mul(mintAndRedeemFee).div(PRECISION)
        aliceCrvBal = amount.sub(fee)
            .mul(await core.pricePerShare())
            .div(virtualPrice)
        await peak.redeem(poolId, amount)

        await assertions(
            peak,
            curveLPToken,
            [
                aliceCrvBal, // curveLPToken.balanceOf(alice)
                aliceBbtc.sub(amount), // bBTC.balanceOf(alice)
                peakCrvLPBal.sub(aliceCrvBal), // curveLPToken.balanceOf(badgerPeak.address)
                accumulatedFee.add(fee) // core.accumulatedFee()
            ]
        )
    }

    async function testRedeem(poolId, pool) {
        const [ curveLPToken, swap, sett ] = await deployer.getPoolContracts(pool)
        const amount = (await sett.balanceOf(badgerPeak.address))
            .mul(await sett.getPricePerFullShare())
            .mul(await swap.get_virtual_price())
            .div(await core.pricePerShare())
            .div(_1e18)
            .add(1) // round-off nuance

        const [
            virtualPrice,
            ppfs,
            aliceBbtcBal,
            aliceCrvBal,
            peakCrvLPBal,
            accumulatedFee,
            calcRedeem
        ] = await Promise.all([
            swap.get_virtual_price(),
            sett.getPricePerFullShare(),
            bBTC.balanceOf(alice),
            curveLPToken.balanceOf(alice),
            curveLPToken.balanceOf(badgerPeak.address),
            core.accumulatedFee(),
            badgerPeak.calcRedeem(poolId, amount)
        ])
        const fee = amount.mul(mintAndRedeemFee).div(PRECISION)
        const expected = amount.sub(fee)
            .mul(await core.pricePerShare())
            .mul(_1e18)
            .div(ppfs)
            .div(virtualPrice)
        expect(calcRedeem.sett).to.eq(expected)

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
                ZERO, // sett.balanceOf(peak.address)
            ]
        )
    }

    async function testMint(poolId, amount, [ peak, curveLPToken, swap, sett ]) {
        const [
            ppfs,
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
            .mul(ppfs)
            .mul(virtualPrice)
            .div(_1e18.mul(_1e18))
        if (totalSupply.gt(ZERO)) {
            mintedBbtc = mintedBbtc
                .mul((await bBTC.totalSupply()).add(accumulatedFee))
                .div(await core.totalSystemAssets())
        }
        const fee = mintedBbtc.mul(mintAndRedeemFee).div(PRECISION)
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
        return expectedBbtc
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
