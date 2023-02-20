// tests adapted/imported from https://github.com/OpenZeppelin/openzeppelin-contracts/blob/7e41bf2259950c33e55604015875b7780b6a2e63/test/token/ERC20/extensions/ERC20VotesComp.test.js
const { network } = require('hardhat')
const {
  BN,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers')

const UnlockDiscountTokenV2 = artifacts.require('UnlockDiscountTokenV2.sol')
const { promisify } = require('util')

const queue = promisify(setImmediate)
const ZERO_ADDRESS = web3.utils.padLeft(0, 40)

async function countPendingTransactions() {
  return parseInt(
    await network.provider.send('eth_getBlockTransactionCountByNumber', [
      'pending',
    ])
  )
}

async function batchInBlock(txs) {
  try {
    // disable auto-mining
    await network.provider.send('evm_setAutomine', [false])
    // send all transactions
    const promises = txs.map((fn) => fn())
    // wait for node to have all pending transactions
    while (txs.length > (await countPendingTransactions())) {
      await queue()
    }
    // mine one block
    await network.provider.send('evm_mine')
    // fetch receipts
    const receipts = await Promise.all(promises)
    // Sanity check, all tx should be in the same block
    const minedBlocks = new Set(
      receipts.map(({ receipt }) => receipt.blockNumber)
    )
    expect(minedBlocks.size).to.equal(1)

    return receipts
  } finally {
    // enable auto-mining
    await network.provider.send('evm_setAutomine', [true])
  }
}

contract('UDT ERC20VotesComp extension', (accounts) => {
  let udt
  const [minter, holder, recipient, holderDelegatee, other1, other2] = accounts

  const supply = new BN('10000000000000000000000000')

  beforeEach(async () => {
    udt = await UnlockDiscountTokenV2.new()
    await udt.initialize(minter)
  })

  describe('Supply', () => {
    describe('balanceOf', () => {
      it('grants initial supply to minter account', async () => {
        await udt.mint(holder, supply, { from: minter })
        assert(supply.eq(await udt.balanceOf(holder)))
      })
    })
    it('minting restriction', async () => {
      const amount = new BN('2').pow(new BN('96'))
      await expectRevert(
        udt.mint(minter, amount, { from: minter }),
        'ERC20Votes: total supply risks overflowing votes'
      )
    })
  })

  describe('Delegation', () => {
    it('delegation with balance', async () => {
      await udt.mint(holder, supply, { from: minter })
      assert.equal(await udt.delegates(minter), ZERO_ADDRESS)
      const { receipt } = await udt.delegate(holder, { from: holder })

      expectEvent(receipt, 'DelegateChanged', {
        delegator: holder,
        fromDelegate: ZERO_ADDRESS,
        toDelegate: holder,
      })
      expectEvent(receipt, 'DelegateVotesChanged', {
        delegate: holder,
        previousBalance: '0',
        newBalance: supply,
      })

      assert(supply.eq(await udt.getCurrentVotes(holder)))
      assert(
        new BN(0).eq(await udt.getPriorVotes(holder, receipt.blockNumber - 1))
      )
      await time.advanceBlock()
      assert(supply.eq(await udt.getPriorVotes(holder, receipt.blockNumber)))
    })
    it('delegation without balance', async () => {
      expect(await udt.delegates(holder)).to.be.equal(ZERO_ADDRESS)

      const { receipt } = await udt.delegate(holder, { from: holder })
      expectEvent(receipt, 'DelegateChanged', {
        delegator: holder,
        fromDelegate: ZERO_ADDRESS,
        toDelegate: holder,
      })
      expectEvent.notEmitted(receipt, 'DelegateVotesChanged')

      expect(await udt.delegates(holder)).to.be.equal(holder)
    })

    describe('change delegation', () => {
      beforeEach(async () => {
        await udt.mint(holder, supply)
        await udt.delegate(holder, { from: holder })
      })

      it('call', async () => {
        expect(await udt.delegates(holder)).to.be.equal(holder)

        const { receipt } = await udt.delegate(holderDelegatee, {
          from: holder,
        })
        expectEvent(receipt, 'DelegateChanged', {
          delegator: holder,
          fromDelegate: holder,
          toDelegate: holderDelegatee,
        })
        expectEvent(receipt, 'DelegateVotesChanged', {
          delegate: holder,
          previousBalance: supply,
          newBalance: '0',
        })
        expectEvent(receipt, 'DelegateVotesChanged', {
          delegate: holderDelegatee,
          previousBalance: '0',
          newBalance: supply,
        })

        expect(await udt.delegates(holder)).to.be.equal(holderDelegatee)

        expect(await udt.getCurrentVotes(holder)).to.be.bignumber.equal('0')
        expect(
          await udt.getCurrentVotes(holderDelegatee)
        ).to.be.bignumber.equal(supply)
        expect(
          await udt.getPriorVotes(holder, receipt.blockNumber - 1)
        ).to.be.bignumber.equal(supply)
        expect(
          await udt.getPriorVotes(holderDelegatee, receipt.blockNumber - 1)
        ).to.be.bignumber.equal('0')
        await time.advanceBlock()
        expect(
          await udt.getPriorVotes(holder, receipt.blockNumber)
        ).to.be.bignumber.equal('0')
        expect(
          await udt.getPriorVotes(holderDelegatee, receipt.blockNumber)
        ).to.be.bignumber.equal(supply)
      })
    })
  })

  describe('Transfers', () => {
    let holderVotes
    let recipientVotes

    beforeEach(async () => {
      await udt.mint(holder, supply, { from: minter })
    })
    it('no delegation', async () => {
      const { receipt } = await udt.transfer(recipient, 1, {
        from: holder,
      })
      expectEvent(receipt, 'Transfer', {
        from: holder,
        to: recipient,
        value: '1',
      })
      expectEvent.notEmitted(receipt, 'DelegateVotesChanged')

      holderVotes = '0'
      recipientVotes = '0'
    })

    it('sender delegation', async () => {
      await udt.delegate(holder, { from: holder })

      const { receipt } = await udt.transfer(recipient, 1, {
        from: holder,
      })
      expectEvent(receipt, 'Transfer', {
        from: holder,
        to: recipient,
        value: '1',
      })
      expectEvent(receipt, 'DelegateVotesChanged', {
        delegate: holder,
        previousBalance: supply,
        newBalance: supply.subn(1),
      })

      holderVotes = supply.subn(1)
      recipientVotes = '0'
    })

    it('receiver delegation', async () => {
      await udt.delegate(recipient, { from: recipient })

      const { receipt } = await udt.transfer(recipient, 1, {
        from: holder,
      })
      expectEvent(receipt, 'Transfer', {
        from: holder,
        to: recipient,
        value: '1',
      })
      expectEvent(receipt, 'DelegateVotesChanged', {
        delegate: recipient,
        previousBalance: '0',
        newBalance: '1',
      })

      holderVotes = '0'
      recipientVotes = '1'
    })

    it('full delegation', async () => {
      await udt.delegate(holder, { from: holder })
      await udt.delegate(recipient, { from: recipient })

      const { receipt } = await udt.transfer(recipient, 1, {
        from: holder,
      })
      expectEvent(receipt, 'Transfer', {
        from: holder,
        to: recipient,
        value: '1',
      })
      expectEvent(receipt, 'DelegateVotesChanged', {
        delegate: holder,
        previousBalance: supply,
        newBalance: supply.subn(1),
      })
      expectEvent(receipt, 'DelegateVotesChanged', {
        delegate: recipient,
        previousBalance: '0',
        newBalance: '1',
      })

      holderVotes = supply.subn(1)
      recipientVotes = '1'
    })

    afterEach(async () => {
      expect(await udt.getCurrentVotes(holder)).to.be.bignumber.equal(
        holderVotes
      )
      expect(await udt.getCurrentVotes(recipient)).to.be.bignumber.equal(
        recipientVotes
      )

      // need to advance 2 blocks to see the effect of a transfer on "getPriorVotes"
      const blockNumber = await time.latestBlock()
      await time.advanceBlock()
      expect(
        await udt.getPriorVotes(holder, blockNumber)
      ).to.be.bignumber.equal(holderVotes)
      expect(
        await udt.getPriorVotes(recipient, blockNumber)
      ).to.be.bignumber.equal(recipientVotes)
    })
  })

  describe('Compound test suite', () => {
    beforeEach(async () => {
      await udt.mint(holder, supply)
    })

    describe('balanceOf', () => {
      it('grants to initial account', async () => {
        expect(await udt.balanceOf(holder)).to.be.bignumber.equal(
          '10000000000000000000000000'
        )
      })
    })

    describe('numCheckpoints', () => {
      it('returns the number of checkpoints for a delegate', async () => {
        await udt.transfer(recipient, '100', { from: holder }) // give an account a few tokens for readability
        expect(await udt.numCheckpoints(other1)).to.be.bignumber.equal('0')

        const t1 = await udt.delegate(other1, { from: recipient })
        expect(await udt.numCheckpoints(other1)).to.be.bignumber.equal('1')

        const t2 = await udt.transfer(other2, 10, { from: recipient })
        expect(await udt.numCheckpoints(other1)).to.be.bignumber.equal('2')

        const t3 = await udt.transfer(other2, 10, { from: recipient })
        expect(await udt.numCheckpoints(other1)).to.be.bignumber.equal('3')

        const t4 = await udt.transfer(recipient, 20, { from: holder })
        expect(await udt.numCheckpoints(other1)).to.be.bignumber.equal('4')

        expect(await udt.checkpoints(other1, 0)).to.be.deep.equal([
          t1.receipt.blockNumber.toString(),
          '100',
        ])
        expect(await udt.checkpoints(other1, 1)).to.be.deep.equal([
          t2.receipt.blockNumber.toString(),
          '90',
        ])
        expect(await udt.checkpoints(other1, 2)).to.be.deep.equal([
          t3.receipt.blockNumber.toString(),
          '80',
        ])
        expect(await udt.checkpoints(other1, 3)).to.be.deep.equal([
          t4.receipt.blockNumber.toString(),
          '100',
        ])

        await time.advanceBlock()
        expect(
          await udt.getPriorVotes(other1, t1.receipt.blockNumber)
        ).to.be.bignumber.equal('100')
        expect(
          await udt.getPriorVotes(other1, t2.receipt.blockNumber)
        ).to.be.bignumber.equal('90')
        expect(
          await udt.getPriorVotes(other1, t3.receipt.blockNumber)
        ).to.be.bignumber.equal('80')
        expect(
          await udt.getPriorVotes(other1, t4.receipt.blockNumber)
        ).to.be.bignumber.equal('100')
      })

      it('does not add more than one checkpoint in a block', async () => {
        await udt.transfer(recipient, '100', { from: holder })
        expect(await udt.numCheckpoints(other1)).to.be.bignumber.equal('0')

        const [t1] = await batchInBlock([
          () => udt.delegate(other1, { from: recipient, gas: 100000 }),
          () => udt.transfer(other2, 10, { from: recipient, gas: 100000 }),
          () => udt.transfer(other2, 10, { from: recipient, gas: 100000 }),
        ])
        expect(await udt.numCheckpoints(other1)).to.be.bignumber.equal('1')
        expect(await udt.checkpoints(other1, 0)).to.be.deep.equal([
          t1.receipt.blockNumber.toString(),
          '80',
        ])
        // expectReve(await udt.checkpoints(other1, 1)).to.be.deep.equal([ '0', '0' ]); // Reverts due to array overflow check
        // expect(await udt.checkpoints(other1, 2)).to.be.deep.equal([ '0', '0' ]); // Reverts due to array overflow check

        const t4 = await udt.transfer(recipient, 20, { from: holder })
        expect(await udt.numCheckpoints(other1)).to.be.bignumber.equal('2')
        expect(await udt.checkpoints(other1, 1)).to.be.deep.equal([
          t4.receipt.blockNumber.toString(),
          '100',
        ])
      })
    })

    describe('getPriorVotes', () => {
      it('reverts if block number >= current block', async () => {
        await expectRevert(
          udt.getPriorVotes(other1, 5e10),
          'ERC20Votes: block not yet mined'
        )
      })

      it('returns 0 if there are no checkpoints', async () => {
        expect(await udt.getPriorVotes(other1, 0)).to.be.bignumber.equal('0')
      })

      it('returns the latest block if >= last checkpoint block', async () => {
        const t1 = await udt.delegate(other1, { from: holder })
        await time.advanceBlock()
        await time.advanceBlock()

        expect(
          await udt.getPriorVotes(other1, t1.receipt.blockNumber)
        ).to.be.bignumber.equal('10000000000000000000000000')
        expect(
          await udt.getPriorVotes(other1, t1.receipt.blockNumber + 1)
        ).to.be.bignumber.equal('10000000000000000000000000')
      })

      it('returns zero if < first checkpoint block', async () => {
        await time.advanceBlock()
        const t1 = await udt.delegate(other1, { from: holder })
        await time.advanceBlock()
        await time.advanceBlock()

        expect(
          await udt.getPriorVotes(other1, t1.receipt.blockNumber - 1)
        ).to.be.bignumber.equal('0')
        expect(
          await udt.getPriorVotes(other1, t1.receipt.blockNumber + 1)
        ).to.be.bignumber.equal('10000000000000000000000000')
      })

      it('generally returns the voting balance at the appropriate checkpoint', async () => {
        const t1 = await udt.delegate(other1, { from: holder })
        await time.advanceBlock()
        await time.advanceBlock()
        const t2 = await udt.transfer(other2, 10, { from: holder })
        await time.advanceBlock()
        await time.advanceBlock()
        const t3 = await udt.transfer(other2, 10, { from: holder })
        await time.advanceBlock()
        await time.advanceBlock()
        const t4 = await udt.transfer(holder, 20, { from: other2 })
        await time.advanceBlock()
        await time.advanceBlock()

        expect(
          await udt.getPriorVotes(other1, t1.receipt.blockNumber - 1)
        ).to.be.bignumber.equal('0')
        expect(
          await udt.getPriorVotes(other1, t1.receipt.blockNumber)
        ).to.be.bignumber.equal('10000000000000000000000000')
        expect(
          await udt.getPriorVotes(other1, t1.receipt.blockNumber + 1)
        ).to.be.bignumber.equal('10000000000000000000000000')
        expect(
          await udt.getPriorVotes(other1, t2.receipt.blockNumber)
        ).to.be.bignumber.equal('9999999999999999999999990')
        expect(
          await udt.getPriorVotes(other1, t2.receipt.blockNumber + 1)
        ).to.be.bignumber.equal('9999999999999999999999990')
        expect(
          await udt.getPriorVotes(other1, t3.receipt.blockNumber)
        ).to.be.bignumber.equal('9999999999999999999999980')
        expect(
          await udt.getPriorVotes(other1, t3.receipt.blockNumber + 1)
        ).to.be.bignumber.equal('9999999999999999999999980')
        expect(
          await udt.getPriorVotes(other1, t4.receipt.blockNumber)
        ).to.be.bignumber.equal('10000000000000000000000000')
        expect(
          await udt.getPriorVotes(other1, t4.receipt.blockNumber + 1)
        ).to.be.bignumber.equal('10000000000000000000000000')
      })
    })
  })

  describe('getPastTotalSupply', () => {
    beforeEach(async () => {
      await udt.delegate(holder, { from: holder })
    })

    it('reverts if block number >= current block', async () => {
      await expectRevert(
        udt.getPastTotalSupply(5e10),
        'ERC20Votes: block not yet mined'
      )
    })

    it('returns 0 if there are no checkpoints', async () => {
      expect(await udt.getPastTotalSupply(0)).to.be.bignumber.equal('0')
    })

    it('returns the latest block if >= last checkpoint block', async () => {
      const t1 = await udt.mint(holder, supply)

      await time.advanceBlock()
      await time.advanceBlock()

      expect(
        await udt.getPastTotalSupply(t1.receipt.blockNumber)
      ).to.be.bignumber.equal(supply)
      expect(
        await udt.getPastTotalSupply(t1.receipt.blockNumber + 1)
      ).to.be.bignumber.equal(supply)
    })

    it('returns zero if < first checkpoint block', async () => {
      await time.advanceBlock()
      const t1 = await udt.mint(holder, supply)
      await time.advanceBlock()
      await time.advanceBlock()

      expect(
        await udt.getPastTotalSupply(t1.receipt.blockNumber - 1)
      ).to.be.bignumber.equal('0')
      expect(
        await udt.getPastTotalSupply(t1.receipt.blockNumber + 1)
      ).to.be.bignumber.equal('10000000000000000000000000')
    })

    it('generally returns the voting balance at the appropriate checkpoint', async () => {
      const t1 = await udt.mint(holder, supply)
      await time.advanceBlock()
      await time.advanceBlock()
      const t2 = await udt.mint(holder, 10)
      await time.advanceBlock()
      await time.advanceBlock()
      const t3 = await udt.mint(holder, 10)
      await time.advanceBlock()
      await time.advanceBlock()
      const t4 = await udt.mint(holder, 20)
      await time.advanceBlock()
      await time.advanceBlock()

      expect(
        await udt.getPastTotalSupply(t1.receipt.blockNumber - 1)
      ).to.be.bignumber.equal('0')
      expect(
        await udt.getPastTotalSupply(t1.receipt.blockNumber)
      ).to.be.bignumber.equal('10000000000000000000000000')
      expect(
        await udt.getPastTotalSupply(t1.receipt.blockNumber + 1)
      ).to.be.bignumber.equal('10000000000000000000000000')
      expect(
        await udt.getPastTotalSupply(t2.receipt.blockNumber)
      ).to.be.bignumber.equal('10000000000000000000000010')
      expect(
        await udt.getPastTotalSupply(t2.receipt.blockNumber + 1)
      ).to.be.bignumber.equal('10000000000000000000000010')
      expect(
        await udt.getPastTotalSupply(t3.receipt.blockNumber)
      ).to.be.bignumber.equal('10000000000000000000000020')
      expect(
        await udt.getPastTotalSupply(t3.receipt.blockNumber + 1)
      ).to.be.bignumber.equal('10000000000000000000000020')
      expect(
        await udt.getPastTotalSupply(t4.receipt.blockNumber)
      ).to.be.bignumber.equal('10000000000000000000000040')
      expect(
        await udt.getPastTotalSupply(t4.receipt.blockNumber + 1)
      ).to.be.bignumber.equal('10000000000000000000000040')
    })
  })
})
