/* eslint-disable @typescript-eslint/no-explicit-any */
import { DexManagerFacet, IERC20__factory, NXTPFacet } from '../../typechain'
import { expect } from '../chai-setup'
import { deployments, network } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers'
import { constants, Contract, utils } from 'ethers'
import { simpleNXTPData } from '../fixtures/nxtp'
import { ChainId, Token } from '@uniswap/sdk'
import { node_url } from '../../utils/network'

describe('NXTPFacet', function () {
  const RINKEBY_DAI_ADDRESS = '0xc7AD46e0b8a400Bb3C915120d284AafbA8fc4735'
  const RINKEBY_TOKEN_ADDRESS = '0x9aC2c46d7AcC21c881154D57c0Dc1c55a3139198'
  const GOERLI_TOKEN_ADDRESS = '0x8a1Cad3703E0beAe0e0237369B4fcD04228d1682'
  const UNISWAP_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

  let alice: SignerWithAddress
  let lifi: NXTPFacet
  let dexMgr: DexManagerFacet
  let lifiData: any

  const setupTest = deployments.createFixture(
    async ({ deployments, ethers }) => {
      // setup wallet
      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: ['0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0'],
      })
      alice = await ethers.getSigner(
        '0x552008c0f6870c2f77e5cC1d2eb9bdff03e30Ea0'
      )

      // setup contract
      await deployments.fixture('DeployNXTPFacet')
      const diamond = await ethers.getContract('LiFiDiamond')
      lifi = (<NXTPFacet>(
        await ethers.getContractAt('NXTPFacet', diamond.address)
      )).connect(alice)
      dexMgr = <DexManagerFacet>(
        await ethers.getContractAt('DexManagerFacet', diamond.address)
      )
      await dexMgr.addDex(UNISWAP_ADDRESS)

      // test data
      lifiData = {
        transactionId: utils.randomBytes(32),
        integrator: 'ACME Devs',
        referrer: constants.AddressZero,
        sendingAssetId: RINKEBY_DAI_ADDRESS,
        receivingAssetId: GOERLI_TOKEN_ADDRESS,
        receiver: alice.address,
        destinationChainId: 5,
        amount: simpleNXTPData.amount,
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
            jsonRpcUrl: node_url('rinkeby'),
            blockNumber: 9451655,
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
    const token = IERC20__factory.connect(RINKEBY_TOKEN_ADDRESS, alice)
    await token.approve(lifi.address, simpleNXTPData.amount)

    const nxtpData = {
      ...simpleNXTPData,
    }

    nxtpData.invariantData.initiator = lifi.address

    await expect(
      lifi.startBridgeTokensViaNXTP(lifiData, nxtpData, {
        gasLimit: 500000,
      })
    )
      .to.emit(lifi, 'NXTPBridgeStarted')
      .and.to.emit(lifi, 'LiFiTransferStarted')
  })

  it('performs a swap then starts bridge transaction on the sending chain', async function () {
    // Uniswap
    const TOKEN = new Token(ChainId.RINKEBY, RINKEBY_TOKEN_ADDRESS, 18)
    const DAI = new Token(ChainId.RINKEBY, RINKEBY_DAI_ADDRESS, 18)

    const amountIn = utils.parseEther('12')
    const amountOut = utils.parseEther('10') // 1 TestToken

    const nxtpData = {
      ...simpleNXTPData,
    }

    nxtpData.invariantData.initiator = lifi.address

    const path = [DAI.address, TOKEN.address]
    const to = lifi.address // should be a checksummed recipient address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time

    const uniswap = new Contract(
      UNISWAP_ADDRESS,
      [
        'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
      ],
      alice
    )

    // Generate swap calldata
    const swapData = await uniswap.populateTransaction.swapTokensForExactTokens(
      amountOut,
      amountIn,
      path,
      to,
      deadline
    )

    // Approve ERC20 for swapping
    const token = IERC20__factory.connect(RINKEBY_DAI_ADDRESS, alice)
    await token.approve(lifi.address, amountIn)

    // Call LiFi smart contract to start the bridge process
    await expect(
      lifi.swapAndStartBridgeTokensViaNXTP(
        lifiData,
        [
          {
            callTo: <string>swapData.to,
            approveTo: <string>swapData.to,
            sendingAssetId: DAI.address,
            receivingAssetId: TOKEN.address,
            callData: <string>swapData?.data,
            fromAmount: amountIn,
          },
        ],
        nxtpData,
        { gasLimit: 500000 }
      )
    )
      .to.emit(lifi, 'AssetSwapped')
      .and.to.emit(lifi, 'NXTPBridgeStarted')
      .and.to.emit(lifi, 'LiFiTransferStarted')
  })

  it('fails to perform a swap when the dex is not authorized', async function () {
    await dexMgr.removeDex(UNISWAP_ADDRESS)

    // Uniswap
    const TOKEN = new Token(ChainId.RINKEBY, RINKEBY_TOKEN_ADDRESS, 18)
    const DAI = new Token(ChainId.RINKEBY, RINKEBY_DAI_ADDRESS, 18)

    const amountIn = utils.parseEther('12')
    const amountOut = utils.parseEther('10') // 1 TestToken

    const nxtpData = {
      ...simpleNXTPData,
    }

    nxtpData.invariantData.initiator = lifi.address

    const path = [DAI.address, TOKEN.address]
    const to = lifi.address // should be a checksummed recipient address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time

    const uniswap = new Contract(
      UNISWAP_ADDRESS,
      [
        'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
      ],
      alice
    )

    // Generate swap calldata
    const swapData = await uniswap.populateTransaction.swapTokensForExactTokens(
      amountOut,
      amountIn,
      path,
      to,
      deadline
    )

    // Approve ERC20 for swapping
    const token = IERC20__factory.connect(RINKEBY_DAI_ADDRESS, alice)
    await token.approve(lifi.address, amountIn)

    // Call LiFi smart contract to start the bridge process
    await expect(
      lifi.swapAndStartBridgeTokensViaNXTP(
        lifiData,
        [
          {
            callTo: <string>swapData.to,
            approveTo: <string>swapData.to,
            sendingAssetId: DAI.address,
            receivingAssetId: TOKEN.address,
            callData: <string>swapData?.data,
            fromAmount: amountIn,
          },
        ],
        nxtpData,
        { gasLimit: 500000 }
      )
    ).to.be.revertedWith('Contract call not allowed!')
  })

  it('performs a swap with positive slippage then starts bridge transaction on the sending chain', async function () {
    // Uniswap
    const TOKEN = new Token(ChainId.RINKEBY, RINKEBY_TOKEN_ADDRESS, 18)
    const DAI = new Token(ChainId.RINKEBY, RINKEBY_DAI_ADDRESS, 18)

    const amountIn = utils.parseEther('12')
    const amountOut = utils.parseEther('10.5') // 1 TestToken

    const nxtpData = {
      ...simpleNXTPData,
    }

    nxtpData.invariantData.initiator = lifi.address

    const path = [DAI.address, TOKEN.address]
    const to = lifi.address // should be a checksummed recipient address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time

    const uniswap = new Contract(
      UNISWAP_ADDRESS,
      [
        'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
      ],
      alice
    )

    // Generate swap calldata
    const swapData = await uniswap.populateTransaction.swapTokensForExactTokens(
      amountOut,
      amountIn,
      path,
      to,
      deadline
    )

    // Approve ERC20 for swapping
    const token = IERC20__factory.connect(RINKEBY_DAI_ADDRESS, alice)
    await token.approve(lifi.address, amountIn)

    // Call LiFi smart contract to start the bridge process
    await expect(
      lifi.swapAndStartBridgeTokensViaNXTP(
        lifiData,
        [
          {
            callTo: <string>swapData.to,
            approveTo: <string>swapData.to,
            sendingAssetId: DAI.address,
            receivingAssetId: TOKEN.address,
            callData: <string>swapData?.data,
            fromAmount: amountIn,
          },
        ],
        nxtpData,
        { gasLimit: 500000 }
      )
    )
      .to.emit(lifi, 'AssetSwapped')
      .and.to.emit(lifi, 'NXTPBridgeStarted')
      .and.to.emit(lifi, 'LiFiTransferStarted')
  })

  it('performs a swap with max approval and then does not approve for subsequent swaps', async function () {
    // Uniswap
    const TOKEN = new Token(ChainId.RINKEBY, RINKEBY_TOKEN_ADDRESS, 18)
    const DAI = new Token(ChainId.RINKEBY, RINKEBY_DAI_ADDRESS, 18)

    const amountIn = utils.parseEther('12')
    const amountOut = utils.parseEther('10') // 1 TestToken

    const nxtpData = {
      ...simpleNXTPData,
    }

    nxtpData.invariantData.initiator = lifi.address

    const path = [DAI.address, TOKEN.address]
    const to = lifi.address // should be a checksummed recipient address
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from the current Unix time

    const uniswap = new Contract(
      UNISWAP_ADDRESS,
      [
        'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
      ],
      alice
    )

    // Generate swap calldata
    const swapData = await uniswap.populateTransaction.swapTokensForExactTokens(
      amountOut,
      amountIn,
      path,
      to,
      deadline
    )

    // Approve ERC20 for swapping
    const token = IERC20__factory.connect(RINKEBY_DAI_ADDRESS, alice)
    await token.approve(lifi.address, amountIn)

    // Call LiFi smart contract to start the bridge process
    await expect(
      lifi.swapAndStartBridgeTokensViaNXTP(
        lifiData,
        [
          {
            callTo: <string>swapData.to,
            approveTo: <string>swapData.to,
            sendingAssetId: DAI.address,
            receivingAssetId: TOKEN.address,
            callData: <string>swapData?.data,
            fromAmount: amountIn,
          },
        ],
        nxtpData,
        { gasLimit: 500000 }
      )
    ).to.emit(token, 'Approval')

    await token.approve(lifi.address, amountIn)

    nxtpData.invariantData.transactionId =
      '0x9761f6676e6f42010794b5ec0f7c4dd25e5f3c5220dd2b16040761db87fd6e45'
    // Call LiFi smart contract to start the bridge process
    await expect(
      lifi.swapAndStartBridgeTokensViaNXTP(
        lifiData,
        [
          {
            callTo: <string>swapData.to,
            approveTo: <string>swapData.to,
            sendingAssetId: DAI.address,
            receivingAssetId: TOKEN.address,
            callData: <string>swapData?.data,
            fromAmount: amountIn,
          },
        ],
        nxtpData,
        { gasLimit: 500000 }
      )
    ).to.not.emit(token, 'Approval')
  })
})
