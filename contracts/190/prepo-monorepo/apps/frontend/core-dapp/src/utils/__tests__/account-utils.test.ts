import { getShortAccount, isEns } from '../account-utils'

describe('account-utils tests', () => {
  test('It should shorten an address', () => {
    const value = getShortAccount('0x00a329c0648769A73afAc7F9381E08FB43dBEA72')
    expect(value).toEqual('0x00a3...A72')
  })
  test('It should do nothing', () => {
    const value = getShortAccount(null)
    expect(value).toEqual(null)
  })
  test("It should give false if it's not ENS name", () => {
    const value = isEns('0x00a329c0648769A73afAc7F9381E08FB43dBEA72')
    expect(value).toEqual(false)
  })
  test('It should give true if it looks like ENS name', () => {
    const value = isEns('some_name.eth')
    expect(value).toEqual(true)
  })
})
