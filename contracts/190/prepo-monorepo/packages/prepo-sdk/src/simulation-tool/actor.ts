import { DELTA } from '../constants'

export default class Actor {
  name: string
  private usdBalance: number

  constructor(name: string, balance: number) {
    this.name = name
    this.usdBalance = balance
  }

  getUsdBalance(): number {
    return this.usdBalance
  }

  setUsdBalance(value: number): void {
    if (value < 0 - DELTA) throw new Error('value must be >= 0')

    this.usdBalance = value
  }
}
