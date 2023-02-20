const initialization = require('./initialization')
const createLock = require('./createLock')

exports.shouldBehaveLikeV1 = (options) => {
  describe('Unlock / behaviors / shared', () => {
    initialization.shouldHaveInitialized(options)
    createLock.shouldCreateLock(options)
  })
}
