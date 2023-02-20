const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, getDiamondCut, FacetCutAction } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('Production', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['ERC20Mock', 'NativeLock', 'ForeignLock']);
    await solution(this, 'sl', this.gov, (production = true));

    await deploy(this, [['tokenA', this.ERC20Mock, ['TokenA', 'A', parseUnits('1000', 18)]]]);
    await deploy(this, [
      ['lockA', this.ForeignLock, ['Lock TokenA', 'lockA', this.sl.address, this.tokenA.address]],
    ]);

    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

    await timeTraveler.snapshot();
  });
  it('Verify non-dev fail', async function () {
    await expect(this.sl.stake(0, this.alice.address, this.tokenA.address)).to.be.revertedWith(
      'ONLY_DEV',
    );
  });
  it('Verify dev success', async function () {
    await this.tokenA.transfer(this.gov.address, parseEther('1'));
    await this.tokenA.connect(this.gov).approve(this.sl.address, parseEther('10000'));
    await this.sl.c(this.gov).stake(parseEther('1'), this.alice.address, this.tokenA.address);
  });
});
