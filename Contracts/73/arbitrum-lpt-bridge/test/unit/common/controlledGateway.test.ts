import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {expect} from 'chai';
import {ethers} from 'hardhat';
import {
  ControlledGateway,
  ControlledGateway__factory,
  LivepeerToken,
  LivepeerToken__factory,
} from '../../../typechain';
import {L1_LPT} from '../../../deploy/constants';

describe('L1 Gateway', function() {
  let token: LivepeerToken;
  let gateway: ControlledGateway;
  let owner: SignerWithAddress;
  let notOwner: SignerWithAddress;
  let governor: SignerWithAddress;
  let governor2: SignerWithAddress;

  const ADMIN_ROLE =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  const GOVERNOR_ROLE = ethers.utils.solidityKeccak256(
      ['string'],
      ['GOVERNOR_ROLE'],
  );

  beforeEach(async function() {
    const signers = await ethers.getSigners();
    owner = signers[0];
    governor = signers[1];
    governor2 = signers[2];
    notOwner = signers[3];

    const Token: LivepeerToken__factory = await ethers.getContractFactory(
        'LivepeerToken',
    );
    token = await Token.deploy();
    await token.deployed();

    const Gateway: ControlledGateway__factory = await ethers.getContractFactory(
        'ControlledGateway',
    );
    gateway = await Gateway.deploy(L1_LPT, token.address);
    await gateway.deployed();
  });

  it('should correctly set admin', async function() {
    const hasAdminRole = await gateway.hasRole(ADMIN_ROLE, owner.address);
    expect(hasAdminRole).to.be.true;
  });

  describe('AccessControl', async function() {
    describe('add governor', async function() {
      describe('caller is not admin', async function() {
        it('should not be able to set governor', async function() {
          const tx = gateway
              .connect(notOwner)
              .grantRole(GOVERNOR_ROLE, governor.address);

          await expect(tx).to.be.revertedWith(
              // eslint-disable-next-line
            `AccessControl: account ${notOwner.address.toLowerCase()} is missing role ${ADMIN_ROLE}`
          );
        });
      });

      describe('caller is admin', async function() {
        it('should set governor', async function() {
          await gateway.grantRole(GOVERNOR_ROLE, governor.address);

          const hasControllerRole = await gateway.hasRole(
              GOVERNOR_ROLE,
              governor.address,
          );
          expect(hasControllerRole).to.be.true;
        });
      });
    });

    describe('pause', async function() {
      beforeEach(async function() {
        await gateway.grantRole(GOVERNOR_ROLE, governor.address);
      });

      describe('caller is not governor', async function() {
        it('should not be able to pause system', async function() {
          const tx = gateway.pause();

          await expect(tx).to.be.revertedWith(
              // eslint-disable-next-line
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${GOVERNOR_ROLE}`
          );
        });
      });

      describe('caller is governor', async function() {
        it('should pause system', async function() {
          await gateway.connect(governor).pause();

          const isPaused = await gateway.paused();
          expect(isPaused).to.be.true;
        });
      });
    });

    describe('unpause', async function() {
      beforeEach(async function() {
        await gateway.grantRole(GOVERNOR_ROLE, governor.address);
        await gateway.connect(governor).pause();

        const isPaused = await gateway.paused();
        expect(isPaused).to.be.true;
      });

      describe('caller is not governor', async function() {
        it('should not be able to unpause system', async function() {
          const tx = gateway.unpause();

          await expect(tx).to.be.revertedWith(
              // eslint-disable-next-line
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${GOVERNOR_ROLE}`
          );
        });
      });

      describe('caller is governor', async function() {
        it('should unpause system', async function() {
          await gateway.connect(governor).unpause();

          const isPaused = await gateway.paused();
          expect(isPaused).to.be.false;
        });
      });
    });
  });

  describe('Pausable', async function() {
    beforeEach(async function() {
      await gateway.grantRole(GOVERNOR_ROLE, governor.address);
    });

    describe('contract is not paused', async function() {
      it('should call function', async function() {
        await gateway.grantRole(GOVERNOR_ROLE, governor2.address);

        const hasControllerRole = await gateway.hasRole(
            GOVERNOR_ROLE,
            governor2.address,
        );
        expect(hasControllerRole).to.be.true;
      });
    });

    describe('contract is paused', async function() {
      beforeEach(async function() {
        await gateway.connect(governor).pause();
      });

      it('should fail to call function', async function() {
        const tx = gateway.connect(governor).pause();

        await expect(tx).to.be.revertedWith('Pausable: paused');
      });
    });
  });
});
