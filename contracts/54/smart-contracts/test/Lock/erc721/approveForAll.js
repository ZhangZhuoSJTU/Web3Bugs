const { reverts } = require('truffle-assertions')
const deployLocks = require('../../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../../helpers/proxy')

let unlock
let lock
let ID

contract('Lock / erc721 / approveForAll', (accounts) => {
  before(async () => {
    unlock = await getProxy(unlockContract)
    const locks = await deployLocks(unlock, accounts[0])
    lock = locks.FIRST
    await lock.updateTransferFee(0) // disable the transfer fee for this test
  })

  let owner = accounts[1]
  let approvedUser = accounts[2]

  describe('when the key exists', () => {
    before(async () => {
      await lock.purchase(0, owner, web3.utils.padLeft(0, 40), [], {
        value: web3.utils.toWei('0.01', 'ether'),
        from: owner,
      })
      ID = await lock.getTokenIdFor.call(owner)
    })

    it('isApprovedForAll defaults to false', async () => {
      assert.equal(await lock.isApprovedForAll.call(owner, approvedUser), false)
    })

    describe('when the sender is self approving', () => {
      it('should fail', async () => {
        await reverts(
          lock.setApprovalForAll(owner, true, {
            from: owner,
          }),
          'APPROVE_SELF'
        )
      })
    })

    describe('when the approval succeeds', () => {
      let event
      before(async () => {
        let result = await lock.setApprovalForAll(approvedUser, true, {
          from: owner,
        })
        event = result.logs[0]
      })

      it('isApprovedForAll is true', async () => {
        assert.equal(
          await lock.isApprovedForAll.call(owner, approvedUser),
          true
        )
      })

      it('should trigger the ApprovalForAll event', () => {
        assert.equal(event.event, 'ApprovalForAll')
        assert.equal(event.args.owner, owner)
        assert.equal(event.args.operator, approvedUser)
        assert.equal(event.args.approved, true)
      })

      it('an authorized operator may set the approved address for an NFT', async () => {
        let newApprovedUser = accounts[8]

        await lock.approve(newApprovedUser, ID, {
          from: approvedUser,
        })

        assert.equal(await lock.getApproved.call(ID), newApprovedUser)
      })

      it('should allow the approved user to transferFrom', async () => {
        await lock.transferFrom(owner, accounts[3], ID, {
          from: approvedUser,
        })

        // Transfer it back to the original owner for other tests
        await lock.transferFrom(accounts[3], owner, ID, {
          from: accounts[3],
        })
      })

      it('isApprovedForAll is still true (not lost after transfer)', async () => {
        assert.equal(
          await lock.isApprovedForAll.call(owner, approvedUser),
          true
        )
      })

      describe('allows for multiple operators per owner', () => {
        let newApprovedUser = accounts[8]

        before(async () => {
          await lock.setApprovalForAll(newApprovedUser, true, {
            from: owner,
          })
        })

        it('new operator is approved', async () => {
          assert.equal(
            await lock.isApprovedForAll.call(owner, newApprovedUser),
            true
          )
        })

        it('original operator is still approved', async () => {
          assert.equal(
            await lock.isApprovedForAll.call(owner, approvedUser),
            true
          )
        })
      })
    })

    describe('can cancel an outstanding approval', () => {
      let event

      before(async () => {
        await lock.setApprovalForAll(approvedUser, true, {
          from: owner,
        })
        let result = await lock.setApprovalForAll(approvedUser, false, {
          from: owner,
        })
        event = result.logs[0]
      })

      it('isApprovedForAll is false again', async () => {
        assert.equal(
          await lock.isApprovedForAll.call(owner, approvedUser),
          false
        )
      })

      it('This emits when an operator is (enabled or) disabled for an owner.', async () => {
        assert.equal(event.event, 'ApprovalForAll')
        assert.equal(event.args.owner, owner)
        assert.equal(event.args.operator, approvedUser)
        assert.equal(event.args.approved, false)
      })
    })
  })

  describe('when the owner does not have a key', () => {
    let ownerWithoutAKey = accounts[7]

    it('owner has no keys', async () => {
      assert.equal(await lock.balanceOf(ownerWithoutAKey), 0)
    })

    describe('allows the owner to call approveForAll', () => {
      before(async () => {
        await lock.setApprovalForAll(approvedUser, true, {
          from: ownerWithoutAKey,
        })
      })

      it('operator is approved', async () => {
        assert.equal(
          await lock.isApprovedForAll.call(ownerWithoutAKey, approvedUser),
          true
        )
      })
    })
  })
})
