import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id, parseEther } from 'ethers/lib/utils'
import { Contract } from 'ethers'
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock'
import { ZERO_ADDRESS } from 'prepo-constants'
import {
  fakeAccountListFixture,
  mintHookFixture,
  smockAccountListFixture,
} from './fixtures/HookFixture'
import { MintHook } from '../typechain'

chai.use(smock.matchers)

describe('=> MintHook', () => {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let market: SignerWithAddress
  let mintHook: MintHook
  let allowlist: MockContract<Contract>
  let msgSendersAllowlist: FakeContract<Contract>

  beforeEach(async () => {
    ;[deployer, user, market] = await ethers.getSigners()
    mintHook = await mintHookFixture()
    allowlist = await smockAccountListFixture()
    msgSendersAllowlist = await fakeAccountListFixture()
    await mintHook.connect(deployer).setAccountList(allowlist.address)
    await mintHook.connect(deployer).setAllowedMsgSenders(msgSendersAllowlist.address)
  })

  describe('initial state', () => {
    it('sets deployer to owner', async () => {
      expect(await mintHook.owner()).to.eq(deployer.address)
    })

    it('sets nominee to zero address', async () => {
      expect(await mintHook.getNominee()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setAccountList', () => {
    it('reverts if not owner', async () => {
      expect(await mintHook.owner()).to.not.eq(user.address)

      await expect(mintHook.connect(user).setAccountList(allowlist.address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('succeeds if owner', async () => {
      expect(await mintHook.owner()).to.eq(deployer.address)

      await mintHook.connect(deployer).setAccountList(allowlist.address)
    })
  })

  describe('# setAllowedMsgSenders', () => {
    it('reverts if not owner', async () => {
      expect(await mintHook.owner()).to.not.eq(user.address)

      await expect(
        mintHook.connect(user).setAllowedMsgSenders(msgSendersAllowlist.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('succeeds if owner', async () => {
      expect(await mintHook.owner()).to.eq(deployer.address)

      await mintHook.connect(deployer).setAllowedMsgSenders(msgSendersAllowlist.address)
    })
  })

  describe('# hook', () => {
    beforeEach(() => {
      msgSendersAllowlist.isIncluded.whenCalledWith(market.address).returns(true)
    })

    it('reverts if caller not allowed', async () => {
      expect(await msgSendersAllowlist.isIncluded(user.address)).to.be.false

      await expect(mintHook.connect(user).hook(user.address, 2, 1)).to.be.revertedWith(
        'msg.sender not allowed'
      )
    })

    it('reverts if sender not allowed', async () => {
      expect(await msgSendersAllowlist.isIncluded(market.address)).to.be.true
      expect(await allowlist.isIncluded(user.address)).to.eq(false)

      await expect(mintHook.connect(market).hook(user.address, 2, 1)).to.be.revertedWith(
        'minter not allowed'
      )
    })

    it('succeeds if sender allowed', async () => {
      expect(await msgSendersAllowlist.isIncluded(market.address)).to.eq(true)
      await allowlist.connect(deployer).set([user.address], [true])
      expect(await allowlist.isIncluded(user.address)).to.eq(true)

      await mintHook.connect(market).hook(user.address, 2, 1)
    })
  })
})
