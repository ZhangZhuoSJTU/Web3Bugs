import { expectRevert, getAddresses, getCore } from '@test/helpers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { Signer } from 'ethers';

const toBN = ethers.BigNumber.from;

describe('ERC20CompoundPCVDeposit', function () {
  let userAddress: string;
  let pcvControllerAddress: string;
  let governorAddress: string;

  const impersonatedSigners: { [key: string]: Signer } = {};

  before(async () => {
    const addresses = await getAddresses();

    // add any addresses you want to impersonate here
    const impersonatedAddresses = [addresses.userAddress, addresses.pcvControllerAddress, addresses.governorAddress];

    for (const address of impersonatedAddresses) {
      await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [address]
      });

      impersonatedSigners[address] = await ethers.getSigner(address);
    }
  });

  beforeEach(async function () {
    ({ userAddress, pcvControllerAddress, governorAddress } = await getAddresses());

    this.core = await getCore();

    this.token = await (await ethers.getContractFactory('MockERC20')).deploy();
    this.cToken = await (await ethers.getContractFactory('MockCToken')).deploy(this.token.address, false);

    this.compoundPCVDeposit = await (
      await ethers.getContractFactory('ERC20CompoundPCVDeposit')
    ).deploy(this.core.address, this.cToken.address);
    this.depositAmount = toBN('1000000000000000000');
  });

  describe('Deposit', function () {
    describe('Paused', function () {
      it('reverts', async function () {
        await this.compoundPCVDeposit.connect(impersonatedSigners[governorAddress]).pause();
        await expectRevert(this.compoundPCVDeposit.deposit(), 'Pausable: paused');
      });
    });

    describe('Not Paused', function () {
      beforeEach(async function () {
        await this.token.mint(this.compoundPCVDeposit.address, this.depositAmount);
      });

      it('succeeds', async function () {
        expect(await this.compoundPCVDeposit.balance()).to.be.equal(toBN('0'));
        await this.compoundPCVDeposit.deposit();
        // Balance should increment with the new deposited cTokens underlying
        expect(await this.compoundPCVDeposit.balance()).to.be.equal(this.depositAmount);

        // Held balance should be 0, now invested into Compound
        expect(await this.token.balanceOf(this.compoundPCVDeposit.address)).to.be.equal(toBN('0'));
      });
    });
  });

  describe('Withdraw', function () {
    describe('Paused', function () {
      it('reverts', async function () {
        await this.compoundPCVDeposit.connect(impersonatedSigners[governorAddress]).pause();
        await expectRevert(
          this.compoundPCVDeposit
            .connect(impersonatedSigners[pcvControllerAddress])
            .withdraw(userAddress, this.depositAmount),
          'Pausable: paused'
        );
      });
    });

    describe('Not PCVController', function () {
      it('reverts', async function () {
        await expectRevert(
          this.compoundPCVDeposit.connect(impersonatedSigners[userAddress]).withdraw(userAddress, this.depositAmount),
          'CoreRef: Caller is not a PCV controller'
        );
      });
    });

    describe('Not Paused', function () {
      beforeEach(async function () {
        await this.token.mint(this.compoundPCVDeposit.address, this.depositAmount);
        await this.compoundPCVDeposit.deposit();
      });

      it('succeeds', async function () {
        const userBalanceBefore = await this.token.balanceOf(userAddress);

        // withdrawing should take balance back to 0
        expect(await this.compoundPCVDeposit.balance()).to.be.equal(this.depositAmount);
        await this.compoundPCVDeposit
          .connect(impersonatedSigners[pcvControllerAddress])
          .withdraw(userAddress, this.depositAmount);
        expect(await this.compoundPCVDeposit.balance()).to.be.equal(toBN('0'));

        const userBalanceAfter = await this.token.balanceOf(userAddress);

        expect(userBalanceAfter.sub(userBalanceBefore)).to.be.equal(this.depositAmount);
      });
    });
  });

  describe('WithdrawERC20', function () {
    describe('Not PCVController', function () {
      it('reverts', async function () {
        await expectRevert(
          this.compoundPCVDeposit
            .connect(impersonatedSigners[userAddress])
            .withdrawERC20(this.cToken.address, userAddress, this.depositAmount),
          'CoreRef: Caller is not a PCV controller'
        );
      });
    });

    describe('From PCVController', function () {
      beforeEach(async function () {
        await this.token.mint(this.compoundPCVDeposit.address, this.depositAmount);
        await this.compoundPCVDeposit.deposit();
      });

      it('succeeds', async function () {
        expect(await this.compoundPCVDeposit.balance()).to.be.equal(this.depositAmount);
        // cToken exchange rate is 2 in the mock, so this would withdraw half of the cTokens
        await this.compoundPCVDeposit
          .connect(impersonatedSigners[pcvControllerAddress])
          .withdrawERC20(this.cToken.address, userAddress, this.depositAmount.div(toBN('4')));

        // balance should also get cut in half
        expect(await this.compoundPCVDeposit.balance()).to.be.equal(this.depositAmount.div(toBN('2')));

        expect(await this.cToken.balanceOf(userAddress)).to.be.equal(this.depositAmount.div(toBN('4')));
      });
    });
  });
});
