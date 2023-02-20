const fs = require('fs')

async function main() {
    const [ UpgradableProxy, BadgerSettPeak, BadgerYearnWbtcPeak, Core, bBTC, CurveLPToken, Swap, Sett, ByvWbtc ] = await Promise.all([
        ethers.getContractFactory("UpgradableProxy"),
        ethers.getContractFactory("BadgerSettPeak"),
        ethers.getContractFactory("BadgerYearnWbtcPeak"),
        ethers.getContractFactory("Core"),
        ethers.getContractFactory("bBTC"),
        ethers.getContractFactory("CurveLPToken"),
        ethers.getContractFactory("Swap"),
        ethers.getContractFactory("Sett"),
        ethers.getContractFactory("byvWbtc")
    ])
    let core = await UpgradableProxy.deploy()
    const pools = await Promise.all([
        CurveLPToken.deploy(),
        CurveLPToken.deploy(),
        CurveLPToken.deploy()
    ])
    const signers = await ethers.getSigners()
    const alice = signers[0].address
    const amount = ethers.constants.WeiPerEther.mul(1000)
    const setts = []
    for (let i = 0; i < pools.length; i++) {
        const p = pools[i]
        const sett = await Sett.deploy(p.address)
        await p.mint(alice, amount)
        await p.approve(sett.address, amount)
        await sett.deposit(amount)
        setts.push(sett)
    }
    const [ bBtc, swap ] = await Promise.all([
        bBTC.deploy(core.address),
        Swap.deploy(),
    ])
    await core.updateImplementation((await Core.deploy(bBtc.address)).address)
    core = await ethers.getContractAt('Core', core.address)

    let badgerPeak = await UpgradableProxy.deploy()
    await badgerPeak.updateImplementation((await BadgerSettPeak.deploy(core.address)).address)
    badgerPeak = await ethers.getContractAt('BadgerSettPeak', badgerPeak.address)

    const byvWbtc = await ByvWbtc.deploy()
    await byvWbtc.mint(alice, 1e11) // 1000 * 1e8
    let byvWbtcPeak = await UpgradableProxy.deploy()
    await byvWbtcPeak.updateImplementation((await BadgerYearnWbtcPeak.deploy(core.address, byvWbtc.address)).address)
    byvWbtcPeak = await ethers.getContractAt('BadgerYearnWbtcPeak', byvWbtcPeak.address)

    const feeSink = signers[9].address
    await Promise.all([
        core.setConfig(10, 10, feeSink),
        core.whitelistPeak(badgerPeak.address),
        core.whitelistPeak(byvWbtcPeak.address),
        badgerPeak.modifyWhitelistedCurvePools(pools.map((_, i) => {
            return { lpToken: pools[i].address, swap: swap.address, sett: setts[i].address }
        }))
    ])
    const config = {
        BadgerPeak: badgerPeak.address,
        bcrvRenWSBTC: setts[0].address,
        bcrvRenWBTC: setts[1].address,
        btbtc_sbtcCrv: setts[2].address,
        byvWbtcPeak: byvWbtcPeak.address,
        byvWbtc: byvWbtc.address,
        bBtc: bBtc.address
    }
    fs.writeFileSync(
        `${process.cwd()}/deployments/local.json`,
        JSON.stringify(config, null, 4) // Indent 4 spaces
    )
}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
