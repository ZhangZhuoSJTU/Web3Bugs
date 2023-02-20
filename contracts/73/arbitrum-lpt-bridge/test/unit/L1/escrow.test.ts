import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {expect} from 'chai';
import {ethers} from 'hardhat';

import {
  L1Escrow,
  L1Escrow__factory,
  LivepeerToken,
  LivepeerToken__factory,
  MockSpender,
  MockSpender__factory,
} from '../../../typechain';

describe('L1Escrow', () => {
  let owner: SignerWithAddress;
  let notOwner: SignerWithAddress;
  let spender: SignerWithAddress;
  let token: LivepeerToken;
  let escrow: L1Escrow;

  const allowanceLimit = 100;

  const ADMIN_ROLE =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  beforeEach(async function() {
    [owner, notOwner, spender] = await ethers.getSigners();

    const Token: LivepeerToken__factory = await ethers.getContractFactory(
        'LivepeerToken',
    );
    token = await Token.deploy();
    await token.deployed();

    const Escrow: L1Escrow__factory = await ethers.getContractFactory(
        'L1Escrow',
    );
    escrow = await Escrow.deploy();
    await escrow.deployed();
  });

  describe('caller is not authorized', () => {
    it('reverts when called approve', async () => {
      const tx = escrow
          .connect(notOwner)
          .approve(token.address, spender.address, allowanceLimit);

      await expect(tx).to.be.revertedWith(
          // eslint-disable-next-line
        `AccessControl: account ${notOwner.address.toLowerCase()} is missing role ${ADMIN_ROLE}`
      );
    });

    it('reverts when called allow', async () => {
      const tx = escrow
          .connect(notOwner)
          .grantRole(ADMIN_ROLE, spender.address);

      await expect(tx).to.be.revertedWith(
          // eslint-disable-next-line
        `AccessControl: account ${notOwner.address.toLowerCase()} is missing role ${ADMIN_ROLE}`
      );
    });
  });

  describe('caller is authorized', () => {
    describe('approve', async function() {
      it('sets approval on erc20 tokens', async () => {
        const initialAllowance = await token.allowance(
            escrow.address,
            spender.address,
        );
        expect(initialAllowance).to.equal(0);

        await escrow.approve(token.address, spender.address, allowanceLimit);

        const allowance = await token.allowance(
            escrow.address,
            spender.address,
        );
        expect(allowance).to.equal(allowanceLimit);
      });

      it('emits Approval event', async () => {
        const tx = escrow.approve(
            token.address,
            spender.address,
            allowanceLimit,
        );

        await expect(tx)
            .to.emit(escrow, 'Approve')
            .withArgs(token.address, spender.address, allowanceLimit);
      });
    });

    describe('grantRole', async function() {
      it('grants another user admin role', async () => {
        const isAllowedInitial = await escrow.hasRole(
            ADMIN_ROLE,
            spender.address,
        );
        expect(isAllowedInitial).to.be.false;

        await escrow.grantRole(ADMIN_ROLE, notOwner.address);

        const isAllowed = await escrow.hasRole(ADMIN_ROLE, notOwner.address);
        expect(isAllowed).to.be.true;
      });
    });
  });

  describe('transactions', async function() {
    let mockSpender: MockSpender;
    const initialSupply = 10000;

    beforeEach(async function() {
      await token.grantRole(
          ethers.utils.solidityKeccak256(['string'], ['MINTER_ROLE']),
          owner.address,
      );
      await token.mint(escrow.address, initialSupply);
      mockSpender = await new MockSpender__factory(owner).deploy();
    });

    describe('spender does not have allowance', () => {
      it('should revert on token transfer', async () => {
        const tx = mockSpender.transferTokens(
            escrow.address,
            token.address,
            1000,
        );

        await expect(tx).to.be.revertedWith(
            'ERC20: transfer amount exceeds allowance',
        );
      });
    });

    describe('spender has allowance', () => {
      const amount = 1000;

      beforeEach(async function() {
        await escrow.approve(token.address, mockSpender.address, amount);
      });

      it('should revert if amount exceeds balance', async () => {
        const tx = mockSpender.transferTokens(
            escrow.address,
            token.address,
            initialSupply + 10,
        );

        await expect(tx).to.be.revertedWith(
            'ERC20: transfer amount exceeds balance',
        );
      });

      it('should revert if amount exceeds allowance', async () => {
        const tx = mockSpender.transferTokens(
            escrow.address,
            token.address,
            amount + 100,
        );

        await expect(tx).to.be.revertedWith(
            'ERC20: transfer amount exceeds allowance',
        );
      });

      it('should transfer tokens to itself', async () => {
        const spenderInitialBalance = await token.balanceOf(
            mockSpender.address,
        );
        const escrowInitialBalance = await token.balanceOf(escrow.address);

        await mockSpender.transferTokens(escrow.address, token.address, amount);

        expect(await token.balanceOf(mockSpender.address)).to.equal(
            spenderInitialBalance.add(amount),
        );
        expect(await token.balanceOf(escrow.address)).to.equal(
            escrowInitialBalance.sub(amount),
        );
      });
    });
  });
});
