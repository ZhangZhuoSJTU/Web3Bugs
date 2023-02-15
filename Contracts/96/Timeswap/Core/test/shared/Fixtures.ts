import { BigNumber } from '@ethersproject/bignumber'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import type { TestToken } from '../../typechain/TestToken'
import BorrowMath from '../libraries/BorrowMath'
import LendMath from '../libraries/LendMath'
import { divUp } from '../libraries/Math'
import MintMath from '../libraries/MintMath'
import { now } from '../shared/Helper'
import { BorrowParams, Lend, lend, LendParams, MintParams, PayParams, WithdrawParams } from '../testCases'
import { FEE, PROTOCOL_FEE } from './Constants'
import { getBlock } from './Helper'
import { Pair, pairInit } from './Pair'
import { TotalClaims } from './PairInterface'
import { PairSim } from './PairSim'
import { testTokenNew } from './TestToken'

const MaxUint112 = BigNumber.from(2).pow(112).sub(1)
const MaxUint128 = BigNumber.from(2).pow(128).sub(1)
const MaxUint256 = BigNumber.from(2).pow(256).sub(1)

export async function constructorFixture(
  assetValue: bigint,
  collateralValue: bigint,
  maturity: bigint
): Promise<Fixture> {
  const signers = await ethers.getSigners()
  let av = BigNumber.from(assetValue)
  let cv = BigNumber.from(collateralValue)
  av = av.mul(4)
  cv = cv.mul(4)
  const assetToken = await testTokenNew('Ether', 'WETH', BigInt(av.toString()))
  const collateralToken = await testTokenNew('Matic', 'MATIC', BigInt(cv.toString()))
  const pair = await pairInit(assetToken, collateralToken, maturity)
  const factory = pair.factoryContract
  const factoryAddress = factory.address
  const owner = await factory.owner()
  await assetToken.transfer(signers[1].address, 10000n)
  await collateralToken.transfer(signers[1].address, 10000n)
  await assetToken.approve(pair.pairContractCallee.address, assetValue)
  await collateralToken.approve(pair.pairContractCallee.address, collateralValue)
  await assetToken.connect(signers[1]).approve(pair.pairContractCallee.address, assetValue)
  await collateralToken.connect(signers[1]).approve(pair.pairContractCallee.address, collateralValue)
  const pairSim = new PairSim(
    assetToken.address,
    collateralToken.address,
    FEE,
    PROTOCOL_FEE,
    pair.pairContract.address,
    factoryAddress,
    owner
  )
  return { pair, pairSim, assetToken, collateralToken }
}

export async function mintFixture(fixture: Fixture, signer: SignerWithAddress, mintParams: MintParams): Promise<any> {
  const { pair, pairSim, assetToken, collateralToken } = fixture
  const pairContractState = await pair.state()
  const k_pairContract = (pairContractState.asset * pairContractState.interest * pairContractState.cdp) << 32n
  const pairSimPool = pairSim.getPool(pair.maturity)
  const pairSimContractState = pairSimPool.state // getting state from the contract
  const k_pairSimContract =
    (pairSimContractState.asset * pairSimContractState.interest * pairSimContractState.cdp) << 32n
  if (k_pairContract != k_pairSimContract) {
    throw Error('state of Pair and PairSim not same')
  }
  const { assetIn, collateralIn, interestIncrease, cdpIncrease, maturity, currentTimeStamp } = mintParams
  const dueOutDebt = MintMath.getDebt(maturity, assetIn, interestIncrease, await now() + 1n)
  if (dueOutDebt > BigInt(MaxUint112.toString())) {
    throw Error('dueOut.debt > MaxUint112')
  }
  const dueOutCollateral = MintMath.getCollateral(maturity, assetIn, interestIncrease, cdpIncrease, await now() + 1n)
  if (dueOutCollateral > BigInt(MaxUint112.toString())) {
    throw Error('dueOut.Collateral > MaxUint112')
  }
  const txn = await pair.upgrade(signer).mint(mintParams.assetIn, mintParams.interestIncrease, mintParams.cdpIncrease)
  const block = await getBlock(txn.blockHash!)
  const mintData = pairSim.mint(
    pair.maturity,
    signer.address,
    signer.address,
    BigInt(mintParams.assetIn),
    mintParams.interestIncrease,
    mintParams.cdpIncrease,
    block
  )

  return { pair, pairSim, assetToken, collateralToken, mintData }
}

export async function lendFixture(fixture: Fixture, signer: SignerWithAddress, lendParam: Lend): Promise<any> {
  const { pair, pairSim, assetToken, collateralToken } = fixture
  if (lendParam.lendAssetIn <= 0) throw Error('Lending with 0 Assets')
  const pairContractState = await pair.state()
  const totalliquidity = await pair.totalLiquidity()
  if (totalliquidity <= 0) throw Error('Invalid')
  const k_pairContract = (pairContractState.asset * pairContractState.interest * pairContractState.cdp) << 32n
  const pairSimPool = pairSim.getPool(pair.maturity)
  const pairSimContractState = pairSimPool.state // getting state from the contract
  const k_pairSimContract =
    (pairSimContractState.asset * pairSimContractState.interest * pairSimContractState.cdp) << 32n
  if (k_pairContract != k_pairSimContract) throw Error('state of Pair and PairSim not same')
  //LendMath.check
  let block;
  try {
    LendMath.check(await pair.state(), lendParam.lendAssetIn, lendParam.lendInterestDecrease, lendParam.lendCdpDecrease);
    LendMath.getBondInterest(
      pair.maturity,
      lendParam.lendInterestDecrease,
      await now(),
    )
    LendMath.getInsurancePrincipal(
      pairContractState,
      lendParam.lendAssetIn
    )
    LendMath.getInsuranceInterest(
      pair.maturity,
      lendParam.lendCdpDecrease,
      await now()
    )
    const txn = await pair.upgrade(signer).lend(lendParam.lendAssetIn, lendParam.lendInterestDecrease, lendParam.lendCdpDecrease)
    block = await getBlock(txn.blockHash!)
  } catch (error) {
    throw error as TypeError;
  }
  const lendData = pairSim.lend(
    pair.maturity,
    signer.address,
    signer.address,
    lendParam.lendAssetIn,
    lendParam.lendInterestDecrease,
    lendParam.lendCdpDecrease,
    block
  )
  return { pair, pairSim, assetToken, collateralToken, lendData }
}

export interface borrowError {
  cdpAdjust: BigInt
  error: string
}

export async function borrowFixture(
  fixture: Fixture,
  signer: SignerWithAddress,
  borrowParams: BorrowParams,
  owner = false
): Promise<any> {
  const { pair, pairSim, assetToken, collateralToken } = fixture
  const pairContractState = await pair.state()
  const totalliquidity = await pair.totalLiquidity()
  if (totalliquidity <= 0) throw Error('Invalid') // require(pool.state.totalLiquidity > 0, 'E206');
  if (borrowParams.assetOut <= 0) throw Error('Invalid')
  // checking the constantProduct is the same prior to the tx
  let k_pairContract = (pairContractState.asset * pairContractState.interest * pairContractState.cdp) << 32n
  const pairSimPool = pairSim.getPool(pair.maturity)
  const pairSimContractState = pairSimPool.state
  let k_pairSimContract = (pairSimContractState.asset * pairSimContractState.interest * pairSimContractState.cdp) << 32n
  if (k_pairContract != k_pairSimContract) throw Error('state of Pair and PairSim not same');
  const value: any = BorrowMath.check(
    pairContractState,
    borrowParams.assetOut,
    borrowParams.interestIncrease,
    borrowParams.cdpIncrease,
  )
  if (value != true) {
    throw value;
  }

  const dueOutDebt = BorrowMath.getDebt(
    pair.maturity,
    borrowParams.assetOut,
    borrowParams.interestIncrease,
    await now()
  )
  if (dueOutDebt > BigInt(MaxUint112.toString())) {
    throw new Error('dueOut.debt greater than Uint112')
  }

  const dueOutCollateral = BorrowMath.getCollateral(
    pair.maturity,
    pairContractState,
    borrowParams.assetOut,
    borrowParams.cdpIncrease,
    await now()
  )
  if (dueOutCollateral > BigInt(MaxUint112.toString())) {
    throw Error("dueOut.collateral greater than Uint112")
  }

  const txn = await pair
    .upgrade(signer)
    .borrow(borrowParams.assetOut, borrowParams.interestIncrease, borrowParams.cdpIncrease, owner)
  const block = await getBlock(txn.blockHash!)
  const debtObj = pairSim.borrow(
    pair.maturity,
    signer.address,
    signer.address,
    borrowParams.assetOut,
    borrowParams.interestIncrease,
    borrowParams.cdpIncrease,
    block
  )
  return { pair, pairSim, assetToken, collateralToken, debtObj }
}

export async function burnFixture(fixture: Fixture, signer: SignerWithAddress, burnParams: any): Promise<Fixture> {
  const { pair, pairSim, assetToken, collateralToken } = fixture
  const txnBurn = await pair.upgrade(signer).burn(burnParams.liquidityIn)
  const block = await getBlock(txnBurn.blockHash!)
  pairSim.burn(pair.maturity, signer.address, signer.address, burnParams.liquidityIn, signer.address, block)
  return { pair, pairSim, assetToken, collateralToken }
}

export async function payFixture(fixture: Fixture, signer: SignerWithAddress, payParams: PayParams): Promise<Fixture> {
  const { pair, pairSim, assetToken, collateralToken } = fixture
  const txn = await pair.upgrade(signer).pay(payParams.ids, payParams.debtIn, payParams.collateralOut)
  const block = await getBlock(txn.blockHash!)
  pairSim.pay(
    pair.maturity,
    signer.address,
    signer.address,
    payParams.ids,
    payParams.debtIn,
    payParams.collateralOut,
    signer.address,
    block
  )
  return { pair, pairSim, assetToken, collateralToken }
}

export async function withdrawFixture(
  fixture: Fixture,
  signer: SignerWithAddress,
  withdrawParams: TotalClaims
): Promise<Fixture> {
  const { pair, pairSim, assetToken, collateralToken } = fixture
  const txnWithdraw = await pair
    .upgrade(signer)
    .withdraw(withdrawParams.bondPrincipal, withdrawParams.bondInterest, withdrawParams.insurancePrincipal, withdrawParams.insuranceInterest)
  const blockWithdraw = await getBlock(txnWithdraw.blockHash!)
  pairSim.withdraw(
    pair.maturity,
    signer.address,
    signer.address,
    withdrawParams,
    signer.address,
    blockWithdraw
  )
  return { pair, pairSim, assetToken, collateralToken }
}

export interface Fixture {
  pair: Pair
  pairSim: PairSim
  assetToken: TestToken
  collateralToken: TestToken
}

export default { constructorFixture, mintFixture }
