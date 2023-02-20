import { DexManagerFacet, IERC20__factory, NXTPFacet } from '../../typechain'
import { expect } from '../chai-setup'
import { deployments, network } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers'
import { utils } from 'ethers'
import { paraswapNXTPData } from '../fixtures/nxtp'
import { node_url } from '../../utils/network'
import config from '../../config/nxtp'
import { addOrReplaceFacets } from '../../utils/diamond'

describe('NXTPFacet (Paraswap)', function () {
  const USDC_ADDRESS = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'

  let alice: SignerWithAddress
  let lifi: NXTPFacet
  let dexMgr: DexManagerFacet

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lifiData: any

  const setupTest = deployments.createFixture(
    async ({ deployments, ethers, getUnnamedAccounts }) => {
      // setup wallet
      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: ['0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0'],
      })
      alice = await ethers.getSigner(
        '0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0'
      )

      // setup contract
      const TX_MGR_ADDR = config['polygon'].txManagerAddress

      const [deployer] = await getUnnamedAccounts()

      await deployments.fixture(['InitFacets', 'DeployDexManagerFacet'])

      await deployments.deploy('NXTPFacet', {
        from: deployer,
        log: true,
        deterministicDeployment: false,
      })

      const nxtpFacet = await ethers.getContract('NXTPFacet')
      const diamond = await ethers.getContract('LiFiDiamond')

      dexMgr = <DexManagerFacet>(
        await ethers.getContractAt('DexManagerFacet', diamond.address)
      )

      await dexMgr.batchAddDex([
        '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
        '0x216b4b4ba9f3e719726886d34a177484278bfcae',
      ])
      const ABI = ['function initNXTP(address)']
      const iface = new utils.Interface(ABI)

      const initData = iface.encodeFunctionData('initNXTP', [TX_MGR_ADDR])

      await addOrReplaceFacets(
        [nxtpFacet],
        diamond.address,
        nxtpFacet.address,
        initData
      )

      lifi = (<NXTPFacet>(
        await ethers.getContractAt('NXTPFacet', diamond.address)
      )).connect(alice)

      // test data
      lifiData = {
        transactionId:
          '0x8bfe666c0d5012ba1c2e515cc37d2932f9faff7336e03f868c222f988274e180',
        integrator: 'li.finance',
        referrer: '0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0',
        sendingAssetId: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        receivingAssetId: '0x4ecaba5870353805a9f068101a40e0f32ed605c6',
        receiver: '0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0',
        destinationChainId: '100',
        amount: '1000000',
      }
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
            blockNumber: 20210572,
          },
        },
      ],
    })
  })

  beforeEach(async function () {
    this.timeout(0)
    await setupTest()
  })

  it('performs a swap then starts bridge transaction on the sending chain', async function () {
    const nxtpData = {
      ...paraswapNXTPData,
    }

    nxtpData.invariantData.initiator = lifi.address

    // Approve ERC20 for swapping
    const token = IERC20__factory.connect(USDC_ADDRESS, alice)
    await token.approve(lifi.address, lifiData.amount)

    // Call LiFi smart contract to start the bridge process
    await expect(
      lifi.swapAndStartBridgeTokensViaNXTP(
        lifiData,
        [
          {
            sendingAssetId: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            receivingAssetId: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
            fromAmount: '1000000',
            callTo: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
            callData:
              '0x54e3f31b00000000000000000000000000000000000000000000000000000000000000200000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa84174000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f00000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000e7c1400000000000000000000000000000000000000000000000000000000000f3f3d00000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000220000000000000000000000000000000000000000000000000000000000000034000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e000000000000000000000000000000000000000000000000000000000616877e6e3cac9502cea11ec873df73deb040325000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000f3938337f7294fef84e9b2c6d548a93f956cc28100000000000000000000000000000000000000000000000000000000000000e491a32b690000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa8417400000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001000000000000000000004df89ec257c1862f1bdf0603a6c20ed6f3d6bae6deb0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e4000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
            approveTo: '0x216b4b4ba9f3e719726886d34a177484278bfcae',
          },
        ],
        nxtpData,
        { gasLimit: 900000 }
      )
    )
      .to.emit(lifi, 'AssetSwapped')
      .and.to.emit(lifi, 'NXTPBridgeStarted')
      .and.to.emit(lifi, 'LiFiTransferStarted')
  }).timeout(60000)
})
