const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber, Uint16Max, Uint32Max } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('Pool', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['ERC20Mock', 'ERC20Mock6d', 'ERC20Mock8d', 'NativeLock', 'ForeignLock']);

    await solution(this, 'sl', this.gov);
    await deploy(this, [
      ['tokenA', this.ERC20Mock, ['TokenA', 'A', parseUnits('1000', 18)]],
      ['tokenB', this.ERC20Mock6d, ['TokenB', 'B', parseUnits('1000', 6)]],
      ['tokenC', this.ERC20Mock8d, ['TokenC', 'C', parseUnits('1000', 8)]],
    ]);
    await deploy(this, [
      ['lockA', this.ForeignLock, ['Lock TokenA', 'lockA', this.sl.address, this.tokenA.address]],
      ['lockB', this.ForeignLock, ['Lock TokenB', 'lockB', this.sl.address, this.tokenB.address]],
      ['lockC', this.ForeignLock, ['Lock TokenC', 'lockC', this.sl.address, this.tokenC.address]],
      ['lockX', this.NativeLock, ['Lock TokenX', 'lockX', this.sl.address]],
    ]);
    // Add tokenA as valid token
    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

    // Add protocolX as valid protocol
    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);

    await timeTraveler.snapshot();
  });
  describe('setCooldownFee()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sl.getCooldownFee(this.tokenA.address)).to.eq(0);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).setCooldownFee(1, this.tokenA.address);
      expect(await this.sl.getCooldownFee(this.tokenA.address)).to.eq(1);
    });
  });
  describe('depositProtocolBalance()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
    });
    it('Initial state', async function () {
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('1000'));
      expect(await this.sl.getProtocolBalance(this.protocolX, this.tokenA.address)).to.eq(0);
    });
    it('Do', async function () {
      await this.sl.depositProtocolBalance(this.protocolX, parseEther('10'), this.tokenA.address);

      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.sl.getProtocolBalance(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('10'),
      );
    });
    it('Do twice', async function () {
      await this.sl.depositProtocolBalance(this.protocolX, parseEther('10'), this.tokenA.address);

      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('980'));
      expect(await this.sl.getProtocolBalance(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('20'),
      );
    });
  });
  describe('withdrawProtocolBalance()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);
    });
    it('Initial state', async function () {
      // stays 0 because no premiums are paid
      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolBalance(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('100'),
      );
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('900'));
    });
    it('Do', async function () {
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          .withdrawProtocolBalance(
            this.protocolX,
            parseEther('30'),
            this.alice.address,
            this.tokenA.address,
          ),
      );

      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getProtocolBalance(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('70'),
      );
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('930'));
    });
    it('Do exceed', async function () {
      await expect(
        this.sl
          .c(this.gov)
          .withdrawProtocolBalance(
            this.protocolX,
            parseEther('71'),
            this.alice.address,
            this.tokenA.address,
          ),
      ).to.be.revertedWith('revert ERC20: transfer amount exceeds balance');
    });
    it('Do full', async function () {
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          .withdrawProtocolBalance(
            this.protocolX,
            constants.MaxUint256,
            this.alice.address,
            this.tokenA.address,
          ),
      );

      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getProtocolBalance(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('0'),
      );
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('1000'));
    });
  });
  describe('stake()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
    });
    it('Initial state', async function () {
      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('1000'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(0);
      // bob state
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.lockA.balanceOf(this.bob.address)).to.eq(0);
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(0);
      expect(await this.lockA.balanceOf(this.sl.address)).to.eq(0);

      // sherlock contract state
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getStakerPoolBalance(this.alice.address, this.tokenA.address)).to.eq(0);
    });
    it('Do', async function () {
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(parseEther('1'));
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.lockA.balanceOf(this.sl.address)).to.eq(0);

      // sherlock contract state
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getStakerPoolBalance(this.alice.address, this.tokenA.address)).to.eq(
        parseEther('10'),
      );
    });
    it('Do bob', async function () {
      await this.sl.stake(parseEther('20'), this.bob.address, this.tokenA.address);

      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('970'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(parseEther('1'));
      // bob state
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.lockA.balanceOf(this.bob.address)).to.eq(parseEther('2'));
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('30'));
      expect(await this.lockA.balanceOf(this.sl.address)).to.eq(0);

      // sherlock contract state
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('30'));
      expect(await this.sl.getStakerPoolBalance(this.alice.address, this.tokenA.address)).to.eq(
        parseEther('10'),
      );
      expect(await this.sl.getStakerPoolBalance(this.bob.address, this.tokenA.address)).to.eq(
        parseEther('20'),
      );
    });
  });
  describe('activateCooldown()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
    });
    it('Initial state', async function () {
      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(parseEther('1'));
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.lockA.balanceOf(this.sl.address)).to.eq(0);

      // sherlock contract state
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getStakerPoolBalance(this.alice.address, this.tokenA.address)).to.eq(
        parseEther('10'),
      );

      expect(await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address)).to.eq(
        0,
      );
      expect(await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address)).to.eq(0);
    });
    it('Do', async function () {
      const b0 = await blockNumber(
        this.sl.activateCooldown(parseEther('0.2'), this.tokenA.address),
      );

      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(parseEther('0.8'));
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.lockA.balanceOf(this.sl.address)).to.eq(parseEther('0.2'));

      // sherlock contract state
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getStakerPoolBalance(this.alice.address, this.tokenA.address)).to.eq(
        parseEther('8'),
      );

      expect(await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address)).to.eq(
        1,
      );
      expect(await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address)).to.eq(1);
      const w = await this.sl.getUnstakeEntry(this.alice.address, 0, this.tokenA.address);
      expect(w.blockInitiated).to.eq(b0);
      expect(w.lock).to.eq(parseEther('0.2'));
    });
  });
  describe('activateCooldown() ─ Fee', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      await this.sl.c(this.gov).setCooldownFee(Uint32Max.div(10), this.tokenA.address);
    });
    it('Initial state', async function () {
      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(parseEther('1'));
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.lockA.balanceOf(this.sl.address)).to.eq(0);

      // sherlock contract state
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getStakerPoolBalance(this.alice.address, this.tokenA.address)).to.eq(
        parseEther('10'),
      );

      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address)).to.eq(
        0,
      );
      expect(await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address)).to.eq(0);
    });
    it('Do too much', async function () {
      await expect(
        this.sl.activateCooldown(parseEther('1.01'), this.tokenA.address),
      ).to.be.revertedWith('revert SafeMath: subtraction overflow');
    });
    it('Do', async function () {
      const b0 = await blockNumber(
        this.sl.activateCooldown(parseEther('0.5'), this.tokenA.address),
      );

      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(parseEther('0.5'));
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.lockA.balanceOf(this.sl.address)).to.be.closeTo(
        parseEther('0.45'),
        parseUnits('1', 10),
      );

      // sherlock contract state
      // 10% of alice 5 tokens is moved to first money out pool
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.be.closeTo(
        parseEther('9.5'),
        parseUnits('1', 10),
      );
      expect(await this.sl.getStakerPoolBalance(this.alice.address, this.tokenA.address)).to.eq(
        parseEther('5'),
      );

      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.be.closeTo(
        parseEther('0.5'),
        parseUnits('1', 10),
      );

      expect(await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address)).to.eq(
        1,
      );
      expect(await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address)).to.eq(1);
      const w = await this.sl.getUnstakeEntry(this.alice.address, 0, this.tokenA.address);
      expect(w.blockInitiated).to.eq(b0);
      expect(w.lock).to.be.closeTo(parseEther('0.45'), parseUnits('1', 10));
    });
  });
  describe('cancelCooldown()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      await this.sl.c(this.gov).setCooldown(1);
      this.b0 = await blockNumber(this.sl.activateCooldown(parseEther('0.5'), this.tokenA.address));
    });
    it('Initial state', async function () {
      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(parseEther('0.5'));
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.lockA.balanceOf(this.sl.address)).to.eq(parseEther('0.5'));

      expect(await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address)).to.eq(
        0,
      );
      expect(await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address)).to.eq(1);
      const w = await this.sl.getUnstakeEntry(this.alice.address, 0, this.tokenA.address);
      expect(w.blockInitiated).to.eq(this.b0);
      expect(w.lock).to.eq(parseEther('0.5'));
    });
    it('Do', async function () {
      await this.sl.cancelCooldown(0, this.tokenA.address);

      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(parseEther('1'));
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.lockA.balanceOf(this.sl.address)).to.eq(parseEther('0'));

      expect(await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address)).to.eq(
        1,
      );
      expect(await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address)).to.eq(1);
      const w = await this.sl.getUnstakeEntry(this.alice.address, 0, this.tokenA.address);
      expect(w.blockInitiated).to.eq(0);
      expect(w.lock).to.eq(0);
    });
    it('Do twice', async function () {
      await expect(this.sl.cancelCooldown(0, this.tokenA.address)).to.be.revertedWith(
        'WITHDRAW_NOT_ACTIVE',
      );
    });
  });
  describe('cancelCooldown() ─ Expired', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      await this.sl.c(this.gov).setCooldown(1);
      await this.sl.activateCooldown(parseEther('0.5'), this.tokenA.address);
    });
    it('Do', async function () {
      await timeTraveler.mine(1);
      await expect(this.sl.cancelCooldown(0, this.tokenA.address)).to.be.revertedWith(
        'COOLDOWN_EXPIRED',
      );
    });
  });
  describe('unstakeWindowExpiry()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      await this.sl.c(this.gov).setCooldown(1);
      await this.sl.c(this.gov).setUnstakeWindow(1);
      this.b0 = await blockNumber(this.sl.activateCooldown(parseEther('0.5'), this.tokenA.address));
    });
    it('Initial state', async function () {
      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(parseEther('0.5'));
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.lockA.balanceOf(this.sl.address)).to.eq(parseEther('0.5'));

      expect(await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address)).to.eq(
        0,
      );
      expect(await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address)).to.eq(1);
      const w = await this.sl.getUnstakeEntry(this.alice.address, 0, this.tokenA.address);
      expect(w.blockInitiated).to.eq(this.b0);
      expect(w.lock).to.eq(parseEther('0.5'));
    });
    it('Not expired, t=1', async function () {
      await expect(
        this.sl.c(this.bob).unstakeWindowExpiry(this.alice.address, 0, this.tokenA.address),
      ).to.be.revertedWith('UNSTAKE_WINDOW_NOT_EXPIRED');
    });
    it('Not expired, t=2', async function () {
      await expect(
        this.sl.c(this.bob).unstakeWindowExpiry(this.alice.address, 0, this.tokenA.address),
      ).to.be.revertedWith('UNSTAKE_WINDOW_NOT_EXPIRED');
    });
    it('Do', async function () {
      await this.sl.c(this.bob).unstakeWindowExpiry(this.alice.address, 0, this.tokenA.address);

      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(parseEther('1'));
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.lockA.balanceOf(this.sl.address)).to.eq(parseEther('0'));

      expect(await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address)).to.eq(
        1,
      );
      expect(await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address)).to.eq(1);
      const w = await this.sl.getUnstakeEntry(this.alice.address, 0, this.tokenA.address);
      expect(w.blockInitiated).to.eq(0);
      expect(w.lock).to.eq(0);
    });
    it('Do twice', async function () {
      await expect(
        this.sl.c(this.bob).unstakeWindowExpiry(this.alice.address, 0, this.tokenA.address),
      ).to.be.revertedWith('WITHDRAW_NOT_ACTIVE');
    });
  });
  describe('unstake()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      await this.sl.c(this.gov).setCooldown(1);
      await this.sl.c(this.gov).setUnstakeWindow(1);
      this.b0 = await blockNumber(this.sl.activateCooldown(parseEther('0.5'), this.tokenA.address));
    });
    it('Initial state', async function () {
      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(parseEther('0.5'));
      // bob state
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.lockA.balanceOf(this.bob.address)).to.eq(0);
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.lockA.balanceOf(this.sl.address)).to.eq(parseEther('0.5'));

      // sherlock contract state
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getStakerPoolBalance(this.alice.address, this.tokenA.address)).to.eq(
        parseEther('5'),
      );

      expect(await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address)).to.eq(
        0,
      );
      expect(await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address)).to.eq(1);
      const w = await this.sl.getUnstakeEntry(this.alice.address, 0, this.tokenA.address);
      expect(w.blockInitiated).to.eq(this.b0);
      expect(w.lock).to.eq(parseEther('0.5'));
    });
    it('Do', async function () {
      await timeTraveler.mine(1);

      await this.sl.unstake(0, this.bob.address, this.tokenA.address);

      // alice state
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.lockA.balanceOf(this.alice.address)).to.eq(parseEther('0.5'));
      // bob state
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('5'));
      expect(await this.lockA.balanceOf(this.bob.address)).to.eq(0);
      // sherlock state
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('5'));
      expect(await this.lockA.balanceOf(this.sl.address)).to.eq(0);

      // sherlock contract state
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('5'));
      expect(await this.sl.getStakerPoolBalance(this.alice.address, this.tokenA.address)).to.eq(
        parseEther('5'),
      );

      expect(await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address)).to.eq(
        1,
      );
      expect(await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address)).to.eq(1);
      const w = await this.sl.getUnstakeEntry(this.alice.address, 0, this.tokenA.address);
      expect(w.blockInitiated).to.eq(0);
      expect(w.lock).to.eq(0);
    });
    it('Do twice', async function () {
      await expect(this.sl.unstake(0, this.bob.address, this.tokenA.address)).to.be.revertedWith(
        'WITHDRAW_NOT_ACTIVE',
      );
    });
  });
  describe('unstake() ─ Expired', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      await this.sl.c(this.gov).setCooldown(1);
      await this.sl.c(this.gov).setUnstakeWindow(1);
      await this.sl.activateCooldown(parseEther('0.5'), this.tokenA.address);
    });
    it('Cooldown active, t=1', async function () {
      await expect(this.sl.unstake(0, this.alice.address, this.tokenA.address)).to.be.revertedWith(
        'COOLDOWN_ACTIVE',
      );
    });
    it('Window of opportunity, t=2', async function () {
      await timeTraveler.mine(1);
    });
    it('Expired, t=3', async function () {
      await expect(this.sl.unstake(0, this.alice.address, this.tokenA.address)).to.be.revertedWith(
        'UNSTAKE_WINDOW_EXPIRED',
      );
    });
  });
  describe('unstake() ─ First Money Out', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      await this.sl.c(this.gov).setInitialWeight();
      await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);

      await this.sl
        .c(this.gov)
        .tokenInit(this.sl.address, this.gov.address, this.lockX.address, true);

      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolY, this.gov.address, this.gov.address, [this.tokenA.address]);

      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenA.address,
          parseEther('1'),
          parseEther('1'),
        );

      await this.sl.c(this.gov).setUnstakeWindow(1);
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
      await this.sl.activateCooldown(parseEther('1'), this.tokenA.address);
    });
    it('Initial state', async function () {
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(0);
      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(0);
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
    });
    it('Do', async function () {
      await this.sl.unstake(0, this.bob.address, this.tokenA.address);

      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(parseEther('1'));
      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(0);
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('10'));
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(0);
    });
  });
  describe('payOffDebtAll()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      // Add protocolY as valid protocol
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolY, this.gov.address, this.gov.address, [this.tokenA.address]);

      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.sl.depositProtocolBalance(this.protocolX, parseEther('10'), this.tokenA.address);
      await this.sl.depositProtocolBalance(this.protocolY, parseEther('10'), this.tokenA.address);

      this.b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32[],address,uint256[],uint256)'](
            [this.protocolX, this.protocolY],
            this.tokenA.address,
            [parseEther('1'), parseEther('2')],
            parseEther('1'),
          ),
      );
    });
    it('Initial state', async function () {
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(this.b0);
      expect(await this.sl.getTotalAccruedDebt(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getAccruedDebt(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getAccruedDebt(this.protocolY, this.tokenA.address)).to.eq(0);
    });
    it('t=1', async function () {
      await timeTraveler.mine(1);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(this.b0);
      expect(await this.sl.getTotalAccruedDebt(this.tokenA.address)).to.eq(parseEther('3'));
      expect(await this.sl.getAccruedDebt(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(await this.sl.getAccruedDebt(this.protocolY, this.tokenA.address)).to.eq(
        parseEther('2'),
      );
    });
    it('Do', async function () {
      const b2 = await blockNumber(this.sl.payOffDebtAll(this.tokenA.address));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getTotalAccruedDebt(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getAccruedDebt(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getAccruedDebt(this.protocolY, this.tokenA.address)).to.eq(0);
    });
  });
  describe('cleanProtocol()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.sl.depositProtocolBalance(this.protocolX, parseEther('10'), this.tokenA.address);
    });
    it('Initial state', async function () {
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('0'));
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .cleanProtocol(this.protocolX, 0, false, this.alice.address, this.tokenA.address);

      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('1000'));
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(0);
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(0);

      expect(await this.sl.getProtocolBalance(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenA.address)).to.eq(false);
      const protocols = await this.sl.getProtocols(this.tokenA.address);
      expect(protocols.length).to.eq(0);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('0'));
    });
  });
  describe('cleanProtocol() ─ Accrued debt (no force)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.sl.depositProtocolBalance(this.protocolX, parseEther('10'), this.tokenA.address);
      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenA.address,
          parseEther('20'),
          parseEther('1'),
        );
    });
    it('Initial state', async function () {
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('20'));
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .cleanProtocol(this.protocolX, 0, false, this.alice.address, this.tokenA.address);

      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('1000'));
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(0);
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(0);

      expect(await this.sl.getProtocolBalance(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenA.address)).to.eq(false);
      const protocols = await this.sl.getProtocols(this.tokenA.address);
      expect(protocols.length).to.eq(0);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('0'));
    });
  });
  describe('cleanProtocol() ─ Accrued debt (force)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.sl.depositProtocolBalance(this.protocolX, parseEther('10'), this.tokenA.address);
      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenA.address,
          parseEther('20'),
          parseEther('1'),
        );
    });
    it('Initial state', async function () {
      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('20'));
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .cleanProtocol(this.protocolX, 0, true, this.alice.address, this.tokenA.address);

      expect(await this.tokenA.balanceOf(this.alice.address)).to.eq(parseEther('990'));
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.tokenA.balanceOf(this.sl.address)).to.eq(parseEther('10'));

      expect(await this.sl.getProtocolBalance(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenA.address)).to.eq(false);
      const protocols = await this.sl.getProtocols(this.tokenA.address);
      expect(protocols.length).to.eq(0);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('0'));
    });
  });
  describe('cleanProtocol() ─ Accruing debt', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.sl.depositProtocolBalance(this.protocolX, parseEther('10'), this.tokenA.address);
      await timeTraveler.ethereum.send('evm_setAutomine', [false]);
      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenA.address,
          parseEther('1'),
          parseEther('1'),
        );
    });
    it('Do', async function () {
      await timeTraveler.ethereum.send('evm_setAutomine', [true]);
      await expect(
        this.sl
          .c(this.gov)
          .cleanProtocol(this.protocolX, 0, true, this.alice.address, this.tokenA.address),
      ).to.be.revertedWith('CAN_NOT_DELETE');
    });
  });
  describe('cleanProtocol() ─ No Debt', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.sl.depositProtocolBalance(this.protocolX, parseEther('10'), this.tokenA.address);
      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenA.address,
          parseEther('1'),
          parseEther('1'),
        );
    });
    it('Do', async function () {
      await expect(
        this.sl
          .c(this.gov)
          .cleanProtocol(this.protocolX, 0, true, this.alice.address, this.tokenA.address),
      ).to.be.revertedWith('CAN_NOT_DELETE2');
    });
  });
  describe('Exchange rates', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));
    });
    it('Initial state', async function () {
      await expect(this.sl.LockToTokenXRate(this.tokenA.address)).to.be.revertedWith('NO_DATA');
      await expect(this.sl.LockToToken(parseEther('2'), this.tokenA.address)).to.be.revertedWith(
        'NO_DATA',
      );
      expect(await this.sl.TokenToLockXRate(this.tokenA.address)).to.be.eq(parseEther('1'));
      expect(await this.sl.TokenToLock(parseEther('2'), this.tokenA.address)).to.be.eq(
        parseEther('1'),
      );
    });
    it('Initial user stake', async function () {
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      expect(await this.sl.LockToTokenXRate(this.tokenA.address)).to.be.eq(parseEther('10'));
      expect(await this.sl.LockToToken(parseEther('2'), this.tokenA.address)).to.be.eq(
        parseEther('20'),
      );
      expect(await this.sl.TokenToLockXRate(this.tokenA.address)).to.be.eq(parseEther('0.1'));
      expect(await this.sl.TokenToLock(parseEther('2'), this.tokenA.address)).to.be.eq(
        parseEther('0.2'),
      );
    });
    it('payout', async function () {
      await this.sl
        .c(this.gov)
        .payout(
          this.alice.address,
          [this.tokenA.address],
          [0],
          [parseEther('5')],
          [0],
          constants.AddressZero,
        );
    });
    it('After payout exchange rates', async function () {
      expect(await this.sl.LockToTokenXRate(this.tokenA.address)).to.be.eq(parseEther('5'));
      expect(await this.sl.LockToToken(parseEther('2'), this.tokenA.address)).to.be.eq(
        parseEther('10'),
      );
      expect(await this.sl.TokenToLockXRate(this.tokenA.address)).to.be.eq(parseEther('0.2'));
      expect(await this.sl.TokenToLock(parseEther('2'), this.tokenA.address)).to.be.eq(
        parseEther('0.4'),
      );
    });
  });
});
