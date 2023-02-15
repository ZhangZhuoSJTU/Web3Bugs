const { expect } = require('chai')
const fs = require('fs')
const { BigNumber } = require('ethers')
const { ethers, network } = require('hardhat')

const ZERO = BigNumber.from(0)
const _1e6 = BigNumber.from(10).pow(6)
const _1e8 = BigNumber.from(10).pow(8)
const _1e12 = BigNumber.from(10).pow(12)
const _1e18 = ethers.constants.WeiPerEther

const DEFAULT_TRADE_FEE = 0.0005 * 1e6 /* 0.05% */
const gasLimit = 6e6

/**
 * signers global var should have been intialized before the call to this fn
 * @dev { nonce: nonce ? nonce++ : undefined, gasLimit } is a weird quirk that lets us use this script for both local testing and prod deployments
*/
async function setupContracts(options = {}) {
    options = Object.assign(
        {
            tradeFee: DEFAULT_TRADE_FEE,
            restrictedVUSD: true,
            governance: signers[0].address,
            setupAMM: true,
            testOracle: true,
            mockMarginAccount: false
        },
        options
    )
    ;({ governance, nonce } = options)

    ;([
        MarginAccountHelper,
        Registry,
        ERC20Mintable,
        AMM,
        MinimalForwarder,
        TransparentUpgradeableProxy,
        ProxyAdmin
    ] = await Promise.all([
        ethers.getContractFactory('MarginAccountHelper'),
        ethers.getContractFactory('Registry'),
        ethers.getContractFactory('ERC20Mintable'),
        ethers.getContractFactory('AMM'),
        ethers.getContractFactory('contracts/MinimalForwarder.sol:MinimalForwarder'),
        ethers.getContractFactory('TransparentUpgradeableProxy'),
        ethers.getContractFactory('ProxyAdmin')
    ]))

    ;([ proxyAdmin, forwarder, usdc ] = await Promise.all([
        ProxyAdmin.deploy({ nonce: nonce ? nonce++ : undefined, gasLimit }),
        MinimalForwarder.deploy({ nonce: nonce ? nonce++ : undefined, gasLimit }),
        ERC20Mintable.deploy('USD Coin', 'USDC', 6, { nonce: nonce ? nonce++ : undefined, gasLimit }),
    ]))
    vusd = await setupUpgradeableProxy(options.restrictedVUSD ? 'RestrictedVusd' : 'VUSD', proxyAdmin.address, [ governance ], [ usdc.address ])

    marginAccount = await setupUpgradeableProxy(
        `${options.mockMarginAccount ? 'Mock' : ''}MarginAccount`,
        proxyAdmin.address,
        [ governance, vusd.address ],
        [ forwarder.address ]
    )
    marginAccountHelper = await MarginAccountHelper.deploy(marginAccount.address, vusd.address, { nonce: nonce ? nonce++ : undefined, gasLimit })
    insuranceFund = await setupUpgradeableProxy('InsuranceFund', proxyAdmin.address, [ governance ])

    if (options.restrictedVUSD) {
        const transferRole = await vusd.TRANSFER_ROLE()
        await Promise.all([
            vusd.grantRole(transferRole, marginAccountHelper.address, { nonce: nonce ? nonce++ : undefined, gasLimit }),
            vusd.grantRole(transferRole, marginAccount.address, { nonce: nonce ? nonce++ : undefined, gasLimit }),
            vusd.grantRole(transferRole, insuranceFund.address, { nonce: nonce ? nonce++ : undefined, gasLimit })
        ])
    }

    oracle = await setupUpgradeableProxy(options.testOracle ? 'TestOracle' : 'Oracle', proxyAdmin.address, [ governance ])
    await oracle.setStablePrice(vusd.address, 1e6, { nonce: nonce ? nonce++ : undefined, gasLimit }) // $1

    clearingHouse = await setupUpgradeableProxy(
        'ClearingHouse',
        proxyAdmin.address,
        [
            governance,
            insuranceFund.address,
            marginAccount.address,
            vusd.address,
            0.1 * 1e6, // 10% maintenance margin, 10x
            0.2 * 1e6, // 20% minimum allowable margin, 5x
            options.tradeFee,
            0.05 * 1e6, // liquidationPenalty = 5%
        ],
        [ forwarder.address ]
    )
    await vusd.grantRole(await vusd.MINTER_ROLE(), marginAccount.address, { nonce: nonce ? nonce++ : undefined, gasLimit })
    registry = await Registry.deploy(oracle.address, clearingHouse.address, insuranceFund.address, marginAccount.address, vusd.address, { nonce: nonce ? nonce++ : undefined, gasLimit })
    await Promise.all([
        marginAccount.syncDeps(registry.address, 5e4, { nonce: nonce ? nonce++ : undefined, gasLimit }), // liquidationIncentive = 5% = .05 scaled 6 decimals
        insuranceFund.syncDeps(registry.address, { nonce: nonce ? nonce++ : undefined, gasLimit })
    ])
    const HubbleViewer = await ethers.getContractFactory('HubbleViewer')
    hubbleViewer = await HubbleViewer.deploy(clearingHouse.address, marginAccount.address, registry.address, { nonce: nonce ? nonce++ : undefined, gasLimit })

    // we will initialize the amm deps so that can be used as  global vars later
    let abiAndBytecode = fs.readFileSync('./contracts/curve-v2/CurveMath.txt').toString().split('\n').filter(Boolean)
    const CurveMath = new ethers.ContractFactory(JSON.parse(abiAndBytecode[0]), abiAndBytecode[1], signers[0])

    abiAndBytecode = fs.readFileSync('./contracts/curve-v2/Views.txt').toString().split('\n').filter(Boolean)
    const Views = new ethers.ContractFactory(JSON.parse(abiAndBytecode[0]), abiAndBytecode[1], signers[0])

    vammAbiAndBytecode = fs.readFileSync('./contracts/curve-v2/Swap.txt').toString().split('\n').filter(Boolean)
    Swap = new ethers.ContractFactory(JSON.parse(vammAbiAndBytecode[0]), vammAbiAndBytecode[1], signers[0])
    ;([ curveMath, vammImpl, ammImpl ] = await Promise.all([
        CurveMath.deploy({ nonce: nonce ? nonce++ : undefined, gasLimit }),
        Swap.deploy({ nonce: nonce ? nonce++ : undefined, gasLimit }),
        AMM.deploy({ nonce: nonce ? nonce++ : undefined, gasLimit })
    ]))
    views = await Views.deploy(curveMath.address, { nonce: nonce ? nonce++ : undefined, gasLimit })
    // amm deps complete

    const res = {
        registry,
        marginAccount,
        marginAccountHelper,
        clearingHouse,
        hubbleViewer,
        vusd,
        usdc,
        oracle,
        insuranceFund,
        forwarder,
        vammImpl: vammImpl,
        tradeFee: options.tradeFee
    }

    if (options.setupAMM) {
        weth = await setupRestrictedTestToken('Hubble Ether', 'hWETH', 18)
        ;({ amm, vamm } = await setupAmm(
            governance,
            [ registry.address, weth.address, 'ETH-PERP' ],
            options.amm
        ))
        Object.assign(res, { swap: vamm, amm, weth })
    }

    // console.log(await generateConfig(hubbleViewer.address))
    return res
}

async function setupUpgradeableProxy(contract, admin, initArgs, deployArgs = []) {
    const factory = await ethers.getContractFactory(contract)
    const impl = await factory.deploy(...deployArgs, { nonce: nonce ? nonce++ : undefined, gasLimit })
    const proxy = await TransparentUpgradeableProxy.deploy(
        impl.address,
        admin,
        initArgs
            ? impl.interface.encodeFunctionData(
                contract === 'VUSD' || contract === 'RestrictedVusd' ? 'init' : 'initialize',
                initArgs
            )
            : '0x',
        { nonce: nonce ? nonce++ : undefined, gasLimit }
    )
    return ethers.getContractAt(contract, proxy.address)
}

async function setupAmm(governance, args, options) {
    const { initialRate, initialLiquidity, fee, ammState } = Object.assign(
        {
            initialRate: 1000, // for ETH perp
            initialLiquidity: 1000, // 1000 eth
            fee: 10000000, // 0.1%
            ammState: 2, // Active
        },
        options
    )
    const vammProxy = await TransparentUpgradeableProxy.deploy(
        vammImpl.address,
        proxyAdmin.address,
        vammImpl.interface.encodeFunctionData('initialize', [
            governance, // owner
            curveMath.address, // math
            views.address, // views
            400000, // A
            '145000000000000', // gamma
            fee, 0, 0, 0, // mid_fee, out_fee, allowed_extra_profit, fee_gamma
            '146000000000000', // adjustment_step
            0, // admin_fee
            600, // ma_half_time
            _1e18.mul(initialRate)
        ]),
        { nonce: nonce ? nonce++ : undefined, gasLimit }
    )

    const vamm = new ethers.Contract(vammProxy.address, JSON.parse(vammAbiAndBytecode[0]), signers[0])
    const ammProxy = await TransparentUpgradeableProxy.deploy(
        ammImpl.address,
        proxyAdmin.address,
        ammImpl.interface.encodeFunctionData('initialize', args.concat([ vamm.address, governance ])),
        { nonce: nonce ? nonce++ : undefined, gasLimit }
    )
    const amm = await ethers.getContractAt('AMM', ammProxy.address)
    if (ammState) {
        await amm.setAmmState(ammState, { nonce: nonce ? nonce++ : undefined, gasLimit })
    }
    await vamm.setAMM(amm.address, { nonce: nonce ? nonce++ : undefined, gasLimit })

    const index = await clearingHouse.getAmmsLength()
    await clearingHouse.whitelistAmm(amm.address, { nonce: nonce ? nonce++ : undefined, gasLimit })

    if (initialLiquidity) {
        await addLiquidity(index, initialLiquidity, initialRate)
    }
    return { amm, vamm }
}

async function addLiquidity(index, initialLiquidity, rate) {
    maker = (await ethers.getSigners())[9]
    await addMargin(maker, _1e6.mul(initialLiquidity * rate * 2))
    await clearingHouse.connect(maker).addLiquidity(index, _1e18.mul(initialLiquidity), 0)
}

async function setupRestrictedTestToken(name, symbol, decimals) {
    const RestrictedErc20 = await ethers.getContractFactory('RestrictedErc20')
    const tok = await RestrictedErc20.deploy(name, symbol, decimals, { nonce: nonce ? nonce++ : undefined, gasLimit })
    // avoiding await tok.TRANSFER_ROLE(), because that reverts if the above tx hasn't confirmed
    await tok.grantRole(ethers.utils.id('TRANSFER_ROLE'), marginAccount.address, { nonce: nonce ? nonce++ : undefined, gasLimit })
    return tok
}

async function addMargin(trader, margin) {
    // omitting the nonce calculation here because this is only used in local
    await usdc.mint(trader.address, margin, { nonce: nonce ? nonce++ : undefined, gasLimit })
    await usdc.connect(trader).approve(marginAccountHelper.address, margin)
    await marginAccountHelper.connect(trader).addVUSDMarginWithReserve(margin)
}

async function generateConfig(hubbleViewerAddress) {
    const hubbleViewer = await ethers.getContractAt('HubbleViewer', hubbleViewerAddress)
    const clearingHouse = await ethers.getContractAt('ClearingHouse', await hubbleViewer.clearingHouse())
    const marginAccount = await ethers.getContractAt('MarginAccount', await hubbleViewer.marginAccount())

    const _amms = await clearingHouse.getAMMs()
    const amms = []
    for (let i = 0; i < _amms.length; i++) {
        const a = await ethers.getContractAt('AMM', _amms[i])
        amms.push({
            perp: await a.name(),
            address: a.address,
            underlying: await a.underlyingAsset()
        })
    }
    let _collateral = await marginAccount.supportedAssets()
    const collateral = []
    for (let i = 0; i < _collateral.length; i++) {
        const asset = await ethers.getContractAt('ERC20PresetMinterPauser', _collateral[i].token)
        collateral.push({
            name: await asset.name(),
            ticker: await asset.symbol(),
            decimals: await asset.decimals(),
            address: asset.address
        })
    }

    // to find the genesis block, we will get the block in which the first amm was whitelisted
    const marketAddedEvents = await clearingHouse.queryFilter('MarketAdded')
    const genesisBlock = marketAddedEvents[0].blockNumber
    return {
        genesisBlock,
        timestamp: (await ethers.provider.getBlock(genesisBlock)).timestamp,
        contracts: {
            ClearingHouse: clearingHouse.address,
            HubbleViewer: hubbleViewer.address,
            MarginAccount: marginAccount.address,
            Oracle: await marginAccount.oracle(),
            InsuranceFund: await marginAccount.insuranceFund(),
            Registry: await hubbleViewer.registry(),
            amms,
            collateral,
        },
        systemParams: {
            maintenanceMargin: (await clearingHouse.maintenanceMargin()).toString(),
            numCollateral: collateral.length
        }
    }
}

module.exports = {
    constants: { _1e6, _1e8, _1e12, _1e18, ZERO },
    BigNumber,
    setupContracts,
    setupUpgradeableProxy,
    setupAmm,
    setupRestrictedTestToken,
    generateConfig,
    addLiquidity,
    addMargin
}
