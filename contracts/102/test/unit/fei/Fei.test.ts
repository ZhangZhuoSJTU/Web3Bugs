import { expectRevert, getAddresses, getCore } from '../../helpers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { Signer } from 'ethers';

const toBN = ethers.BigNumber.from;

describe('Fei', function () {
  let userAddress;
  let governorAddress;
  let minterAddress;
  let burnerAddress;

  const impersonatedSigners: { [key: string]: Signer } = {};

  before(async () => {
    const addresses = await getAddresses();

    // add any addresses you want to impersonate here
    const impersonatedAddresses = [
      addresses.userAddress,
      addresses.pcvControllerAddress,
      addresses.governorAddress,
      addresses.minterAddress,
      addresses.burnerAddress
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
    ({ minterAddress, burnerAddress, governorAddress, userAddress } = await getAddresses());
    this.core = await getCore();
    this.fei = await ethers.getContractAt('Volt', await this.core.volt());
  });

  describe('mint', function () {
    describe('Paused', function () {
      it('reverts', async function () {
        await this.fei.connect(impersonatedSigners[governorAddress]).pause();
        await expectRevert(
          this.fei.connect(impersonatedSigners[minterAddress]).mint(userAddress, 100),
          'Pausable: paused'
        );
      });
    });
    describe('not from minter', function () {
      it('reverts', async function () {
        await expectRevert(this.fei.mint(userAddress, 100), 'CoreRef: Caller is not a minter');
      });
    });

    describe('from minter', function () {
      beforeEach(async function () {
        await (await this.fei.connect(impersonatedSigners[minterAddress]).mint(userAddress, 100)).wait();
      });

      it('mints new Fei tokens', async function () {
        expect(await this.fei.balanceOf(userAddress)).to.be.equal(toBN(100));
      });
    });
  });

  describe('burn', function () {
    describe('from burner to user with sufficient balance', function () {
      beforeEach(async function () {
        await this.fei.connect(impersonatedSigners[minterAddress]).mint(userAddress, 200);
      });

      it('burn Fei tokens', async function () {
        await this.fei.connect(impersonatedSigners[userAddress]).burn(100);
        expect(await this.fei.balanceOf(userAddress)).to.be.equal(toBN(100));
      });

      it('burn Fei tokens with allowance', async function () {
        await this.fei.connect(impersonatedSigners[userAddress]).approve(minterAddress, 100);
        await this.fei.connect(impersonatedSigners[minterAddress]).burnFrom(userAddress, 100);

        expect(await this.fei.balanceOf(userAddress)).to.be.equal(toBN(100));
        expect(await this.fei.allowance(userAddress, minterAddress)).to.be.equal(toBN(0));
      });
    });

    describe('from burner to user without sufficient balance', function () {
      it('burn Fei tokens', async function () {
        await expectRevert(
          this.fei.connect(impersonatedSigners[burnerAddress]).burnFrom(userAddress, 100),
          'ERC20: burn amount exceeds allowance'
        );
      });
    });
  });
});
