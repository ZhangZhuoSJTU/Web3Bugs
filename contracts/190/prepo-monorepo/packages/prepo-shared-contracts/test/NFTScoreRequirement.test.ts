import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { MockContract, smock } from '@defi-wonderland/smock'
import { NFTScoreRequirement } from '../types/generated'
import { nftScoreRequirementFixture } from './fixtures/NFTScoreRequirementFixture'
import { Contract } from 'ethers'

chai.use(smock.matchers)

describe('=> NFTScoreRequirement', () => {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let nftScoreRequirement: NFTScoreRequirement
  let firstERC721: MockContract<Contract>
  let secondERC721: MockContract<Contract>

  beforeEach(async () => {
    ;[deployer, user] = await ethers.getSigners()
    nftScoreRequirement = await nftScoreRequirementFixture()
    const mockERC721Factory = await smock.mock('ERC721Mintable')
    firstERC721 = await mockERC721Factory.deploy('firstERC721', 'NFT1')
    secondERC721 = await mockERC721Factory.deploy('secondERC721', 'NFT2')
  })

  describe('# setRequiredScore', () => {
    it('sets to > 0', async () => {
      expect(await nftScoreRequirement.getRequiredScore()).to.not.be.gt(0)

      await nftScoreRequirement.connect(deployer).setRequiredScore(1)

      expect(await nftScoreRequirement.getRequiredScore()).to.be.gt(0)
    })

    it('sets to 0', async () => {
      await nftScoreRequirement.connect(deployer).setRequiredScore(1)
      expect(await nftScoreRequirement.getRequiredScore()).to.not.eq(0)

      await nftScoreRequirement.connect(deployer).setRequiredScore(0)

      expect(await nftScoreRequirement.getRequiredScore()).to.eq(0)
    })

    it('is idempotent', async () => {
      await nftScoreRequirement.connect(deployer).setRequiredScore(1)
      expect(await nftScoreRequirement.getRequiredScore()).to.eq(1)

      await nftScoreRequirement.connect(deployer).setRequiredScore(1)

      expect(await nftScoreRequirement.getRequiredScore()).to.eq(1)
    })

    it('emits RequiredScoreChange', async () => {
      const tx = await nftScoreRequirement.connect(deployer).setRequiredScore(1)

      await expect(tx).to.emit(nftScoreRequirement, 'RequiredScoreChange').withArgs(1)
    })
  })

  describe('# setCollectionScores', () => {
    it('reverts if array length mismatch', async () => {
      await expect(
        nftScoreRequirement.connect(deployer).setCollectionScores([firstERC721.address], [1, 2])
      ).revertedWith('collections.length != scores.length')
    })

    it('reverts if single collection with score = 0', async () => {
      await expect(
        nftScoreRequirement.connect(deployer).setCollectionScores([firstERC721.address], [0])
      ).revertedWith('score == 0')
    })

    it('reverts if multiple collections and one has score = 0', async () => {
      await expect(
        nftScoreRequirement
          .connect(deployer)
          .setCollectionScores([firstERC721.address, secondERC721.address], [1, 0])
      ).revertedWith('score == 0')
    })

    it('sets score for a collection', async () => {
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)

      await nftScoreRequirement.connect(deployer).setCollectionScores([firstERC721.address], [1])

      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)
    })

    it('sets score if multiple collections', async () => {
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(0)

      await nftScoreRequirement
        .connect(deployer)
        .setCollectionScores([firstERC721.address, secondERC721.address], [1, 2])

      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(2)
    })

    it('sets score if duplicate collections', async () => {
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)

      await nftScoreRequirement
        .connect(deployer)
        .setCollectionScores([firstERC721.address, firstERC721.address], [1, 2])

      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(2)
    })

    it('is idempotent', async () => {
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)

      await nftScoreRequirement.connect(deployer).setCollectionScores([firstERC721.address], [1])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)

      await nftScoreRequirement.connect(deployer).setCollectionScores([firstERC721.address], [1])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)
    })

    it('is idempotent for multiple collections', async () => {
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(0)

      await nftScoreRequirement
        .connect(deployer)
        .setCollectionScores([firstERC721.address, secondERC721.address], [1, 2])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(2)

      await nftScoreRequirement
        .connect(deployer)
        .setCollectionScores([firstERC721.address, secondERC721.address], [1, 2])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(2)
    })

    it('is idempotent for a collection when another changes', async () => {
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(0)

      await nftScoreRequirement
        .connect(deployer)
        .setCollectionScores([firstERC721.address, secondERC721.address], [1, 2])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(2)

      await nftScoreRequirement
        .connect(deployer)
        .setCollectionScores([firstERC721.address, secondERC721.address], [1, 3])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(3)
    })

    it('emits CollectionScoresChange if single collection', async () => {
      const tx = await nftScoreRequirement
        .connect(deployer)
        .setCollectionScores([firstERC721.address], [1])

      await expect(tx)
        .to.emit(nftScoreRequirement, 'CollectionScoresChange')
        .withArgs([firstERC721.address], [1])
    })

    it('emits CollectionScoresChange if multiple collections', async () => {
      const tx = await nftScoreRequirement
        .connect(deployer)
        .setCollectionScores([firstERC721.address, secondERC721.address], [1, 2])

      await expect(tx)
        .to.emit(nftScoreRequirement, 'CollectionScoresChange')
        .withArgs([firstERC721.address, secondERC721.address], [1, 2])
    })
  })

  describe('# removeCollections', () => {
    it('removes a collection', async () => {
      await nftScoreRequirement.connect(deployer).setCollectionScores([firstERC721.address], [1])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)

      await nftScoreRequirement.connect(deployer).removeCollections([firstERC721.address])

      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)
    })

    it('removes multiple collections', async () => {
      await nftScoreRequirement
        .connect(deployer)
        .setCollectionScores([firstERC721.address, secondERC721.address], [1, 1])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(1)

      await nftScoreRequirement
        .connect(deployer)
        .removeCollections([firstERC721.address, secondERC721.address])

      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(0)
    })

    it('removes specified collection only', async () => {
      await nftScoreRequirement
        .connect(deployer)
        .setCollectionScores([firstERC721.address, secondERC721.address], [1, 2])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(2)

      await nftScoreRequirement.connect(deployer).removeCollections([firstERC721.address])

      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(2)
    })

    it('is idempotent if single collection', async () => {
      await nftScoreRequirement.connect(deployer).setCollectionScores([firstERC721.address], [1])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)
      await nftScoreRequirement.connect(deployer).removeCollections([firstERC721.address])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)

      await nftScoreRequirement.connect(deployer).removeCollections([firstERC721.address])

      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)
    })

    it('is idempotent if multiple collections', async () => {
      await nftScoreRequirement
        .connect(deployer)
        .setCollectionScores([firstERC721.address, secondERC721.address], [1, 2])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(2)
      await nftScoreRequirement
        .connect(deployer)
        .removeCollections([firstERC721.address, secondERC721.address])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(0)

      await nftScoreRequirement
        .connect(deployer)
        .removeCollections([firstERC721.address, secondERC721.address])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(0)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(0)
    })

    it('emits CollectionScoresChange if single collection', async () => {
      await nftScoreRequirement.connect(deployer).setCollectionScores([firstERC721.address], [1])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)

      const tx = await nftScoreRequirement
        .connect(deployer)
        .removeCollections([firstERC721.address])

      await expect(tx)
        .to.emit(nftScoreRequirement, 'CollectionScoresChange')
        .withArgs([firstERC721.address], [0])
    })

    it('emits CollectionScoresChange if multiple collections', async () => {
      await nftScoreRequirement
        .connect(deployer)
        .setCollectionScores([firstERC721.address, secondERC721.address], [1, 1])
      expect(await nftScoreRequirement.getCollectionScore(firstERC721.address)).to.eq(1)
      expect(await nftScoreRequirement.getCollectionScore(secondERC721.address)).to.eq(1)

      const tx = await nftScoreRequirement
        .connect(deployer)
        .removeCollections([firstERC721.address, secondERC721.address])

      await expect(tx)
        .to.emit(nftScoreRequirement, 'CollectionScoresChange')
        .withArgs([firstERC721.address, secondERC721.address], [0, 0])
    })
  })

  describe('# getAccountScore', () => {
    async function prepareNFTs(
      collection: MockContract<Contract>,
      numHeld: number,
      collectionScore: number
    ): Promise<void> {
      if (numHeld > 0) {
        const mintTxs = []
        for (let i = 0; i < numHeld; i++) {
          mintTxs.push(collection.mint(user.address, i))
        }
        await Promise.all(mintTxs)
      }
      expect(await collection.balanceOf(user.address)).to.eq(numHeld)

      if (collectionScore > 0) {
        await nftScoreRequirement
          .connect(deployer)
          .setCollectionScores([collection.address], [collectionScore])
      }
    }

    it('returns 0 if holding 0 NFTs from collection with score = 0', async () => {
      expect(await nftScoreRequirement.getAccountScore(user.address)).to.eq(0)
    })

    it('returns 0 if holding 1 NFT from collection with score = 0', async () => {
      await prepareNFTs(firstERC721, 1, 0)

      expect(await nftScoreRequirement.getAccountScore(user.address)).to.eq(0)
    })

    it('returns 0 if holding multiple NFTs from collection with score = 0', async () => {
      await prepareNFTs(firstERC721, 10, 0)

      expect(await nftScoreRequirement.getAccountScore(user.address)).to.eq(0)
    })

    it('returns 1 if holding 1 NFT from collection with score = 1', async () => {
      await prepareNFTs(firstERC721, 1, 1)

      expect(await nftScoreRequirement.getAccountScore(user.address)).to.eq(1)
    })

    it('returns 1 if holding multiple NFTs from collection with score = 1', async () => {
      await prepareNFTs(firstERC721, 10, 1)

      expect(await nftScoreRequirement.getAccountScore(user.address)).to.eq(1)
    })

    it('returns 0 if holding 0 NFTs from collection with score > 0', async () => {
      await prepareNFTs(firstERC721, 0, 10)

      expect(await nftScoreRequirement.getAccountScore(user.address)).to.eq(0)
    })

    it('returns correct value if holding 1 NFT from 2 collections each with score > 0', async () => {
      await prepareNFTs(firstERC721, 1, 1)
      await prepareNFTs(secondERC721, 1, 2)

      expect(await nftScoreRequirement.getAccountScore(user.address)).to.eq(3)
    })

    it('returns correct value if holding multiple NFTs from 2 collections each with score > 0', async () => {
      await prepareNFTs(firstERC721, 10, 1)
      await prepareNFTs(secondERC721, 10, 2)

      expect(await nftScoreRequirement.getAccountScore(user.address)).to.eq(3)
    })

    it('returns 1 if holding 1 NFT from collection with score = 0, 1 NFT from collection with score = 1', async () => {
      await prepareNFTs(firstERC721, 1, 0)
      await prepareNFTs(secondERC721, 1, 1)

      expect(await nftScoreRequirement.getAccountScore(user.address)).to.eq(1)
    })
  })
})
