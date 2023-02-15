import { loadFixture } from '@ethereum-waffle/provider'
import fc from 'fast-check'
import { ethers } from 'hardhat'
import { DateTimeCallee } from '../../../typechain'
import { expect } from '../../shared/Expect'

const fixture = async () => {
  const dateTimeContractFactory = await ethers.getContractFactory('DateTimeCallee')
  const dateTimeContract = (await dateTimeContractFactory.deploy()) as DateTimeCallee
  return dateTimeContract
}

describe('DateTime', () => {
  it('Timestamp to DateTime', async () => {
    const dateTimeContract = await loadFixture(fixture)

    await fc.assert(
      fc.asyncProperty(
        fc.integer().filter((x) => x >= 0),
        async (timestamp) => {
          const dateTime = await dateTimeContract.timestampToDateTime(timestamp)
          const date = new Date(timestamp * 1_000)

          expect(dateTime.year.toNumber()).equal(date.getUTCFullYear())
          expect(dateTime.month.toNumber()).equal(date.getUTCMonth() + 1)
          expect(dateTime.day.toNumber()).equal(date.getUTCDate())
          expect(dateTime.hour.toNumber()).equal(date.getUTCHours())
          expect(dateTime.minute.toNumber()).equal(date.getUTCMinutes())
          expect(dateTime.second.toNumber()).equal(date.getUTCSeconds())
        }
      )
    )
  })
})
