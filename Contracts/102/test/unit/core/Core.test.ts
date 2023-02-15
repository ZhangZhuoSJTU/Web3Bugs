import { expectRevert, getCore, getAddresses } from '../../helpers';
import { expect } from 'chai';
import hre, { ethers, artifacts } from 'hardhat';
import { Signer } from 'ethers';

const Tribe = artifacts.readArtifactSync('Vcon');
const MockCoreRef = artifacts.readArtifactSync('MockCoreRef');
const toBN = ethers.BigNumber.from;

describe('Core', function () {
  let userAddress: string;
  let minterAddress: string;
  let burnerAddress: string;
  let pcvControllerAddress: string;
  let governorAddress: string;
  let guardianAddress: string;

  const impersonatedSigners: { [key: string]: Signer } = {};

  before(async () => {
    const addresses = await getAddresses();

    // add any addresses you want to impersonate here
    const impersonatedAddresses = [
      addresses.userAddress,
      addresses.pcvControllerAddress,
      addresses.governorAddress,
      addresses.minterAddress,
      addresses.burnerAddress,
      addresses.guardianAddress
    ];

    for (const address of impersonatedAddresses) {
      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [address]
      });

      impersonatedSigners[address] = await ethers.getSigner(address);
    }
  });

  beforeEach(async function () {
    ({ userAddress, minterAddress, burnerAddress, pcvControllerAddress, governorAddress, guardianAddress } =
      await getAddresses());
    this.core = await getCore();

    this.tribe = await ethers.getContractAt(Tribe.abi, await this.core.vcon());

    const coreRefFactory = await ethers.getContractFactory(MockCoreRef.abi, MockCoreRef.bytecode);
    this.coreRef = await coreRefFactory.deploy(this.core.address);

    this.minterRole = await this.core.MINTER_ROLE();
    this.burnerRole = await this.core.BURNER_ROLE();
    this.governorRole = await this.core.GOVERN_ROLE();
    this.pcvControllerRole = await this.core.PCV_CONTROLLER_ROLE();
    this.guardianRole = await this.core.GUARDIAN_ROLE();
  });

  describe('Minter', function () {
    describe('Role', function () {
      describe('Has access', function () {
        it('is registered in core', async function () {
          expect(await this.core.isMinter(minterAddress)).to.be.equal(true);
        });
      });
      describe('Access revoked', function () {
        beforeEach(async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).revokeMinter(minterAddress, {});
        });

        it('is not registered in core', async function () {
          expect(await this.core.isMinter(minterAddress)).to.be.equal(false);
        });
      });
      describe('Access renounced', function () {
        beforeEach(async function () {
          await this.core.connect(impersonatedSigners[minterAddress]).renounceRole(this.minterRole, minterAddress, {});
        });

        it('is not registered in core', async function () {
          expect(await this.core.isMinter(minterAddress)).to.be.equal(false);
        });
      });
      describe('Member Count', function () {
        it('is one', async function () {
          expect(await this.core.getRoleMemberCount(this.minterRole)).to.be.equal(toBN(1));
        });
        it('updates to two', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).grantMinter(userAddress, {});
          expect(await this.core.getRoleMemberCount(this.minterRole)).to.be.equal(toBN(2));
        });
      });
      describe('Admin', function () {
        it('is governor', async function () {
          expect(await this.core.getRoleAdmin(this.minterRole)).to.be.equal(this.governorRole);
        });
      });
    });
    describe('Access', function () {
      it('onlyMinter succeeds', async function () {
        await this.coreRef.connect(impersonatedSigners[minterAddress]).testMinter({});
      });

      it('onlyBurner reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[minterAddress]).testBurner({}),
          'CoreRef: Caller is not a burner'
        );
      });

      it('onlyGovernor reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[minterAddress]).testGovernor({}),
          'CoreRef: Caller is not a governor'
        );
      });

      it('onlyGovernorOrAdmin reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[minterAddress]).testOnlyGovernorOrAdmin({}),
          'CoreRef: Caller is not a governor or contract admin'
        );
      });

      it('onlyPCVController reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[minterAddress]).testPCVController({}),
          'CoreRef: Caller is not a PCV controller'
        );
      });
    });
  });

  describe('Burner', function () {
    describe('Role', function () {
      describe('Has access', function () {
        it('is registered in core', async function () {
          expect(await this.core.isBurner(burnerAddress)).to.be.equal(true);
        });
      });
      describe('Access revoked', function () {
        beforeEach(async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).revokeBurner(burnerAddress, {});
        });

        it('is not registered in core', async function () {
          expect(await this.core.isBurner(burnerAddress)).to.be.equal(false);
        });
      });
      describe('Access renounced', function () {
        beforeEach(async function () {
          await this.core.connect(impersonatedSigners[burnerAddress]).renounceRole(this.burnerRole, burnerAddress, {});
        });

        it('is not registered in core', async function () {
          expect(await this.core.isBurner(burnerAddress)).to.be.equal(false);
        });
      });
      describe('Member Count', function () {
        it('is one', async function () {
          expect(await this.core.getRoleMemberCount(this.burnerRole)).to.be.equal(toBN(1));
        });
        it('updates to two', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).grantBurner(userAddress, {});
          expect(await this.core.getRoleMemberCount(this.burnerRole)).to.be.equal(toBN(2));
        });
      });
      describe('Admin', function () {
        it('is governor', async function () {
          expect(await this.core.getRoleAdmin(this.burnerRole)).to.be.equal(this.governorRole);
        });
      });
    });
    describe('Access', function () {
      it('onlyMinter reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[burnerAddress]).testMinter({}),
          'CoreRef: Caller is not a minter'
        );
      });

      it('onlyBurner succeeds', async function () {
        await this.coreRef.connect(impersonatedSigners[burnerAddress]).testBurner({});
      });

      it('onlyGovernor reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[burnerAddress]).testGovernor({}),
          'CoreRef: Caller is not a governor'
        );
      });

      it('onlyGovernorOrAdmin reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[burnerAddress]).testOnlyGovernorOrAdmin({}),
          'CoreRef: Caller is not a governor or contract admin'
        );
      });

      it('onlyPCVController reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[burnerAddress]).testPCVController({}),
          'CoreRef: Caller is not a PCV controller'
        );
      });
    });
  });

  describe('PCV Controller', function () {
    describe('Role', function () {
      describe('Has access', function () {
        it('is registered in core', async function () {
          expect(await this.core.isPCVController(pcvControllerAddress)).to.be.equal(true);
        });
      });
      describe('Access revoked', function () {
        beforeEach(async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).revokePCVController(pcvControllerAddress, {});
        });

        it('is not registered in core', async function () {
          expect(await this.core.isPCVController(pcvControllerAddress)).to.be.equal(false);
        });
      });
      describe('Access renounced', function () {
        beforeEach(async function () {
          await this.core
            .connect(impersonatedSigners[pcvControllerAddress])
            .renounceRole(this.pcvControllerRole, pcvControllerAddress, {});
        });

        it('is not registered in core', async function () {
          expect(await this.core.isPCVController(pcvControllerAddress)).to.be.equal(false);
        });
      });
      describe('Member Count', function () {
        it('is one', async function () {
          expect(await this.core.getRoleMemberCount(this.pcvControllerRole)).to.be.equal(toBN(1));
        });
        it('updates to two', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).grantPCVController(userAddress, {});
          expect(await this.core.getRoleMemberCount(this.pcvControllerRole)).to.be.equal(toBN(2));
        });
      });
      describe('Admin', function () {
        it('is governor', async function () {
          expect(await this.core.getRoleAdmin(this.pcvControllerRole)).to.be.equal(this.governorRole);
        });
      });
    });
    describe('Access', function () {
      it('onlyMinter reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[pcvControllerAddress]).testMinter({}),
          'CoreRef: Caller is not a minter'
        );
      });

      it('onlyBurner reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[pcvControllerAddress]).testBurner({}),
          'CoreRef: Caller is not a burner'
        );
      });

      it('onlyGovernor reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[pcvControllerAddress]).testGovernor({}),
          'CoreRef: Caller is not a governor'
        );
      });

      it('onlyGovernorOrAdmin reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[pcvControllerAddress]).testOnlyGovernorOrAdmin({}),
          'CoreRef: Caller is not a governor or contract admin'
        );
      });

      it('onlyPCVController succeeds', async function () {
        await this.coreRef.connect(impersonatedSigners[pcvControllerAddress]).testPCVController({});
      });
    });
  });

  describe('Governor', function () {
    describe('Role', function () {
      describe('Has access', function () {
        it('is registered in core', async function () {
          expect(await this.core.isGovernor(governorAddress)).to.be.equal(true);
        });
      });
      describe('Access revoked', function () {
        beforeEach(async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).revokeGovernor(governorAddress, {});
        });

        it('is not registered in core', async function () {
          expect(await this.core.isGovernor(governorAddress)).to.be.equal(false);
        });
      });
      describe('Access renounced', function () {
        beforeEach(async function () {
          await this.core
            .connect(impersonatedSigners[governorAddress])
            .renounceRole(this.governorRole, governorAddress, {});
        });

        it('is not registered in core', async function () {
          expect(await this.core.isGovernor(governorAddress)).to.be.equal(false);
        });
      });
      describe('Member Count', function () {
        it('is one', async function () {
          expect(await this.core.getRoleMemberCount(this.governorRole)).to.be.equal(toBN(2)); // gov and core
        });
        it('updates to two', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).grantGovernor(userAddress, {});
          expect(await this.core.getRoleMemberCount(this.governorRole)).to.be.equal(toBN(3)); // gov, core, and user
        });
      });
      describe('Admin', function () {
        it('is governor', async function () {
          expect(await this.core.getRoleAdmin(this.governorRole)).to.be.equal(this.governorRole);
        });
      });
    });
    describe('Access', function () {
      it('onlyMinter reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[governorAddress]).testMinter({}),
          'CoreRef: Caller is not a minter'
        );
      });

      it('onlyBurner reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[governorAddress]).testBurner({}),
          'CoreRef: Caller is not a burner'
        );
      });

      it('onlyGovernor succeeds', async function () {
        await this.coreRef.connect(impersonatedSigners[governorAddress]).testGovernor({});
      });

      it('onlyPCVController reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[governorAddress]).testPCVController({}),
          'CoreRef: Caller is not a PCV controller'
        );
      });
    });

    describe('Access Control', function () {
      describe('Minter', function () {
        it('can grant', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).grantMinter(userAddress, {});
          expect(await this.core.isMinter(userAddress)).to.be.equal(true);
        });
        it('can revoke', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).revokeMinter(minterAddress, {});
          expect(await this.core.isMinter(minterAddress)).to.be.equal(false);
        });
      });
      describe('Burner', function () {
        it('can grant', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).grantBurner(userAddress, {});
          expect(await this.core.isBurner(userAddress)).to.be.equal(true);
        });
        it('can revoke', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).revokeBurner(burnerAddress, {});
          expect(await this.core.isBurner(burnerAddress)).to.be.equal(false);
        });
      });
      describe('PCV Controller', function () {
        it('can grant', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).grantPCVController(userAddress, {});
          expect(await this.core.isPCVController(userAddress)).to.be.equal(true);
        });
        it('can revoke', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).revokePCVController(pcvControllerAddress, {});
          expect(await this.core.isPCVController(pcvControllerAddress)).to.be.equal(false);
        });
      });
      describe('Governor', function () {
        it('can grant', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).grantGovernor(userAddress, {});
          expect(await this.core.isGovernor(userAddress)).to.be.equal(true);
        });
        it('can revoke', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).revokeGovernor(governorAddress, {});
          expect(await this.core.isGovernor(governorAddress)).to.be.equal(false);
        });
      });
    });
  });

  describe('Guardian', function () {
    describe('Role', function () {
      describe('Has access', function () {
        it('is registered in core', async function () {
          expect(await this.core.isGuardian(guardianAddress)).to.be.equal(true);
        });
      });
      describe('Access revoked', function () {
        beforeEach(async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).revokeGuardian(guardianAddress, {});
        });

        it('is not registered in core', async function () {
          expect(await this.core.isGuardian(guardianAddress)).to.be.equal(false);
        });
      });
      describe('Access renounced', function () {
        beforeEach(async function () {
          await this.core
            .connect(impersonatedSigners[guardianAddress])
            .renounceRole(this.guardianRole, guardianAddress, {});
        });

        it('is not registered in core', async function () {
          expect(await this.core.isGuardian(guardianAddress)).to.be.equal(false);
        });
      });
      describe('Member Count', function () {
        it('is one', async function () {
          expect(await this.core.getRoleMemberCount(this.guardianRole)).to.be.equal(toBN(1));
        });
        it('updates to two', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).grantGuardian(userAddress, {});
          expect(await this.core.getRoleMemberCount(this.guardianRole)).to.be.equal(toBN(2));
        });
      });
      describe('Admin', function () {
        it('is governor', async function () {
          expect(await this.core.getRoleAdmin(this.guardianRole)).to.be.equal(this.governorRole);
        });
      });
    });
    describe('Access', function () {
      it('onlyMinter reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[guardianAddress]).testMinter({}),
          'CoreRef: Caller is not a minter'
        );
      });

      it('onlyBurner reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[guardianAddress]).testBurner({}),
          'CoreRef: Caller is not a burner'
        );
      });

      it('onlyGovernor reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[guardianAddress]).testGovernor({}),
          'CoreRef: Caller is not a governor'
        );
      });

      it('onlyGovernorOrAdmin reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[guardianAddress]).testOnlyGovernorOrAdmin({}),
          'CoreRef: Caller is not a governor or contract admin'
        );
      });

      it('onlyPCVController reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[guardianAddress]).testPCVController({}),
          'CoreRef: Caller is not a PCV controller'
        );
      });
    });

    describe('Access Control', function () {
      describe('Non-Guardian', function () {
        it('cannot revoke', async function () {
          await expectRevert(
            this.core.connect(impersonatedSigners[userAddress]).revokeOverride(this.minterRole, minterAddress, {}),
            'Permissions: Caller is not a guardian'
          );
        });
      });

      describe('Guardian', function () {
        it('can revoke minter', async function () {
          await this.core
            .connect(impersonatedSigners[guardianAddress])
            .revokeOverride(this.minterRole, minterAddress, {});
          expect(await this.core.isMinter(minterAddress)).to.be.equal(false);
        });

        it('can revoke burner', async function () {
          await this.core
            .connect(impersonatedSigners[guardianAddress])
            .revokeOverride(this.burnerRole, burnerAddress, {});
          expect(await this.core.isBurner(burnerAddress)).to.be.equal(false);
        });

        it('can revoke pcv controller', async function () {
          await this.core
            .connect(impersonatedSigners[guardianAddress])
            .revokeOverride(this.pcvControllerRole, pcvControllerAddress, {});
          expect(await this.core.isPCVController(pcvControllerAddress)).to.be.equal(false);
        });

        it('cannot revoke governor', async function () {
          await expectRevert(
            this.core
              .connect(impersonatedSigners[guardianAddress])
              .revokeOverride(this.governorRole, governorAddress, {}),
            'Permissions: Guardian cannot revoke governor'
          );
          expect(await this.core.isGovernor(governorAddress)).to.be.equal(true);
        });

        it('can revoke contract admin', async function () {
          this.role = await this.coreRef.CONTRACT_ADMIN_ROLE();
          await this.core
            .connect(impersonatedSigners[governorAddress])
            .createRole(this.role, await this.core.GOVERN_ROLE(), {});
          await this.core.connect(impersonatedSigners[governorAddress]).grantRole(this.role, guardianAddress, {});
          expect(await this.core.hasRole(this.role, guardianAddress)).to.be.equal(true);

          await this.core.connect(impersonatedSigners[guardianAddress]).revokeOverride(this.role, guardianAddress, {});
          expect(await this.core.hasRole(this.role, guardianAddress)).to.be.equal(false);
        });
      });
    });
  });

  describe('Contract Admin', function () {
    beforeEach(async function () {
      this.role = await this.coreRef.CONTRACT_ADMIN_ROLE();
      await this.core
        .connect(impersonatedSigners[governorAddress])
        .createRole(this.role, await this.core.GOVERN_ROLE(), {});
      await this.core.connect(impersonatedSigners[governorAddress]).grantRole(this.role, guardianAddress, {});
    });

    describe('Role', function () {
      describe('Has access', function () {
        it('is registered in core', async function () {
          expect(await this.core.hasRole(this.role, guardianAddress)).to.be.equal(true);
        });
      });

      describe('Access renounced', function () {
        beforeEach(async function () {
          await this.core.connect(impersonatedSigners[guardianAddress]).renounceRole(this.role, guardianAddress, {});
        });

        it('is not registered in core', async function () {
          expect(await this.core.hasRole(this.role, guardianAddress)).to.be.equal(false);
        });
      });
      describe('Member Count', function () {
        it('is one', async function () {
          expect(await this.core.getRoleMemberCount(this.role)).to.be.equal(toBN(1));
        });
        it('updates to two', async function () {
          await this.core.connect(impersonatedSigners[governorAddress]).grantRole(this.role, userAddress, {});
          expect(await this.core.getRoleMemberCount(this.role)).to.be.equal(toBN(2));
        });
      });
      describe('Admin', function () {
        it('is governor', async function () {
          expect(await this.core.getRoleAdmin(this.role)).to.be.equal(this.governorRole);
        });
      });
    });
    describe('Access', function () {
      it('onlyMinter reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[guardianAddress]).testMinter({}),
          'CoreRef: Caller is not a minter'
        );
      });

      it('onlyBurner reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[guardianAddress]).testBurner({}),
          'CoreRef: Caller is not a burner'
        );
      });

      it('onlyGovernor reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[guardianAddress]).testGovernor({}),
          'CoreRef: Caller is not a governor'
        );
      });

      it('onlyGovernorOrAdmin succeeds', async function () {
        await this.coreRef.connect(impersonatedSigners[guardianAddress]).testOnlyGovernorOrAdmin({});
      });

      it('onlyPCVController reverts', async function () {
        await expectRevert(
          this.coreRef.connect(impersonatedSigners[guardianAddress]).testPCVController({}),
          'CoreRef: Caller is not a PCV controller'
        );
      });
    });

    describe('Access Control', function () {
      describe('Non-Guardian', function () {
        it('cannot revoke', async function () {
          await expectRevert(
            this.core.connect(impersonatedSigners[userAddress]).revokeOverride(this.minterRole, minterAddress, {}),
            'Permissions: Caller is not a guardian'
          );
        });
      });

      describe('Guardian', function () {
        it('can revoke minter', async function () {
          await this.core
            .connect(impersonatedSigners[guardianAddress])
            .revokeOverride(this.minterRole, minterAddress, {});
          expect(await this.core.isMinter(minterAddress)).to.be.equal(false);
        });

        it('can revoke burner', async function () {
          await this.core
            .connect(impersonatedSigners[guardianAddress])
            .revokeOverride(this.burnerRole, burnerAddress, {});
          expect(await this.core.isBurner(burnerAddress)).to.be.equal(false);
        });

        it('can revoke pcv controller', async function () {
          await this.core
            .connect(impersonatedSigners[guardianAddress])
            .revokeOverride(this.pcvControllerRole, pcvControllerAddress, {});
          expect(await this.core.isPCVController(pcvControllerAddress)).to.be.equal(false);
        });

        it('cannot revoke governor', async function () {
          await expectRevert(
            this.core
              .connect(impersonatedSigners[guardianAddress])
              .revokeOverride(this.governorRole, governorAddress, {}),
            'Permissions: Guardian cannot revoke governor'
          );
          expect(await this.core.isGovernor(governorAddress)).to.be.equal(true);
        });
      });
    });
  });

  describe('Create Role', function () {
    beforeEach(async function () {
      this.role = '0x0000000000000000000000000000000000000000000000000000000000000001';
      this.adminRole = '0x0000000000000000000000000000000000000000000000000000000000000002';
    });

    it('governor succeeds', async function () {
      await this.core.connect(impersonatedSigners[governorAddress]).createRole(this.role, this.adminRole, {});
      expect(await this.core.getRoleAdmin(this.role)).to.be.equal(this.adminRole);
    });

    it('non-governor fails', async function () {
      await expectRevert(
        this.core.connect(impersonatedSigners[userAddress]).createRole(this.role, this.adminRole),
        'Permissions: Caller is not a governor'
      );
    });
  });
});
