import { add } from '../number-utils'

// Boilerplate test to keep reference that jest is configured properly
// Can be removed when real tests are added on the application
describe('utils', () => {
  test('It should add two numbers', () => {
    const value = add(1, 1)
    expect(value).toEqual(2)
  })
})
