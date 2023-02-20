const { expect } = require("chai");

const deployer = require('../deployer')
const {
    constants: { _1e8, _1e18, ZERO },
    impersonateAccount
} = require('../utils');
const badgerMultiSig = '0xB65cef03b9B89f99517643226d76e286ee999e77'
const ibbtcMetaSig = '0xCF7346A5E41b0821b80D5B3fdc385EEB6Dc59F44'
const wBTCWhale = '0x28c6c06298d514db089934071355e5743bf21d60' // has 2k+ wbtc at block=12887317
const renBTCWhale = '0x4F868C1aa37fCf307ab38D215382e88FCA6275E2' // has 1k+ renbtc at block=12887317

describe('Zap (mainnet-fork)', function() {
    before('setup contracts', async function() {
        signers = await ethers.getSigners()
        alice = signers[0].address

        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
                    blockNumber: 12887417
                }
            }]
        })

        const config = require('../../deployments/mainnet.json')
        ;([ badgerPeak, wbtcPeak, bBTC, core, Zap ] = await Promise.all([
            ethers.getContractAt('BadgerSettPeak', config.badgerPeak),
            ethers.getContractAt('BadgerYearnWbtcPeak', config.byvWbtcPeak),
            ethers.getContractAt('bBTC', config.bBtc),
            ethers.getContractAt('Core', config.core),
            ethers.getContractFactory('Zap')
        ]))

        await impersonateAccount(ibbtcMetaSig)
        await web3.eth.sendTransaction({ from: alice, to: ibbtcMetaSig, value: _1e18 })

        if (process.env.DRYRUN === 'true') {
            zap = await ethers.getContractAt('Zap', config.zap)
        } else {
            const [ TransparentUpgradeableProxy, ProxyAdmin ] = await Promise.all([
                ethers.getContractFactory('TransparentUpgradeableProxy'),
                ethers.getContractFactory('ProxyAdmin')
            ])
            const [ zapImpl, proxyAdmin ] = await Promise.all([ Zap.deploy(), ProxyAdmin.deploy() ])
            zap = await TransparentUpgradeableProxy.deploy(
                zapImpl.address,
                proxyAdmin.address,
                zapImpl.interface.encodeFunctionData('init', [ alice /* governance */ ])
            )
            zap = await ethers.getContractAt('Zap', zap.address)

            // admin whitelists
            await impersonateAccount(badgerMultiSig)
            for (let i = 0; i < 3; i++) {
                const pool = await badgerPeak.pools(i)
                const sett = await ethers.getContractAt('ISett', pool.sett)
                await sett.connect(ethers.provider.getSigner(badgerMultiSig)).approveContractAccess(zap.address)
            }

            await badgerPeak.connect(ethers.provider.getSigner(ibbtcMetaSig)).approveContractAccess(zap.address)
            await wbtcPeak.connect(ethers.provider.getSigner(ibbtcMetaSig)).approveContractAccess(zap.address)
        }
    })

    it('mint with renbtc', async function() {
        let amount = _1e8.mul(9)
        ren = await deployer.getRenbtc(alice, amount, renBTCWhale)
        await ren.approve(zap.address, amount)

        amount = amount.div(3)

        const calcMint = await zap.calcMint(ren.address, amount)
        const calcMintWithRen = await zap.calcMintWithRen(amount)
        expect(calcMint).to.deep.eq(calcMintWithRen)
        // console.log(calcMint, calcMintWithRen)

        let prev = await bBTC.balanceOf(alice)
        await zap.mint(ren.address, amount, 0 /* crvRenWBTC */, 0 /* renbtc idx */, 0)
        let now = await bBTC.balanceOf(alice)
        let minted = parseFloat(now.sub(prev).toString()) / 1e18
        expect(minted > 2.9).to.be.true

        prev = now
        await zap.mint(ren.address, amount, 1 /* crvRenWSBTC */, 0 /* renbtc idx */, 0)
        now = await bBTC.balanceOf(alice)
        minted = parseFloat(now.sub(prev).toString()) / 1e18
        expect(minted > 2.9).to.be.true

        prev = now
        await zap.mint(ren.address, amount, 2 /* tbtc/sbtcCrv */, 1 /* renbtc idx */, 0)
        now = await bBTC.balanceOf(alice)
        minted = parseFloat(now.sub(prev).toString()) / 1e18
        expect(minted > 2.9).to.be.true

        const ibbtc = parseFloat(now.toString()) / 1e18
        expect(ibbtc > 8.9).to.be.true
    })

    it('mint with wbtc', async function() {
        let amount = _1e8.mul(12)
        wbtc = await deployer.getWbtc(alice, amount, wBTCWhale)
        await wbtc.approve(zap.address, amount)

        amount = amount.div(4)

        const calcMint = await zap.calcMint(wbtc.address, amount)
        const calcMintWithWbtc = await zap.calcMintWithWbtc(amount)
        expect(calcMint).to.deep.eq(calcMintWithWbtc)
        // console.log(calcMint, calcMintWithWbtc)

        let prev = await bBTC.balanceOf(alice)
        await zap.mint(wbtc.address, amount, 0 /* crvRenWBTC */, 1 /* wbtc idx */, 0)
        let now = await bBTC.balanceOf(alice)
        let minted = parseFloat(now.sub(prev).toString()) / 1e18
        expect(minted > 2.9).to.be.true

        prev = now
        await zap.mint(wbtc.address, amount, 1 /* crvRenWSBTC */, 1 /* wbtc idx */, 0)
        now = await bBTC.balanceOf(alice)
        minted = parseFloat(now.sub(prev).toString()) / 1e18
        expect(minted > 2.9).to.be.true

        prev = now
        await zap.mint(wbtc.address, amount, 2 /* tbtc/sbtcCrv */, 2 /* wbtc idx */, 0)
        now = await bBTC.balanceOf(alice)
        minted = parseFloat(now.sub(prev).toString()) / 1e18
        expect(minted > 2.9).to.be.true

        prev = now
        await zap.mint(wbtc.address, amount, 3 /* tbtcbyvWbtc */, 0 /* wbtc idx (redundant) */, 0)
        now = await bBTC.balanceOf(alice)
        minted = parseFloat(now.sub(prev).toString()) / 1e18
        expect(minted > 2.9).to.be.true

        const ibbtc = parseFloat((await bBTC.balanceOf(alice)).toString()) / 1e18
        expect(ibbtc > 17.8).to.be.true
    })

    it('zap.calcRedeem', async function() {
        amount = await bBTC.balanceOf(alice)

        let redeem = await zap.calcRedeem(ren.address, amount)
        console.log({ redeem })
        redeem = await zap.calcRedeem(wbtc.address, amount)
        console.log({ redeem })

        expect(await ren.balanceOf(alice)).to.eq(ZERO)
        expect(await wbtc.balanceOf(alice)).to.eq(ZERO)

        await bBTC.approve(zap.address, amount);
        amount = amount.div(7)
    })

    it('redeem from crvRenWBTC', async function() {
        const bcrvRenWBTC = await ethers.getContractAt('IERC20', deployer.crvPools.ren.sett)
        let _then = await Promise.all([
            bBTC.balanceOf(alice),
            ren.balanceOf(alice),
            bcrvRenWBTC.balanceOf(badgerPeak.address)
        ])

        await zap.redeem(ren.address, amount, 0, 0, 0);

        let _now = await Promise.all([
            bBTC.balanceOf(alice),
            ren.balanceOf(alice),
            bcrvRenWBTC.balanceOf(badgerPeak.address)
        ])
        assertions(_then, _now, amount)

        // wbtc
        _then = await Promise.all([
            bBTC.balanceOf(alice),
            wbtc.balanceOf(alice),
            bcrvRenWBTC.balanceOf(badgerPeak.address)
        ])

        await zap.redeem(wbtc.address, amount, 0, 1, 0);

        _now = await Promise.all([
            bBTC.balanceOf(alice),
            wbtc.balanceOf(alice),
            bcrvRenWBTC.balanceOf(badgerPeak.address)
        ])
        assertions(_then, _now, amount)
    })

    it('redeem from bcrvRenWSBTC', async function() {
        const bcrvRenWSBTC = await ethers.getContractAt('IERC20', deployer.crvPools.sbtc.sett)
        let _then = await Promise.all([
            bBTC.balanceOf(alice),
            ren.balanceOf(alice),
            bcrvRenWSBTC.balanceOf(badgerPeak.address)
        ])

        await zap.redeem(ren.address, amount, 1, 0, 0);

        let _now = await Promise.all([
            bBTC.balanceOf(alice),
            ren.balanceOf(alice),
            bcrvRenWSBTC.balanceOf(badgerPeak.address)
        ])
        assertions(_then, _now, amount)

        // wbtc
        _then = await Promise.all([
            bBTC.balanceOf(alice),
            wbtc.balanceOf(alice),
            bcrvRenWSBTC.balanceOf(badgerPeak.address)
        ])

        await zap.redeem(wbtc.address, amount, 1, 1, 0);

        _now = await Promise.all([
            bBTC.balanceOf(alice),
            wbtc.balanceOf(alice),
            bcrvRenWSBTC.balanceOf(badgerPeak.address)
        ])
        assertions(_then, _now, amount)
    })

    it('redeem from btbtc_sbtcCrv', async function() {
        const btbtc_sbtcCrv = await ethers.getContractAt('IERC20', deployer.crvPools.tbtc.sett)
        let _then = await Promise.all([
            bBTC.balanceOf(alice),
            ren.balanceOf(alice),
            btbtc_sbtcCrv.balanceOf(badgerPeak.address)
        ])

        await zap.redeem(ren.address, amount, 2, 1, 0);

        let _now = await Promise.all([
            bBTC.balanceOf(alice),
            ren.balanceOf(alice),
            btbtc_sbtcCrv.balanceOf(badgerPeak.address)
        ])
        assertions(_then, _now, amount)

        // wbtc
        _then = await Promise.all([
            bBTC.balanceOf(alice),
            wbtc.balanceOf(alice),
            btbtc_sbtcCrv.balanceOf(badgerPeak.address)
        ])

        await zap.redeem(wbtc.address, amount, 2, 2, 0);

        _now = await Promise.all([
            bBTC.balanceOf(alice),
            wbtc.balanceOf(alice),
            btbtc_sbtcCrv.balanceOf(badgerPeak.address)
        ])
        assertions(_then, _now, amount)
    })

    it('redeem from byvwbtc', async function() {
        const byvWbtc = await ethers.getContractAt('IERC20', '0x4b92d19c11435614CD49Af1b589001b7c08cD4D5')
        let _then = await Promise.all([
            bBTC.balanceOf(alice),
            wbtc.balanceOf(alice),
            byvWbtc.balanceOf(wbtcPeak.address)
        ])

        await zap.redeem(wbtc.address, amount, 3, -1 /* redundant */, 0);

        let _now = await Promise.all([
            bBTC.balanceOf(alice),
            wbtc.balanceOf(alice),
            byvWbtc.balanceOf(wbtcPeak.address)
        ])
        assertions(_then, _now, amount)
    })

    function assertions(_then, _now, amount) {
        expect(_now[0]).to.eq(_then[0].sub(amount))
        expect(_now[1].gt(_then[1])).to.be.true
        expect(_now[2].lt(_then[2])).to.be.true
    }

    it('approveContractAccess', async function() {
        const ZapCall = await ethers.getContractFactory('ZapCall')
        const zapCall = await ZapCall.deploy()
        let amount = _1e8.mul(5)
        const wbtc = await deployer.getWbtc(zapCall.address, amount, wBTCWhale)

        await expect(zapCall.mint(wbtc.address, zap.address)).to.be.revertedWith('ACCESS_DENIED')

        if (process.env.DRYRUN === 'true') {
            await zap.connect(ethers.provider.getSigner(ibbtcMetaSig)).approveContractAccess(zapCall.address)
        } else {
            await zap.approveContractAccess(zapCall.address)
        }

        await zapCall.mint(wbtc.address, zap.address)

        const ibbtc = parseFloat((await bBTC.balanceOf(zapCall.address)).toString()) / 1e18
        expect(ibbtc > 4.9).to.be.true
    })
})
