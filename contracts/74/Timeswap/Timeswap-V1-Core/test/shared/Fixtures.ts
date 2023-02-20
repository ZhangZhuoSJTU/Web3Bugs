import { BigNumber } from '@ethersproject/bignumber'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import type { TestToken } from '../../typechain/TestToken'
import BorrowMath from '../libraries/BorrowMath'
import LendMath from '../libraries/LendMath'
import { divUp } from '../libraries/Math'
import MintMath from '../libraries/MintMath'
import { now } from '../shared/Helper'
import { BorrowParams, LendParams, MintParams, PayParams, WithdrawParams } from '../testCases'
import { FEE, PROTOCOL_FEE } from './Constants'
import { getBlock } from './Helper'
import { Pair, pairInit } from './Pair'
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
  const dueOutDebt = MintMath.getDebt(maturity, assetIn, interestIncrease, currentTimeStamp)
  if (dueOutDebt > BigInt(MaxUint112.toString())) {
    throw Error('dueOut.debt > MaxUint112')
  }
  const dueOutCollateral = MintMath.getCollateral(maturity, assetIn, interestIncrease, cdpIncrease, currentTimeStamp)
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

export async function lendFixture(fixture: Fixture, signer: SignerWithAddress, lendParams: LendParams): Promise<any> {
  const { pair, pairSim, assetToken, collateralToken } = fixture
  if (lendParams.assetIn <= 0) throw Error('Zero')
  const pairContractState = await pair.state()
  const totalliquidity = await pair.totalLiquidity()
  if (totalliquidity <= 0) throw Error('Invalid')
  if (lendParams.interestDecrease > pairContractState.interest) throw Error('yDecrease is too high')
  const k_pairContract = (pairContractState.asset * pairContractState.interest * pairContractState.cdp) << 32n
  const pairSimPool = pairSim.getPool(pair.maturity)
  const pairSimContractState = pairSimPool.state // getting state from the contract
  const k_pairSimContract =
    (pairSimContractState.asset * pairSimContractState.interest * pairSimContractState.cdp) << 32n
  if (k_pairContract != k_pairSimContract) throw Error('state of Pair and PairSim not same')
  //LendMath.check
  const feeBase = 0x10000n + FEE // uint128 feeBase = 0x10000 + fee;
  const xReserve: bigint = pairContractState.asset + lendParams.assetIn // uint112 xReserve = state.x + xIncrease;
  if (xReserve > BigInt(MaxUint112.toString())) throw Error('xReserve > Uint112') //uint112 xReserve = state.x + xIncrease;
  const interestAdjust = LendMath.adjust(lendParams.interestDecrease, pairContractState.interest, feeBase) // uint128 yAdjusted = adjust(state.y, yDecrease, feeBase);
  if (interestAdjust > BigInt(MaxUint128.toString())) throw Error('interestAdjust > Uint128') //uint128
  const cdpAdjust = divUp(k_pairContract, (pairContractState.asset + lendParams.assetIn) * interestAdjust)
  const cdpDecrease = LendMath.readjust(cdpAdjust, pairContractState.cdp, feeBase)
  if (cdpDecrease < 0) throw Error('zAdjusted is neg; yDec is too large')

  let minimum = lendParams.assetIn
  minimum = minimum * pairContractState.interest
  let assetReserve = pairContractState.asset + lendParams.assetIn
  minimum /= assetReserve << 4n
  if (lendParams.interestDecrease < minimum) throw Error('Intrest Decrease is less than required') //uint112;

  let _insuranceOut = pair.maturity
  _insuranceOut -= await now()
  _insuranceOut *= pairContractState.interest
  _insuranceOut += pairContractState.asset << 32n
  let _denominator = pairContractState.asset
  _denominator += lendParams.assetIn
  _denominator *= pairContractState.asset
  _denominator = _denominator << 32n
  _insuranceOut = _insuranceOut * lendParams.assetIn * pairContractState.cdp
  _insuranceOut = _insuranceOut / _denominator
  _insuranceOut += cdpAdjust
  if (_insuranceOut > BigInt(MaxUint128.toString())) throw Error('_insuranceOut > Uint128') //uint128
  const txn = await pair.upgrade(signer).lend(lendParams.assetIn, lendParams.interestDecrease, cdpAdjust >> 32n)
  const block = await getBlock(txn.blockHash!)
  const lendData = pairSim.lend(
    pair.maturity,
    signer.address,
    signer.address,
    lendParams.assetIn,
    lendParams.interestDecrease,
    cdpAdjust >> 32n,
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
  if (k_pairContract != k_pairSimContract) throw Error('state of Pair and PairSim not same')
  const value: any = BorrowMath.check(
    pairContractState,
    borrowParams.assetOut,
    borrowParams.interestIncrease,
    borrowParams.cdpIncrease,
    FEE
  )
  if (value != true) {
    return Error(
      JSON.stringify({
        cdpAdjust: undefined,
        error: value,
      })
    )
  }
  const dueOutDebt = BorrowMath.getDebt(
    pair.maturity,
    borrowParams.assetOut,
    borrowParams.interestIncrease,
    await now()
  )
  if (dueOutDebt > BigInt(MaxUint112.toString())) {
    return Error(
      JSON.stringify({
        cdpAdjust: undefined,
        error: 'dueOut.debt greater than Uint112',
      })
    )
  }
  const dueOutCollateral = BorrowMath.getCollateral(
    pair.maturity,
    pairContractState,
    borrowParams.assetOut,
    borrowParams.cdpIncrease,
    await now()
  )
  if (dueOutCollateral > BigInt(MaxUint112.toString())) {
    return {
      cdpAdjust: undefined,
      error: 'dueOut.collateral greater than Uint112',
    }
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
  withdrawParams: WithdrawParams
): Promise<Fixture> {
  const { pair, pairSim, assetToken, collateralToken } = fixture
  const txnWithdraw = await pair
    .upgrade(signer)
    .withdraw(withdrawParams.claimsIn.bond, withdrawParams.claimsIn.insurance)
  const blockWithdraw = await getBlock(txnWithdraw.blockHash!)
  pairSim.withdraw(
    pair.maturity,
    signer.address,
    signer.address,
    withdrawParams.claimsIn,
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
