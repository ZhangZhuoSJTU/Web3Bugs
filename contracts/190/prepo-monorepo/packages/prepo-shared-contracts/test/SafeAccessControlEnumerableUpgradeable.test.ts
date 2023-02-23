import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { DEFAULT_ADMIN_ROLE, ZERO_ADDRESS } from 'prepo-constants'
import { safeAccessControlEnumerableUpgradeableTestFixture } from './fixtures/SafeAccessControlEnumerableFixtures'
import { SafeAccessControlEnumerableUpgradeableTest } from '../types/generated'
import { formatBytes32String } from 'ethers/lib/utils'

describe('SafeAccessControlEnumerableUpgradeableTest', () => {
  let deployer: SignerWithAddress
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let roleAMember: SignerWithAddress
  let safeAccessControlEnumerable: SafeAccessControlEnumerableUpgradeableTest
  const roleA = formatBytes32String('A')
  const roleB = formatBytes32String('B')

  const deploySafeAccessControlEnumerable = async (): Promise<void> => {
    ;[deployer, user1, user2] = await ethers.getSigners()
    owner = deployer
    safeAccessControlEnumerable = await safeAccessControlEnumerableUpgradeableTestFixture()
  }

  const setupSafeAccessControlEnumerable = async (): Promise<void> => {
    await deploySafeAccessControlEnumerable()
    await safeAccessControlEnumerable.connect(deployer).grantRole(DEFAULT_ADMIN_ROLE, owner.address)
    await safeAccessControlEnumerable.connect(owner).acceptRole(DEFAULT_ADMIN_ROLE)
  }

  describe('initial state', () => {
    beforeEach(async () => {
      await deploySafeAccessControlEnumerable()
    })

    it('sets default admin to deployer', async () => {
      expect(await safeAccessControlEnumerable.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.eq(
        true
      )
    })
  })

  describe('# setRoleAdminNominee', () => {
    beforeEach(async () => {
      await setupSafeAccessControlEnumerable()
      roleAMember = user1
      await safeAccessControlEnumerable.connect(owner).grantRole(roleA, roleAMember.address)
      await safeAccessControlEnumerable.connect(roleAMember).acceptRole(roleA)
      expect(await safeAccessControlEnumerable.hasRole(roleA, roleAMember.address)).to.eq(true)
    })

    it('reverts if not role admin and not role admin nominee', async () => {
      const roleBAdmin = await safeAccessControlEnumerable.getRoleAdmin(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleBAdmin, user1.address)).to.eq(false)
      const roleBAdminNominee = await safeAccessControlEnumerable.getRoleAdminNominee(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleBAdminNominee, user1.address)).to.eq(
        false
      )

      await expect(
        safeAccessControlEnumerable.connect(user1).setRoleAdminNominee(roleB, roleA)
      ).to.be.revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      )
    })

    it('reverts if not role admin but is role admin nominee', async () => {
      const roleBAdmin = await safeAccessControlEnumerable.getRoleAdmin(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleBAdmin, roleAMember.address)).to.eq(
        false
      )
      await safeAccessControlEnumerable.setRoleAdminNominee(roleB, roleA)
      const roleBAdminNominee = await safeAccessControlEnumerable.getRoleAdminNominee(roleB)
      expect(roleBAdminNominee).to.eq(roleA)
      expect(
        await safeAccessControlEnumerable.hasRole(roleBAdminNominee, roleAMember.address)
      ).to.eq(true)

      await expect(
        safeAccessControlEnumerable.connect(roleAMember).setRoleAdminNominee(roleB, roleA)
      ).to.be.revertedWith(
        `AccessControl: account ${roleAMember.address.toLowerCase()} is missing role ${DEFAULT_ADMIN_ROLE}`
      )
    })

    it('sets role admin nominee to non-zero', async () => {
      expect(await safeAccessControlEnumerable.getRoleAdminNominee(roleB)).to.not.eq(roleA)
      expect(roleA).to.not.eq(DEFAULT_ADMIN_ROLE)
      const roleBAdmin = await safeAccessControlEnumerable.getRoleAdmin(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleBAdmin, owner.address)).to.eq(true)

      await safeAccessControlEnumerable.connect(owner).setRoleAdminNominee(roleB, roleA)

      expect(await safeAccessControlEnumerable.getRoleAdminNominee(roleB)).to.eq(roleA)
    })

    it('sets role admin nominee to default admin', async () => {
      await safeAccessControlEnumerable.connect(owner).setRoleAdminNominee(roleB, roleA)
      expect(await safeAccessControlEnumerable.getRoleAdminNominee(roleB)).to.not.eq(
        DEFAULT_ADMIN_ROLE
      )
      const roleBAdmin = await safeAccessControlEnumerable.getRoleAdmin(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleBAdmin, owner.address)).to.eq(true)

      await safeAccessControlEnumerable
        .connect(owner)
        .setRoleAdminNominee(roleB, DEFAULT_ADMIN_ROLE)

      expect(await safeAccessControlEnumerable.getRoleAdminNominee(roleB)).to.eq(DEFAULT_ADMIN_ROLE)
    })

    it('is idempotent', async () => {
      expect(await safeAccessControlEnumerable.getRoleAdminNominee(roleB)).to.not.eq(roleA)
      expect(roleA).to.not.eq(DEFAULT_ADMIN_ROLE)

      await safeAccessControlEnumerable.connect(owner).setRoleAdminNominee(roleB, roleA)

      expect(await safeAccessControlEnumerable.getRoleAdminNominee(roleB)).to.eq(roleA)

      await safeAccessControlEnumerable.connect(owner).setRoleAdminNominee(roleB, roleA)

      expect(await safeAccessControlEnumerable.getRoleAdminNominee(roleB)).to.eq(roleA)
    })

    it('emits RoleAdminNomineeUpdate', async () => {
      const previousNominee = await safeAccessControlEnumerable.getRoleAdmin(roleB)

      const tx = await safeAccessControlEnumerable.connect(owner).setRoleAdminNominee(roleB, roleA)

      await expect(tx)
        .to.emit(safeAccessControlEnumerable, 'RoleAdminNomineeUpdate')
        .withArgs(previousNominee, roleA)
    })
  })

  describe('# acceptRoleAdmin', () => {
    let roleBMember: SignerWithAddress
    beforeEach(async () => {
      await setupSafeAccessControlEnumerable()
      roleAMember = user1
      roleBMember = user2
      // Setup role A
      await safeAccessControlEnumerable.connect(owner).grantRole(roleA, roleAMember.address)
      await safeAccessControlEnumerable.connect(roleAMember).acceptRole(roleA)
      expect(await safeAccessControlEnumerable.hasRole(roleA, roleAMember.address)).to.eq(true)
      // Setup role B
      await safeAccessControlEnumerable.connect(owner).grantRole(roleB, roleBMember.address)
      await safeAccessControlEnumerable.connect(roleBMember).acceptRole(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleB, roleBMember.address)).to.eq(true)
      // Nominate role A to be admin of role B
      await safeAccessControlEnumerable.connect(owner).setRoleAdminNominee(roleB, roleA)
    })

    it('reverts if not role admin and not role admin nominee', async () => {
      await safeAccessControlEnumerable
        .connect(owner)
        .setRoleAdminNominee(roleB, DEFAULT_ADMIN_ROLE)
      const roleBAdmin = await safeAccessControlEnumerable.getRoleAdmin(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleBAdmin, user1.address)).to.eq(false)
      const roleBAdminNominee = await safeAccessControlEnumerable.getRoleAdminNominee(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleBAdminNominee, user1.address)).to.eq(
        false
      )

      await expect(
        safeAccessControlEnumerable.connect(user1).acceptRoleAdmin(roleB)
      ).to.be.revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${roleBAdminNominee}`
      )
    })

    it('reverts if role admin but not role admin nominee', async () => {
      const roleBAdmin = await safeAccessControlEnumerable.getRoleAdmin(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleBAdmin, owner.address)).to.eq(true)
      const roleBAdminNominee = await safeAccessControlEnumerable.getRoleAdminNominee(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleBAdminNominee, owner.address)).to.eq(
        false
      )
      expect(await safeAccessControlEnumerable.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.eq(
        true
      )

      await expect(
        safeAccessControlEnumerable.connect(owner).acceptRoleAdmin(roleB)
      ).to.be.revertedWith(
        `AccessControl: account ${owner.address.toLowerCase()} is missing role ${roleBAdminNominee}`
      )
    })

    it('sets role admin to role admin nominee', async () => {
      const roleBAdminNominee = await safeAccessControlEnumerable.getRoleAdminNominee(roleB)
      expect(await safeAccessControlEnumerable.getRoleAdmin(roleB)).to.not.eq(roleBAdminNominee)

      await safeAccessControlEnumerable.connect(roleAMember).acceptRoleAdmin(roleB)

      expect(await safeAccessControlEnumerable.getRoleAdmin(roleB)).to.eq(roleBAdminNominee)
    })

    it('sets role admin nominee to default admin afterwards', async () => {
      expect(await safeAccessControlEnumerable.getRoleAdminNominee(roleB)).to.not.eq(
        DEFAULT_ADMIN_ROLE
      )

      await safeAccessControlEnumerable.connect(roleAMember).acceptRoleAdmin(roleB)

      expect(await safeAccessControlEnumerable.getRoleAdminNominee(roleB)).to.eq(DEFAULT_ADMIN_ROLE)
    })

    it('emits RoleAdminChanged', async () => {
      const previousRoleAdmin = await safeAccessControlEnumerable.getRoleAdmin(roleB)

      const tx = await safeAccessControlEnumerable.connect(roleAMember).acceptRoleAdmin(roleB)

      await expect(tx)
        .to.emit(safeAccessControlEnumerable, 'RoleAdminChanged')
        .withArgs(roleB, previousRoleAdmin, roleA)
    })

    it('emits RoleAdminNomineeUpdate', async () => {
      const previousNominee = await safeAccessControlEnumerable.getRoleAdminNominee(roleB)

      const tx = await safeAccessControlEnumerable.connect(roleAMember).acceptRoleAdmin(roleB)

      await expect(tx)
        .to.emit(safeAccessControlEnumerable, 'RoleAdminNomineeUpdate')
        .withArgs(previousNominee, DEFAULT_ADMIN_ROLE)
    })
  })

  describe('# grantRole', () => {
    let roleBNominee: SignerWithAddress
    beforeEach(async () => {
      await setupSafeAccessControlEnumerable()
      roleAMember = user1
      roleBNominee = user2
    })

    it('reverts if not role admin and not role admin nominee', async () => {
      const roleBAdmin = await safeAccessControlEnumerable.getRoleAdmin(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleBAdmin, user1.address)).to.eq(false)
      const roleBAdminNominee = await safeAccessControlEnumerable.getRoleAdminNominee(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleBAdminNominee, user1.address)).to.eq(
        false
      )

      await expect(
        safeAccessControlEnumerable.connect(user1).grantRole(roleB, roleBNominee.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${roleBAdmin}`
      )
    })

    it('reverts if not role admin but is role admin nominee', async () => {
      await safeAccessControlEnumerable.connect(owner).setRoleAdminNominee(roleB, roleA)
      await safeAccessControlEnumerable.connect(owner).grantRole(roleA, roleAMember.address)
      await safeAccessControlEnumerable.connect(roleAMember).acceptRole(roleA)
      const roleBAdmin = await safeAccessControlEnumerable.getRoleAdmin(roleB)
      expect(await safeAccessControlEnumerable.hasRole(roleBAdmin, roleAMember.address)).to.eq(
        false
      )
      const roleBAdminNominee = await safeAccessControlEnumerable.getRoleAdminNominee(roleB)
      expect(
        await safeAccessControlEnumerable.hasRole(roleBAdminNominee, roleAMember.address)
      ).to.eq(true)

      await expect(
        safeAccessControlEnumerable.connect(roleAMember).grantRole(roleB, roleBNominee.address)
      ).to.be.revertedWith(
        `AccessControl: account ${roleAMember.address.toLowerCase()} is missing role ${roleBAdmin}`
      )
    })

    it('sets role nominee to non-zero address', async () => {
      expect(await safeAccessControlEnumerable.isNominated(roleB, roleBNominee.address)).to.eq(
        false
      )

      await safeAccessControlEnumerable.connect(owner).grantRole(roleB, roleBNominee.address)

      expect(await safeAccessControlEnumerable.isNominated(roleB, roleBNominee.address)).to.eq(true)
    })

    it('sets role nominee to zero address', async () => {
      expect(await safeAccessControlEnumerable.isNominated(roleB, ZERO_ADDRESS)).to.eq(false)

      await safeAccessControlEnumerable.connect(owner).grantRole(roleB, ZERO_ADDRESS)

      expect(await safeAccessControlEnumerable.isNominated(roleB, ZERO_ADDRESS)).to.eq(true)
    })

    it("doesn't make role nominee a member", async () => {
      expect(await safeAccessControlEnumerable.hasRole(roleB, roleBNominee.address)).to.eq(false)

      await safeAccessControlEnumerable.connect(owner).grantRole(roleB, roleBNominee.address)

      expect(await safeAccessControlEnumerable.hasRole(roleB, roleBNominee.address)).to.eq(false)
    })

    it('is idempotent', async () => {
      expect(await safeAccessControlEnumerable.isNominated(roleB, roleBNominee.address)).to.eq(
        false
      )

      await safeAccessControlEnumerable.connect(owner).grantRole(roleB, roleBNominee.address)

      expect(await safeAccessControlEnumerable.isNominated(roleB, roleBNominee.address)).to.eq(true)

      await safeAccessControlEnumerable.connect(owner).grantRole(roleB, roleBNominee.address)

      expect(await safeAccessControlEnumerable.isNominated(roleB, roleBNominee.address)).to.eq(true)
    })

    it('emits RoleNomineeUpdate', async () => {
      const tx = await safeAccessControlEnumerable
        .connect(owner)
        .grantRole(roleB, roleBNominee.address)

      await expect(tx)
        .to.emit(safeAccessControlEnumerable, 'RoleNomineeUpdate')
        .withArgs(roleB, roleBNominee.address, true)
    })
  })

  describe('# acceptRole', () => {
    let roleANominee: SignerWithAddress
    beforeEach(async () => {
      await setupSafeAccessControlEnumerable()
      roleANominee = user1
      await safeAccessControlEnumerable.connect(owner).setRoleAdminNominee(roleB, roleA)
      await safeAccessControlEnumerable.connect(owner).grantRole(roleA, roleANominee.address)
    })

    it('reverts if not role nominee', async () => {
      expect(await safeAccessControlEnumerable.isNominated(roleA, user2.address)).to.eq(false)

      await expect(safeAccessControlEnumerable.connect(user2).acceptRole(roleA)).to.be.revertedWith(
        'msg.sender != role nominee'
      )
    })

    it('sets role nominee as a member', async () => {
      expect(await safeAccessControlEnumerable.hasRole(roleA, roleANominee.address)).to.eq(false)

      await safeAccessControlEnumerable.connect(roleANominee).acceptRole(roleA)

      expect(await safeAccessControlEnumerable.hasRole(roleA, roleANominee.address)).to.eq(true)
    })

    it("sets nominee's nomination status to false", async () => {
      expect(await safeAccessControlEnumerable.isNominated(roleA, roleANominee.address)).to.eq(true)

      await safeAccessControlEnumerable.connect(roleANominee).acceptRole(roleA)

      expect(await safeAccessControlEnumerable.isNominated(roleA, roleANominee.address)).to.eq(
        false
      )
    })

    it('emits RoleGranted', async () => {
      const tx = await safeAccessControlEnumerable.connect(roleANominee).acceptRole(roleA)

      await expect(tx)
        .to.emit(safeAccessControlEnumerable, 'RoleGranted')
        .withArgs(roleA, roleANominee.address, roleANominee.address)
    })

    it('emits RoleNomineeUpdate', async () => {
      const tx = await safeAccessControlEnumerable.connect(roleANominee).acceptRole(roleA)

      await expect(tx)
        .to.emit(safeAccessControlEnumerable, 'RoleNomineeUpdate')
        .withArgs(roleA, roleANominee.address, false)
    })
  })

  describe('# revokeNomination', () => {
    let roleANominee: SignerWithAddress
    beforeEach(async () => {
      await setupSafeAccessControlEnumerable()
      roleANominee = user1
      await safeAccessControlEnumerable.connect(owner).grantRole(roleA, roleANominee.address)
    })

    it('reverts if not role nominee and not role admin', async () => {
      const notNomineeOrAdmin = user2
      expect(await safeAccessControlEnumerable.isNominated(roleA, notNomineeOrAdmin.address)).to.eq(
        false
      )
      const roleAAdmin = await safeAccessControlEnumerable.getRoleAdmin(roleA)
      expect(
        await safeAccessControlEnumerable.hasRole(roleAAdmin, notNomineeOrAdmin.address)
      ).to.eq(false)

      await expect(
        safeAccessControlEnumerable
          .connect(notNomineeOrAdmin)
          .revokeNomination(roleA, roleANominee.address)
      ).to.be.revertedWith(
        `AccessControl: account ${notNomineeOrAdmin.address.toLowerCase()} is missing role ${roleAAdmin}`
      )
    })

    it('reverts if role nominee but not role admin', async () => {
      expect(await safeAccessControlEnumerable.isNominated(roleA, roleANominee.address)).to.eq(true)
      const roleAAdmin = await safeAccessControlEnumerable.getRoleAdmin(roleA)
      expect(await safeAccessControlEnumerable.hasRole(roleAAdmin, roleANominee.address)).to.eq(
        false
      )

      await expect(
        safeAccessControlEnumerable
          .connect(roleANominee)
          .revokeNomination(roleA, roleANominee.address)
      ).to.be.revertedWith(
        `AccessControl: account ${roleANominee.address.toLowerCase()} is missing role ${roleAAdmin}`
      )
    })

    it("sets nominee's nomination status to false", async () => {
      expect(await safeAccessControlEnumerable.isNominated(roleA, roleANominee.address)).to.eq(true)

      await safeAccessControlEnumerable.connect(owner).revokeNomination(roleA, roleANominee.address)

      expect(await safeAccessControlEnumerable.isNominated(roleA, roleANominee.address)).to.eq(
        false
      )
    })

    it('emits RoleNomineeUpdate', async () => {
      const tx = await safeAccessControlEnumerable
        .connect(owner)
        .revokeNomination(roleA, roleANominee.address)

      await expect(tx)
        .to.emit(safeAccessControlEnumerable, 'RoleNomineeUpdate')
        .withArgs(roleA, roleANominee.address, false)
    })
  })
})
