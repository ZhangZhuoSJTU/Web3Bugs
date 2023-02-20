import chai from 'chai'
import { waffle } from 'hardhat'

const { solidity } = waffle

chai.use(solidity)
chai.use(function (chai, utils) {
  chai.Assertion.addMethod('equalBigInt', function (actual) {
    const expected = this._obj

    const expectedStr = expected.toString()
    const actualStr = actual.toString()

    const expectedMsg = expectedStr + 'n'
    const actualMsg = actualStr + 'n'

    this.assert(
      expectedStr === actualStr,
      'expected #{exp} to be equal to #{act}',
      'Both have to of type bigint',
      expectedMsg,
      actualMsg
    )
  })
})

export const { expect } = chai

declare global {
  export namespace Chai {
    interface Assertion {
      equalBigInt(expected: bigint): Assertion
    }
  }
}

export default { expect }
