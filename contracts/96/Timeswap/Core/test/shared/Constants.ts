import { BigNumber } from '@ethersproject/bignumber'
import Decimal from 'decimal.js'

export const FEE: bigint = 3000n
export const PROTOCOL_FEE: bigint = 3000n

function pseudoRandomBigNumber(maxUint: BigNumber) {
  return BigNumber.from(new Decimal(maxUint.toString()).mul(Math.random().toString()).round().toString())
}

export default { FEE, PROTOCOL_FEE }
