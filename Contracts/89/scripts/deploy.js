const util = require('util')

const utils = require('./utils')

const {
    constants: { _1e6, _1e18 },
    BigNumber,
    setupContracts,
    setupRestrictedTestToken,
    generateConfig,
} = utils
const _1e8 = BigNumber.from(10).pow(8)

/**
 * After deployment
 * maker1 - signers[9]
 * maker2 - signers[8]
 * governance - signers[0]
 * signers[1], signers[2] have 1000 vUSD and 200 avax each
 */

async function main() {
    signers = await ethers.getSigners()

    await setupContracts()

    // provide some vusd to signers[1], signers[2]
    const initialVusdAmount = _1e6.mul(1000)
    await addVUSDWithReserve(signers[1], initialVusdAmount)
    await addVUSDWithReserve(signers[2], initialVusdAmount)

    // whitelist avax as collateral
    const avax = await setupRestrictedTestToken('Avalanche', 'AVAX', 8)
    await oracle.setStablePrice(avax.address, 100e8) // $100
    await marginAccount.whitelistCollateral(avax.address, 8e5) // weight = 0.8e6
    await avax.mint(signers[1].address, _1e8.mul(200)) // 200 avax
    await avax.mint(signers[2].address, _1e8.mul(200)) // 200 avax

    // setup another market
    const btc = await setupRestrictedTestToken('Bitcoin', 'BTC', 8)
    await utils.setupAmm(
        governance,
        [ registry.address, btc.address, 'BTC-PERP' ],
        50000, // initialRate => btc = $50000
        25, // initialLiquidity = 25 btc
        false, // isPause
        1 // index
    )

    // maker2 adds liquidity
    await utils.addMargin(signers[8], _1e6.mul(4.1e5))
    await clearingHouse.connect(signers[8]).addLiquidity(0, _1e18.mul(500), 0)
    await clearingHouse.connect(signers[8]).addLiquidity(1, _1e18.mul(10), 0)

    console.log(util.inspect(await generateConfig(hubbleViewer.address), { depth: null }))

    async function addVUSDWithReserve(trader, amount) {
        await usdc.mint(trader.address, amount)
        await usdc.connect(trader).approve(vusd.address, amount)
        await vusd.connect(trader).mintWithReserve(trader.address, amount)
    }
}

main()
.then(() => process.exit(0))
.catch(error => {
    console.error(error);
    process.exit(1);
});
