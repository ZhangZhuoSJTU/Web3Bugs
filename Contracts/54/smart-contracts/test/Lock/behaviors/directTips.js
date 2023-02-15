const { constants } = require('hardlydifficult-ethereum-contracts')

module.exports.getBalanceBehavior = (options) => {
  describe('Lock / behaviors / directTips', () => {
    let lock

    beforeEach(async () => {
      ;({ lock } = options)
      await web3.eth.sendTransaction({ to: lock, value: 42 })
    })

    it('ETH tip balance appears', async () => {
      const balance = await web3.eth.balanceOf(lock)
      assert.equal(balance.toString(), 42)
    })

    it('can withdraw ETH', async () => {
      await lock.withdraw(constants.ZERO_ADDRESS)
      const balance = await web3.eth.balanceOf(lock)
      assert.equal(balance.toString(), 0)
    })
  })
}
