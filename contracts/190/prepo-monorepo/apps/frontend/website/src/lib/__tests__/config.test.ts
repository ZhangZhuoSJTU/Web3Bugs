import config from '../config'

describe('config', () => {
  test('config.ENVIRONMENT should return dev', () => {
    expect(config.ENVIRONMENT).toEqual('dev')
  })
})
