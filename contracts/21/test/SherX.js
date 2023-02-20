const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const {
  prepare,
  deploy,
  solution,
  blockNumber,
  events,
  Uint16Max,
  Uint16Fragment,
  Uint32Max,
} = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('SherX', function () {
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
      .tokenInit(this.tokenA.address, this.gov.address, constants.AddressZero, true);

    await this.sl
      .c(this.gov)
      .tokenInit(this.sl.address, this.gov.address, this.lockX.address, true);

    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);

    await this.tokenA.approve(this.sl.address, parseEther('10000'));
    await timeTraveler.snapshot();
  });
  describe('setInitialWeight()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do unset', async function () {
      await expect(this.sl.c(this.gov).setInitialWeight()).to.be.revertedWith('WATS_UNSET');

      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
    });
    it('Do', async function () {
      expect(await this.sl.getWatsonsSherXWeight()).to.eq(0);
      await this.sl.c(this.gov).setInitialWeight();
      expect(await this.sl.getWatsonsSherXWeight()).to.eq(Uint16Max);
    });
    it('Do twice', async function () {
      await expect(this.sl.c(this.gov).setInitialWeight()).to.be.revertedWith('ALREADY_INIT');
    });
    it('Do twice, with move', async function () {
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, constants.AddressZero, this.lockA.address, false);
      await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);

      await expect(this.sl.c(this.gov).setInitialWeight()).to.be.revertedWith('ALREADY_INIT_2');
    });
  });
  describe('setWeights()', function () {
    // LibSherX.accrueSherX() returns without changing storage in these tests
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenB.address, this.gov.address, constants.AddressZero, true);
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, constants.AddressZero, this.lockA.address, false);
      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      await this.sl.c(this.gov).setInitialWeight();
    });
    it('Initial state', async function () {
      expect(await this.sl.getSherXWeight(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getSherXWeight(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getWatsonsSherXWeight()).to.eq(Uint16Max);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);

      expect(await this.sl.getSherXWeight(this.tokenA.address)).to.eq(Uint16Max);
      expect(await this.sl.getWatsonsSherXWeight()).to.eq(0);
    });
    it('Do disabled', async function () {
      await expect(
        this.sl.c(this.gov).setWeights([this.tokenB.address], [Uint16Max], 0),
      ).to.be.revertedWith('DISABLED');
    });
    it('Do wrong', async function () {
      await expect(
        this.sl.c(this.gov).setWeights([this.tokenC.address], [Uint16Max], 0),
      ).to.be.revertedWith('DISABLED');
    });
    it('Do tokenB, exceed sum', async function () {
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenB.address, constants.AddressZero, this.lockB.address, false);

      await expect(
        this.sl
          .c(this.gov)
          .setWeights(
            [this.tokenA.address, this.tokenB.address],
            [Uint16Max.div(2), Uint16Max.div(2).add(2)],
            0,
          ),
      ).to.be.revertedWith('SUM');
    });
    it('Do tokenB, beneath sum', async function () {
      await expect(
        this.sl
          .c(this.gov)
          .setWeights(
            [this.tokenA.address, this.tokenB.address],
            [Uint16Max.div(2), Uint16Max.div(2).sub(1)],
            0,
          ),
      ).to.be.revertedWith('SUM');
    });
    it('Do tokenB, single', async function () {
      await expect(
        this.sl.c(this.gov).setWeights([this.tokenB.address], [Uint16Max], 0),
      ).to.be.revertedWith('SUM');
    });
    it('Do overflow', async function () {
      await expect(
        this.sl
          .c(this.gov)
          .setWeights(
            [this.tokenA.address, this.tokenB.address],
            [0, Uint16Max.add(Uint16Max).add(1)],
            0,
          ),
      ).to.be.revertedWith('SUM');
    });
    it('Do 30/70', async function () {
      await this.sl
        .c(this.gov)
        .setWeights(
          [this.tokenA.address, this.tokenB.address],
          [Uint16Fragment(0.3), Uint16Fragment(0.7).add(1)],
          0,
        );

      expect(await this.sl.getSherXWeight(this.tokenA.address)).to.eq(Uint16Fragment(0.3));
      expect(await this.sl.getSherXWeight(this.tokenB.address)).to.eq(Uint16Fragment(0.7).add(1));
      expect(await this.sl.getWatsonsSherXWeight()).to.eq(0);
    });
    it('Do watsons, exceed sum', async function () {
      await expect(
        this.sl
          .c(this.gov)
          .setWeights(
            [this.tokenA.address, this.tokenB.address],
            [Uint16Fragment(0.1), Uint16Fragment(0.2)],
            Uint16Fragment(0.7).add(2),
          ),
      ).to.be.revertedWith('SUM');
    });
    it('Do watsons, below sum', async function () {
      await expect(
        this.sl
          .c(this.gov)
          .setWeights(
            [this.tokenA.address, this.tokenB.address],
            [Uint16Fragment(0.1), Uint16Fragment(0.2)],
            Uint16Fragment(0.7).add(0),
          ),
      ).to.be.revertedWith('SUM');
    });
    it('Do watsons, 10/20/70', async function () {
      await this.sl
        .c(this.gov)
        .setWeights(
          [this.tokenA.address, this.tokenB.address],
          [Uint16Fragment(0.1), Uint16Fragment(0.2)],
          Uint16Fragment(0.7).add(1),
        );

      expect(await this.sl.getSherXWeight(this.tokenA.address)).to.eq(Uint16Fragment(0.1));
      expect(await this.sl.getSherXWeight(this.tokenB.address)).to.eq(Uint16Fragment(0.2));
      expect(await this.sl.getWatsonsSherXWeight()).to.eq(Uint16Fragment(0.7).add(1));
    });
    it('Do watsons, 20/10/70', async function () {
      await this.sl
        .c(this.gov)
        .setWeights(
          [this.tokenA.address, this.tokenB.address],
          [Uint16Fragment(0.2), Uint16Fragment(0.1)],
          constants.MaxUint256,
        );

      expect(await this.sl.getSherXWeight(this.tokenA.address)).to.eq(Uint16Fragment(0.2));
      expect(await this.sl.getSherXWeight(this.tokenB.address)).to.eq(Uint16Fragment(0.1));
      expect(await this.sl.getWatsonsSherXWeight()).to.eq(Uint16Fragment(0.7).add(1));
    });
  });
  describe('harvestFor(address,address)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, constants.AddressZero, this.lockA.address, false);
      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      await this.sl.c(this.gov).setInitialWeight();
      this.bStart = await blockNumber(
        this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0),
      );
    });
    it('Initial state', async function () {
      await this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address);

      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getUnallocatedSherXFor(this.alice.address, this.tokenA.address)).to.eq(
        0,
      );
      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(0);

      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(0);
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(0);

      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(this.bStart);
      expect(await this.sl.balanceOf(this.sl.address)).to.eq(0);
      expect(await this.lockX.balanceOf(this.alice.address)).to.eq(0);

      expect(
        await this.sl['getSherXPerBlock(address,address)'](this.alice.address, this.tokenA.address),
      ).to.eq(0);

      expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
    });
    it('Setup', async function () {
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address],
            [parseEther('1')],
            [parseEther('1')],
          ),
      );
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b0);
      expect(await this.sl['getSherXPerBlock(address)'](this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(
        await this.sl['getSherXPerBlock(address,address)'](this.alice.address, this.tokenA.address),
      ).to.eq(parseEther('1'));
      // if 1 lock is added, roi = 0.5 sherx
      expect(
        await this.sl['getSherXPerBlock(uint256,address)'](parseEther('1'), this.tokenA.address),
      ).to.eq(parseEther('0.5'));
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
    });
    it('Do', async function () {
      this.b1 = await blockNumber(
        this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address),
      );

      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(this.b1);
      expect(await this.sl['getSherXPerBlock(address)'](this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(
        await this.sl['getSherXPerBlock(address,address)'](this.alice.address, this.tokenA.address),
      ).to.eq(parseEther('1'));
      // if 1 lock is added, roi = 0.5 sherx
      expect(
        await this.sl['getSherXPerBlock(uint256,address)'](parseEther('1'), this.tokenA.address),
      ).to.eq(parseEther('0.5'));

      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getUnallocatedSherXFor(this.alice.address, this.tokenA.address)).to.eq(
        0,
      );
      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(0);

      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(parseEther('1'));
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(0);

      expect(await this.sl.balanceOf(this.sl.address)).to.eq(parseEther('1'));
      expect(await this.lockX.balanceOf(this.alice.address)).to.eq(parseEther('1'));
    });
    it('Do wait', async function () {
      await timeTraveler.mine(1);

      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(this.b1);
      expect(await this.sl['getSherXPerBlock(address)'](this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(
        await this.sl['getSherXPerBlock(address,address)'](this.alice.address, this.tokenA.address),
      ).to.eq(parseEther('1'));
      // if 1 lock is added, roi = 0.5 sherx
      expect(
        await this.sl['getSherXPerBlock(uint256,address)'](parseEther('1'), this.tokenA.address),
      ).to.eq(parseEther('0.5'));

      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('1'));
      expect(await this.sl.getUnallocatedSherXFor(this.alice.address, this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(0);

      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(parseEther('1'));
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(0);

      expect(await this.sl.balanceOf(this.sl.address)).to.eq(parseEther('1'));
      expect(await this.lockX.balanceOf(this.alice.address)).to.eq(parseEther('1'));
    });
    it('Do again', async function () {
      this.b2 = await blockNumber(
        this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address),
      );

      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(this.b2);
      expect(await this.sl['getSherXPerBlock(address)'](this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(
        await this.sl['getSherXPerBlock(address,address)'](this.alice.address, this.tokenA.address),
      ).to.eq(parseEther('1'));
      // if 1 lock is added, roi = 0.5 sherx
      expect(
        await this.sl['getSherXPerBlock(uint256,address)'](parseEther('1'), this.tokenA.address),
      ).to.eq(parseEther('0.5'));

      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getUnallocatedSherXFor(this.alice.address, this.tokenA.address)).to.eq(
        0,
      );
      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(0);

      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(parseEther('3'));
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(0);

      expect(await this.sl.balanceOf(this.sl.address)).to.eq(parseEther('3'));
      expect(await this.lockX.balanceOf(this.alice.address)).to.eq(parseEther('3'));
    });
  });
  describe('harvest calls', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('harvest()', async function () {
      const tx = this.sl['harvest()']();
      await expect(tx).to.emit(this.sl, 'Harvest').withArgs(this.alice.address, this.lockX.address);

      expect((await events(tx)).length).to.eq(1);
    });
    it('harvest(address)', async function () {
      const tx = this.sl['harvest(address)'](this.lockA.address);
      await expect(tx).to.emit(this.sl, 'Harvest').withArgs(this.alice.address, this.lockA.address);
      expect((await events(tx)).length).to.eq(1);
    });
    it('harvest(address[])', async function () {
      const tx = this.sl['harvest(address[])']([this.lockA.address]);
      await expect(tx).to.emit(this.sl, 'Harvest').withArgs(this.alice.address, this.lockA.address);
      expect((await events(tx)).length).to.eq(1);
    });
    it('harvestFor(address)', async function () {
      const tx = this.sl['harvestFor(address)'](this.alice.address);
      await expect(tx).to.emit(this.sl, 'Harvest').withArgs(this.alice.address, this.lockX.address);
      expect((await events(tx)).length).to.eq(1);
    });
    it('harvestFor(address,address)', async function () {
      const tx = this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address);
      await expect(tx).to.emit(this.sl, 'Harvest').withArgs(this.alice.address, this.lockA.address);
      expect((await events(tx)).length).to.eq(1);
    });
    it('harvestFor(address,address[])', async function () {
      const tx = this.sl['harvestFor(address,address[])'](this.alice.address, [this.lockA.address]);
      await expect(tx).to.emit(this.sl, 'Harvest').withArgs(this.alice.address, this.lockA.address);
      expect((await events(tx)).length).to.eq(1);
    });
  });
  describe('redeem() ─ stale', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);
      // add token b for protocol
      await this.tokenB.approve(this.sl.address, parseUnits('10000', this.tokenB.dec));
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenB.address, this.gov.address, constants.AddressZero, true);
      await this.sl.c(this.gov).protocolDepositAdd(this.protocolX, [this.tokenB.address]);
      await this.sl.depositProtocolBalance(
        this.protocolX,
        parseUnits('100', this.tokenB.dec),
        this.tokenB.address,
      );

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, constants.AddressZero, this.lockA.address, false);
      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      await this.sl.c(this.gov).setInitialWeight();
      await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);
      // stake token A
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
      // send SherX tokens to token A holder
      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
          this.protocolX,
          [this.tokenA.address, this.tokenB.address],
          [parseEther('1'), parseUnits('2', this.tokenB.dec)],
          [parseEther('1'), parseUnits('1', this.tokenB.usdDec)],
        );
      // stop sending to token A
      this.b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [0, 0],
            [parseEther('1'), parseUnits('1', this.tokenB.usdDec)],
          ),
      );
      // harvest SherX tokens
      await this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address);
      // unstake SherX tokens
      await this.sl.c(this.gov).setUnstakeWindow(10);
      await this.lockX.approve(this.sl.address, parseEther('10000'));
      await this.sl.activateCooldown(parseEther('1'), this.sl.address);
      await this.sl.unstake(0, this.alice.address, this.sl.address);
    });
    it('Initial state', async function () {
      // underlying variables
      this.aUnderlying = parseUnits('1', this.tokenA.dec);
      this.bUnderlying = parseUnits('2', this.tokenB.dec);

      expect(await this.sl.totalSupply()).to.eq(parseEther('1'));
      expect(await this.sl.balanceOf(this.alice.address)).to.eq(parseEther('1'));
      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(this.aUnderlying);
      expect(await this.sl.getSherXUnderlying(this.tokenB.address)).to.eq(this.bUnderlying);

      const data = await this.sl['calcUnderlying()']();
      expect(data.tokens[0]).to.eq(this.tokenA.address);
      expect(data.tokens[1]).to.eq(this.sl.address);
      expect(data.tokens[2]).to.eq(this.tokenB.address);
      expect(data.tokens.length).to.eq(3);

      expect(data.amounts[0]).to.eq(this.aUnderlying);
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(this.bUnderlying);
      expect(data.amounts.length).to.eq(3);

      expect(await this.sl['calcUnderlyingInStoredUSD()']()).to.eq(parseEther('3'));

      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('1'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(this.b0);

      // pool variables
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(this.b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('3'));
      expect(await this.sl.getTotalUsdPool()).to.eq(parseEther('3'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(this.b0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(this.b0);

      // bob
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.tokenB.balanceOf(this.bob.address)).to.eq(0);
    });
    it('Do', async function () {
      const b1 = await blockNumber(this.sl.redeem(parseEther('1'), this.bob.address));

      // underlying variables
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.balanceOf(this.alice.address)).to.eq(0);
      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getSherXUnderlying(this.tokenB.address)).to.eq(0);

      const data = await this.sl['calcUnderlying()']();
      expect(data.tokens[0]).to.eq(this.tokenA.address);
      expect(data.tokens[1]).to.eq(this.sl.address);
      expect(data.tokens[2]).to.eq(this.tokenB.address);
      expect(data.tokens.length).to.eq(3);

      expect(data.amounts[0]).to.eq(0);
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(0);
      expect(data.amounts.length).to.eq(3);

      expect(await this.sl['calcUnderlyingInStoredUSD()']()).to.eq(0);

      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b1);

      // pool variables
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);
      expect(await this.sl.getTotalUsdPool()).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(this.b0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(this.b0);

      // bob
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(this.aUnderlying);
      expect(await this.tokenB.balanceOf(this.bob.address)).to.eq(this.bUnderlying);
    });
  });
  describe('redeem() ─ moving', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);
      // add token b for protocol
      await this.tokenB.approve(this.sl.address, parseEther('10000'));
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenB.address, this.gov.address, constants.AddressZero, true);
      await this.sl.c(this.gov).protocolDepositAdd(this.protocolX, [this.tokenB.address]);
      await this.sl.depositProtocolBalance(
        this.protocolX,
        parseUnits('100', this.tokenB.dec),
        this.tokenB.address,
      );

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, constants.AddressZero, this.lockA.address, false);
      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      await this.sl.c(this.gov).setInitialWeight();
      await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);
      // stake token A
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
      // send SherX tokens to token A holder
      this.b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [parseEther('1'), parseUnits('2', this.tokenB.dec)],
            [parseEther('1'), parseUnits('1', this.tokenB.usdDec)],
          ),
      );
      // harvest SherX tokens
      this.bHarvest = await blockNumber(
        this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address),
      );
      // unstake SherX tokens
      await this.sl.c(this.gov).setUnstakeWindow(10);
      await this.lockX.approve(this.sl.address, parseEther('10000'));
      this.b1 = await blockNumber(this.sl.activateCooldown(parseEther('1'), this.sl.address));
      this.b2 = await blockNumber(this.sl.unstake(0, this.alice.address, this.sl.address));
    });
    it('Initial state', async function () {
      // underlying variables
      // b2 instead of b1 as it is SherX instead of ForeignLock
      this.userDiff = this.b2.sub(this.b0);

      expect(await this.sl.totalSupply()).to.eq(parseEther('1'));
      expect(await this.sl.balanceOf(this.alice.address)).to.eq(parseEther('1'));
      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getSherXUnderlying(this.tokenB.address)).to.eq(0);

      const data = await this.sl['calcUnderlying()']();
      expect(data.tokens[0]).to.eq(this.tokenA.address);
      expect(data.tokens[1]).to.eq(this.sl.address);
      expect(data.tokens[2]).to.eq(this.tokenB.address);
      expect(data.tokens.length).to.eq(3);

      expect(data.amounts[0]).to.eq(this.userDiff.mul(parseEther('1')));
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(this.userDiff.mul(parseUnits('2', this.tokenB.dec)));
      expect(data.amounts.length).to.eq(3);

      expect(await this.sl['calcUnderlyingInStoredUSD()']()).to.eq(parseEther('3'));

      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(this.b0);

      expect(await this.sl.getTotalSherXUnminted()).to.eq(
        this.b2.sub(this.bHarvest).mul(parseEther('1')),
      );

      // pool variables
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(this.b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);
      expect(await this.sl.getTotalUsdPool()).to.eq(this.userDiff.mul(parseEther('3')));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(this.b0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(this.b0);

      // bob
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.tokenB.balanceOf(this.bob.address)).to.eq(0);
    });
    it('Do', async function () {
      this.b3 = await blockNumber(this.sl.redeem(parseEther('1'), this.bob.address));
      // basically userDiff -1 (redeem) +1 (1 block passed)
      this.aUnderlying = this.userDiff.mul(parseEther('1'));
      this.bUnderlying = this.userDiff.mul(parseUnits('2', this.tokenB.dec));
      // underlying variables
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.balanceOf(this.alice.address)).to.eq(0);
      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(this.aUnderlying);
      expect(await this.sl.getSherXUnderlying(this.tokenB.address)).to.eq(this.bUnderlying);

      const data = await this.sl['calcUnderlying()']();
      expect(data.tokens[0]).to.eq(this.tokenA.address);
      expect(data.tokens[1]).to.eq(this.sl.address);
      expect(data.tokens[2]).to.eq(this.tokenB.address);
      expect(data.tokens.length).to.eq(3);

      expect(data.amounts[0]).to.eq(this.aUnderlying);
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(this.bUnderlying);
      expect(data.amounts.length).to.eq(3);

      expect(await this.sl['calcUnderlyingInStoredUSD()']()).to.eq(0);

      expect(await this.sl.getInternalTotalSupply()).to.eq(this.userDiff.mul(parseEther('1')));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(this.b3);

      // Not minted on redeem
      expect(await this.sl.getTotalSherXUnminted()).to.eq(
        this.b3.sub(this.bHarvest).mul(parseEther('1')),
      );

      // pool variables
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(this.b3);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(this.userDiff.mul(parseEther('3')));
      expect(await this.sl.getTotalUsdPool()).to.eq(this.userDiff.mul(parseEther('3')));
      // important line, accrueDebt() is called on redeem.
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(this.b3);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(this.b3);

      // bob
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('1'));
      expect(await this.tokenB.balanceOf(this.bob.address)).to.eq(parseUnits('2', this.tokenB.dec));
    });
  });
  describe('calcUnderlying()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);
      // add token b for protocol
      await this.tokenB.approve(this.sl.address, parseUnits('10000', this.tokenB.dec));
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenB.address, this.gov.address, constants.AddressZero, true);
      await this.sl.c(this.gov).protocolDepositAdd(this.protocolX, [this.tokenB.address]);
      await this.sl.depositProtocolBalance(
        this.protocolX,
        parseUnits('100', this.tokenB.dec),
        this.tokenB.address,
      );

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, constants.AddressZero, this.lockA.address, false);

      // Add tokenC for staking (doesn't end up in sherx underlying)
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenC.address, this.gov.address, this.lockC.address, false);
      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      await this.sl.c(this.gov).setInitialWeight();
      await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);
      // stake token A
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
      // send SherX tokens to token A holder
      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
          this.protocolX,
          [this.tokenA.address, this.tokenB.address],
          [parseEther('1'), parseUnits('2', this.tokenB.dec)],
          [parseEther('1'), parseUnits('1', this.tokenB.usdDec)],
        );
    });
    it('Initial state', async function () {
      expect(await this.sl['getSherXBalance()']()).to.eq(0);

      const data = await this.sl['calcUnderlying()']();
      expect(data.tokens[0]).to.eq(this.tokenA.address);
      expect(data.tokens[1]).to.eq(this.sl.address);
      expect(data.tokens[2]).to.eq(this.tokenB.address);
      expect(data.tokens.length).to.eq(3);

      expect(data.amounts[0]).to.eq(0);
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(0);
      expect(data.amounts.length).to.eq(3);
    });
    it('t=1', async function () {
      await timeTraveler.mine(1);

      expect(await this.sl['getSherXBalance()']()).to.eq(parseEther('1'));

      const data = await this.sl['calcUnderlying()']();
      expect(data.amounts[0]).to.eq(parseEther('1'));
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(parseUnits('2', this.tokenB.dec));
      expect(data.amounts.length).to.eq(3);
    });
    it('t=2', async function () {
      await timeTraveler.mine(1);

      expect(await this.sl['getSherXBalance()']()).to.eq(parseEther('2'));

      const data = await this.sl['calcUnderlying()']();
      expect(data.amounts[0]).to.eq(parseEther('2'));
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(parseUnits('4', this.tokenB.dec));
      expect(data.amounts.length).to.eq(3);
    });
    it('t=3', async function () {
      await timeTraveler.mine(1);

      expect(await this.sl['getSherXBalance()']()).to.eq(parseEther('3'));

      const data = await this.sl['calcUnderlying()']();
      expect(data.amounts[0]).to.eq(parseEther('3'));
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(parseUnits('6', this.tokenB.dec));
      expect(data.amounts.length).to.eq(3);
    });
    it('t=4, update', async function () {
      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
          this.protocolX,
          [this.tokenA.address, this.tokenB.address],
          [parseEther('2'), parseUnits('4', this.tokenB.dec)],
          [parseEther('1'), parseUnits('1', this.tokenB.usdDec)],
        );

      expect(await this.sl['getSherXBalance()']()).to.eq(parseEther('4'));

      const data = await this.sl['calcUnderlying()']();
      expect(data.amounts[0]).to.eq(parseEther('4'));
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(parseUnits('8', this.tokenB.dec));
      expect(data.amounts.length).to.eq(3);
    });
    it('t=5', async function () {
      await timeTraveler.mine(1);

      expect(await this.sl['getSherXBalance()']()).to.eq(parseEther('6'));

      const data = await this.sl['calcUnderlying()']();
      expect(data.amounts[0]).to.eq(parseEther('6'));
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(parseUnits('12', this.tokenB.dec));
      expect(data.amounts.length).to.eq(3);
    });
    it('t=6', async function () {
      await timeTraveler.mine(1);

      expect(await this.sl['getSherXBalance()']()).to.eq(parseEther('8'));

      const data = await this.sl['calcUnderlying()']();
      expect(data.amounts[0]).to.eq(parseEther('8'));
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(parseUnits('16', this.tokenB.dec));
      expect(data.amounts.length).to.eq(3);
    });
  });
  describe('accrueSherX(address)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, constants.AddressZero, this.lockA.address, false);
      await this.sl.c(this.gov).setWatsonsAddress(this.carol.address);
      await this.sl.c(this.gov).setInitialWeight();
      await this.sl
        .c(this.gov)
        .setWeights(
          [this.sl.address, this.tokenA.address],
          [Uint16Fragment('0.3'), Uint16Fragment('0.7').add(1)],
          0,
        );
      this.b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address],
            [parseEther('1')],
            [parseEther('1')],
          ),
      );
    });
    it('Initial state', async function () {
      await timeTraveler.mine(1);

      expect(await this.sl.getWatsonsSherXPerBlock()).to.eq(0);
      expect(await this.sl.getWatsonsSherxLastAccrued()).to.eq(this.b0);
      expect(await this.sl.getWatsonsUnmintedSherX()).to.eq(0);
      expect(await this.sl.balanceOf(this.carol.address)).to.eq(0);

      expect(await this.sl.getUnallocatedSherXStored(this.sl.address)).to.eq(0);
      expect(await this.sl.getTotalUnmintedSherX(this.sl.address)).to.be.closeTo(
        parseEther('0.3'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getUnallocatedSherXTotal(this.sl.address)).to.be.closeTo(
        parseEther('0.3'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(0);
      expect(await this.sl.getSherXLastAccrued(this.sl.address)).to.eq(this.b0);

      expect(await this.sl.getUnallocatedSherXStored(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getTotalUnmintedSherX(this.tokenA.address)).to.be.closeTo(
        parseEther('0.7'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.be.closeTo(
        parseEther('0.7'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(this.b0);

      expect(await this.sl.balanceOf(this.sl.address)).to.eq(parseEther('0'));
    });
    it('Do', async function () {
      const b1 = await blockNumber(this.sl['accrueSherX(address)'](this.tokenA.address));

      expect(await this.sl.getWatsonsSherXPerBlock()).to.eq(0);
      expect(await this.sl.getWatsonsSherxLastAccrued()).to.eq(this.b0);
      expect(await this.sl.getWatsonsUnmintedSherX()).to.eq(0);
      expect(await this.sl.balanceOf(this.carol.address)).to.eq(0);

      expect(await this.sl.getUnallocatedSherXStored(this.sl.address)).to.eq(0);
      expect(await this.sl.getTotalUnmintedSherX(this.sl.address)).to.be.closeTo(
        parseEther('0.6'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getUnallocatedSherXTotal(this.sl.address)).to.be.closeTo(
        parseEther('0.6'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(0);
      expect(await this.sl.getSherXLastAccrued(this.sl.address)).to.eq(this.b0);

      expect(await this.sl.getUnallocatedSherXStored(this.tokenA.address)).to.be.closeTo(
        parseEther('1.4'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getTotalUnmintedSherX(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.be.closeTo(
        parseEther('1.4'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b1);

      expect(await this.sl.balanceOf(this.sl.address)).to.be.closeTo(
        parseEther('1.4'),
        parseUnits('1', 14),
      );
    });
  });
  describe('accrueSherX()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, constants.AddressZero, this.lockA.address, false);
      await this.sl.c(this.gov).setWatsonsAddress(this.carol.address);
      await this.sl.c(this.gov).setInitialWeight();
      await this.sl
        .c(this.gov)
        .setWeights(
          [this.sl.address, this.tokenA.address],
          [Uint16Fragment('0.3'), Uint16Fragment('0.7').add(1)],
          0,
        );
      this.b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address],
            [parseEther('1')],
            [parseEther('1')],
          ),
      );
    });
    it('Initial state', async function () {
      await timeTraveler.mine(1);

      expect(await this.sl.getWatsonsSherXPerBlock()).to.eq(0);
      expect(await this.sl.getWatsonsSherxLastAccrued()).to.eq(this.b0);
      expect(await this.sl.getWatsonsUnmintedSherX()).to.eq(0);
      expect(await this.sl.balanceOf(this.carol.address)).to.eq(0);

      expect(await this.sl.getUnallocatedSherXStored(this.sl.address)).to.eq(0);
      expect(await this.sl.getTotalUnmintedSherX(this.sl.address)).to.be.closeTo(
        parseEther('0.3'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getUnallocatedSherXTotal(this.sl.address)).to.be.closeTo(
        parseEther('0.3'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(0);
      expect(await this.sl.getSherXLastAccrued(this.sl.address)).to.eq(this.b0);

      expect(await this.sl.getUnallocatedSherXStored(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getTotalUnmintedSherX(this.tokenA.address)).to.be.closeTo(
        parseEther('0.7'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.be.closeTo(
        parseEther('0.7'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(this.b0);

      expect(await this.sl.balanceOf(this.sl.address)).to.eq(parseEther('0'));
    });
    it('Do', async function () {
      const b1 = await blockNumber(this.sl['accrueSherX()']());

      expect(await this.sl.getWatsonsSherXPerBlock()).to.eq(0);
      expect(await this.sl.getWatsonsSherxLastAccrued()).to.eq(b1);
      expect(await this.sl.getWatsonsUnmintedSherX()).to.eq(0);
      expect(await this.sl.balanceOf(this.carol.address)).to.eq(0);

      expect(await this.sl.getUnallocatedSherXStored(this.sl.address)).to.eq(0);
      expect(await this.sl.getTotalUnmintedSherX(this.sl.address)).to.eq(0);
      expect(await this.sl.getUnallocatedSherXTotal(this.sl.address)).to.eq(0);
      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.be.closeTo(
        parseEther('0.6'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getSherXLastAccrued(this.sl.address)).to.eq(b1);

      expect(await this.sl.getUnallocatedSherXStored(this.tokenA.address)).to.be.closeTo(
        parseEther('1.4'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getTotalUnmintedSherX(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.be.closeTo(
        parseEther('1.4'),
        parseUnits('1', 14),
      );
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b1);

      expect(await this.sl.balanceOf(this.sl.address)).to.be.closeTo(
        parseEther('2'),
        parseUnits('1', 1),
      );
    });
  });
  describe('accrueSherXWatsons()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, constants.AddressZero, this.lockA.address, false);
      await this.sl.c(this.gov).setWatsonsAddress(this.carol.address);
      await this.sl.c(this.gov).setInitialWeight();
      this.b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address],
            [parseEther('1')],
            [parseEther('1')],
          ),
      );
    });
    it('Initial state', async function () {
      await timeTraveler.mine(1);

      expect(await this.sl.getWatsonsSherXPerBlock()).to.eq(parseEther('1'));
      expect(await this.sl.getWatsonsSherxLastAccrued()).to.eq(this.b0);
      expect(await this.sl.getWatsonsUnmintedSherX()).to.eq(parseEther('1'));
      expect(await this.sl.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sl.getTotalSherXUnminted()).to.eq(parseEther('1'));
    });
    it('Do', async function () {
      const b1 = await blockNumber(this.sl.accrueSherXWatsons());

      expect(await this.sl.getWatsonsSherXPerBlock()).to.eq(parseEther('1'));
      expect(await this.sl.getWatsonsSherxLastAccrued()).to.eq(b1);
      expect(await this.sl.getWatsonsUnmintedSherX()).to.eq(0);
      expect(await this.sl.balanceOf(this.carol.address)).to.eq(parseEther('2'));
      expect(await this.sl.getTotalSherXUnminted()).to.eq(0);
    });
  });
});
