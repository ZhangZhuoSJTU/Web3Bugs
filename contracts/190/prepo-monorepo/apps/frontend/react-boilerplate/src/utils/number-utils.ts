import { BigNumber } from 'ethers'
import { formatUnits } from 'ethers/lib/utils'
import { ERC20_UNITS } from '../lib/constants'

export const balanceToNumber = (balanceOfSigner: BigNumber): number =>
  Number(formatUnits(balanceOfSigner.toString(), ERC20_UNITS))

export const add = (value1: number, value2: number): number => value1 + value2
