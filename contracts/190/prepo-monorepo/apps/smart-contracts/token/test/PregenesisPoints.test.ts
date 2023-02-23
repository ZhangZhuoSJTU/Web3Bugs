import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { MerkleTree } from 'merkletreejs'
import { ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { pregenesisPointsFixture } from './fixtures/PregenesisFixtures'
import {
  ONE,
  AccountAmountLeafNode,
  hashAccountAmountLeafNode,
  generateAccountAmountMerkleTree,
} from '../utils'
import { PregenesisPoints } from '../types/generated'

const { parseEther } = ethers.utils

describe('PregenesisPoints', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let shop: SignerWithAddress
  let merkleTree: MerkleTree
  let eligibleNode1: AccountAmountLeafNode
  let eligibleNode2: AccountAmountLeafNode
  const zeroHash = ethers.utils.formatBytes32String('')
  let points: PregenesisPoints
  const TOKEN_NAME = `Pregenesis Points`
  const TOKEN_SYMBOL = 'PP'

  const deployPregenesisPoints = async (): Promise<void> => {
    ;[deployer, owner, user1, user2, shop] = await ethers.getSigners()
    points = await pregenesisPointsFixture(TOKEN_NAME, TOKEN_SYMBOL)
  }

  const setupPregenesisPoints = async (): Promise<void> => {
    await deployPregenesisPoints()
    eligibleNode1 = {
      account: user1.address,
      amount: parseEther('0.1'),
    }
    eligibleNode2 = {
      account: user2.address,
      amount: parseEther('1'),
    }
    const eligibleNodes = [eligibleNode1, eligibleNode2]
    merkleTree = generateAccountAmountMerkleTree(eligibleNodes)
    await points.connect(deployer).transferOwnership(owner.address)
    await points.connect(owner).acceptOwnership()
  }

  describe('initial state', () => {
    before(async () => {
      await deployPregenesisPoints()
    })

    it('sets nominee to zero address', async () => {
      expect(await points.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('sets name from constructor', async () => {
      expect(await points.name()).to.eq(TOKEN_NAME)
    })

    it('sets symbol from constructor', async () => {
      expect(await points.symbol()).to.eq(TOKEN_SYMBOL)
    })

    it('sets shop as zero address', async () => {
      expect(await points.getShop()).to.eq(ZERO_ADDRESS)
    })

    it('sets owner to deployer', async () => {
      expect(await points.owner()).to.eq(deployer.address)
    })
  })

  describe('# setShop', () => {
    beforeEach(async () => {
      await setupPregenesisPoints()
    })

    it('reverts if not owner', async () => {
      expect(await points.owner()).to.not.eq(user1.address)
      await expect(points.connect(user1).setShop(JUNK_ADDRESS)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero address', async () => {
      expect(await points.connect(owner).getShop()).to.not.eq(JUNK_ADDRESS)

      await points.connect(owner).setShop(JUNK_ADDRESS)

      expect(await points.connect(owner).getShop()).to.eq(JUNK_ADDRESS)
      expect(await points.connect(owner).getShop()).to.not.eq(ZERO_ADDRESS)
    })

    it('sets to zero address', async () => {
      await points.connect(owner).setShop(JUNK_ADDRESS)
      expect(await points.connect(owner).getShop()).to.not.eq(ZERO_ADDRESS)

      await points.connect(owner).setShop(ZERO_ADDRESS)

      expect(await points.connect(owner).getShop()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await points.connect(owner).getShop()).to.not.eq(JUNK_ADDRESS)

      await points.connect(owner).setShop(JUNK_ADDRESS)

      expect(await points.connect(owner).getShop()).to.eq(JUNK_ADDRESS)

      await points.connect(owner).setShop(JUNK_ADDRESS)

      expect(await points.connect(owner).getShop()).to.eq(JUNK_ADDRESS)
    })
  })

  describe('# setMerkleTreeRoot', () => {
    beforeEach(async () => {
      await setupPregenesisPoints()
    })

    it('reverts if not owner', async () => {
      expect(await points.owner()).to.not.eq(user1.address)

      await expect(points.connect(user1).setMerkleTreeRoot(merkleTree.getHexRoot())).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets root to non-zero hash', async () => {
      expect(await points.getMerkleTreeRoot()).to.not.eq(merkleTree.getHexRoot())
      expect(merkleTree.getHexRoot()).to.not.eq(zeroHash)

      await points.connect(owner).setMerkleTreeRoot(merkleTree.getHexRoot())

      expect(await points.getMerkleTreeRoot()).to.eq(merkleTree.getHexRoot())
    })

    it('sets root to zero hash', async () => {
      await points.connect(owner).setMerkleTreeRoot(merkleTree.getHexRoot())
      expect(await points.getMerkleTreeRoot()).to.not.eq(zeroHash)

      await points.connect(owner).setMerkleTreeRoot(zeroHash)

      expect(await points.getMerkleTreeRoot()).to.eq(zeroHash)
    })

    it('is idempotent', async () => {
      expect(await points.getMerkleTreeRoot()).to.not.eq(merkleTree.getHexRoot())

      await points.connect(owner).setMerkleTreeRoot(merkleTree.getHexRoot())

      expect(await points.getMerkleTreeRoot()).to.eq(merkleTree.getHexRoot())

      await points.connect(owner).setMerkleTreeRoot(merkleTree.getHexRoot())

      expect(await points.getMerkleTreeRoot()).to.eq(merkleTree.getHexRoot())
    })
  })

  describe('# mint', () => {
    beforeEach(async () => {
      await setupPregenesisPoints()
      await points.connect(owner).setShop(shop.address)
    })

    it('reverts if not owner', async () => {
      expect(await points.owner()).to.not.eq(user1.address)

      await expect(points.connect(user1).mint(user1.address, ONE)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('reverts if shop tries to mint', async () => {
      expect(await points.owner()).to.not.eq(shop.address)

      await expect(points.connect(shop).mint(user1.address, ONE)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('reverts if minting to zero address', async () => {
      await expect(points.connect(owner).mint(ZERO_ADDRESS, ONE)).revertedWith(
        'ERC20: mint to the zero address'
      )
    })

    it('increases non-caller balance', async () => {
      const nonCallerPPBalanceBefore = await points.balanceOf(user1.address)
      expect(owner).to.not.eq(user1)

      await points.connect(owner).mint(user1.address, ONE)

      expect(await points.balanceOf(user1.address)).to.eq(nonCallerPPBalanceBefore.add(ONE))
    })

    it('increases caller balance', async () => {
      const callerPPBalanceBefore = await points.balanceOf(owner.address)

      await points.connect(owner).mint(owner.address, ONE)

      expect(await points.balanceOf(owner.address)).to.eq(callerPPBalanceBefore.add(ONE))
    })
  })
  /**
   * TODO: Add tests for transfer, transferFrom using smock to test for intended behavior
   * of `_beforeTokenTransfer()`
   */
  describe('# burn', () => {
    beforeEach(async () => {
      await setupPregenesisPoints()
      await points.connect(owner).setShop(shop.address)
    })

    it('reverts if not owner', async () => {
      expect(await points.owner()).to.not.eq(user1.address)
      await points.connect(owner).mint(user1.address, ONE)
      expect(await points.balanceOf(user1.address)).to.be.gte(ONE)

      await expect(points.connect(user1).burn(user1.address, ONE)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('reverts if shop tries to burn', async () => {
      await points.connect(owner).mint(shop.address, ONE)
      expect(await points.balanceOf(shop.address)).to.be.gte(ONE)
      expect(await points.owner()).to.not.eq(shop.address)

      await expect(points.connect(shop).burn(user1.address, ONE)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('reverts if burn from zero address', async () => {
      await expect(points.connect(owner).burn(ZERO_ADDRESS, ONE)).revertedWith(
        'ERC20: burn from the zero address'
      )
    })

    it('reverts if amount > balance', async () => {
      await points.connect(owner).mint(user1.address, ONE)
      const userPPBalance = await points.balanceOf(user1.address)

      await expect(points.connect(owner).burn(user1.address, userPPBalance.add(ONE))).revertedWith(
        'ERC20: burn amount exceeds balance'
      )
    })

    it('decreases non-caller balance', async () => {
      await points.connect(owner).mint(user1.address, ONE)
      const nonCallerPPBalanceBefore = await points.balanceOf(user1.address)

      await points.connect(owner).burn(user1.address, ONE)

      expect(await points.balanceOf(user1.address)).to.eq(nonCallerPPBalanceBefore.sub(ONE))
    })

    it('decreases caller balance', async () => {
      await points.connect(owner).mint(owner.address, ONE)
      const callerPPBalanceBefore = await points.balanceOf(owner.address)

      await points.connect(owner).burn(owner.address, ONE)

      expect(await points.balanceOf(owner.address)).to.eq(callerPPBalanceBefore.sub(ONE))
    })
  })

  describe('# claim', () => {
    beforeEach(async () => {
      await setupPregenesisPoints()
      await points.connect(owner).setMerkleTreeRoot(merkleTree.getHexRoot())
    })

    it('reverts if already claimed', async () => {
      const proof = merkleTree.getHexProof(hashAccountAmountLeafNode(eligibleNode1))
      await points.connect(user1).claim(eligibleNode1.amount, proof)
      expect(await points.hasClaimed(eligibleNode1.account)).to.be.eq(true)

      await expect(points.connect(user1).claim(eligibleNode1.amount, proof)).revertedWith(
        'Already claimed'
      )
    })

    it('reverts if wrong account', async () => {
      const invalidAccount = shop.address
      const ineligibleNode = {
        ...eligibleNode1,
        account: invalidAccount,
      }
      const proof = merkleTree.getHexProof(hashAccountAmountLeafNode(ineligibleNode))

      await expect(points.connect(user1).claim(ineligibleNode.amount, proof)).revertedWith(
        'Invalid claim'
      )
    })

    it('reverts if wrong amount', async () => {
      const wrongAmount = eligibleNode1.amount.add(parseEther('0.1'))
      const ineligibleNode = {
        ...eligibleNode1,
        amount: wrongAmount,
      }
      const proof = merkleTree.getHexProof(hashAccountAmountLeafNode(ineligibleNode))

      await expect(points.connect(user1).claim(ineligibleNode.amount, proof)).revertedWith(
        'Invalid claim'
      )
    })

    it('increases user PP balance', async () => {
      const proof = merkleTree.getHexProof(hashAccountAmountLeafNode(eligibleNode1))
      const eligibleNodeBalanceBefore = await points.balanceOf(eligibleNode1.account)

      await points.connect(user1).claim(eligibleNode1.amount, proof)

      expect(await points.balanceOf(eligibleNode1.account)).to.be.equal(
        eligibleNodeBalanceBefore.add(eligibleNode1.amount)
      )
    })

    it('sets userToClaimed', async () => {
      const proof = merkleTree.getHexProof(hashAccountAmountLeafNode(eligibleNode1))
      expect(await points.hasClaimed(eligibleNode1.account)).to.be.equal(false)

      await points.connect(user1).claim(eligibleNode1.amount, proof)

      expect(await points.hasClaimed(eligibleNode1.account)).to.be.equal(true)
    })
  })
})
