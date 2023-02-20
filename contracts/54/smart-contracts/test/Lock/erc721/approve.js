const { constants } = require('hardlydifficult-ethereum-contracts')
const { reverts } = require('truffle-assertions')
const deployLocks = require('../../helpers/deployLocks')

const unlockContract = artifacts.require('Unlock.sol')
const getProxy = require('../../helpers/proxy')

let unlock
let locks
let ID

contract('Lock / erc721 / approve', (accounts) => {
  before(async () => {
    unlock = await getProxy(unlockContract)
    locks = await deployLocks(unlock, accounts[0])
  })

  describe('when the token does not exist', () => {
    it('should fail', async () => {
      await reverts(
        locks.FIRST.approve(accounts[2], 42, {
          from: accounts[1],
        }),
        'ONLY_KEY_MANAGER_OR_APPROVED'
      )
    })
  })

  describe('when the key exists', () => {
    before(async () => {
      await locks.FIRST.purchase(
        0,
        accounts[1],
        web3.utils.padLeft(0, 40),
        [],
        {
          value: web3.utils.toWei('0.01', 'ether'),
          from: accounts[1],
        }
      )
      ID = await locks.FIRST.getTokenIdFor.call(accounts[1])
    })

    describe('when the sender is not the token owner', () => {
      it('should fail', async () => {
        await reverts(
          locks.FIRST.approve(accounts[2], ID, {
            from: accounts[2],
          }),
          'ONLY_KEY_MANAGER_OR_APPROVED'
        )
      })
    })

    describe('when the sender is self approving', () => {
      it('should fail', async () => {
        await reverts(
          locks.FIRST.approve(accounts[1], ID, {
            from: accounts[1],
          }),
          'APPROVE_SELF'
        )
      })
    })

    describe('when the approval succeeds', () => {
      let event
      before(async () => {
        let result = await locks.FIRST.approve(accounts[2], ID, {
          from: accounts[1],
        })
        event = result.logs[0]
      })

      it('should assign the approvedForTransfer value', async () => {
        const approved = await locks.FIRST.getApproved.call(ID)
        assert.equal(approved, accounts[2])
      })

      it('should trigger the Approval event', () => {
        assert.equal(event.event, 'Approval')
        assert.equal(event.args.owner, accounts[1])
        assert.equal(event.args.approved, accounts[2])
        assert(event.args.tokenId.eq(ID))
      })

      describe('when reaffirming the approved address', () => {
        before(async () => {
          let result = await locks.FIRST.approve(accounts[2], ID, {
            from: accounts[1],
          })
          event = result.logs[0]
        })

        it('Approval emits when the approved address is reaffirmed', async () => {
          assert.equal(event.event, 'Approval')
          assert.equal(event.args.owner, accounts[1])
          assert.equal(event.args.approved, accounts[2])
          assert(event.args.tokenId.eq(ID))
        })
      })

      describe('when clearing the approved address', () => {
        before(async () => {
          let result = await locks.FIRST.approve(
            web3.utils.padLeft(0, 40),
            ID,
            {
              from: accounts[1],
            }
          )
          event = result.logs[0]
        })

        it('The zero address indicates there is no approved address', async () => {
          assert.equal(
            await locks.FIRST.getApproved.call(ID),
            constants.ZERO_ADDRESS
          )
        })
      })
    })
  })
})
