import { DexManagerFacet, IERC20__factory, HopFacet } from '../../typechain'
// import { expect } from '../chai-setup'
import { deployments, network } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers'
import { constants, Contract, utils } from 'ethers'
import { node_url } from '../../utils/network'
import { expect } from '../chai-setup'
import { parseEther, parseUnits } from 'ethers/lib/utils'

const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const UNISWAP_ADDRESS = '0xE592427A0AEce92De3Edee1F18E0157C05861564'

describe('HopFacet L1', function () {
  let alice: SignerWithAddress
  let lifi: HopFacet
  let dexMgr: DexManagerFacet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lifiData: any

  const setupTest = deployments.createFixture(
    async ({ deployments, ethers }) => {
      await deployments.fixture('DeployHopFacet')

      const diamond = await ethers.getContract('LiFiDiamond')
      lifi = <HopFacet>await ethers.getContractAt('HopFacet', diamond.address)
      dexMgr = <DexManagerFacet>(
        await ethers.getContractAt('DexManagerFacet', diamond.address)
      )
      await dexMgr.addDex(UNISWAP_ADDRESS)

      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: ['0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503'],
      })

      alice = await ethers.getSigner(
        '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503'
      )

      lifiData = {
        transactionId: utils.randomBytes(32),
        integrator: 'ACME Devs',
        referrer: constants.AddressZero,
        sendingAssetId: USDC_ADDRESS,
        receivingAssetId: USDC_ADDRESS,
        receiver: alice.address,
        destinationChainId: 137,
        amount: utils.parseUnits('10000', 6),
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
            jsonRpcUrl: node_url('mainnet'),
            blockNumber: 13409456,
          },
        },
      ],
    })
  })

  beforeEach(async function () {
    this.timeout(0)
    await setupTest()
  })

  it('starts a bridge transaction on the sending chain', async function () {
    // Approve ERC20 for swapping
    const token = IERC20__factory.connect(USDC_ADDRESS, alice)
    const amount = utils.parseUnits('10010', 6)
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time

    await token.approve(lifi.address, amount)

    const HopData = {
      asset: 'USDC',
      chainId: 137,
      recipient: alice.address,
      amount: amount,
      bonderFee: 0,
      amountOutMin: 0,
      deadline,
      destinationAmountOutMin: utils.parseUnits('10000', 6),
      destinationDeadline: deadline,
    }

    await expect(
      lifi.connect(alice).startBridgeTokensViaHop(lifiData, HopData, {
        gasLimit: 500000,
      })
    ).to.emit(lifi, 'LiFiTransferStarted')
  })

  it('starts a bridge transaction on the sending chain with ETH', async function () {
    const amount = utils.parseEther('0.05')
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time

    const HopData = {
      asset: 'ETH',
      chainId: 137,
      recipient: alice.address,
      amount: amount,
      bonderFee: 0,
      amountOutMin: 0,
      deadline,
      destinationAmountOutMin: utils.parseEther('0.04'),
      destinationDeadline: deadline,
    }

    await expect(
      lifi.connect(alice).startBridgeTokensViaHop(lifiData, HopData, {
        gasLimit: 500000,
        value: parseEther('0.05'),
      })
    ).to.emit(lifi, 'LiFiTransferStarted')
  })

  it('performs a swap then starts bridge transaction on the sending chain', async function () {
    const amountIn = utils.parseUnits('1020', 6)
    const amountOut = utils.parseEther('1010')
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time

    const HopData = {
      asset: 'DAI',
      chainId: 137,
      recipient: alice.address,
      amount: parseUnits('900', 18),
      bonderFee: 0,
      amountOutMin: 0,
      deadline,
      destinationAmountOutMin: utils.parseUnits('899', 18),
      destinationDeadline: deadline,
    }

    const to = lifi.address // should be a checksummed recipient address

    const uniswap = new Contract(
      UNISWAP_ADDRESS,
      [
        'function exactOutputSingle(tuple(address,address,uint24,address,uint256,uint256,uint256,uint160)) external payable returns (uint256)',
      ],
      alice
    )

    // Generate swap calldata
    const swapData = await uniswap.populateTransaction.exactOutputSingle([
      USDC_ADDRESS,
      DAI_ADDRESS,
      3000,
      to,
      deadline,
      amountOut,
      amountIn,
      0,
    ])

    // Approve ERC20 for swapping
    const token = IERC20__factory.connect(USDC_ADDRESS, alice)
    await token.approve(lifi.address, amountIn)

    await expect(
      lifi.connect(alice).swapAndStartBridgeTokensViaHop(
        lifiData,
        [
          {
            callTo: <string>swapData.to,
            approveTo: <string>swapData.to,
            sendingAssetId: USDC_ADDRESS,
            receivingAssetId: DAI_ADDRESS,
            callData: <string>swapData?.data,
            fromAmount: amountIn,
          },
        ],
        HopData,
        { gasLimit: 500000 }
      )
    )
      .to.emit(lifi, 'AssetSwapped')
      .and.to.emit(lifi, 'LiFiTransferStarted')
  })

  it('it fails performing a swap if dex is not authorized', async function () {
    await dexMgr.removeDex(UNISWAP_ADDRESS)

    const amountIn = utils.parseUnits('1020', 6)
    const amountOut = utils.parseEther('1010')
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time

    const HopData = {
      asset: 'DAI',
      chainId: 137,
      recipient: alice.address,
      amount: parseUnits('900', 18),
      bonderFee: 0,
      amountOutMin: 0,
      deadline,
      destinationAmountOutMin: utils.parseUnits('899', 18),
      destinationDeadline: deadline,
    }

    const to = lifi.address // should be a checksummed recipient address

    const uniswap = new Contract(
      UNISWAP_ADDRESS,
      [
        'function exactOutputSingle(tuple(address,address,uint24,address,uint256,uint256,uint256,uint160)) external payable returns (uint256)',
      ],
      alice
    )

    // Generate swap calldata
    const swapData = await uniswap.populateTransaction.exactOutputSingle([
      USDC_ADDRESS,
      DAI_ADDRESS,
      3000,
      to,
      deadline,
      amountOut,
      amountIn,
      0,
    ])

    // Approve ERC20 for swapping
    const token = IERC20__factory.connect(USDC_ADDRESS, alice)
    await token.approve(lifi.address, amountIn)

    await expect(
      lifi.connect(alice).swapAndStartBridgeTokensViaHop(
        lifiData,
        [
          {
            callTo: <string>swapData.to,
            approveTo: <string>swapData.to,
            sendingAssetId: USDC_ADDRESS,
            receivingAssetId: DAI_ADDRESS,
            callData: <string>swapData?.data,
            fromAmount: amountIn,
          },
        ],
        HopData,
        { gasLimit: 500000 }
      )
    ).to.be.revertedWith('Contract call not allowed!')
  })
})
