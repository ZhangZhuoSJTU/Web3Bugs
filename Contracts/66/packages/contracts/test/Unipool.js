// original file: https://github.com/Synthetixio/Unipool/blob/master/test/Unipool.js

const { BN, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { TestHelper } = require('../utils/testHelpers.js');

const { assertRevert } = TestHelper;

const Uni = artifacts.require('ERC20Mock');
const Lqty = artifacts.require('YETIToken');
const Unipool = artifacts.require('Unipool');
const NonPayable = artifacts.require('NonPayable');

const _1e18 = new BN('10').pow(new BN('18'));

const almostEqualDiv1e18 = function (expectedOrig, actualOrig) {
  const expected = expectedOrig.div(_1e18);
  const actual = actualOrig.div(_1e18);
  this.assert(
    expected.eq(actual) ||
      expected.addn(1).eq(actual) || expected.addn(2).eq(actual) ||
      actual.addn(1).eq(expected) || actual.addn(2).eq(expected),
    'expected #{act} to be almost equal #{exp}',
    'expected #{act} to be different from #{exp}',
    expectedOrig.toString(),
    actualOrig.toString(),
  );
};

require('chai').use(function (chai, utils) {
  chai.Assertion.overwriteMethod('almostEqualDiv1e18', function (original) {
    return function (value) {
      if (utils.flag(this, 'bignumber')) {
        var expected = new BN(value);
        var actual = new BN(this._obj);
        almostEqualDiv1e18.apply(this, [expected, actual]);
      } else {
        original.apply(this, arguments);
      }
    };
  });
});

contract('Unipool', function ([_, wallet1, wallet2, wallet3, wallet4, bountyAddress, owner]) {
  let multisig = "0x5b5e5CC89636CA2685b4e4f50E66099EBCFAb638"  // Arbitrary address for the multisig, which is not tested in this file

  const deploy = async (that) => {
      that.uni = await Uni.new('Uniswap token', 'LPT', owner, 0);
      that.pool = await Unipool.new();

      const communityIssuance = await NonPayable.new();
      const sYETI = await NonPayable.new();
      const lockupContractFactory = await NonPayable.new();
      that.yeti = await Lqty.new(
        communityIssuance.address,
        sYETI.address,
        lockupContractFactory.address,
        bountyAddress,
        that.pool.address,
        multisig
      );
      that.lpRewardsEntitlement = await that.yeti.getLpRewardsEntitlement();
      that.DURATION = new BN(6 * 7 * 24 * 60 * 60); // 6 weeks
      that.rewardRate = that.lpRewardsEntitlement.div(that.DURATION);

      await that.uni.mint(wallet1, web3.utils.toWei('1000'));
      await that.uni.mint(wallet2, web3.utils.toWei('1000'));
      await that.uni.mint(wallet3, web3.utils.toWei('1000'));
      await that.uni.mint(wallet4, web3.utils.toWei('1000'));

      await that.uni.approve(that.pool.address, new BN(2).pow(new BN(255)), { from: wallet1 });
      await that.uni.approve(that.pool.address, new BN(2).pow(new BN(255)), { from: wallet2 });
      await that.uni.approve(that.pool.address, new BN(2).pow(new BN(255)), { from: wallet3 });
      await that.uni.approve(that.pool.address, new BN(2).pow(new BN(255)), { from: wallet4 });
  };

  describe('Unipool', async function () {
    beforeEach(async function () {
      await deploy(this);
      await this.pool.setParams(this.yeti.address, this.uni.address, this.DURATION);
    });

    it('Two stakers with the same stakes wait DURATION', async function () {
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18('0');
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

      const stake1 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake1, { from: wallet1 });
      const stakeTime1 = await time.latest();
      // time goes by... so slowly

      const stake2 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake2, { from: wallet2 });
      const stakeTime2 = await time.latest();

      await time.increaseTo(stakeTime1.add(this.DURATION));

      const timeDiff = stakeTime2.sub(stakeTime1);
      const rewardPerToken = this.rewardRate.mul(timeDiff).mul(_1e18).div(stake1).add(this.rewardRate.mul(this.DURATION.sub(timeDiff)).mul(_1e18).div(stake1.add(stake2)));
      const halfEntitlement = this.lpRewardsEntitlement.div(new BN(2));
      const earnedDiff = halfEntitlement.mul(timeDiff).div(this.DURATION);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken);
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(halfEntitlement.add(earnedDiff));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(halfEntitlement.sub(earnedDiff));
    });

    it('Two stakers with the different (1:3) stakes wait DURATION', async function () {
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18('0');
      expect(await this.pool.balanceOf(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.balanceOf(wallet2)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

      const stake1 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake1, { from: wallet1 });
      const stakeTime1 = await time.latest();

      const stake2 = new BN(web3.utils.toWei('3'));
      await this.pool.stake(stake2, { from: wallet2 });
      const stakeTime2 = await time.latest();

      await time.increaseTo(stakeTime1.add(this.DURATION));

      const timeDiff = stakeTime2.sub(stakeTime1);
      const rewardPerToken1 = this.rewardRate.mul(timeDiff).mul(_1e18).div(stake1);
      const rewardPerToken2 = this.rewardRate.mul(this.DURATION.sub(timeDiff)).mul(_1e18).div(stake1.add(stake2));
      const rewardPerToken = rewardPerToken1.add(rewardPerToken2);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken);
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.mul(stake2).div(_1e18));
    });

    it('Two stakers with the different (1:3) stakes wait DURATION and DURATION/2', async function () {
      //
      // 1x: +--------------+
      // 3x:      +---------+
      //

      const stake1 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake1, { from: wallet1 });
      const stakeTime1 = await time.latest();

      await time.increaseTo(stakeTime1.add(this.DURATION.div(new BN(3))));

      const stake2 = new BN(web3.utils.toWei('3'));
      await this.pool.stake(stake2, { from: wallet2 });
      const stakeTime2 = await time.latest();

      const timeDiff = stakeTime2.sub(stakeTime1);
      const rewardPerToken1 = this.rewardRate.mul(timeDiff).mul(_1e18).div(stake1);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1);
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');

      // Forward to week 3 and notifyReward weekly
      await time.increase(this.DURATION.mul(new BN(2)).div(new BN(3)));

      const rewardPerToken2 = this.rewardRate.mul(this.DURATION.sub(timeDiff)).mul(_1e18).div(stake1.add(stake2));
      const rewardPerToken = rewardPerToken1.add(rewardPerToken2);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken);
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.mul(stake2).div(_1e18));
    });

    it('Three stakers with the different (1:3:5) stakes wait different durations', async function () {
      //
      // 1x: +----------------+--------+
      // 3x:  +---------------+
      // 5x:         +-----------------+
      //

      const stake1 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake1, { from: wallet1 });
      const stakeTime1 = await time.latest();


      const stake2 = new BN(web3.utils.toWei('3'));
      await this.pool.stake(stake2, { from: wallet2 });
      const stakeTime2 = await time.latest();

      await time.increaseTo(stakeTime1.add(this.DURATION.div(new BN(3))));

      const stake3 = new BN(web3.utils.toWei('5'));
      await this.pool.stake(stake3, { from: wallet3 });
      const stakeTime3 = await time.latest();

      const timeDiff1 = stakeTime2.sub(stakeTime1);
      const timeDiff2 = stakeTime3.sub(stakeTime2);
      const rewardPerToken1 = this.rewardRate.mul(timeDiff1).mul(_1e18).div(stake1);
      const rewardPerToken2 = this.rewardRate.mul(timeDiff2).mul(_1e18).div(stake1.add(stake2));
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.mul(stake2).div(_1e18));

      await time.increaseTo(stakeTime1.add(this.DURATION.mul(new BN(2)).div(new BN(3))));

      await this.pool.withdrawAndClaim({ from: wallet2 });
      const exitTime2 = await time.latest();

      const timeDiff3 = exitTime2.sub(stakeTime3);
      const rewardPerToken3 = this.rewardRate.mul(timeDiff3).mul(_1e18).div(stake1.add(stake2).add(stake3));
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');
      expect(await this.yeti.balanceOf(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.add(rewardPerToken3).mul(stake2).div(_1e18));
      expect(await this.pool.earned(wallet3)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken3.mul(stake3).div(_1e18));

      await time.increaseTo(stakeTime1.add(this.DURATION));

      const timeDiff4 = this.DURATION.sub(exitTime2.sub(stakeTime1));
      const rewardPerToken4 = this.rewardRate.mul(timeDiff4).mul(_1e18).div(stake1.add(stake3));
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3).add(rewardPerToken4));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3).add(rewardPerToken4).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet3)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken3.add(rewardPerToken4).mul(stake3).div(_1e18));
    });

    it('Four stakers with gaps of zero total supply', async function () {
      //
      // 1x: +-------+               |
      // 3x:  +----------+           |
      // 5x:                +------+ |
      // 1x:                         |  +------...
      //                             +-> end of initial duration

      const stake1 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake1, { from: wallet1 });
      const stakeTime1 = await time.latest();

      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime1.add(this.DURATION));

      const stake2 = new BN(web3.utils.toWei('3'));
      await this.pool.stake(stake2, { from: wallet2 });
      const stakeTime2 = await time.latest();

      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime1.add(this.DURATION));

      await time.increase(this.DURATION.div(new BN(6)));

      await this.pool.withdrawAndClaim({ from: wallet1 });
      const exitTime1 = await time.latest();

      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime1.add(this.DURATION));

      const timeDiff1 = stakeTime2.sub(stakeTime1);
      const timeDiff2 = exitTime1.sub(stakeTime2);
      const rewardPerToken1 = this.rewardRate.mul(timeDiff1).mul(_1e18).div(stake1);
      const rewardPerToken2 = this.rewardRate.mul(timeDiff2).mul(_1e18).div(stake1.add(stake2));
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.yeti.balanceOf(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.mul(stake2).div(_1e18));

      await time.increase(this.DURATION.div(new BN(6)));

      await this.pool.withdrawAndClaim({ from: wallet2 });
      const exitTime2 = await time.latest();

      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime1.add(this.DURATION));

      const timeDiff3 = exitTime2.sub(exitTime1);
      const rewardPerToken3 = this.rewardRate.mul(timeDiff3).mul(_1e18).div(stake2);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');
      expect(await this.yeti.balanceOf(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.add(rewardPerToken3).mul(stake2).div(_1e18));

      await time.increase(this.DURATION.div(new BN(6)));

      const stake3 = new BN(web3.utils.toWei('5'));
      await this.pool.stake(stake3, { from: wallet3 });
      const stakeTime3 = await time.latest();

      const emptyPeriod1 = stakeTime3.sub(exitTime2);
      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime1.add(emptyPeriod1).add(this.DURATION));

      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet3)).to.be.bignumber.equal('0');

      await time.increase(this.DURATION.div(new BN(6)));

      await this.pool.withdrawAndClaim({ from: wallet3 });
      const exitTime3 = await time.latest();

      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime1.add(emptyPeriod1).add(this.DURATION));

      const timeDiff4 = exitTime3.sub(stakeTime3);
      const rewardPerToken4 = this.rewardRate.mul(timeDiff4).mul(_1e18).div(stake3);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3).add(rewardPerToken4));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet3)).to.be.bignumber.equal('0');
      expect(await this.yeti.balanceOf(wallet3)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken4.mul(stake3).div(_1e18));

      await time.increase(this.DURATION.div(new BN(2)));

      // check that we have reached initial duration
      expect(await time.latest()).to.be.bignumber.gte(stakeTime1.add(this.DURATION));

      const stake4 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake4, { from: wallet4 });
      const stakeTime4 = await time.latest();

      const emptyPeriod2 = stakeTime1.add(emptyPeriod1).add(this.DURATION).sub(exitTime3);
      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime4.add(emptyPeriod2));

      await time.increase(this.DURATION.div(new BN(2)));

      const timeDiff5 = this.DURATION.sub(exitTime2.sub(stakeTime1).add(timeDiff4));
      const rewardPerToken5 = this.rewardRate.mul(timeDiff5).mul(_1e18).div(stake4);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3).add(rewardPerToken4).add(rewardPerToken5));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet3)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet4)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken5.mul(stake4).div(_1e18));
    });

    it('Four stakers with gaps of zero total supply, with claims in between', async function () {
      //
      // 1x: +-------+               |
      // 3x:  +----------+           |
      // 5x:                +------+ |
      // 1x:                         |  +------...
      //                             +-> end of initial duration

      const stake1 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake1, { from: wallet1 });
      const stakeTime1 = await time.latest();

      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime1.add(this.DURATION));

      const stake2 = new BN(web3.utils.toWei('3'));
      await this.pool.stake(stake2, { from: wallet2 });
      const stakeTime2 = await time.latest();

      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime1.add(this.DURATION));

      await time.increase(this.DURATION.div(new BN(6)));

      await this.pool.withdraw(stake1, { from: wallet1 });
      const exitTime1 = await time.latest();

      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime1.add(this.DURATION));

      const timeDiff1 = stakeTime2.sub(stakeTime1);
      const timeDiff2 = exitTime1.sub(stakeTime2);
      const rewardPerToken1 = this.rewardRate.mul(timeDiff1).mul(_1e18).div(stake1);
      const rewardPerToken2 = this.rewardRate.mul(timeDiff2).mul(_1e18).div(stake1.add(stake2));
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.mul(stake2).div(_1e18));

      await time.increase(this.DURATION.div(new BN(6)));

      await this.pool.withdraw(stake2, { from: wallet2 });
      const exitTime2 = await time.latest();

      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime1.add(this.DURATION));

      const timeDiff3 = exitTime2.sub(exitTime1);
      const rewardPerToken3 = this.rewardRate.mul(timeDiff3).mul(_1e18).div(stake2);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).mul(stake1).div(_1e18));
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.add(rewardPerToken3).mul(stake2).div(_1e18));

      await time.increase(this.DURATION.div(new BN(12)));

      await this.pool.claimReward({ from: wallet1 });

      await time.increase(this.DURATION.div(new BN(12)));

      const stake3 = new BN(web3.utils.toWei('5'));
      await this.pool.stake(stake3, { from: wallet3 });
      const stakeTime3 = await time.latest();

      const emptyPeriod1 = stakeTime3.sub(exitTime2);
      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime1.add(emptyPeriod1).add(this.DURATION));

      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.add(rewardPerToken3).mul(stake2).div(_1e18));
      expect(await this.pool.earned(wallet3)).to.be.bignumber.equal('0');

      await time.increase(this.DURATION.div(new BN(6)));

      await this.pool.withdraw(stake3, { from: wallet3 });
      const exitTime3 = await time.latest();

      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime1.add(emptyPeriod1).add(this.DURATION));

      const timeDiff4 = exitTime3.sub(stakeTime3);
      const rewardPerToken4 = this.rewardRate.mul(timeDiff4).mul(_1e18).div(stake3);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3).add(rewardPerToken4));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.add(rewardPerToken3).mul(stake2).div(_1e18));
      expect(await this.pool.earned(wallet3)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken4.mul(stake3).div(_1e18));

      await time.increase(this.DURATION.div(new BN(2)));

      // check that we have reached initial duration
      expect(await time.latest()).to.be.bignumber.gte(stakeTime1.add(this.DURATION));

      await this.pool.claimReward({ from: wallet3 });

      await time.increase(this.DURATION.div(new BN(12)));

      const stake4 = new BN(web3.utils.toWei('1'));
      await this.pool.stake(stake4, { from: wallet4 });
      const stakeTime4 = await time.latest();

      const emptyPeriod2 = stakeTime1.add(emptyPeriod1).add(this.DURATION).sub(exitTime3);
      expect(await this.pool.periodFinish()).to.be.bignumber.equal(stakeTime4.add(emptyPeriod2));

      await time.increase(this.DURATION.div(new BN(2)));

      const timeDiff5 = this.DURATION.sub(exitTime2.sub(stakeTime1).add(timeDiff4));
      const rewardPerToken5 = this.rewardRate.mul(timeDiff5).mul(_1e18).div(stake4);
      expect(await this.pool.rewardPerToken()).to.be.bignumber.almostEqualDiv1e18(rewardPerToken1.add(rewardPerToken2).add(rewardPerToken3).add(rewardPerToken4).add(rewardPerToken5));
      expect(await this.pool.earned(wallet1)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet2)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken2.add(rewardPerToken3).mul(stake2).div(_1e18));
      expect(await this.pool.earned(wallet3)).to.be.bignumber.equal('0');
      expect(await this.pool.earned(wallet4)).to.be.bignumber.almostEqualDiv1e18(rewardPerToken5.mul(stake4).div(_1e18));
    });
  });

  describe('Unipool, before calling setAddresses', async function () {
    beforeEach(async function () {
      await deploy(this);
    });

    it('Stake fails', async function () {
      const stake1 = new BN(web3.utils.toWei('1'));
      await assertRevert(this.pool.stake(stake1, { from: wallet1 }), "Liqudity Pool Token has not been set yet");
    });

    it('Withdraw falis', async function () {
      const stake1 = new BN(web3.utils.toWei('1'));
      await assertRevert(this.pool.withdraw(stake1, { from: wallet1 }), "Liqudity Pool Token has not been set yet");
    });

    it('Claim fails', async function () {
      await assertRevert(this.pool.claimReward({ from: wallet1 }), "Liqudity Pool Token has not been set yet");
    });

    it('Exit fails', async function () {
      await assertRevert(this.pool.withdrawAndClaim({ from: wallet1 }), "Cannot withdraw 0");
    });
  });
});
