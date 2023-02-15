const deployer = require('../deployer')

const {
    constants: { _1e8, _1e18, ZERO },
    impersonateAccount
} = require('../utils');

const badgerMultiSig = '0xB65cef03b9B89f99517643226d76e286ee999e77'
const badgerMultiSigner = ethers.provider.getSigner(badgerMultiSig)
const ibbtcMetaSig = '0xCF7346A5E41b0821b80D5B3fdc385EEB6Dc59F44'

describe.only('rebalance', function() {
    before('setup contracts', async function() {
        signers = await ethers.getSigners()
        alice = signers[0].address

        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
                    blockNumber: 13040510
                }
            }]
        })
        const Rebalance = await ethers.getContractFactory('Rebalance')
        rebalance = await Rebalance.deploy()

        const config = require('../../deployments/mainnet.json')
        ;([ badgerPeak, wbtcPeak, Zap, proxyAdmin ] = await Promise.all([
            ethers.getContractAt('BadgerSettPeak', config.badgerPeak),
            ethers.getContractAt('BadgerSettPeak', config.byvWbtcPeak),
            ethers.getContractFactory('Zap'),
            ethers.getContractAt('ProxyAdmin', config.proxyAdmin),
        ]))

        await impersonateAccount(ibbtcMetaSig)
        await web3.eth.sendTransaction({ from: alice, to: ibbtcMetaSig, value: _1e18.mul(3) })
        await badgerPeak.connect(ethers.provider.getSigner(ibbtcMetaSig)).approveContractAccess(rebalance.address)
        await wbtcPeak.connect(ethers.provider.getSigner(ibbtcMetaSig)).approveContractAccess(rebalance.address)

        const newZapImpl = await Zap.deploy()
        await proxyAdmin.connect(ethers.provider.getSigner(ibbtcMetaSig)).upgrade(config.zap, newZapImpl.address)
        zap = await ethers.getContractAt('Zap', config.zap)
        await zap.connect(ethers.provider.getSigner(ibbtcMetaSig)).approveContractAccess(rebalance.address)

        await impersonateAccount(badgerMultiSig)
        await web3.eth.sendTransaction({ from: alice, to: badgerMultiSig, value: _1e18.mul(3) })
        for (let i = 0; i < 3; i++) {
            const pool = await badgerPeak.pools(i)
            const sett = await ethers.getContractAt('ISett', pool.sett)
            await sett.connect(badgerMultiSigner).approveContractAccess(rebalance.address)
        }

        ;([ wbtc, bBTC, crvRenWBTC, crvRenWSBTC, bcrvRenWBTC, bcrvRenWSBTC, btbtc, byvwbtc ] = await Promise.all([
            ethers.getContractAt('IERC20', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'),
            ethers.getContractAt('bBTC', config.bBtc),
            ethers.getContractAt('IERC20', deployer.crvPools.ren.lpToken),
            ethers.getContractAt('IERC20', deployer.crvPools.sbtc.lpToken),
            ethers.getContractAt('IERC20', deployer.crvPools.ren.sett),
            ethers.getContractAt('IERC20', deployer.crvPools.sbtc.sett),
            ethers.getContractAt('IERC20', deployer.crvPools.tbtc.sett),
            ethers.getContractAt('IERC20', '0x4b92d19c11435614CD49Af1b589001b7c08cD4D5'), // byvwbtc
        ]))
    })

    it('cycle', async function() {
        await Promise.all([
            wbtc.connect(badgerMultiSigner).approve(rebalance.address, ethers.constants.MaxUint256),
            crvRenWBTC.connect(badgerMultiSigner).approve(rebalance.address, ethers.constants.MaxUint256),
            crvRenWSBTC.connect(badgerMultiSigner).approve(rebalance.address, ethers.constants.MaxUint256)
        ])
        await printMultisigBalances() // { crvRenWBTC: 105.01, crvRenWSBTC: 57.76, wbtc: 7.6 }
        await printComposition() // percentages: [ 4.478384934393702, 0.37264967364677587, 0.006381069436712366, 95.14258432252282]

        await rebalance.connect(badgerMultiSigner).cycleWithSett(0, await crvRenWBTC.balanceOf(badgerMultiSig)) // 105.01
        await rebalance.connect(badgerMultiSigner).cycleWithSett(1, await crvRenWSBTC.balanceOf(badgerMultiSig)) // 57.76
        await rebalance.connect(badgerMultiSigner).cycleWithWbtc(0, 1, _1e8.mul(150))
        await rebalance.connect(badgerMultiSigner).cycleWithWbtc(0, 1, _1e8.mul(150))
        await rebalance.connect(badgerMultiSigner).cycleWithWbtc(1, 1, _1e8.mul(158))

        await printComposition() // percentages: [ 60.13715002870447, 30.13228728679639, 0.006456731102912498, 9.724105953396219 ]
        await printMultisigBalances() // { crvRenWBTC: 0, crvRenWSBTC: 0, wbtc: 170.692035 }
    })

    async function printComposition() {
        let bals = (await Promise.all([
            bcrvRenWBTC.balanceOf(badgerPeak.address),
            bcrvRenWSBTC.balanceOf(badgerPeak.address),
            btbtc.balanceOf(badgerPeak.address),
        ])).map(b => parseFloat(web3.utils.fromWei(b.toString())))
        const _byvWbtc = (await byvwbtc.balanceOf(wbtcPeak.address)).toNumber() / 1e8
        bals = bals.concat(_byvWbtc)
        const total = bals.reduce((a, b) => a + b)
        console.log({
            balances: bals,
            percentages: bals.map(b => b * 100 / total)
        })
    }

    async function printMultisigBalances() {
        console.log({
            crvRenWBTC: parseFloat(web3.utils.fromWei((await crvRenWBTC.balanceOf(badgerMultiSig)).toString())),
            crvRenWSBTC: parseFloat(web3.utils.fromWei((await crvRenWSBTC.balanceOf(badgerMultiSig)).toString())),
            wbtc: (await wbtc.balanceOf(badgerMultiSig)).toNumber() / 1e8
        })
    }
})
