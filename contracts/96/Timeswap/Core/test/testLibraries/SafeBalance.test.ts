import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import { ethers, waffle } from 'hardhat'
import { IERC20 } from '../../typechain/IERC20'
import { SafeBalanceTest } from '../../typechain/SafeBalanceTest'
import { testTokenNew } from '../shared/TestToken'

let signers: SignerWithAddress[]

const { solidity } = waffle
chai.use(solidity)
const { expect } = chai

describe('Checking SafeBalance', () => {
  let token: IERC20
  let safeBalTestContract: SafeBalanceTest
  let tokenMinted = 1000n
  let tokenTransfer = 600n

  before(async () => {
    signers = await ethers.getSigners()
  })

  beforeEach(async () => {
    token = await testTokenNew('Ether', 'WETH', tokenMinted)
    const SafeBalanceTestContractFactory = await ethers.getContractFactory('SafeBalanceTest')
    safeBalTestContract = (await SafeBalanceTestContractFactory.deploy()) as SafeBalanceTest
    await safeBalTestContract.deployed()
    token.transfer(safeBalTestContract.address, tokenTransfer)
  })

  it('Should return the balance transferred', async () => {
    let safeBalance = await safeBalTestContract.safeBalance(token.address)
    expect(safeBalance).to.be.equal(tokenTransfer)
  })
})
