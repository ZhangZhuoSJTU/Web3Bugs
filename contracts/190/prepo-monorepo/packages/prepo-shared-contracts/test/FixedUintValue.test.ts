import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS } from 'prepo-constants'
import { parseEther } from 'ethers/lib/utils'
import { fixedUintValueFixture } from './fixtures/FixedUintValueFixture'
import { FixedUintValue } from '../types/generated'

describe('FixedUintValue', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let fixedUintValue: FixedUintValue

  const setupFixedUintValue = async (): Promise<void> => {
    ;[deployer, user1] = await ethers.getSigners()
    owner = deployer
    fixedUintValue = await fixedUintValueFixture()
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await setupFixedUintValue()
    })

    it('sets owner to deployer', async () => {
      expect(await fixedUintValue.owner()).to.eq(deployer.address)
    })

    it('sets nominee to zero address', async () => {
      expect(await fixedUintValue.getNominee()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# set', () => {
    beforeEach(async () => {
      await setupFixedUintValue()
    })

    it('reverts if not owner', async () => {
      expect(await fixedUintValue.owner()).to.not.eq(user1.address)

      await expect(fixedUintValue.connect(user1).set(parseEther('1'))).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets price to non-zero value', async () => {
      expect(await fixedUintValue.get()).to.eq(0)

      await fixedUintValue.connect(owner).set(parseEther('1'))

      expect(await fixedUintValue.get()).to.eq(parseEther('1'))
    })

    it('sets price to zero', async () => {
      await fixedUintValue.connect(owner).set(parseEther('1'))
      expect(await fixedUintValue.get()).to.not.eq(0)

      await fixedUintValue.connect(owner).set(0)

      expect(await fixedUintValue.get()).to.eq(0)
    })

    it('is idempotent', async () => {
      expect(await fixedUintValue.get()).to.not.eq(parseEther('1'))

      await fixedUintValue.connect(owner).set(parseEther('1'))

      expect(await fixedUintValue.get()).to.eq(parseEther('1'))

      await fixedUintValue.connect(owner).set(parseEther('1'))

      expect(await fixedUintValue.get()).to.eq(parseEther('1'))
    })

    it('emits ValueChange', async () => {
      const tx = await fixedUintValue.connect(owner).set(parseEther('1'))

      await expect(tx).to.emit(fixedUintValue, 'ValueChange(uint256)').withArgs(parseEther('1'))
    })
  })
})
