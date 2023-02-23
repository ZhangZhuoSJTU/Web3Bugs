import { PROJECT_NAME } from '../constants'

describe('constants', () => {
  test('PROJECT_NAME should return website', () => {
    expect(PROJECT_NAME).toEqual('website')
  })
})
