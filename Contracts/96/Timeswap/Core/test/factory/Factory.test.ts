import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import { ethers, waffle } from 'hardhat'
import { factoryInit } from '../shared/Factory'
import { pseudoRandomBigUint } from '../shared/Helper'

const { solidity } = waffle
chai.use(solidity)
const { expect } = chai

const MaxUint16 = BigNumber.from(2).pow(16).sub(1)

describe('Factory Contract', () => {
  let signers: SignerWithAddress[]
  let factory: Contract
  let fee: bigint
  let protocol_fee: bigint

  beforeEach(async () => {
    signers = await ethers.getSigners()
    fee = pseudoRandomBigUint(MaxUint16)
    protocol_fee = pseudoRandomBigUint(MaxUint16)
    let timeSwapMathFactory = await ethers.getContractFactory("TimeswapMath")
    let timeSwapMathContract= await timeSwapMathFactory.deploy();
    factory = await factoryInit(signers[10].address, fee, protocol_fee, timeSwapMathContract.address) // deploying the factory
  })

  it('Set Owner and accept owner from another account', async () => {
    // setting new owner and emitting event
    console.log(`Deploying TimeSwap Factory with fee: ${fee} and protocolFee: ${protocol_fee}`)
    await expect(factory.connect(signers[10]).setOwner(signers[1].address))
      .to.emit(factory, 'SetOwner')
      .withArgs(signers[1].address)
    // accepting ownership and emitting event
    await expect(factory.connect(signers[1]).acceptOwner()).to.emit(factory, 'AcceptOwner').withArgs(signers[1].address)
    const currentOwner = await factory.owner()
    const expectedOwner = signers[1].address
    expect(currentOwner).to.equal(expectedOwner)
    expect(currentOwner).to.be.equal(signers[1].address)
  })

  it('Setting New Owner from non-owner account: Reverted', async () => {
    console.log(`Deploying TimeSwap Factory with fee: ${fee} and protocolFee: ${protocol_fee}`)
    await expect(factory.connect(signers[9]).setOwner(signers[1].address)).to.be.revertedWith('E102')
  })

  it('Setting New Owner to ZeroAddress: Reverted', async () => {
    console.log(`Deploying TimeSwap Factory with fee: ${fee} and protocolFee: ${protocol_fee}`)
    await expect(factory.connect(signers[10]).setOwner(ethers.constants.AddressZero)).to.be.revertedWith('E101')
  })

  it('Accept owner from third account: Reverted', async () => {
    console.log(`Deploying TimeSwap Factory with fee: ${fee} and protocolFee: ${protocol_fee}`)
    await factory.connect(signers[10]).setOwner(signers[1].address)
    await expect(factory.connect(signers[2]).acceptOwner()).to.be.revertedWith('E102')
  })
})

describe('', async () => {
  it('Deploying factory with zero address: Reverted', async () => {
    console.log(`Deploying TimeSwap Factory with default fee and default protocolFee`)
    let timeSwapMathFactory = await ethers.getContractFactory("TimeswapMath")
    let timeSwapMathContract= await timeSwapMathFactory.deploy();
    await expect(factoryInit(ethers.constants.AddressZero, undefined,undefined, timeSwapMathContract.address)).to.be.revertedWith('E101')
  })
})

describe('', async () => {
  it('Deploying factory with fee greater than uint16: Reverted', async () => {
    console.log(`Deploying TimeSwap Factory with fee: uint16 (edgecase)`)
    let timeSwapMathFactory = await ethers.getContractFactory("TimeswapMath")
    let timeSwapMathContract= await timeSwapMathFactory.deploy();
    await expect(factoryInit(undefined, BigInt(MaxUint16.add(1).toString()), undefined,timeSwapMathContract.address), undefined).to.be.reverted
  })
})

describe('', async () => {
  it('Deploying factory with protocolfee greater than uint16: Reverted', async () => {
    console.log(`Deploying TimeSwap Factory with protocolfee: uint16 (edgecase)`)
    let timeSwapMathFactory = await ethers.getContractFactory("TimeswapMath")
    let timeSwapMathContract= await timeSwapMathFactory.deploy();
    await expect(factoryInit(undefined, undefined, BigInt(MaxUint16.add(1).toString()), timeSwapMathContract.address)).to.be.reverted
  })
})

describe('', async () => {
  it('Deploying factory with negative fee: Reverted', async () => {
    console.log(`Deploying TimeSwap Factory with negative fee (edgecase)`)
    let timeSwapMathFactory = await ethers.getContractFactory("TimeswapMath")
    let timeSwapMathContract= await timeSwapMathFactory.deploy();
    await expect(factoryInit(undefined, -1n, undefined, timeSwapMathContract.address)).to.be.reverted
  })
})

describe('', async () => {
  it('Deploying factory with negative protocolfee: Reverted', async () => {
    console.log(`Deploying TimeSwap Factory with negative protocolfee (edgecase)`)
    let timeSwapMathFactory = await ethers.getContractFactory("TimeswapMath")
    let timeSwapMathContract= await timeSwapMathFactory.deploy();
    await expect(factoryInit(undefined, undefined, -1n, timeSwapMathContract.address)).to.be.reverted
  })
})

describe('', async () => {
  it('Deploying factory with 0 fee', async () => {
    console.log('Deploying factory with 0 fee')
    let signerAddress = await ethers.getSigners()
    let timeSwapMathFactory = await ethers.getContractFactory("TimeswapMath")
    let timeSwapMathContract= await timeSwapMathFactory.deploy();
    let factoryContract = await factoryInit(signerAddress[1].address, 0n, undefined, timeSwapMathContract.address)
    expect(await factoryContract.owner()).to.be.equal(signerAddress[1].address)
  })
})

describe('', async () => {
  it('Deploying factory with 0 protocol fee', async () => {
    console.log('Deploying factory with 0 protocol fee')
    let signerAddress = await ethers.getSigners()
    let timeSwapMathFactory = await ethers.getContractFactory("TimeswapMath")
    let timeSwapMathContract= await timeSwapMathFactory.deploy();
    let factoryContract = await factoryInit(signerAddress[1].address, undefined, 0n, timeSwapMathContract.address)
    expect(await factoryContract.owner()).to.be.equal(signerAddress[1].address)
  })
})
