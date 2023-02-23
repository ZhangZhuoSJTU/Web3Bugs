import chai, { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { ZERO_ADDRESS, JUNK_ADDRESS } from 'prepo-constants'
import { FakeContract, smock } from '@defi-wonderland/smock'
import { BigNumber, Contract } from 'ethers'
import { utils } from 'prepo-hardhat'
import { formatBytes32String } from 'ethers/lib/utils'
import { ppoFixture } from './fixtures/PPOFixtures'
import { generateDomainSeparator, MAX_UINT256 } from '../utils'
import { PPO } from '../types/generated'

const { getLastTimestamp, setNextTimestamp, getPermitSignature } = utils

chai.use(smock.matchers)

describe('=> PPO', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let ppo: PPO
  let fakeTransferHook: FakeContract<Contract>

  const deployPPO = async (): Promise<void> => {
    ;[deployer, owner, user1, user2] = await ethers.getSigners()
    ppo = await ppoFixture('prePO Token', 'PPO')
  }

  const setupPPO = async (): Promise<void> => {
    await deployPPO()
    await ppo.connect(deployer).transferOwnership(owner.address)
    await ppo.connect(owner).acceptOwnership()
  }

  const setupPPOAndFakeTransferHook = async (): Promise<void> => {
    await setupPPO()
    fakeTransferHook = await smock.fake('BlocklistTransferHook')
    await ppo.connect(owner).setTransferHook(fakeTransferHook.address)
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await deployPPO()
    })

    it('sets nominee to zero address', async () => {
      expect(await ppo.getNominee()).to.eq(ZERO_ADDRESS)
    })

    it('sets name from initialize', async () => {
      expect(await ppo.name()).to.eq('prePO Token')
    })

    it('sets symbol from initialize', async () => {
      expect(await ppo.symbol()).to.eq('PPO')
    })

    it('sets owner to deployer', async () => {
      expect(await ppo.owner()).to.eq(deployer.address)
    })

    it('sets transfer hook as zero address', async () => {
      expect(await ppo.getTransferHook()).to.eq(ZERO_ADDRESS)
    })

    it('sets token supply to zero', async () => {
      expect(await ppo.totalSupply()).to.eq(0)
    })

    it('sets owner token balance to zero', async () => {
      expect(await ppo.balanceOf(deployer.address)).to.eq(0)
    })

    it('sets nominee token balance to zero', async () => {
      expect(await ppo.balanceOf(owner.address)).to.eq(0)
    })

    it('generates domain separator from token name', async () => {
      /**
       * Domain separator is generated using the chainId accessed via
       * `block.chainid`. It seems that the hardhat test network will return
       * 0 for the chainId when accessed in-contract via `block.chainid`, even
       * though the network provider designates 31337 for hardhat networks.
       */
      expect(await ppo.DOMAIN_SEPARATOR()).to.eq(
        generateDomainSeparator('prePO Token', '1', 31337, ppo.address)
      )
    })
  })

  describe('# setTransferHook', () => {
    beforeEach(async () => {
      await setupPPO()
    })

    it('reverts if not owner', async () => {
      expect(await ppo.owner()).to.not.eq(user1.address)

      await expect(ppo.connect(user1).setTransferHook(JUNK_ADDRESS)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('sets to non-zero address', async () => {
      expect(await ppo.getTransferHook()).to.not.eq(JUNK_ADDRESS)
      expect(JUNK_ADDRESS).to.not.equal(ZERO_ADDRESS)

      await ppo.connect(owner).setTransferHook(JUNK_ADDRESS)

      expect(await ppo.getTransferHook()).to.eq(JUNK_ADDRESS)
    })

    it('sets to zero address', async () => {
      await ppo.connect(owner).setTransferHook(JUNK_ADDRESS)
      expect(await ppo.getTransferHook()).to.not.eq(ZERO_ADDRESS)

      await ppo.connect(owner).setTransferHook(ZERO_ADDRESS)

      expect(await ppo.getTransferHook()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      expect(await ppo.getTransferHook()).to.not.eq(JUNK_ADDRESS)

      await ppo.connect(owner).setTransferHook(JUNK_ADDRESS)

      expect(await ppo.getTransferHook()).to.eq(JUNK_ADDRESS)

      await ppo.connect(owner).setTransferHook(JUNK_ADDRESS)

      expect(await ppo.getTransferHook()).to.eq(JUNK_ADDRESS)
    })
  })

  describe('# mint', () => {
    beforeEach(async () => {
      await setupPPOAndFakeTransferHook()
    })

    it('reverts if transfer hook not set', async () => {
      await ppo.connect(owner).setTransferHook(ZERO_ADDRESS)

      await expect(ppo.connect(owner).mint(user1.address, 1)).revertedWith('Transfer hook not set')
    })

    it('reverts if transfer hook reverts', async () => {
      fakeTransferHook.hook.reverts()

      await expect(ppo.connect(owner).mint(user1.address, 1)).to.be.reverted
    })

    it('calls transfer hook with correct parameters', async () => {
      await ppo.connect(owner).mint(user1.address, 1)

      expect(fakeTransferHook.hook).to.have.been.calledWith(ZERO_ADDRESS, user1.address, 1)
    })

    it('reverts if not owner', async () => {
      expect(await ppo.owner()).to.not.eq(user1.address)

      await expect(ppo.connect(user1).mint(user1.address, 1)).revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('reverts if minting to zero address', async () => {
      await expect(ppo.connect(owner).mint(ZERO_ADDRESS, 1)).revertedWith(
        'ERC20: mint to the zero address'
      )
    })

    it('mints to non-caller if recipient is non-caller', async () => {
      const nonCallerPPOBalanceBefore = await ppo.balanceOf(user1.address)
      expect(owner).to.not.eq(user1)

      await ppo.connect(owner).mint(user1.address, 1)

      expect(await ppo.balanceOf(user1.address)).to.eq(nonCallerPPOBalanceBefore.add(1))
    })

    it('mints to caller if recipient is caller', async () => {
      const callerPPOBalanceBefore = await ppo.balanceOf(owner.address)

      await ppo.connect(owner).mint(owner.address, 1)

      expect(await ppo.balanceOf(owner.address)).to.eq(callerPPOBalanceBefore.add(1))
    })

    it("doesn't increase recipient balance if amount = 0", async () => {
      const recipientPPOBalanceBefore = await ppo.balanceOf(owner.address)

      await ppo.connect(owner).mint(user1.address, 0)

      expect(await ppo.balanceOf(owner.address)).to.eq(recipientPPOBalanceBefore)
    })

    it('increases recipient balance if amount > 1', async () => {
      const recipientPPOBalanceBefore = await ppo.balanceOf(owner.address)

      await ppo.connect(owner).mint(user1.address, 2)

      expect(await ppo.balanceOf(user1.address)).to.eq(recipientPPOBalanceBefore.add(2))
    })

    it('increases recipient balance if amount = max uint', async () => {
      expect(await ppo.balanceOf(user1.address)).to.eq(0)

      await ppo.connect(owner).mint(user1.address, MAX_UINT256)

      expect(await ppo.balanceOf(user1.address)).to.eq(MAX_UINT256)
    })

    it('emits transfer if amount = 0 and recipient is caller', async () => {
      const tx = await ppo.connect(owner).mint(owner.address, 0)

      await expect(tx)
        .to.emit(ppo, 'Transfer(address,address,uint256)')
        .withArgs(ZERO_ADDRESS, owner.address, 0)
    })

    it('emits transfer if amount = 0 and recipient is non-caller', async () => {
      const tx = await ppo.connect(owner).mint(user1.address, 0)

      await expect(tx)
        .to.emit(ppo, 'Transfer(address,address,uint256)')
        .withArgs(ZERO_ADDRESS, user1.address, 0)
    })

    it('emits transfer if amount > 0 and recipient is caller', async () => {
      const tx = await ppo.connect(owner).mint(owner.address, 1)

      await expect(tx)
        .to.emit(ppo, 'Transfer(address,address,uint256)')
        .withArgs(ZERO_ADDRESS, owner.address, 1)
    })

    it('emits transfer if amount > 0 and recipient is non-caller', async () => {
      const tx = await ppo.connect(owner).mint(user1.address, 1)

      await expect(tx)
        .to.emit(ppo, 'Transfer(address,address,uint256)')
        .withArgs(ZERO_ADDRESS, user1.address, 1)
    })
  })

  describe('# burn', () => {
    beforeEach(async () => {
      await setupPPOAndFakeTransferHook()
      await ppo.connect(owner).mint(user1.address, 10)
    })

    it('reverts if transfer hook not set', async () => {
      await ppo.connect(owner).setTransferHook(ZERO_ADDRESS)

      await expect(ppo.connect(user1).burn(1)).revertedWith('Transfer hook not set')
    })

    it('reverts if transfer hook reverts', async () => {
      fakeTransferHook.hook.reverts()

      await expect(ppo.connect(user1).burn(1)).to.be.reverted
    })

    it('calls transfer hook with correct parameters', async () => {
      await ppo.connect(user1).burn(1)

      expect(fakeTransferHook.hook).to.have.been.calledWith(user1.address, ZERO_ADDRESS, 1)
    })

    it('reverts if amount > balance', async () => {
      const callerPPOBalanceBefore = await ppo.balanceOf(user1.address)

      await expect(ppo.connect(user1).burn(callerPPOBalanceBefore.add(1))).to.revertedWith(
        'ERC20: burn amount exceeds balance'
      )
    })

    it("doesn't decrease caller balance if amount = 0", async () => {
      const callerPPOBalanceBefore = await ppo.balanceOf(user1.address)

      await ppo.connect(user1).burn(0)

      expect(await ppo.balanceOf(user1.address)).to.eq(callerPPOBalanceBefore)
    })

    it('decreases caller balance if amount < balance', async () => {
      const callerPPOBalanceBefore = await ppo.balanceOf(user1.address)

      await ppo.connect(user1).burn(callerPPOBalanceBefore.sub(1))

      expect(await ppo.balanceOf(user1.address)).to.eq(1)
    })

    it('decreases caller balance if amount = balance', async () => {
      const callerPPOBalanceBefore = await ppo.balanceOf(user1.address)

      await ppo.connect(user1).burn(callerPPOBalanceBefore)

      expect(await ppo.balanceOf(user1.address)).to.eq(0)
    })

    it('decreases total supply if amount > 0', async () => {
      const totalSupplyBefore = await ppo.totalSupply()

      await ppo.connect(user1).burn(1)

      expect(await ppo.totalSupply()).to.eq(totalSupplyBefore.sub(1))
    })

    it("doesn't change total supply if amount = 0", async () => {
      const totalSupplyBefore = await ppo.totalSupply()

      await ppo.connect(user1).burn(0)

      expect(await ppo.totalSupply()).to.eq(totalSupplyBefore)
    })

    it('emits transfer if amount = 0', async () => {
      const tx = await ppo.connect(user1).burn(0)

      await expect(tx)
        .to.emit(ppo, 'Transfer(address,address,uint256)')
        .withArgs(user1.address, ZERO_ADDRESS, 0)
    })

    it('emits transfer if amount > 0', async () => {
      const tx = await ppo.connect(user1).burn(1)

      await expect(tx)
        .to.emit(ppo, 'Transfer(address,address,uint256)')
        .withArgs(user1.address, ZERO_ADDRESS, 1)
    })
  })

  describe('# burnFrom', () => {
    beforeEach(async () => {
      await setupPPOAndFakeTransferHook()
      await ppo.connect(owner).mint(user1.address, 10)
    })

    it('reverts if transfer hook not set', async () => {
      await ppo.connect(owner).setTransferHook(ZERO_ADDRESS)
      await ppo.connect(user1).approve(user2.address, 1)

      await expect(ppo.connect(user2).burnFrom(user1.address, 1)).revertedWith(
        'Transfer hook not set'
      )
    })

    it('reverts if transfer hook reverts', async () => {
      fakeTransferHook.hook.reverts()
      await ppo.connect(user1).approve(user2.address, 1)

      await expect(ppo.connect(user2).burnFrom(user1.address, 1)).to.be.reverted
    })

    it('calls transfer hook with correct parameters', async () => {
      await ppo.connect(user1).approve(user2.address, 1)

      await ppo.connect(user2).burnFrom(user1.address, 1)

      expect(fakeTransferHook.hook).to.have.been.calledWith(user1.address, ZERO_ADDRESS, 1)
    })

    it('reverts if burn from zero address', async () => {
      await expect(ppo.connect(user1).burnFrom(ZERO_ADDRESS, 1)).revertedWith(
        'ERC20: insufficient allowance'
      )
    })

    it('reverts if amount > allowance', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      await ppo.connect(user1).approve(user2.address, user1PPOBalanceBefore.sub(1))

      await expect(
        ppo.connect(user2).burnFrom(user1.address, user1PPOBalanceBefore)
      ).to.revertedWith('ERC20: insufficient allowance')
    })

    it('reverts if amount > balance', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      await ppo.connect(user1).approve(user2.address, user1PPOBalanceBefore.add(1))

      await expect(
        ppo.connect(user2).burnFrom(user1.address, user1PPOBalanceBefore.add(1))
      ).to.revertedWith('ERC20: burn amount exceeds balance')
    })

    it("doesn't decrease user balance if amount = 0", async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      await ppo.connect(user1).approve(user2.address, user1PPOBalanceBefore)

      await ppo.connect(user2).burnFrom(user1.address, 0)

      expect(await ppo.balanceOf(user1.address)).to.eq(user1PPOBalanceBefore)
    })

    it('decreases user balance if amount < balance', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      await ppo.connect(user1).approve(user2.address, user1PPOBalanceBefore)

      await ppo.connect(user2).burnFrom(user1.address, user1PPOBalanceBefore.sub(1))

      expect(await ppo.balanceOf(user1.address)).to.eq(1)
    })

    it('decreases user balance if amount = balance', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      await ppo.connect(user1).approve(user2.address, user1PPOBalanceBefore)

      await ppo.connect(user2).burnFrom(user1.address, user1PPOBalanceBefore)

      expect(await ppo.balanceOf(user1.address)).to.eq(0)
    })

    it('decreases total supply if amount > 0', async () => {
      const totalSupplyBefore = await ppo.totalSupply()
      await ppo.connect(user1).approve(user2.address, 1)

      await ppo.connect(user2).burnFrom(user1.address, 1)

      expect(await ppo.totalSupply()).to.eq(totalSupplyBefore.sub(1))
    })

    it("doesn't change total supply if amount = 0", async () => {
      const totalSupplyBefore = await ppo.totalSupply()

      await ppo.connect(user2).burnFrom(user1.address, 0)

      expect(await ppo.totalSupply()).to.eq(totalSupplyBefore)
    })

    it('emits transfer if amount = 0', async () => {
      const tx = await ppo.connect(user2).burnFrom(user1.address, 0)

      await expect(tx)
        .to.emit(ppo, 'Transfer(address,address,uint256)')
        .withArgs(user1.address, ZERO_ADDRESS, 0)
    })

    it('emits transfer if amount > 0', async () => {
      await ppo.connect(user1).approve(user2.address, 1)
      const tx = await ppo.connect(user2).burnFrom(user1.address, 1)

      await expect(tx)
        .to.emit(ppo, 'Transfer(address,address,uint256)')
        .withArgs(user1.address, ZERO_ADDRESS, 1)
    })
  })

  describe('# transferFromWithPermit', () => {
    let currentTime: number
    let deadline: number
    const BLOCK_DURATION_IN_SECONDS = 15
    let spender: SignerWithAddress
    beforeEach(async () => {
      await setupPPOAndFakeTransferHook()
      await ppo.connect(owner).mint(user1.address, 10)
      currentTime = await getLastTimestamp(ethers.provider)
      deadline = currentTime + BLOCK_DURATION_IN_SECONDS
      spender = deployer
    })

    it('reverts if deadline expired', async () => {
      const timeAfterDeadlineExpiration = deadline + BLOCK_DURATION_IN_SECONDS
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore,
        deadline
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await setNextTimestamp(ethers.provider as any, timeAfterDeadlineExpiration)

      await expect(
        ppo
          .connect(spender)
          .transferFromWithPermit(
            user1.address,
            user2.address,
            user1PPOBalanceBefore,
            deadline,
            v,
            r,
            s
          )
      ).revertedWith('ERC20Permit: expired deadline')
    })

    it('reverts if from address different from signature', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const invalidFromAddress = user2
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore,
        deadline
      )

      await expect(
        ppo
          .connect(spender)
          .transferFromWithPermit(
            invalidFromAddress.address,
            user2.address,
            user1PPOBalanceBefore,
            deadline,
            v,
            r,
            s
          )
      ).revertedWith('ERC20Permit: invalid signature')
    })

    it('reverts if spender different from signature', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const invalidSpender = user2
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore,
        deadline
      )

      await expect(
        ppo
          .connect(invalidSpender)
          .transferFromWithPermit(
            user1.address,
            user2.address,
            user1PPOBalanceBefore,
            deadline,
            v,
            r,
            s
          )
      ).revertedWith('ERC20Permit: invalid signature')
    })

    it('reverts if deadline different from signature', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore,
        deadline
      )

      await expect(
        ppo
          .connect(spender)
          .transferFromWithPermit(
            user1.address,
            user2.address,
            user1PPOBalanceBefore,
            deadline + 1,
            v,
            r,
            s
          )
      ).revertedWith('ERC20Permit: invalid signature')
    })

    it('reverts if invalid v', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore,
        deadline
      )
      /**
       * `v` can only be 27 or 28, so if we just indiscriminately add 1, the
       * function might revert with a ECDSA revert due to the `v` value being
       * invalid instead of not matching the signature verification inputs.
       * Instead, we switch between 27 and 28 depending on the correct `v`
       * value.
       */
      const invalidV = v === 27 ? 28 : 27

      await expect(
        ppo
          .connect(spender)
          .transferFromWithPermit(
            user1.address,
            user2.address,
            user1PPOBalanceBefore,
            deadline,
            invalidV,
            r,
            s
          )
      ).revertedWith('ERC20Permit: invalid signature')
    })

    it('reverts if invalid r', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore,
        deadline
      )
      const invalidR = formatBytes32String('JUNK_DATA')
      expect(invalidR).to.not.eq(r)

      await expect(
        ppo
          .connect(spender)
          .transferFromWithPermit(
            user1.address,
            user2.address,
            user1PPOBalanceBefore,
            deadline + 1,
            v,
            invalidR,
            s
          )
      ).revertedWith('ERC20Permit: invalid signature')
    })

    it('reverts if invalid s', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore,
        deadline
      )
      const invalidS = formatBytes32String('JUNK_DATA')
      expect(invalidS).to.not.eq(s)

      await expect(
        ppo
          .connect(spender)
          .transferFromWithPermit(
            user1.address,
            user2.address,
            user1PPOBalanceBefore,
            deadline + 1,
            v,
            r,
            invalidS
          )
      ).revertedWith('ERC20Permit: invalid signature')
    })

    it('reverts if transfer hook not set', async () => {
      await ppo.connect(owner).setTransferHook(ZERO_ADDRESS)
      expect(await ppo.getTransferHook()).to.eq(ZERO_ADDRESS)
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore,
        deadline
      )

      await expect(
        ppo
          .connect(spender)
          .transferFromWithPermit(
            user1.address,
            user2.address,
            user1PPOBalanceBefore,
            deadline,
            v,
            r,
            s
          )
      ).revertedWith('Transfer hook not set')
    })

    it('reverts if transfer hook reverts', async () => {
      fakeTransferHook.hook.reverts()
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore,
        deadline
      )

      await expect(
        ppo
          .connect(spender)
          .transferFromWithPermit(
            user1.address,
            user2.address,
            user1PPOBalanceBefore,
            deadline,
            v,
            r,
            s
          )
      ).to.be.reverted
      expect(await fakeTransferHook.hook).to.have.been.called
    })

    it('reverts if amount > allowance', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore.sub(1),
        deadline
      )

      await expect(
        ppo
          .connect(spender)
          .transferFromWithPermit(
            user1.address,
            user2.address,
            user1PPOBalanceBefore,
            deadline,
            v,
            r,
            s
          )
      ).revertedWith('ERC20Permit: invalid signature')
    })

    it('reverts if amount > balance', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore.add(1),
        deadline
      )

      await expect(
        ppo
          .connect(spender)
          .transferFromWithPermit(
            user1.address,
            user2.address,
            user1PPOBalanceBefore.add(1),
            deadline,
            v,
            r,
            s
          )
      ).revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('transfers to recipient if recipient is not spender', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const user2PPOBalanceBefore = await ppo.balanceOf(user2.address)
      const spenderPPOBalanceBefore = await ppo.balanceOf(spender.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore,
        deadline
      )
      expect(spender.address).to.not.eq(user2.address)

      await ppo
        .connect(spender)
        .transferFromWithPermit(
          user1.address,
          user2.address,
          user1PPOBalanceBefore,
          deadline,
          v,
          r,
          s
        )

      expect(await ppo.balanceOf(user1.address)).to.eq(0)
      expect(await ppo.balanceOf(user2.address)).to.eq(
        user2PPOBalanceBefore.add(user1PPOBalanceBefore)
      )
      expect(await ppo.balanceOf(spender.address)).to.eq(spenderPPOBalanceBefore)
    })

    it('transfers to recipient if recipient is spender', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const spenderPPOBalanceBefore = await ppo.balanceOf(spender.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore,
        deadline
      )

      await ppo
        .connect(spender)
        .transferFromWithPermit(
          user1.address,
          spender.address,
          user1PPOBalanceBefore,
          deadline,
          v,
          r,
          s
        )

      expect(await ppo.balanceOf(user1.address)).to.eq(0)
      expect(await ppo.balanceOf(spender.address)).to.eq(
        spenderPPOBalanceBefore.add(user1PPOBalanceBefore)
      )
    })

    it("doesn't change user balances if amount = 0", async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const user2PPOBalanceBefore = await ppo.balanceOf(user2.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        BigNumber.from(0),
        deadline
      )

      await ppo
        .connect(spender)
        .transferFromWithPermit(user1.address, user2.address, BigNumber.from(0), deadline, v, r, s)

      expect(await ppo.balanceOf(user1.address)).to.eq(user1PPOBalanceBefore)
      expect(await ppo.balanceOf(user2.address)).to.eq(user2PPOBalanceBefore)
    })

    it('transfers to recipient if amount < balance', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const user2PPOBalanceBefore = await ppo.balanceOf(user2.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore.sub(1),
        deadline
      )

      await ppo
        .connect(spender)
        .transferFromWithPermit(
          user1.address,
          user2.address,
          user1PPOBalanceBefore.sub(1),
          deadline,
          v,
          r,
          s
        )

      expect(await ppo.balanceOf(user1.address)).to.eq(1)
      expect(await ppo.balanceOf(user2.address)).to.eq(
        user2PPOBalanceBefore.add(user1PPOBalanceBefore.sub(1))
      )
    })

    it('transfers to recipient if amount = balance', async () => {
      const user1PPOBalanceBefore = await ppo.balanceOf(user1.address)
      const user2PPOBalanceBefore = await ppo.balanceOf(user2.address)
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        user1PPOBalanceBefore,
        deadline
      )

      await ppo
        .connect(spender)
        .transferFromWithPermit(
          user1.address,
          user2.address,
          user1PPOBalanceBefore,
          deadline,
          v,
          r,
          s
        )

      expect(await ppo.balanceOf(user1.address)).to.eq(0)
      expect(await ppo.balanceOf(user2.address)).to.eq(
        user2PPOBalanceBefore.add(user1PPOBalanceBefore)
      )
    })

    it('emits transfer if amount = 0 and recipient is not spender', async () => {
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        BigNumber.from(0),
        deadline
      )
      expect(spender.address).to.not.eq(user2.address)
      const tx = await ppo
        .connect(spender)
        .transferFromWithPermit(user1.address, user2.address, BigNumber.from(0), deadline, v, r, s)

      await expect(tx)
        .to.emit(ppo, 'Transfer(address,address,uint256)')
        .withArgs(user1.address, user2.address, 0)
    })

    it('emits transfer if amount = 0 and recipient is spender', async () => {
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        BigNumber.from(0),
        deadline
      )
      const tx = await ppo
        .connect(spender)
        .transferFromWithPermit(
          user1.address,
          spender.address,
          BigNumber.from(0),
          deadline,
          v,
          r,
          s
        )

      await expect(tx)
        .to.emit(ppo, 'Transfer(address,address,uint256)')
        .withArgs(user1.address, spender.address, 0)
    })

    it('emits transfer if amount > 0 and recipient is not spender', async () => {
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        BigNumber.from(1),
        deadline
      )
      expect(spender.address).to.not.eq(user2.address)
      const tx = await ppo
        .connect(spender)
        .transferFromWithPermit(user1.address, user2.address, BigNumber.from(1), deadline, v, r, s)

      await expect(tx)
        .to.emit(ppo, 'Transfer(address,address,uint256)')
        .withArgs(user1.address, user2.address, 1)
    })

    it('emits transfer if amount > 0 and recipient is spender', async () => {
      const { v, r, s } = await getPermitSignature(
        ppo,
        user1,
        spender.address,
        BigNumber.from(1),
        deadline
      )
      const tx = await ppo
        .connect(spender)
        .transferFromWithPermit(
          user1.address,
          spender.address,
          BigNumber.from(1),
          deadline,
          v,
          r,
          s
        )

      await expect(tx)
        .to.emit(ppo, 'Transfer(address,address,uint256)')
        .withArgs(user1.address, spender.address, 1)
    })
  })

  describe('# transfer', () => {
    beforeEach(async () => {
      await setupPPOAndFakeTransferHook()
      await ppo.connect(owner).mint(user1.address, 10)
    })

    it('reverts if transfer hook not set', async () => {
      await ppo.connect(owner).setTransferHook(ZERO_ADDRESS)

      await expect(ppo.connect(user1).transfer(user2.address, 1)).revertedWith(
        'Transfer hook not set'
      )
    })

    it('reverts if transfer hook reverts', async () => {
      fakeTransferHook.hook.reverts()

      await expect(ppo.connect(user1).transfer(user2.address, 1)).to.be.reverted
    })

    it('calls transfer hook with correct parameters', async () => {
      await ppo.connect(user1).transfer(user2.address, 1)

      expect(fakeTransferHook.hook).to.have.been.calledWith(user1.address, user2.address, 1)
    })
  })

  describe('# transferFrom', () => {
    beforeEach(async () => {
      await setupPPOAndFakeTransferHook()
      await ppo.connect(owner).mint(user1.address, 10)
    })

    it('reverts if transfer hook not set', async () => {
      await ppo.connect(owner).setTransferHook(ZERO_ADDRESS)
      await ppo.connect(user1).approve(user2.address, 1)

      await expect(ppo.connect(user2).transferFrom(user1.address, user2.address, 1)).revertedWith(
        'Transfer hook not set'
      )
    })

    it('reverts if transfer hook reverts', async () => {
      fakeTransferHook.hook.reverts()
      await ppo.connect(user1).approve(user2.address, 1)

      await expect(ppo.connect(user2).transferFrom(user1.address, user2.address, 1)).to.be.reverted
    })

    it('calls transfer hook with correct parameters', async () => {
      await ppo.connect(user1).approve(user2.address, 1)

      await ppo.connect(user2).transferFrom(user1.address, user2.address, 1)

      expect(fakeTransferHook.hook).to.have.been.calledWith(user1.address, user2.address, 1)
    })
  })
})
