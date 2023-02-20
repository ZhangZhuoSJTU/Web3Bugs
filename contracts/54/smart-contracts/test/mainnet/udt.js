const { ethers } = require('hardhat')
const { reverts } = require('truffle-assertions')
const { time } = require('@openzeppelin/test-helpers')
const { getProxyAddress } = require('../../helpers/deployments')

const { resetNodeState, impersonate } = require('../helpers/mainnet')
const { errorMessages } = require('../helpers/constants')
const { getUnlockMultisigOwners } = require('../../helpers/multisig')

const { VM_ERROR_REVERT_WITH_REASON } = errorMessages

contract('UnlockDiscountToken on mainnet', async () => {
  let udt
  const chainId = 1 // mainnet
  let unlockAddress

  beforeEach(async function setupMainnetForkTestEnv() {
    if (!process.env.RUN_MAINNET_FORK) {
      // all suite will be skipped
      this.skip()
    }

    // reset fork
    await resetNodeState()

    // prepare proxy info
    const proxyAddress = getProxyAddress(chainId, 'UnlockDiscountTokenV2')
    // const proxyAdmin = getProxyAdminAddress({ network })
    // await impersonate(proxyAdmin)

    // mocha settings
    this.timeout(200000)

    const UnlockDiscountToken = await ethers.getContractFactory(
      'UnlockDiscountTokenV2'
    )
    const [, minter] = await ethers.getSigners()
    udt = await UnlockDiscountToken.attach(proxyAddress).connect(minter)

    unlockAddress = getProxyAddress(chainId, 'Unlock')
  })

  describe('ERC20 details', () => {
    it('name is set', async () => {
      const name = await udt.name()
      assert.equal(name, 'Unlock Discount Token')
    })

    it('symbol is set', async () => {
      const symbol = await udt.symbol()
      assert.equal(symbol, 'UDT')
    })

    it('decimals are set', async () => {
      const decimals = await udt.decimals()
      assert.equal(decimals, 18)
    })
  })

  describe('mint', () => {
    const amount = ethers.utils.hexStripZeros(ethers.utils.parseEther('1000'))

    it('minters can not be added anymore', async () => {
      const [, minter] = await ethers.getSigners()
      await reverts(
        udt.addMinter(minter.address),
        `${VM_ERROR_REVERT_WITH_REASON} 'MinterRole: caller does not have the Minter role'`
      )
    })
    it('random accounts can not mint', async () => {
      const [, , , , lambda] = await ethers.getSigners()
      const recipient = await ethers.Wallet.createRandom()

      await reverts(
        udt.connect(lambda).mint(recipient.address, amount),
        `${VM_ERROR_REVERT_WITH_REASON} 'MinterRole: caller does not have the Minter role'`
      )
    })
    describe('the Unlock contract', () => {
      it('is declared as minter', async () => {
        assert.equal(await udt.isMinter(unlockAddress), true)
      })
      it('can mint', async () => {
        const recipient = await ethers.Wallet.createRandom()

        await impersonate(unlockAddress)
        const unlock = await ethers.getSigner(unlockAddress)
        const tx = await udt.connect(unlock).mint(recipient.address, amount)

        const { events } = await tx.wait()
        const { args } = events.find((v) => v.event === 'Transfer')

        assert.equal(args.from, ethers.constants.AddressZero)
        assert.equal(args.to, recipient.address)
        assert.equal(args.value.eq(amount), true)
      })
    })
  })

  describe('burn', () => {
    it('function does not exist', async () => {
      assert.equal(udt.burn, null)
      assert.equal(Object.keys(udt).includes('burn'), false)
      assert.equal(Object.keys(udt.functions).includes('burn'), false)
      assert.equal(Object.keys(udt.functions).includes('burn()'), false)
    })
  })

  describe('supply', () => {
    it('is more than 1M', async () => {
      const totalSupply = await udt.totalSupply()
      assert.equal(
        totalSupply.gt(0),
        true,
        'starting supply must be different from 0'
      )
      // more than 1M
      assert(totalSupply.gt(ethers.utils.parseEther('1000000')))
    })

    // totalSupply at block height for ERC20Votes function
    describe('pastTotalSupply', async () => {
      it('corresponds to latest totalSupply', async () => {
        const blockNumber = await ethers.provider.getBlockNumber()
        await time.advanceBlock()
        const pastTotalSupply = await udt.getPastTotalSupply(blockNumber)
        const totalSupply = await udt.totalSupply()
        assert.isTrue(pastTotalSupply.eq(totalSupply))
      })
      it('increases when tokens are minted', async () => {
        const amount = ethers.utils.hexStripZeros(
          ethers.utils.parseEther('1000')
        )
        const blockNumber = await ethers.provider.getBlockNumber()
        await time.advanceBlock()
        const pastTotalSupply = await udt.getPastTotalSupply(blockNumber)

        // mint some tokens
        const recipient = await ethers.Wallet.createRandom()
        await impersonate(unlockAddress)
        const unlock = await ethers.getSigner(unlockAddress)
        const tx = await udt.connect(unlock).mint(recipient.address, amount)
        const receipt = await tx.wait()
        await time.advanceBlock()

        const pastTotalSupplyAfter = await udt.getPastTotalSupply(
          receipt.blockNumber
        )
        assert.isTrue(pastTotalSupplyAfter.eq(pastTotalSupply.add(amount)))
      })
    })
  })

  describe('transfers', () => {
    it('should support simple transfer of tokens', async () => {
      const amount = 1
      const [holderAddress] = await getUnlockMultisigOwners()
      await impersonate(holderAddress)
      const holder = await ethers.getSigner(holderAddress)

      const recipient = await ethers.Wallet.createRandom()
      await udt.connect(holder).transfer(recipient.address, amount)

      const balanceAfter = await udt.balanceOf(recipient.address)
      assert.equal(balanceAfter, amount)
    })
    it('should support allowance/transferFrom', async () => {
      const amount = 1

      const [holderAddress] = await getUnlockMultisigOwners()
      await impersonate(holderAddress)
      const holder = await ethers.getSigner(holderAddress)

      const [spender] = await ethers.getSigners()
      const recipient = await ethers.Wallet.createRandom()

      const allowanceBefore = await udt.allowance(
        holder.address,
        spender.address
      )
      assert.equal(allowanceBefore.toNumber(), 0)

      // allow
      await udt.connect(holder).approve(spender.address, amount)
      const allowance = await udt.allowance(holder.address, spender.address)
      assert.equal(allowance.toNumber(), amount)

      // transfer
      await udt
        .connect(spender)
        .transferFrom(holder.address, recipient.address, amount)

      const balanceAfter = await udt.balanceOf(recipient.address)
      assert.equal(balanceAfter, amount)

      const allowanceAfter = await udt.allowance(
        holder.address,
        recipient.address
      )
      assert.equal(allowanceAfter.toNumber(), 0)
    })

    it('should support transfer by permit', async () => {
      const [spender] = await ethers.getSigners()
      const permitter = ethers.Wallet.createRandom()

      udt = udt.connect(spender)

      // Check approval
      const approvedAmountBefore = await udt
        .connect(spender)
        .allowance(spender.address, permitter.address)
      assert.equal(approvedAmountBefore, 0)

      const value = 1
      const deadline = Math.floor(new Date().getTime()) + 60 * 60 * 24
      const { chainId } = await ethers.provider.getNetwork()
      const nonce = await udt.nonces(permitter.address)

      const domain = {
        name: await udt.name(),
        version: '1',
        chainId,
        verifyingContract: udt.address,
      }

      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      }

      const message = {
        owner: permitter.address,
        spender: spender.address,
        value,
        nonce,
        deadline,
      }

      const signature = await permitter._signTypedData(domain, types, message)

      // Let's now have the holder submit the
      const { v, r, s } = ethers.utils.splitSignature(signature)

      const tx = await udt.permit(
        permitter.address,
        spender.address,
        value,
        deadline,
        v,
        r,
        s
      )
      const { events } = await tx.wait()
      const evtApproval = events.find((v) => v.event === 'Approval')
      assert.equal(evtApproval.args.owner, permitter.address)
      assert.equal(evtApproval.args.spender, spender.address)
      assert.isTrue(evtApproval.args.value.eq(value))
    })
  })

  describe('governance', () => {
    describe('Delegation', () => {
      it('delegation with balance', async () => {
        // a holder directly interact w udt
        const [holderAddress] = await getUnlockMultisigOwners()
        await impersonate(holderAddress)
        const holder = await ethers.getSigner(holderAddress)
        udt = udt.connect(holder)

        // delegate some votes
        const supply = await udt.balanceOf(holder.address)
        const [recipient] = await ethers.getSigners()
        const tx = await udt.delegate(recipient.address)
        const { events, blockNumber } = await tx.wait()

        const evtChanged = events.find((v) => v.event === 'DelegateChanged')
        const [delegator, fromDelegate, toDelegate] = evtChanged.args

        const evtVotesChanges = events.find(
          (v) => v.event === 'DelegateVotesChanged'
        )
        const [delegate, previousBalance, newBalance] = evtVotesChanges.args

        assert.equal(delegator, holder.address)
        assert.equal(fromDelegate, holder.address)
        assert.equal(toDelegate, recipient.address)

        assert.equal(delegate, holder.address)
        assert.equal(newBalance.toString(), '0')
        assert(previousBalance.eq(supply))

        assert(supply.eq(await udt.getCurrentVotes(recipient.address)))
        assert(
          (await udt.getPriorVotes(recipient.address, blockNumber - 1)).eq(0)
        )
        await time.advanceBlock()
        assert(
          supply.eq(await udt.getPriorVotes(recipient.address, blockNumber))
        )
      })

      it('delegation by signature', async () => {
        // Create a user
        const delegator = ethers.Wallet.createRandom()

        // We assume the first signer on the multisig has at least 1 token
        const [holderAddress] = await getUnlockMultisigOwners()
        await impersonate(holderAddress)
        const holder = await ethers.getSigner(holderAddress)

        const balanceBefore = await udt.balanceOf(delegator.address)
        assert.equal(balanceBefore, 0)

        const delegateBefore = await udt.delegates(delegator.address)
        assert.equal(delegateBefore, 0)

        const votesHolderBefore = await udt.getCurrentVotes(holder.address)
        assert.isTrue(votesHolderBefore.gt(0))

        const balanceHolderBefore = await udt.balanceOf(holder.address)
        assert.isTrue(balanceHolderBefore.gt(0))

        // Transfer 1 token
        udt = udt.connect(holder)
        await udt.transfer(delegator.address, 1)

        const balanceAfter = await udt.balanceOf(delegator.address)
        assert.equal(balanceAfter, 1)

        const { chainId } = await ethers.provider.getNetwork()

        const domain = {
          name: await udt.name(),
          version: '1',
          chainId,
          verifyingContract: udt.address,
        }

        const types = {
          Delegation: [
            { name: 'delegatee', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'expiry', type: 'uint256' },
          ],
        }

        const delegatee = holder.address
        const nonce = 0
        const expiry = Math.floor(new Date().getTime()) + 60 * 60 * 24 // 1 day

        const message = {
          delegatee,
          nonce,
          expiry,
        }

        const signature = await delegator._signTypedData(domain, types, message)

        // Let's now have the holder submit the
        const { v, r, s } = ethers.utils.splitSignature(signature)
        const tx = await udt.delegateBySig(delegatee, nonce, expiry, v, r, s)
        const { events } = await tx.wait()

        const evtDelegateChanged = events.find(
          (v) => v.event === 'DelegateChanged'
        )
        assert.equal(evtDelegateChanged.args.delegator, delegator.address)
        assert.equal(
          evtDelegateChanged.args.fromDelegate,
          ethers.constants.AddressZero
        )
        assert.equal(evtDelegateChanged.args.toDelegate, holder.address)

        const evtDelegateVotesChanged = events.find(
          (v) => v.event === 'DelegateVotesChanged'
        )
        assert.equal(evtDelegateVotesChanged.args.delegate, holder.address)
        assert.isTrue(
          evtDelegateVotesChanged.args.previousBalance.eq(
            votesHolderBefore.sub(1)
          )
        )
        assert.isTrue(
          evtDelegateVotesChanged.args.newBalance.eq(votesHolderBefore)
        )

        const delegateAfter = await udt.delegates(delegator.address)
        assert.equal(delegateAfter, delegatee)

        const votesHolderAfter = await udt.getCurrentVotes(holder.address)
        assert.isTrue(votesHolderAfter.eq(votesHolderBefore))
      })
    })
  })

  describe('domain separator', () => {
    it('is set correctly', async () => {
      const expectedDomain = {
        name: await udt.name(),
        version: '1',
        chainId: await udt.provider.getNetwork().then(({ chainId }) => chainId),
        verifyingContract: udt.address,
      }

      const domainSeparator = await udt.DOMAIN_SEPARATOR()
      assert.equal(
        domainSeparator,
        ethers.utils._TypedDataEncoder.hashDomain(expectedDomain)
      )
    })
  })
})
