import { time, expectRevert, expectApprox, getAddresses, getCore } from '@test/helpers';
import { expect } from 'chai';
import hre, { ethers } from 'hardhat';
import { Contract, Signer } from 'ethers';
import { Core, Volt, GlobalRateLimitedMinter } from '@custom-types/contracts';

const scale = ethers.constants.WeiPerEther;

describe('GlobalRateLimitedMinterBuffer', function () {
  let userAddress;
  let governorAddress;
  let globalRateLimitedMinter: GlobalRateLimitedMinter;
  let authorizedMinter: Contract;
  let core: Core;
  let fei: Volt;

  const globalRateLimitPerSecond = scale.mul(100_000);
  const maxRateLimitPerSecond = globalRateLimitPerSecond.div(10);
  const bufferCap = scale.mul(100_000_000);
  const maxBufferCap = bufferCap.div(10);

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

    core = await getCore();

    fei = await ethers.getContractAt('Volt', await core.volt());

    globalRateLimitedMinter = await (
      await ethers.getContractFactory('GlobalRateLimitedMinter')
    ).deploy(
      core.address,
      globalRateLimitPerSecond,
      globalRateLimitPerSecond,
      maxRateLimitPerSecond,
      maxBufferCap,
      bufferCap
    );

    authorizedMinter = await (await ethers.getContractFactory('MockMinter')).deploy(globalRateLimitedMinter.address);

    await core.connect(impersonatedSigners[governorAddress]).grantMinter(globalRateLimitedMinter.address);

    await globalRateLimitedMinter
      .connect(impersonatedSigners[governorAddress])
      .addAddress(authorizedMinter.address, globalRateLimitPerSecond, bufferCap);
  });

  describe('Init', function () {
    it('buffercap is correct on individual minter', async function () {
      expect((await globalRateLimitedMinter.rateLimitPerAddress(authorizedMinter.address)).bufferCap).to.be.equal(
        bufferCap
      );
    });

    it('rateLimitPerSecond is correctly initialized on individual minter', async function () {
      expect(
        (await globalRateLimitedMinter.rateLimitPerAddress(authorizedMinter.address)).rateLimitPerSecond
      ).to.be.equal(globalRateLimitPerSecond);
    });

    it('lastBufferUsedTime is not 0 individual minter', async function () {
      expect(
        (await globalRateLimitedMinter.rateLimitPerAddress(authorizedMinter.address)).lastBufferUsedTime
      ).to.not.be.equal(0);
    });

    it('bufferStored is correctly initialized on individual minter', async function () {
      expect((await globalRateLimitedMinter.rateLimitPerAddress(authorizedMinter.address)).bufferStored).to.be.equal(
        bufferCap
      );
    });

    it('maxBufferCap is correctly initialized on individual minter', async function () {
      expect(await globalRateLimitedMinter.individualMaxBufferCap()).to.be.equal(maxBufferCap);
    });

    it('maxRateLimitPerSecond is correctly initialized on individual minter', async function () {
      expect(await globalRateLimitedMinter.individualMaxRateLimitPerSecond()).to.be.equal(maxRateLimitPerSecond);
    });
  });

  describe('Mint', function () {
    describe('Mint Max Allowable', function () {
      it('fully clears out buffer', async function () {
        await authorizedMinter.mintAllFei(userAddress);
        expect(await fei.balanceOf(userAddress)).to.be.equal(bufferCap);
        expectApprox(await globalRateLimitedMinter.individualBuffer(authorizedMinter.address), '0');
      });

      it('fully clears out buffer and second call mints 0 silently', async function () {
        await authorizedMinter.mintAllFei(userAddress);
        await authorizedMinter.mintAllFei(userAddress);
        expectApprox(await globalRateLimitedMinter.individualBuffer(authorizedMinter.address), '0');
      });

      it('fully clears out buffer and second call mints 0 silently', async function () {
        await authorizedMinter.mintAllFei(userAddress);
        await authorizedMinter.mintAllFei(userAddress);
        expectApprox(await globalRateLimitedMinter.individualBuffer(authorizedMinter.address), '0');
      });
    });

    describe('Mint Max Allowable With Drained Global Buffer', function () {
      let secondAuthorizedMinter: Contract;

      before(async function () {
        globalRateLimitedMinter = await (
          await ethers.getContractFactory('GlobalRateLimitedMinter')
        ).deploy(
          core.address,
          globalRateLimitPerSecond,
          globalRateLimitPerSecond,
          maxRateLimitPerSecond,
          maxBufferCap.sub(1),
          maxBufferCap
        );

        authorizedMinter = await (
          await ethers.getContractFactory('MockMinter')
        ).deploy(globalRateLimitedMinter.address);

        secondAuthorizedMinter = await (
          await ethers.getContractFactory('MockMinter')
        ).deploy(globalRateLimitedMinter.address);

        await core.connect(impersonatedSigners[governorAddress]).grantMinter(globalRateLimitedMinter.address);

        await globalRateLimitedMinter
          .connect(impersonatedSigners[governorAddress])
          .addAddress(authorizedMinter.address, globalRateLimitPerSecond, maxBufferCap);

        await globalRateLimitedMinter
          .connect(impersonatedSigners[governorAddress])
          .addAddress(secondAuthorizedMinter.address, globalRateLimitPerSecond, maxBufferCap);
      });

      it('fully clears out global buffer and second call mints 0 silently as global buffer is exhausted', async function () {
        await secondAuthorizedMinter.mintAllFei(userAddress);
        await authorizedMinter.mintAllFei(userAddress);
        expectApprox(await globalRateLimitedMinter.individualBuffer(authorizedMinter.address), '0');
        expectApprox(await globalRateLimitedMinter.individualBuffer(secondAuthorizedMinter.address), maxBufferCap);
        expectApprox(await globalRateLimitedMinter.buffer(), '0');
      });
    });

    describe('Mint Fails', function () {
      it('non whitelisted address fails mints on mintMaxAllowableFei', async function () {
        await expectRevert(
          globalRateLimitedMinter.connect(impersonatedSigners[userAddress]).mintMaxAllowableVolt(userAddress),
          'MultiRateLimited: no rate limit buffer'
        );
        expect(await fei.balanceOf(userAddress)).to.be.equal(0);
      });

      it('non whitelisted address fails mints on mintFei', async function () {
        await expectRevert(
          globalRateLimitedMinter.connect(impersonatedSigners[userAddress]).mintVolt(userAddress, 1),
          'MultiRateLimited: no rate limit buffer'
        );
        expect(await fei.balanceOf(userAddress)).to.be.equal(0);
      });
    });

    describe('Full mint', function () {
      beforeEach(async function () {
        await authorizedMinter.mintFei(userAddress, bufferCap);
      });

      it('clears out buffer', async function () {
        expectApprox(await globalRateLimitedMinter.individualBuffer(authorizedMinter.address), '0');
        expect(await fei.balanceOf(userAddress)).to.be.equal(bufferCap);
      });

      it('second mint reverts', async function () {
        await expectRevert(authorizedMinter.mintFei(userAddress, bufferCap), 'RateLimited: rate limit hit');
      });

      it('mint fails when user has no buffer or allocation in the system', async function () {
        const { lastBufferUsedTime, bufferCap, rateLimitPerSecond, bufferStored } =
          await globalRateLimitedMinter.rateLimitPerAddress(userAddress);

        expect(lastBufferUsedTime).to.be.equal(0);
        expect(bufferCap).to.be.equal(0);
        expect(rateLimitPerSecond).to.be.equal(0);
        expect(bufferStored).to.be.equal(0);

        await expectRevert(
          globalRateLimitedMinter.connect(impersonatedSigners[userAddress]).mintVolt(userAddress, 100),
          'MultiRateLimited: no rate limit buffer'
        );
      });
    });

    it('time increase refreshes buffer', async function () {
      await time.increase(500);
      expectApprox(await globalRateLimitedMinter.getBufferCap(authorizedMinter.address), bufferCap.div(2));
    });

    it('time increase refreshes buffer', async function () {
      await time.increase(1000);
      expectApprox(await globalRateLimitedMinter.getBufferCap(authorizedMinter.address), bufferCap);
    });
  });

  describe('Second Minter', function () {
    let secondAuthorizedMinter: Contract;

    beforeEach(async function () {
      secondAuthorizedMinter = await (
        await ethers.getContractFactory('MockMinter')
      ).deploy(globalRateLimitedMinter.address);

      await globalRateLimitedMinter
        .connect(impersonatedSigners[governorAddress])
        .addAddress(secondAuthorizedMinter.address, globalRateLimitPerSecond, bufferCap);
    });

    it('second minter mints successfully and depletes global buffer', async function () {
      const startingUserFeiBalance = await fei.balanceOf(userAddress);
      await secondAuthorizedMinter.mintFei(userAddress, await globalRateLimitedMinter.buffer());
      const endingUserFeiBalance = await fei.balanceOf(userAddress);

      expect(endingUserFeiBalance.sub(startingUserFeiBalance)).to.be.equal(await globalRateLimitedMinter.bufferCap());
    });

    it('first and second minter mints successfully and depletes their and global buffers', async function () {
      const globalBuffer = await globalRateLimitedMinter.buffer();
      const mintAmount = globalBuffer.div(2);

      await authorizedMinter.mintFei(userAddress, mintAmount);
      await secondAuthorizedMinter.mintFei(userAddress, mintAmount);

      /// expect individual buffers to be 50% depleted + 2 seconds of replenishment for the first minter
      expect((await globalRateLimitedMinter.individualBuffer(secondAuthorizedMinter.address)).mul(2)).to.be.equal(
        bufferCap
      );
      expect((await globalRateLimitedMinter.individualBuffer(authorizedMinter.address)).mul(2)).to.be.equal(
        bufferCap.add(globalRateLimitPerSecond.mul(2))
      );

      /// one second has passed so buffer has replenished a tiny bit
      expect(await globalRateLimitedMinter.buffer()).to.be.equal(globalRateLimitPerSecond);

      /// assert that the first minter minted 1 second before the 2nd
      expect(
        (await globalRateLimitedMinter.rateLimitPerAddress(secondAuthorizedMinter.address)).lastBufferUsedTime -
          (await globalRateLimitedMinter.rateLimitPerAddress(authorizedMinter.address)).lastBufferUsedTime
      ).to.be.equal(1);

      /// assert that the second minter updated the global buffer last used time correctly
      expect(
        (await globalRateLimitedMinter.rateLimitPerAddress(secondAuthorizedMinter.address)).lastBufferUsedTime
      ).to.be.equal(await globalRateLimitedMinter.lastBufferUsedTime());
    });

    it('second minter mint fails as global buffer is depleted', async function () {
      const remainingGlobalBuffer = await globalRateLimitedMinter.buffer();
      await authorizedMinter.mintFei(userAddress, remainingGlobalBuffer);
      await expectRevert(
        secondAuthorizedMinter.mintFei(userAddress, remainingGlobalBuffer),
        'RateLimited: rate limit hit'
      );
    });
  });

  describe('Partial Mint', function () {
    const mintAmount = '10000';

    beforeEach(async function () {
      globalRateLimitedMinter = await (
        await ethers.getContractFactory('GlobalRateLimitedMinter')
      ).deploy(
        core.address,
        globalRateLimitPerSecond,
        globalRateLimitPerSecond,
        maxRateLimitPerSecond,
        maxBufferCap,
        bufferCap
      );

      authorizedMinter = await (await ethers.getContractFactory('MockMinter')).deploy(globalRateLimitedMinter.address);

      await core.connect(impersonatedSigners[governorAddress]).grantMinter(globalRateLimitedMinter.address);

      await globalRateLimitedMinter
        .connect(impersonatedSigners[governorAddress])
        .addAddress(authorizedMinter.address, globalRateLimitPerSecond, bufferCap);

      await authorizedMinter.mintFei(userAddress, mintAmount);
    });

    it('partially clears out buffer', async function () {
      expectApprox(await globalRateLimitedMinter.individualBuffer(authorizedMinter.address), bufferCap);
      expect(await fei.balanceOf(userAddress)).to.be.equal(mintAmount);
    });

    it('second mint does not have enough buffer and fails', async function () {
      await expectRevert(authorizedMinter.mintFei(userAddress, bufferCap.mul(2)), 'RateLimited: rate limit hit');
    });

    it('time increase replenishes buffer', async function () {
      await time.increase('1000');
      expectApprox(await globalRateLimitedMinter.individualBuffer(authorizedMinter.address), bufferCap.sub(mintAmount));
    });
  });

  describe('Multi Rate Limit Buffer Exhaustion', function () {
    const newRateLimitPerSecond = globalRateLimitPerSecond.div(10);
    const newBufferCap = bufferCap.div(10);

    beforeEach(async function () {
      await globalRateLimitedMinter
        .connect(impersonatedSigners[governorAddress])
        .updateAddress(authorizedMinter.address, newRateLimitPerSecond, newBufferCap);

      // clear the whole buffer out
      await authorizedMinter.mintFei(userAddress, newBufferCap);
    });

    it('time increase partially replenishes buffer and mint fails due to MultiRateLimit', async function () {
      /// only refresh the buffer 10%
      await time.increase('100');
      await expectRevert(authorizedMinter.mintFei(userAddress, newBufferCap), 'MultiRateLimited: rate limit hit');
    });
  });

  describe('construction', function () {
    it('construction fails when non gov max buffer cap is equal to global buffer cap', async function () {
      await expectRevert(
        (
          await ethers.getContractFactory('GlobalRateLimitedMinter')
        ).deploy(
          core.address,
          globalRateLimitPerSecond,
          globalRateLimitPerSecond,
          maxRateLimitPerSecond,
          bufferCap,
          bufferCap
        ),
        'MultiRateLimited: max buffer cap invalid'
      );
    });
  });
});
