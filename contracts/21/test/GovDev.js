const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, getDiamondCut, FacetCutAction } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('GovDev', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['ERC20Mock', 'NativeLock', 'ForeignLock']);
    await solution(this, 'sl', this.gov);

    await deploy(this, [['tokenA', this.ERC20Mock, ['TokenA', 'A', parseUnits('1000', 18)]]]);
    await deploy(this, [
      ['lockA', this.ForeignLock, ['Lock TokenA', 'lockA', this.sl.address, this.tokenA.address]],
    ]);

    await timeTraveler.snapshot();
  });
  it('Initial state', async function () {
    expect(await this.sl.getGovDev()).to.eq(this.gov.address);
  });
  describe('transferGovDev()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      await this.sl.c(this.gov).transferGovDev(this.alice.address);
      expect(await this.sl.getGovDev()).to.eq(this.alice.address);
    });
    it('Do again', async function () {
      await this.sl.transferGovDev(this.gov.address);
      expect(await this.sl.getGovDev()).to.eq(this.gov.address);
    });
    it('Renounce', async function () {
      await this.sl.c(this.gov).transferGovDev(constants.AddressZero);
      expect(await this.sl.getGovDev()).to.eq(constants.AddressZero);
    });
  });
  describe('updateSolution() [ @skip-on-coverage ]', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);
    });
    it('Initial state', async function () {
      await expect(this.sl.stake(0, this.alice.address, this.tokenA.address)).to.be.revertedWith(
        'AMOUNT',
      );
    });
    it('Do', async function () {
      libPool = await (await ethers.getContractFactory('LibPool')).deploy();
      facets = [
        await ethers.getContractFactory('PoolDevOnly', {
          libraries: { LibPool: libPool.address },
        }),
      ];

      const diamondCut = await getDiamondCut(facets, (action = FacetCutAction.Replace));

      await this.sl.c(this.gov).updateSolution(diamondCut, constants.AddressZero, '0x');
    });
    it('Verify state', async function () {
      await expect(this.sl.stake(0, this.alice.address, this.tokenA.address)).to.be.revertedWith(
        'ONLY_DEV',
      );
    });
  });
});
