const fs = require('fs')

const crvPools = {
    ren: { // crvRenWBTC [ ren, wbtc ]
        swap: '0x93054188d876f558f4a66B2EF1d97d16eDf0895B',
        sett: '0x6dEf55d2e18486B9dDfaA075bc4e4EE0B28c1545'
    },
    sbtc: { // crvRenWSBTC [ ren, wbtc, sbtc ]
        swap: '0x7fC77b5c7614E1533320Ea6DDc2Eb61fa00A9714',
        sett: '0xd04c48A53c111300aD41190D63681ed3dAd998eC'
    },
    tbtc: { // tbtc/sbtcCrv [ tbtc, ren, wbtc, sbtc ]
        swap: '0xC25099792E9349C7DD09759744ea681C7de2cb66',
        sett: '0xb9D076fDe463dbc9f915E5392F807315Bf940334'
    }
}

async function main() {
    const [ UpgradableProxy, BadgerSettPeak, BadgerYearnWbtcPeak, Core, bBTC ] = await Promise.all([
        ethers.getContractFactory('UpgradableProxy'),
        ethers.getContractFactory('BadgerSettPeak'),
        ethers.getContractFactory('BadgerYearnWbtcPeak'),
        ethers.getContractFactory('Core'),
        ethers.getContractFactory('bBTC')
    ])

    let core = await UpgradableProxy.deploy()
    console.log({ core: core.address })

    const bBtc = await bBTC.deploy(core.address)
    console.log({ bBtc: bBtc.address })

    const coreImpl = await Core.deploy(bBtc.address)
    console.log({ coreImpl: coreImpl.address })
    await core.updateImplementation(coreImpl.address)
    core = await ethers.getContractAt('Core', core.address)

    let badgerPeak = await UpgradableProxy.deploy()
    console.log({ badgerPeak: badgerPeak.address })
    const badgerPeakImpl = await BadgerSettPeak.deploy(core.address)
    console.log({ badgerPeakImpl: badgerPeakImpl.address })
    await badgerPeak.updateImplementation(badgerPeakImpl.address)
    badgerPeak = await ethers.getContractAt('BadgerSettPeak', badgerPeak.address)

    const pools = Object.keys(crvPools).map(k => crvPools[k], ['swap', 'sett'])
    await badgerPeak.modifyWhitelistedCurvePools(pools)

    let byvWbtcPeak = await UpgradableProxy.deploy()
    console.log({ byvWbtcPeak: byvWbtcPeak.address })
    const byvWbtcPeakImpl = await BadgerYearnWbtcPeak.deploy(core.address, '0x4b92d19c11435614CD49Af1b589001b7c08cD4D5') // byvWbtc
    console.log({ byvWbtcPeakImpl: byvWbtcPeakImpl.address })
    await byvWbtcPeak.updateImplementation(byvWbtcPeakImpl.address)

    const feeSink = '0x5b5cF8620292249669e1DCC73B753d01543D6Ac7' // DFD Governance Multisig
    await core.setConfig(30 /* 0.3% */, 50 /* 0.5% */, feeSink)
    await core.whitelistPeak(badgerPeak.address)
    await core.whitelistPeak(byvWbtcPeak.address)

    const config = {
        badgerPeak: badgerPeak.address,
        byvWbtcPeak: byvWbtcPeak.address,
        bBtc: bBtc.address,
        core: core.address
    }
    fs.writeFileSync(
        `${process.cwd()}/deployments/mainnet.json`,
        JSON.stringify(config, null, 4) // Indent 4 spaces
    )
}

async function deployZap() {
    const [ TransparentUpgradeableProxy, Zap ] = await Promise.all([
        ethers.getContractFactory('TransparentUpgradeableProxy'),
        ethers.getContractFactory('Zap')
    ])
    // const zapImpl = await Zap.deploy()
    // console.log({ zapImpl: zapImpl.address })
    const zapImpl = await ethers.getContractAt('Zap', '0x4459A591c61CABd905EAb8486Bf628432b15C8b1')
    const args = [
        zapImpl.address,
        '0xBf0e27fdf5eF7519A9540DF401cCe0A7a4Cd75Bc', // proxyAdmin
        zapImpl.interface.encodeFunctionData('init', [ '0xCF7346A5E41b0821b80D5B3fdc385EEB6Dc59F44' /* ibbtc Metasig */ ])
    ]
    console.log(args)
    // const zap = await TransparentUpgradeableProxy.deploy(...args)
    // console.log({ zap: zap.address })
}

deployZap()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
