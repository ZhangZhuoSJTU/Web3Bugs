const BigNumber = require('bignumber.js')

exports.shouldHaveInitialized = (options) => {
  describe('Unlock / behaviors / initialization', () => {
    let unlock
    let unlockOwner

    beforeEach(async () => {
      ;({ unlock, unlockOwner } = options)
    })

    it('should have an owner', async () => {
      const owner = await unlock.owner()
      assert.equal(owner, web3.utils.toChecksumAddress(unlockOwner))
    })

    it('should have initialized grossNetworkProduct', async () => {
      const grossNetworkProduct = new BigNumber(
        await unlock.grossNetworkProduct()
      )
      assert.equal(grossNetworkProduct.toFixed(), 0)
    })

    it('should have initialized totalDiscountGranted', async () => {
      const totalDiscountGranted = new BigNumber(
        await unlock.totalDiscountGranted()
      )
      assert.equal(totalDiscountGranted.toFixed(), 0)
    })
  })
}
