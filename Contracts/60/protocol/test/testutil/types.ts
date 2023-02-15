import { BigNumberish } from 'ethers'
import { expect } from 'chai'

export interface Position {
  maker: BigNumberish
  taker: BigNumberish
}

export interface PrePosition {
  oracleVersion: BigNumberish
  openPosition: Position
  closePosition: Position
}

export async function expectPositionEq(a: Position, b: Position): Promise<void> {
  expect(a.maker).to.equal(b.maker)
  expect(a.taker).to.equal(b.taker)
}

export async function expectPrePositionEq(a: PrePosition, b: PrePosition): Promise<void> {
  expect(a.oracleVersion).to.equal(b.oracleVersion)
  await expectPositionEq(a.openPosition, b.openPosition)
  await expectPositionEq(a.closePosition, b.closePosition)
}
