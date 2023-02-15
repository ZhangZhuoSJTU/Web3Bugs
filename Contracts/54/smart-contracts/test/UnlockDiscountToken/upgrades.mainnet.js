const { reverts } = require('truffle-assertions')
const { config, ethers, assert, network, upgrades } = require('hardhat')
const { time } = require('@openzeppelin/test-helpers')
const { errorMessages } = require('../helpers/constants')
const multisigABI = require('../helpers/ABIs/multisig.json')
const proxyABI = require('../helpers/ABIs/proxy.json')

const { VM_ERROR_REVERT_WITH_REASON } = errorMessages

const UDTProxyContractAddress = '0x90DE74265a416e1393A450752175AED98fe11517'
const proxyAdminAddress = '0x79918A4389A437906538E0bbf39918BfA4F7690e'

const deployerAddress = '0x33ab07dF7f09e793dDD1E9A25b079989a557119A'
const multisigAddress = '0xa39b44c4AFfbb56b76a1BF1d19Eb93a5DfC2EBA9'

// helper function
const upgradeContract = async () => {
  // prepare upgrade and deploy new contract implementation
  const deployer = await ethers.getSigner(deployerAddress)
  const UnlockDiscountTokenV2 = await ethers.getContractFactory(
    'UnlockDiscountTokenV2',
    deployer
  )
  const newImpl = await upgrades.prepareUpgrade(
    UDTProxyContractAddress,
    UnlockDiscountTokenV2,
    {}
  )

  // update contract implementation address in proxy admin using multisig
  const multisig = await ethers.getContractAt(multisigABI, multisigAddress)

  const signers = await multisig.getOwners()
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [signers[0]],
  })
  // give some ETH
  const balance = ethers.utils.hexStripZeros(ethers.utils.parseEther('1000'))
  await network.provider.send('hardhat_setBalance', [signers[0], balance])

  const issuer = await ethers.getSigner(signers[0])
  const multisigIssuer = multisig.connect(issuer)

  // build upgrade tx
  const proxy = await ethers.getContractAt(proxyABI, UDTProxyContractAddress)
  const data = proxy.interface.encodeFunctionData('upgrade', [
    UDTProxyContractAddress,
    newImpl,
  ])

  // submit proxy upgrade tx
  const tx = await multisigIssuer.submitTransaction(
    proxyAdminAddress,
    0, // ETH value
    data
  )

  // get tx id
  const { events } = await tx.wait()
  const evt = events.find((v) => v.event === 'Confirmation')
  const transactionId = evt.args[1]

  // reach concensus
  await Promise.all(
    signers.slice(1, 4).map(async (signerAddress) => {
      await network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [signerAddress],
      })
      const balance = ethers.utils.hexStripZeros(
        ethers.utils.parseEther('1000')
      )
      await network.provider.send('hardhat_setBalance', [
        signerAddress,
        balance,
      ])

      const signer = await ethers.getSigner(signerAddress)

      const m = multisig.connect(signer)
      await m.confirmTransaction(transactionId, { gasLimit: 1200000 })
    })
  )

  return UnlockDiscountTokenV2.attach(UDTProxyContractAddress)
}

contract('UnlockDiscountToken (on mainnet)', async () => {
  let udt
  let deployer

  beforeEach(async function setupMainnetForkTestEnv() {
    if (!process.env.RUN_MAINNET_FORK) {
      // all suite will be skipped
      this.skip()
    }

    // reset fork
    const { forking } = config.networks.hardhat
    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: forking.url,
            blockNumber: forking.blockNumber,
          },
        },
      ],
    })

    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [deployerAddress],
    })

    // give some ETH to deployer
    const balance = ethers.utils.hexStripZeros(ethers.utils.parseEther('1000'))
    await network.provider.send('hardhat_setBalance', [
      deployerAddress,
      balance,
    ])

    // get UDT instance
    deployer = await ethers.getSigner(deployerAddress)
    const UnlockDiscountToken = await ethers.getContractFactory(
      'UnlockDiscountTokenV2',
      deployer
    )

    udt = UnlockDiscountToken.attach(UDTProxyContractAddress)
  })

  describe('The mainnet fork', () => {
    it('impersonates UDT deployer correctly', async () => {
      const { signer } = udt
      assert.equal(signer.address, deployerAddress)
    })

    it('UDT deployer has been revoked', async () => {
      assert.equal(await udt.isMinter(deployerAddress), false)
    })
  })

  describe('Existing UDT contract (before upgrade)', () => {
    it('starting supply > 1M', async () => {
      const totalSupply = await udt.totalSupply()
      assert.equal(totalSupply.eq(0), false)
      // more than initial pre-mined 1M
      assert(totalSupply.gt(ethers.utils.parseEther('1000000')))
    })

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

    it('lives at the same address', async () => {
      assert.equal(udt.address, UDTProxyContractAddress)
    })

    /*
    // TODO: why bytes length difference btw builds?
    // 10390
    // +10352
    it('is the same bytecode as local version', async () => {
      const UnlockDiscountToken = await ethers.getContractFactory(
        'UnlockDiscountToken'
      )
      const deployedByteCode = await ethers.provider.getCode(
        UDTProxyInfo.implementation
      )
      deployedAbi.forEach((d, i) => {
        assert.deepEqual(deployedAbi[i], abi[i])
        // console.log(deployedAbi[i], abi[i], '\n\n')
      })
      assert.equal(UnlockDiscountToken.bytecode.length, deployedByteCode.length)
      assert.equal(`${UnlockDiscountToken.bytecode}`, `${deployedByteCode}`)
    })
    */
  })

  describe('Existing supply', () => {
    it('Supply is preserved after upgrade', async () => {
      const totalSupply = await udt.totalSupply()

      // upgrade the contract
      const updated = await upgradeContract()

      const totalSupplyAfterUpdate = await updated.totalSupply()
      assert.equal(totalSupplyAfterUpdate.toString(), totalSupply.toString())
    })

    it('New tokens can not be issued anymore', async () => {
      const [, minter] = await ethers.getSigners()

      // upgrade
      const updated = await upgradeContract()

      // mint tokens
      await reverts(
        updated.addMinter(minter.address),
        `${VM_ERROR_REVERT_WITH_REASON} 'MinterRole: caller does not have the Minter role'`
      )
    })
  })

  describe('Details', () => {
    it('name is preserved', async () => {
      const updated = await upgradeContract()
      const updatedName = await updated.name()
      assert.equal(updatedName, 'Unlock Discount Token')
    })

    it('symbol is preserved', async () => {
      const updated = await upgradeContract()
      const updatedSymbol = await updated.symbol()
      assert.equal(updatedSymbol, 'UDT')
    })

    it('decimals are preserved', async () => {
      const updated = await upgradeContract()
      const updatedDecimals = await updated.decimals()
      assert.equal(updatedDecimals, 18)
    })
  })

  describe('Multisig', () => {
    it('tx is deployed properly', async () => {
      await upgradeContract()
      const multisig = await ethers.getContractAt(multisigABI, multisigAddress)

      const transactionId = (await multisig.transactionCount()).toNumber() - 1
      const count = await multisig.getConfirmationCount(transactionId)
      assert.equal(4, await count.toNumber())
      assert(await multisig.isConfirmed(transactionId))
      const [, , , executed] = await multisig.transactions(transactionId)
      assert(executed)
    })
  })

  describe('initialize2()', () => {
    it('reset pastTotalSupply properly', async () => {
      // upgrade contract
      udt = await upgradeContract()

      const blockNumber = await ethers.provider.getBlockNumber()
      await time.advanceBlock()
      const supplyBefore = await udt.getPastTotalSupply(blockNumber)

      const tx = await udt.initialize2()
      const receipt = await tx.wait()
      await time.advanceBlock()

      const supplyAfter = await udt.getPastTotalSupply(receipt.blockNumber)
      assert.isTrue(supplyBefore.lt(supplyAfter))

      const totalSupply = await udt.totalSupply()
      assert.isTrue(supplyAfter.eq(totalSupply))
    })

    it('sets domain separator', async () => {
      const domainSeparatorBefore = await udt.DOMAIN_SEPARATOR()
      assert.isTrue(domainSeparatorBefore.length !== 0)
      // Note: Etherscan yields a different value, but Hardhat will still show a chain id of 31337 on mainnet forks, and this affects the DOMAIN_SEPARATOR
      assert.equal(
        domainSeparatorBefore,
        '0x441b58d23170603d99a03316b633425cffa08ea4fd19bd4fa31bb12ff0c7113e'
      )

      // upgrade contract
      udt = await upgradeContract()

      const expectedDomain = {
        name: await udt.name(),
        version: '1',
        chainId: await udt.provider.getNetwork().then(({ chainId }) => chainId),
        verifyingContract: udt.address,
      }

      const tx = await udt.initialize2()
      await tx.wait()

      const domainSeparatorAfter = await udt.DOMAIN_SEPARATOR()
      assert.notEqual(domainSeparatorBefore, domainSeparatorAfter)
      assert.isTrue(domainSeparatorAfter.length !== 0)
      assert.equal(
        domainSeparatorAfter,
        ethers.utils._TypedDataEncoder.hashDomain(expectedDomain)
      )
      assert.notEqual(domainSeparatorAfter, domainSeparatorBefore)
    })
  })

  describe('transfers', () => {
    it('should support transfer by permit', async () => {
      const [spender] = await ethers.getSigners()

      const permitter = ethers.Wallet.createRandom()

      udt = await upgradeContract()
      await udt.initialize2()
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
        const multisig = await ethers.getContractAt(
          multisigABI,
          multisigAddress
        )

        const [holderAddress] = await multisig.getOwners()
        await network.provider.request({
          method: 'hardhat_impersonateAccount',
          params: [holderAddress],
        })
        const holder = await ethers.getSigner(holderAddress)

        // make the upgrade
        udt = await upgradeContract()
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
        // make the upgrade
        udt = await upgradeContract()
        await udt.initialize2()

        // Create a user
        const delegator = ethers.Wallet.createRandom()

        // We assume the first signer on the multisig has at least 1 token
        const multisig = await ethers.getContractAt(
          multisigABI,
          multisigAddress
        )

        const [holderAddress] = await multisig.getOwners()
        await network.provider.request({
          method: 'hardhat_impersonateAccount',
          params: [holderAddress],
        })
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
})
