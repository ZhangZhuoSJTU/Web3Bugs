/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AnyswapFacet,
  DexManagerFacet,
  IERC20,
  IERC20__factory,
} from '../../typechain'
import { deployments, network } from 'hardhat'
import { constants, utils } from 'ethers'
import { node_url } from '../../utils/network'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers'
import { expect } from '../chai-setup'

const ANYSWAP_ROUTER = '0x4f3aff3a747fcade12598081e80c6605a8be192f'
const USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
const MATIC_ROUTER = '0x2ef4a574b72e1f555185afa8a09c6d1a8ac4025c'
const anyMATIC_ADDRESS = '0x21804205c744dd98fbc87898704564d5094bb167'
const anyUSDT_ADDRESS = '0xE3eeDa11f06a656FcAee19de663E84C7e61d3Cac'
const UNISWAP_ADDRESS = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'
const BEEFY_ADDRESS = '0xFbdd194376de19a88118e84E279b977f165d01b8'
const BEEFY_ROUTER = '0x6fF0609046A38D76Bd40C5863b4D1a2dCe687f73'

describe('AnyswapFacet', function () {
  let lifi: AnyswapFacet
  let dexMgr: DexManagerFacet
  let alice: SignerWithAddress
  let beefHolder: SignerWithAddress
  let lifiData: any
  let token: IERC20
  let usdt: IERC20
  let wmatic: IERC20

  const setupTest = deployments.createFixture(
    async ({ deployments, ethers }) => {
      await deployments.fixture('DeployAnyswapFacet')
      const diamond = await ethers.getContract('LiFiDiamond')
      lifi = <AnyswapFacet>(
        await ethers.getContractAt('AnyswapFacet', diamond.address)
      )
      dexMgr = <DexManagerFacet>(
        await ethers.getContractAt('DexManagerFacet', diamond.address)
      )
      await dexMgr.addDex(UNISWAP_ADDRESS)

      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: ['0x6722846282868a9c084b423aee79eb8ff69fc497'],
      })

      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: ['0xf71b335a1d9449c381d867f4172fc1bb3d2bfb7b'],
      })

      alice = await ethers.getSigner(
        '0x6722846282868a9c084b423aee79eb8ff69fc497'
      )

      beefHolder = await ethers.getSigner(
        '0xf71b335a1d9449c381d867f4172fc1bb3d2bfb7b'
      )

      wmatic = IERC20__factory.connect(WMATIC_ADDRESS, alice)

      usdt = IERC20__factory.connect(USDT_ADDRESS, alice)
      lifiData = {
        transactionId: utils.randomBytes(32),
        integrator: 'ACME Devs',
        referrer: constants.AddressZero,
        sendingAssetId: usdt.address,
        receivingAssetId: usdt.address,
        receiver: alice.address,
        destinationChainId: 100,
        amount: utils.parseUnits('1000', 6),
      }
      token = IERC20__factory.connect(anyUSDT_ADDRESS, alice)
      await usdt.approve(lifi.address, utils.parseUnits('1000', 6))
    }
  )

  before(async function () {
    this.timeout(0)
    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: node_url('polygon'),
            blockNumber: 25689963,
          },
        },
      ],
    })
  })

  beforeEach(async () => {
    await setupTest()
  })

  it('starts a bridge transaction using native token on the sending chain', async () => {
    const AnyswapData = {
      token: anyMATIC_ADDRESS,
      router: MATIC_ROUTER,
      amount: utils.parseEther('1000'),
      recipient: alice.address,
      toChainId: 100,
    }

    await lifi
      .connect(alice)
      .startBridgeTokensViaAnyswap(lifiData, AnyswapData, {
        gasLimit: 500000,
        value: utils.parseEther('1000'),
      })
  })

  it('starts a bridge transaction using anyToken implementation on the sending chain', async () => {
    const beefy = IERC20__factory.connect(BEEFY_ADDRESS, beefHolder)
    await beefy.approve(lifi.address, utils.parseEther('10'))

    const AnyswapData = {
      token: BEEFY_ADDRESS,
      router: BEEFY_ROUTER,
      amount: utils.parseEther('10'),
      recipient: beefHolder.address,
      toChainId: 100,
    }

    await lifi
      .connect(beefHolder)
      .startBridgeTokensViaAnyswap(lifiData, AnyswapData, {
        gasLimit: 500000,
      })
  })

  it('starts a bridge transaction on the sending chain', async () => {
    const AnyswapData = {
      token: token.address,
      router: ANYSWAP_ROUTER,
      amount: utils.parseUnits('1000', 6),
      recipient: alice.address,
      toChainId: 100,
    }

    await lifi
      .connect(alice)
      .startBridgeTokensViaAnyswap(lifiData, AnyswapData, {
        gasLimit: 500000,
      })
  })

  it('performs a swap then starts bridge transaction on the sending chain', async () => {
    const to = lifi.address // should be a checksummed recipient address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time

    const iface = new utils.Interface([
      'function swapETHForExactTokens(uint,address[],address,uint256)',
    ])

    // Generate swap calldata
    const uniswapData = iface.encodeFunctionData('swapETHForExactTokens', [
      utils.parseUnits('1000', 6),
      [wmatic.address, usdt.address],
      to,
      deadline,
    ])

    const swapData = [
      {
        callTo: UNISWAP_ADDRESS,
        approveTo: UNISWAP_ADDRESS,
        sendingAssetId: '0x0000000000000000000000000000000000000000',
        receivingAssetId: usdt.address,
        fromAmount: utils.parseEther('700'),
        callData: uniswapData,
      },
    ]

    const AnyswapData = {
      token: token.address,
      router: ANYSWAP_ROUTER,
      amount: utils.parseUnits('1000', 6),
      recipient: alice.address,
      toChainId: 137,
    }

    await lifi
      .connect(alice)
      .swapAndStartBridgeTokensViaAnyswap(lifiData, swapData, AnyswapData, {
        gasLimit: 500000,
        value: utils.parseEther('700'),
      })
  })

  it('fails to perform a swap when the dex is not approved', async () => {
    await dexMgr.removeDex(UNISWAP_ADDRESS)
    const to = lifi.address // should be a checksummed recipient address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time

    const iface = new utils.Interface([
      'function swapETHForExactTokens(uint,address[],address,uint256)',
    ])

    // Generate swap calldata
    const uniswapData = iface.encodeFunctionData('swapETHForExactTokens', [
      utils.parseUnits('1000', 6),
      [wmatic.address, usdt.address],
      to,
      deadline,
    ])

    const swapData = [
      {
        callTo: UNISWAP_ADDRESS,
        approveTo: UNISWAP_ADDRESS,
        sendingAssetId: '0x0000000000000000000000000000000000000000',
        receivingAssetId: usdt.address,
        fromAmount: utils.parseEther('700'),
        callData: uniswapData,
      },
    ]

    const AnyswapData = {
      token: token.address,
      router: ANYSWAP_ROUTER,
      amount: utils.parseUnits('1000', 6),
      recipient: alice.address,
      toChainId: 137,
    }

    await expect(
      lifi
        .connect(alice)
        .swapAndStartBridgeTokensViaAnyswap(lifiData, swapData, AnyswapData, {
          gasLimit: 500000,
          value: utils.parseEther('700'),
        })
    ).to.be.revertedWith('Contract call not allowed!')
  })
})
