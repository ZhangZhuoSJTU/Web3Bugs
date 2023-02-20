import { time, expectRevert, expectApprox, getAddresses, getCore } from '@test/helpers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { Signer } from 'ethers';

const toBN = ethers.BigNumber.from;

describe('RateLimitedMinter', function () {
  let userAddress;
  let governorAddress;

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
    ({ userAddress, governorAddress } = await getAddresses());

    this.core = await getCore();

    this.fei = await ethers.getContractAt('Volt', await this.core.volt());

    this.rateLimitPerSecond = '1';
    this.bufferCap = '20000';
    this.rateLimitedMinter = await (
      await ethers.getContractFactory('MockRateLimitedMinter')
    ).deploy(this.core.address, this.rateLimitPerSecond, this.bufferCap, false);

    await this.core.connect(impersonatedSigners[governorAddress]).grantMinter(this.rateLimitedMinter.address);
  });

  describe('Mint', function () {
    describe('Full mint', function () {
      beforeEach(async function () {
        await this.rateLimitedMinter.mint(userAddress, this.bufferCap);
      });

      it('clears out buffer', async function () {
        expectApprox(await this.rateLimitedMinter.buffer(), '0');
        expect(await this.fei.balanceOf(userAddress)).to.be.equal(this.bufferCap);
      });

      it('second mint reverts', async function () {
        await expectRevert(this.rateLimitedMinter.mint(userAddress, this.bufferCap), 'RateLimited: rate limit hit');
      });

      it('time increase refreshes buffer', async function () {
        await time.increase('1000');
        expectApprox(await this.rateLimitedMinter.buffer(), '1000');
      });
    });
    describe('Partial Mint', function () {
      beforeEach(async function () {
        this.mintAmount = '10000';
        await this.rateLimitedMinter.setDoPartialMint(true); // mock method
        await this.rateLimitedMinter.mint(userAddress, this.mintAmount);
      });

      it('partially clears out buffer', async function () {
        expectApprox(await this.rateLimitedMinter.buffer(), '10000');
        expect(await this.fei.balanceOf(userAddress)).to.be.equal(this.mintAmount);
      });

      it('second mint is partial', async function () {
        await this.rateLimitedMinter.mint(userAddress, this.bufferCap);
        expectApprox(await this.fei.balanceOf(userAddress), this.bufferCap);
        expectApprox(await this.rateLimitedMinter.buffer(), '0');
      });

      it('time increase refreshes buffer', async function () {
        await time.increase('1000');
        expectApprox(await this.rateLimitedMinter.buffer(), '11000');
      });
    });
  });

  describe('Set Fei Limit Per Second', function () {
    it('governor succeeds', async function () {
      await this.rateLimitedMinter.connect(impersonatedSigners[governorAddress]).setRateLimitPerSecond('10000');
      expect(await this.rateLimitedMinter.rateLimitPerSecond()).to.be.equal(toBN('10000'));
    });

    it('non-governor reverts', async function () {
      await expectRevert(
        this.rateLimitedMinter.connect(impersonatedSigners[userAddress]).setRateLimitPerSecond('10000'),
        'CoreRef: Caller is not a governor'
      );
    });

    it('too high fei rate reverts', async function () {
      await expectRevert(
        this.rateLimitedMinter
          .connect(impersonatedSigners[governorAddress])
          .setRateLimitPerSecond(toBN('20000000000000000000000')),
        'RateLimited: rateLimitPerSecond too high'
      );
    });
  });

  describe('Set Minting Buffer Cap', function () {
    it('governor succeeds', async function () {
      await this.rateLimitedMinter
        .connect(impersonatedSigners[governorAddress])
        .connect(impersonatedSigners[governorAddress])
        .setBufferCap('10000', {});
      expect(await this.rateLimitedMinter.bufferCap()).to.be.equal(toBN('10000'));
      expect(await this.rateLimitedMinter.buffer()).to.be.equal(toBN('10000'));
    });

    it('non-governor reverts', async function () {
      await expectRevert(
        this.rateLimitedMinter.connect(impersonatedSigners[userAddress]).setBufferCap('10000'),
        'CoreRef: Caller is not a governor'
      );
    });
  });
});
