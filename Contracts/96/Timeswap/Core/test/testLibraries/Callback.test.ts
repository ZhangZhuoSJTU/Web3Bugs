import { BigNumberish } from '@ethersproject/bignumber'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import { ethers, waffle } from 'hardhat'
import { CallbackTest } from '../../typechain/CallbackTest'
import { CallbackTestCallee } from '../../typechain/CallbackTestCallee'
import { IERC20 } from '../../typechain/IERC20'
import { expect } from '../shared/Expect'
import { now } from '../shared/Helper'
import { testTokenNew } from '../shared/TestToken'

let signers: SignerWithAddress[]

const { solidity } = waffle
chai.use(solidity)

let CallbackTestContract: CallbackTest
let CallbackTestCalleeContract: CallbackTestCallee
let maturity: BigNumberish
let assetToken: IERC20
let collateralToken: IERC20

const assetIn: bigint = 0n
const collateralIn: bigint = 0n

describe('Borrow Math', () => {
  before(async () => {
    signers = await ethers.getSigners()
    maturity = (await now()) + 10000n
    assetToken = await testTokenNew('Ether', 'WETH', 0n)
    collateralToken = await testTokenNew('Matic', 'MATIC', 0n)
    const CallbackTestContractFactory = await ethers.getContractFactory('CallbackTest')
    const CallbackTestCalleeContractFactory = await ethers.getContractFactory('CallbackTestCallee')
    CallbackTestContract = (await CallbackTestContractFactory.deploy()) as CallbackTest
    await CallbackTestContract.deployed()
    CallbackTestCalleeContract = (await CallbackTestCalleeContractFactory.deploy(
      CallbackTestContract.address
    )) as CallbackTestCallee
    await CallbackTestCalleeContract.deployed()
  })

  it('Mint Callback should return true', async () => {
    expect(
      await CallbackTestCalleeContract.callStatic.mint(
        assetToken.address,
        collateralToken.address,
        assetIn,
        collateralIn,
        '0x'
      )
    ).to.be.true
  })

  it('Lend Callback should return true', async () => {
    expect(await CallbackTestCalleeContract.callStatic.lend(assetToken.address, assetIn, '0x')).to.be.true
  })

  it('Borrow Callback should return true', async () => {
    expect(await CallbackTestCalleeContract.callStatic.borrow(collateralToken.address, collateralIn, '0x')).to.be.true
  })

  it('Pay Callback should return true', async () => {
    expect(await CallbackTestCalleeContract.callStatic.pay(assetToken.address, assetIn, '0x')).to.be.true
  })
})
