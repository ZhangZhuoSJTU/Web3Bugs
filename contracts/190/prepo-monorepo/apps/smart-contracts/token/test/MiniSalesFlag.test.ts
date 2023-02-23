import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS } from 'prepo-constants'
import { miniSalesFlagFixture } from './fixtures/MiniSalesFixtures'
import { MiniSalesFlag } from '../types/generated'

describe('=> MiniSalesFlag', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let miniSalesFlag: MiniSalesFlag

  const setupMiniSalesFlag = async (): Promise<void> => {
    ;[deployer, owner, user1] = await ethers.getSigners()
    miniSalesFlag = await miniSalesFlagFixture()
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await setupMiniSalesFlag()
    })

    it('sets owner to deployer', async () => {
      expect(await miniSalesFlag.owner()).to.eq(deployer.address)
    })

    it('sets nominee to zero address', async () => {
      expect(await miniSalesFlag.getNominee()).to.eq(ZERO_ADDRESS)
    })
  })

  describe('# setSaleStarted', () => {
    beforeEach(async () => {
      await setupMiniSalesFlag()
      owner = deployer
    })

    it('reverts if not owner', async () => {
      expect(await miniSalesFlag.owner()).to.not.eq(user1.address)

      await expect(miniSalesFlag.connect(user1).setSaleStarted(true)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to true', async () => {
      expect(await miniSalesFlag.hasSaleStarted()).to.eq(false)

      await miniSalesFlag.connect(owner).setSaleStarted(true)

      expect(await miniSalesFlag.hasSaleStarted()).to.eq(true)
    })

    it('sets to false', async () => {
      await miniSalesFlag.connect(owner).setSaleStarted(true)
      expect(await miniSalesFlag.hasSaleStarted()).to.eq(true)

      await miniSalesFlag.connect(owner).setSaleStarted(false)

      expect(await miniSalesFlag.hasSaleStarted()).to.eq(false)
    })

    it('is idempotent', async () => {
      expect(await miniSalesFlag.hasSaleStarted()).to.eq(false)

      await miniSalesFlag.connect(owner).setSaleStarted(true)

      expect(await miniSalesFlag.hasSaleStarted()).to.eq(true)

      await miniSalesFlag.connect(owner).setSaleStarted(true)

      expect(await miniSalesFlag.hasSaleStarted()).to.eq(true)
    })
  })
})
