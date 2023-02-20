const { expect } = require("chai");
const { BigNumber } = ethers

const { impersonateAccount } = require('./utils');

const wBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
const wBTCWhale = '0x875abe6f1e2aba07bed4a3234d8555a0d7656d12' // has 150 wbtc

const renBTC = '0xeb4c2781e4eba804ce9a9803c67d0893436bb27d'
const renBTCWhale = '0xaae0633e15200bc9c50d45cd762477d268e126bd' // has 1293 renbtc at block=12495130

const deployer = '0x08f7506e0381f387e901c9d0552cf4052a0740a4'

const crvPools = {
    ren: {
        lpToken: '0x49849C98ae39Fff122806C06791Fa73784FB3675', // crvRenWBTC [ ren, wbtc ]
        swap: '0x93054188d876f558f4a66B2EF1d97d16eDf0895B',
        sett: '0x6dEf55d2e18486B9dDfaA075bc4e4EE0B28c1545'
    },
    sbtc: {
        lpToken: '0x075b1bb99792c9E1041bA13afEf80C91a1e70fB3', // crvRenWSBTC [ ren, wbtc, sbtc ]
        swap: '0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714',
        sett: '0xd04c48A53c111300aD41190D63681ed3dAd998eC'
    },
    tbtc: {
        lpToken: '0x64eda51d3Ad40D56b9dFc5554E06F94e1Dd786Fd', // tbtc/sbtcCrv [ tbtc, ren, wbtc, sbtc ]
        swap: '0xC25099792E9349C7DD09759744ea681C7de2cb66',
        sett: '0xb9D076fDe463dbc9f915E5392F807315Bf940334'
    }
}

async function setupMainnetContracts(feeSink, blockNumber = 12342315) {
    await network.provider.request({
        method: "hardhat_reset",
        params: [{
            forking: {
                jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
                blockNumber // having a consistent block number speeds up the tests across runs
            }
        }]
    })
    await impersonateAccount(wBTCWhale)

    if (process.env.DRYRUN === 'true') {
        const config = require('../deployments/mainnet.json')

        const alice = (await ethers.getSigners())[0].address
        await impersonateAccount(deployer);
        (await Promise.all([
            ethers.getContractAt('UpgradableProxy', config.core),
            ethers.getContractAt('UpgradableProxy', config.badgerPeak),
            ethers.getContractAt('UpgradableProxy', config.byvWbtcPeak)
        ])).map(async c => await c.connect(ethers.provider.getSigner(deployer)).transferOwnership(alice))

        return {
            badgerPeak: await ethers.getContractAt('BadgerSettPeak', config.badgerPeak),
            wbtcPeak: await ethers.getContractAt('BadgerYearnWbtcPeak', config.byvWbtcPeak),
            byvWBTC: await ethers.getContractAt('IbyvWbtc', config.byvWbtc),
            bBTC: await ethers.getContractAt('bBTC', config.bBtc),
            core: await ethers.getContractAt('Core', config.core)
        }
    } else {
        const [ UpgradableProxy, BadgerSettPeak, BadgerYearnWbtcPeak, Core, BBTC ] = await Promise.all([
            ethers.getContractFactory('UpgradableProxy'),
            ethers.getContractFactory('BadgerSettPeak'),
            ethers.getContractFactory('BadgerYearnWbtcPeak'),
            ethers.getContractFactory('Core'),
            ethers.getContractFactory('bBTC')
        ])
        let [ core, badgerPeak, wbtcPeak ] = await Promise.all([
            UpgradableProxy.deploy(),
            UpgradableProxy.deploy(),
            UpgradableProxy.deploy()
        ])
        const bBTC = await BBTC.deploy(core.address)
        await core.updateImplementation((await Core.deploy(bBTC.address)).address)

        await badgerPeak.updateImplementation((await BadgerSettPeak.deploy(core.address)).address)

        const byvWBTC = await ethers.getContractAt('IbyvWbtc', '0x4b92d19c11435614CD49Af1b589001b7c08cD4D5')
        await wbtcPeak.updateImplementation((await BadgerYearnWbtcPeak.deploy(core.address, byvWBTC.address)).address)

        ;([ core, badgerPeak, wbtcPeak ] = await Promise.all([
            ethers.getContractAt('Core', core.address),
            ethers.getContractAt('BadgerSettPeak', badgerPeak.address),
            ethers.getContractAt('BadgerYearnWbtcPeak', wbtcPeak.address),
        ]))
        await core.setConfig(10, 10, feeSink)
        await core.whitelistPeak(badgerPeak.address)
        await core.whitelistPeak(wbtcPeak.address)
        return { badgerPeak, wbtcPeak, byvWBTC, bBTC, core }
    }
}

async function getPoolContracts(pool) {
    return Promise.all([
        ethers.getContractAt('CurveLPToken', crvPools[pool].lpToken),
        ethers.getContractAt('ISwap', crvPools[pool].swap),
        ethers.getContractAt('ISett', crvPools[pool].sett)
    ])
}

async function mintCrvPoolToken(pool, account, a) {
    const [ _wBTC, _lpToken ] = await Promise.all([
        ethers.getContractAt('IERC20', wBTC),
        ethers.getContractAt('IERC20', crvPools[pool].lpToken)
    ])
    BigNumber.from(150).mul(1e8)
    const amount = BigNumber.from(15).mul(1e8) // wbtc has 8 decimals and whale has 150 wbtc
    let _deposit, _amounts
    switch (pool) {
        case 'ren':
            _deposit = await ethers.getContractAt('renDeposit', crvPools.ren.swap)
            _amounts = [0, amount] // [ ren, wbtc ]
            break
        case 'sbtc':
            _deposit = await ethers.getContractAt('sbtcDeposit', crvPools.sbtc.swap)
            _amounts = [0, amount, 0] // [ ren, wbtc, sbtc ]
            break
        case 'tbtc':
            _deposit = await ethers.getContractAt('tbtcDeposit', '0xaa82ca713D94bBA7A89CEAB55314F9EfFEdDc78c')
            _amounts = [0, 0, amount, 0] // [ tbtc, ren, wbtc, sbtc ]
    }
    const signer = ethers.provider.getSigner(wBTCWhale)
    await _wBTC.connect(signer).approve(_deposit.address, amount)
    await _deposit.connect(signer).add_liquidity(_amounts, 0)
    await _lpToken.connect(signer).transfer(account, a)
}

async function getWbtc(account, amount, whale = wBTCWhale) {
    await impersonateAccount(whale)
    const _wBTC = await ethers.getContractAt('IERC20', wBTC)
    await _wBTC.connect(ethers.provider.getSigner(whale)).transfer(account, amount)
    return _wBTC
}

async function getRenbtc(account, amount, whale = renBTCWhale) {
    await impersonateAccount(whale)
    const _ren = await ethers.getContractAt('IERC20', renBTC)
    await _ren.connect(ethers.provider.getSigner(whale)).transfer(account, amount)
    return _ren
}

async function setupContracts(feeSink) {
    const [ UpgradableProxy, BadgerSettPeak, Core, BBTC, CurveLPToken, Swap, Sett ] = await Promise.all([
        ethers.getContractFactory("UpgradableProxy"),
        ethers.getContractFactory("BadgerSettPeak"),
        ethers.getContractFactory("Core"),
        ethers.getContractFactory("bBTC"),
        ethers.getContractFactory("CurveLPToken"),
        ethers.getContractFactory("Swap"),
        ethers.getContractFactory("Sett")
    ])
    let core = await UpgradableProxy.deploy()
    const [ bBTC, curveLPToken, swap ] = await Promise.all([
        BBTC.deploy(core.address),
        CurveLPToken.deploy(),
        Swap.deploy(),
    ])
    await core.updateImplementation((await Core.deploy(bBTC.address)).address)
    core = await ethers.getContractAt('Core', core.address)

    let badgerPeak = await UpgradableProxy.deploy()

    const impl = await BadgerSettPeak.deploy(core.address, { gasLimit: 5000000 })
    await badgerPeak.updateImplementation(impl.address)
    badgerPeak = await ethers.getContractAt('BadgerSettPeak', badgerPeak.address)

    const sett = await Sett.deploy(curveLPToken.address)
    expect(await core.peaks(badgerPeak.address)).to.eq(0) // Extinct
    await Promise.all([
        core.whitelistPeak(badgerPeak.address),
        core.setConfig(10, 10, feeSink), // 0.1% fee
        badgerPeak.modifyWhitelistedCurvePools([{ swap: swap.address, sett: sett.address }])
    ])
    expect(await core.peaks(badgerPeak.address)).to.eq(1) // Active
    return { badgerPeak, curveLPToken, bBTC, sett, swap, core }
}

module.exports = {
    setupContracts,
    setupMainnetContracts,
    getPoolContracts,
    mintCrvPoolToken,
    getWbtc,
    getRenbtc,
    crvPools
}
