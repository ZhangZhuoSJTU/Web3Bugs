import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import { ethers, waffle } from 'hardhat'
import { IERC20 } from '../../typechain/IERC20'
import { SafeBalanceTest } from '../../typechain/SafeBalanceTest'
import { SafeTransferTest } from '../../typechain/SafeTransferTest'
import { testTokenNew } from '../shared/TestToken'

let signers: SignerWithAddress[]

const { solidity } = waffle
chai.use(solidity)
const { expect } = chai

describe('Checking SafeTransfer', () => {
  let token: IERC20
  let safeTransferTestContract: SafeTransferTest
  let safeBalTestContract: SafeBalanceTest

  let tokenMinted = 1000n
  let tokenTransfer = 600n
  before(async () => {
    signers = await ethers.getSigners()
  })
  beforeEach(async () => {
    token = await testTokenNew('Ether', 'WETH', tokenMinted)
    const SafeTransferFactory = await ethers.getContractFactory('SafeTransferTest')
    safeTransferTestContract = (await SafeTransferFactory.deploy()) as SafeTransferTest
    await safeTransferTestContract.deployed()
    const SafeBalanceTestContractFactory = await ethers.getContractFactory('SafeBalanceTest')
    safeBalTestContract = (await SafeBalanceTestContractFactory.deploy()) as SafeBalanceTest
    await safeBalTestContract.deployed()
    token.transfer(safeTransferTestContract.address, tokenTransfer)
    safeTransferTestContract.safeTransfer(token.address, safeBalTestContract.address, tokenTransfer)
  })
  it('Should pass when token is transferred', async () => {
    let safeBalance = await safeBalTestContract.safeBalance(token.address)
    expect(safeBalance).to.be.equal(tokenTransfer)
  })
  it('Should revert when amount exceeds balance', async () => {
    expect(
      safeTransferTestContract.safeTransfer(token.address, safeBalTestContract.address, tokenTransfer)
    ).to.be.revertedWith('ERC20: transfer amount exceeds balance')
  })
})
