import { makeRepeatedValue } from '../generic-utils'

describe('makeRepeatedValue tests', () => {
  it('should return expected value 1', () => {
    const value = makeRepeatedValue('*', 6)
    expect(value).toBe('******')
  })

  it('should return expected value 2', () => {
    const value = makeRepeatedValue('#', 8)
    expect(value).toBe('########')
  })
})
