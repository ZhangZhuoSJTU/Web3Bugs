import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { id } from 'ethers/lib/utils'
import { smock } from '@defi-wonderland/smock'
import { ZERO_ADDRESS } from 'prepo-constants'
import { tokenSenderCallerFixture } from './fixtures/TokenSenderCallerFixtures'
import { TokenSenderCaller } from '../types/generated'

chai.use(smock.matchers)

describe('=> TokenSenderCaller', () => {
  let tokenSenderCaller: TokenSenderCaller
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let treasury: SignerWithAddress
  let tokenSender: SignerWithAddress

  beforeEach(async () => {
    ;[deployer, user, treasury, tokenSender] = await ethers.getSigners()
    tokenSenderCaller = await tokenSenderCallerFixture()
  })

  describe('initial state', () => {
    it('does not set treasury', async () => {
      expect(await tokenSenderCaller.getTreasury()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setTreasury', () => {
    it('sets treasury to non-zero address', async () => {
      await tokenSenderCaller.connect(deployer).setTreasury(treasury.address)

      expect(await tokenSenderCaller.getTreasury()).to.eq(treasury.address)
    })

    it('sets treasury to zero address', async () => {
      await tokenSenderCaller.connect(deployer).setTreasury(ZERO_ADDRESS)

      expect(await tokenSenderCaller.getTreasury()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      await tokenSenderCaller.connect(deployer).setTreasury(treasury.address)
      expect(await tokenSenderCaller.getTreasury()).to.eq(treasury.address)

      await tokenSenderCaller.connect(deployer).setTreasury(treasury.address)

      expect(await tokenSenderCaller.getTreasury()).to.eq(treasury.address)
    })

    it('emits TreasuryChange event', async () => {
      await expect(tokenSenderCaller.connect(deployer).setTreasury(treasury.address))
        .to.emit(tokenSenderCaller, 'TreasuryChange')
        .withArgs(treasury.address)
    })
  })

  describe('# setTokenSender', () => {
    it('sets non-zero address', async () => {
      await tokenSenderCaller.connect(deployer).setTokenSender(tokenSender.address)

      expect(await tokenSenderCaller.getTokenSender()).to.eq(tokenSender.address)
    })

    it('sets zero address', async () => {
      await tokenSenderCaller.connect(deployer).setTokenSender(ZERO_ADDRESS)

      expect(await tokenSenderCaller.getTokenSender()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      await tokenSenderCaller.connect(deployer).setTokenSender(tokenSender.address)
      expect(await tokenSenderCaller.getTokenSender()).to.eq(tokenSender.address)

      await tokenSenderCaller.connect(deployer).setTokenSender(tokenSender.address)

      expect(await tokenSenderCaller.getTokenSender()).to.eq(tokenSender.address)
    })

    it('emits TokenSenderChange', async () => {
      await expect(tokenSenderCaller.connect(deployer).setTokenSender(tokenSender.address))
        .to.emit(tokenSenderCaller, 'TokenSenderChange')
        .withArgs(tokenSender.address)
    })
  })
})
