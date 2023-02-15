const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber, Uint16Max, Uint32Max } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('Gov', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, [
      'ERC20Mock',
      'ERC20Mock6d',
      'ERC20Mock8d',
      'NativeLock',
      'ForeignLock',
      'RemoveMock',
      'StrategyMock',
    ]);

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

    await deploy(this, [
      ['removeMock', this.RemoveMock, [this.tokenB.address]],
      ['strategyMockA', this.StrategyMock, [this.tokenA.address, this.sl.address]],
    ]);

    await timeTraveler.snapshot();
  });
  describe('setInitialGovMain()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sl.getGovMain()).to.eq(this.gov.address);
    });
    it('Do', async function () {
      await expect(this.sl.c(this.gov).setInitialGovMain(this.gov.address)).to.be.revertedWith(
        'ALREADY_SET',
      );
    });
  });
  describe('transferGovMain()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sl.getGovMain()).to.eq(this.gov.address);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).transferGovMain(this.alice.address);
      expect(await this.sl.getGovMain()).to.eq(this.alice.address);
    });
  });
  describe('setWatsonsAddress()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sl.getWatsons()).to.eq(constants.AddressZero);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      expect(await this.sl.getWatsons()).to.eq(this.alice.address);
    });
    it('Do again fail', async function () {
      await expect(this.sl.c(this.gov).setWatsonsAddress(this.alice.address)).to.be.revertedWith(
        'SAME_WATS',
      );
    });
    it('Do again', async function () {
      await this.sl.c(this.gov).setWatsonsAddress(this.bob.address);
      expect(await this.sl.getWatsons()).to.eq(this.bob.address);
    });
  });
  describe('setUnstakeWindow()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sl.getUnstakeWindow()).to.eq(0);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).setUnstakeWindow(1);
      expect(await this.sl.getUnstakeWindow()).to.eq(1);
    });
  });
  describe('setCooldown()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sl.getCooldown()).to.eq(0);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).setCooldown(1);
      expect(await this.sl.getCooldown()).to.eq(1);
    });
  });
  describe('protocolAdd()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);
    });
    it('Initial state', async function () {
      expect(await this.sl.getProtocolIsCovered(this.protocolX)).to.eq(false);
      expect(await this.sl.getProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.sl.getProtocolManager(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenA.address)).to.eq(false);
      const protocols = await this.sl.getProtocols(this.tokenA.address);
      expect(protocols.length).to.eq(0);
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.alice.address, this.bob.address, [this.tokenA.address]);
      expect(await this.sl.getProtocolIsCovered(this.protocolX)).to.eq(true);
      expect(await this.sl.getProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.sl.getProtocolManager(this.protocolX)).to.eq(this.bob.address);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenA.address)).to.eq(true);
      const protocols = await this.sl.getProtocols(this.tokenA.address);
      expect(protocols.length).to.eq(1);
      expect(protocols[0]).to.eq(this.protocolX);
    });
  });
  describe('protocolUpdate()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.alice.address, this.bob.address, [this.tokenA.address]);
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .protocolUpdate(this.protocolX, this.gov.address, this.carol.address);
      expect(await this.sl.getProtocolAgent(this.protocolX)).to.eq(this.gov.address);
      expect(await this.sl.getProtocolManager(this.protocolX)).to.eq(this.carol.address);
    });
  });
  describe('protocolDepositAdd()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenB.address, this.gov.address, this.lockB.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.alice.address, this.bob.address, [this.tokenA.address]);
    });
    it('Initial state', async function () {
      expect(await this.sl.isProtocol(this.protocolX, this.tokenB.address)).to.eq(false);
      const protocols = await this.sl.getProtocols(this.tokenB.address);
      expect(protocols.length).to.eq(0);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).protocolDepositAdd(this.protocolX, [this.tokenB.address]);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenB.address)).to.eq(true);
      const protocols = await this.sl.getProtocols(this.tokenB.address);
      expect(protocols.length).to.eq(1);
      expect(protocols[0]).to.eq(this.protocolX);
    });
  });
  describe('protocolRemove()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.alice.address, this.bob.address, [this.tokenA.address]);
      await this.sl
        .c(this.gov)
        .cleanProtocol(this.protocolX, 0, false, this.alice.address, this.tokenA.address);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).protocolRemove(this.protocolX);
      expect(await this.sl.getProtocolIsCovered(this.protocolX)).to.eq(false);
      expect(await this.sl.getProtocolManager(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.sl.getProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenA.address)).to.eq(false);
    });
  });
  describe('protocolRemove() ─ Debt', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseUnits('10000', this.tokenA.dec));

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);
      await this.sl.depositProtocolBalance(
        this.protocolX,
        parseUnits('100', this.tokenA.dec),
        this.tokenA.address,
      );
      t0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address],
            [parseUnits('1', this.tokenA.dec)],
            [parseUnits('1', this.tokenA.usdDec)],
          ),
      );
    });
    it('Remove fail', async function () {
      await expect(this.sl.c(this.gov).protocolRemove(this.protocolX)).to.be.revertedWith('DEBT');
    });
    it('Remove fail, not removed from pool', async function () {
      t1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address],
            [0],
            [0],
          ),
      );
      await expect(this.sl.c(this.gov).protocolRemove(this.protocolX)).to.be.revertedWith(
        'POOL_PROTOCOL',
      );
    });
    it('Remove success', async function () {
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(0);
      await this.sl
        .c(this.gov)
        .cleanProtocol(this.protocolX, 0, true, this.bob.address, this.tokenA.address);
      await this.sl.c(this.gov).protocolRemove(this.protocolX);

      const pPaid = t1.sub(t0).mul(parseUnits('1', this.tokenA.dec));
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(
        parseUnits('100', this.tokenA.dec).sub(pPaid),
      );
      expect(await this.sl.getProtocolIsCovered(this.protocolX)).to.eq(false);
      expect(await this.sl.getProtocolManager(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.sl.getProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenA.address)).to.eq(false);
    });
  });
  describe('tokenInit()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

      const tokensStaker = await this.sl.getTokensStaker();
      expect(tokensStaker.length).to.eq(1);
      expect(tokensStaker[0]).to.eq(this.tokenA.address);

      const tokensSherX = await this.sl.getTokensSherX();
      expect(tokensSherX.length).to.eq(1);
      expect(tokensSherX[0]).to.eq(this.tokenA.address);

      expect(await this.sl.isStake(this.tokenA.address)).to.eq(true);
      expect(await this.sl.isPremium(this.tokenA.address)).to.eq(true);
      expect(await this.sl.getGovPool(this.tokenA.address)).to.eq(this.gov.address);
      expect(await this.sl.getLockToken(this.tokenA.address)).to.eq(this.lockA.address);
    });
    it('Do 2', async function () {
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenB.address, this.gov.address, this.lockB.address, false);

      const tokensStaker = await this.sl.getTokensStaker();
      expect(tokensStaker.length).to.eq(2);
      expect(tokensStaker[0]).to.eq(this.tokenA.address);
      expect(tokensStaker[1]).to.eq(this.tokenB.address);

      const tokensSherX = await this.sl.getTokensSherX();
      expect(tokensSherX.length).to.eq(1);
      expect(tokensSherX[0]).to.eq(this.tokenA.address);

      expect(await this.sl.isStake(this.tokenB.address)).to.eq(true);
      expect(await this.sl.isPremium(this.tokenB.address)).to.eq(false);
      expect(await this.sl.getGovPool(this.tokenB.address)).to.eq(this.gov.address);
      expect(await this.sl.getLockToken(this.tokenB.address)).to.eq(this.lockB.address);
    });
    it('Do 3', async function () {
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenC.address, this.gov.address, constants.AddressZero, true);

      const tokensStaker = await this.sl.getTokensStaker();
      expect(tokensStaker.length).to.eq(2);
      expect(tokensStaker[0]).to.eq(this.tokenA.address);
      expect(tokensStaker[1]).to.eq(this.tokenB.address);

      const tokensSherX = await this.sl.getTokensSherX();
      expect(tokensSherX.length).to.eq(2);
      expect(tokensSherX[0]).to.eq(this.tokenA.address);
      expect(tokensSherX[1]).to.eq(this.tokenC.address);

      expect(await this.sl.isStake(this.tokenC.address)).to.eq(false);
      expect(await this.sl.isPremium(this.tokenC.address)).to.eq(true);
      expect(await this.sl.getGovPool(this.tokenC.address)).to.eq(this.gov.address);
      expect(await this.sl.getLockToken(this.tokenC.address)).to.eq(constants.AddressZero);
    });
  });
  describe('tokenInit() - reinit', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);
    });
    it('Do stake reenable', async function () {
      await this.sl.c(this.gov).tokenDisableStakers(this.tokenA.address, 0);

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, constants.AddressZero, this.lockA.address, false);

      const tokensStaker = await this.sl.getTokensStaker();
      expect(tokensStaker.length).to.eq(1);
      expect(tokensStaker[0]).to.eq(this.tokenA.address);

      const tokensSherX = await this.sl.getTokensSherX();
      expect(tokensSherX.length).to.eq(1);
      expect(tokensSherX[0]).to.eq(this.tokenA.address);

      expect(await this.sl.isStake(this.tokenA.address)).to.eq(true);
      expect(await this.sl.isPremium(this.tokenA.address)).to.eq(true);
      expect(await this.sl.getGovPool(this.tokenA.address)).to.eq(this.gov.address);
      expect(await this.sl.getLockToken(this.tokenA.address)).to.eq(this.lockA.address);
    });
    it('Do protocol reenable', async function () {
      await this.sl.c(this.gov).tokenDisableProtocol(this.tokenA.address, 0);

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, constants.AddressZero, constants.AddressZero, true);

      const tokensStaker = await this.sl.getTokensStaker();
      expect(tokensStaker.length).to.eq(1);
      expect(tokensStaker[0]).to.eq(this.tokenA.address);

      const tokensSherX = await this.sl.getTokensSherX();
      expect(tokensSherX.length).to.eq(1);
      expect(tokensSherX[0]).to.eq(this.tokenA.address);

      expect(await this.sl.isStake(this.tokenA.address)).to.eq(true);
      expect(await this.sl.isPremium(this.tokenA.address)).to.eq(true);
      expect(await this.sl.getGovPool(this.tokenA.address)).to.eq(this.gov.address);
      expect(await this.sl.getLockToken(this.tokenA.address)).to.eq(this.lockA.address);
    });
    it('Do gov reinit', async function () {
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.bob.address, constants.AddressZero, false);

      expect(await this.sl.getGovPool(this.tokenA.address)).to.eq(this.bob.address);
    });
  });
  describe('tokenDisableStakers()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).tokenDisableStakers(this.tokenA.address, 0);

      const tokensStaker = await this.sl.getTokensStaker();
      expect(tokensStaker.length).to.eq(0);

      expect(await this.sl.isStake(this.tokenA.address)).to.eq(false);
      expect(await this.sl.isPremium(this.tokenA.address)).to.eq(true);
      expect(await this.sl.getGovPool(this.tokenA.address)).to.eq(this.gov.address);
      expect(await this.sl.getLockToken(this.tokenA.address)).to.eq(this.lockA.address);
    });
  });
  describe('tokenDisableStakers() ─ Active weight', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);
      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      await this.sl.c(this.gov).setInitialWeight();
      await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);
    });
    it('Do', async function () {
      await expect(
        this.sl.c(this.gov).tokenDisableStakers(this.tokenA.address, 0),
      ).to.be.revertedWith('ACTIVE_WEIGHT');
    });
  });
  describe('tokenDisableStakers() ─ Staker Withdraw', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      await this.sl.c(this.gov).setInitialWeight();

      await this.sl.c(this.gov).setUnstakeWindow(1);

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).tokenDisableStakers(this.tokenA.address, 0);

      await expect(
        this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address),
      ).to.be.revertedWith('NO_STAKES');
    });
    it('Cooldown', async function () {
      await this.sl.activateCooldown(parseEther('1'), this.tokenA.address);
    });
    it('Unstake', async function () {
      await this.sl.unstake(0, this.alice.address, this.tokenA.address);
    });
  });
  describe('tokenDisableStakers() ─ Harvest', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

      await this.sl
        .c(this.gov)
        .tokenInit(this.sl.address, this.gov.address, this.lockX.address, true);

      // Distribute SherX to tokenA stakers
      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      await this.sl.c(this.gov).setInitialWeight();
      await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);

      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);

      await this.sl.depositProtocolBalance(
        this.protocolX,
        parseUnits('100', this.tokenA.dec),
        this.tokenA.address,
      );

      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenA.address,
          parseEther('1'),
          parseEther('1'),
        );

      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenA.address,
          0,
          parseEther('1'),
        );

      await this.sl.c(this.gov).setWeights([this.tokenA.address], [0], Uint16Max);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).tokenDisableStakers(this.tokenA.address, 0);

      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('1'));
      expect(await this.sl.getUnallocatedSherXFor(this.alice.address, this.tokenA.address)).to.eq(
        parseEther('1'),
      );

      expect(await this.lockX.balanceOf(this.alice.address)).to.eq(0);
    });
    it('Harvest fail', async function () {
      await this.sl['harvest()']();
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('1'));
      expect(await this.sl.getUnallocatedSherXFor(this.alice.address, this.tokenA.address)).to.eq(
        parseEther('1'),
      );

      expect(await this.lockX.balanceOf(this.alice.address)).to.eq(0);
    });
    it('Harvest success', async function () {
      await this.sl['harvest(address)'](this.lockA.address);
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getUnallocatedSherXFor(this.alice.address, this.tokenA.address)).to.eq(
        0,
      );

      expect(await this.lockX.balanceOf(this.alice.address)).to.eq(parseEther('1'));
    });
  });
  describe('tokenDisableProtocol()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).tokenDisableProtocol(this.tokenA.address, 0);

      const tokensSherX = await this.sl.getTokensSherX();
      expect(tokensSherX.length).to.eq(0);

      expect(await this.sl.isStake(this.tokenA.address)).to.eq(true);
      expect(await this.sl.isPremium(this.tokenA.address)).to.eq(false);
      expect(await this.sl.getGovPool(this.tokenA.address)).to.eq(this.gov.address);
      expect(await this.sl.getLockToken(this.tokenA.address)).to.eq(this.lockA.address);
    });
  });
  describe('tokenDisableProtocol() ─ Active Premium', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);
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
        this.sl.c(this.gov).tokenDisableProtocol(this.tokenA.address, 0),
      ).to.be.revertedWith('ACTIVE_PREMIUM');
    });
  });
  describe('tokenDisableProtocol() ─ Active SherX', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('1000'));
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);
      await this.sl.depositProtocolBalance(
        this.protocolX,
        parseUnits('100', this.tokenA.dec),
        this.tokenA.address,
      );
      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenA.address,
          parseEther('1'),
          parseEther('1'),
        );
      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      await this.sl.c(this.gov).setInitialWeight();
      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenA.address,
          0,
          0,
        );
    });
    it('Do', async function () {
      await expect(
        this.sl.c(this.gov).tokenDisableProtocol(this.tokenA.address, 0),
      ).to.be.revertedWith('ACTIVE_SHERX');
    });
  });
  describe('tokenUnload() ─ Active premium', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, constants.AddressZero, true);

      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);

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
          .tokenUnload(this.tokenA.address, this.removeMock.address, this.carol.address),
      ).to.be.revertedWith('ACTIVE_PREMIUM');
    });
  });
  describe('tokenUnload() ─ Active strategy', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, false);

      await this.sl.c(this.gov).strategyUpdate(this.strategyMockA.address, this.tokenA.address);
      await this.sl.c(this.gov).tokenDisableStakers(this.tokenA.address, 0);
    });
    it('Do', async function () {
      await expect(
        this.sl
          .c(this.gov)
          .tokenUnload(this.tokenA.address, this.removeMock.address, this.carol.address),
      ).to.be.revertedWith('ACTIVE_STRATEGY');
    });
  });
  describe('tokenUnload() ─ Active balances (+activate cooldown)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

      await this.tokenB.transfer(this.removeMock.address, parseUnits('1000', 6));

      await this.sl
        .c(this.gov)
        .tokenInit(this.sl.address, this.gov.address, this.lockX.address, true);

      // Distribute SherX to tokenA stakers
      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      await this.sl.c(this.gov).setInitialWeight();
      await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);

      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);

      await this.sl.depositProtocolBalance(
        this.protocolX,
        parseUnits('100', this.tokenA.dec),
        this.tokenA.address,
      );

      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenA.address,
          parseEther('1'),
          parseEther('1'),
        );

      await this.sl.c(this.gov).setCooldownFee(Uint32Max.div(2), this.tokenA.address);
      await this.sl.activateCooldown(parseEther('0.3'), this.tokenA.address);

      await this.sl.c(this.gov).setWeights([this.tokenA.address], [0], Uint16Max);

      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenA.address,
          0,
          parseEther('1'),
        );

      await this.sl
        .c(this.gov)
        .cleanProtocol(this.protocolX, 0, true, this.alice.address, this.tokenA.address);
      await this.sl.c(this.gov).tokenDisableStakers(this.tokenA.address, 0);
    });
    it('Initial state', async function () {
      expect(await this.sl.balanceOf(this.carol.address)).to.eq(0);
    });
    it('Do swap, token not added', async function () {
      await expect(
        this.sl
          .c(this.gov)
          .tokenUnload(this.tokenA.address, this.removeMock.address, this.carol.address),
      ).to.be.revertedWith('EMPTY_SWAP');
    });
    it('Add token', async function () {
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenB.address, this.gov.address, this.lockB.address, true);

      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.be.closeTo(
        parseUnits('8.5', 18),
        parseUnits('1', 9),
      );
      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.be.closeTo(
        parseUnits('1.5', 18),
        parseUnits('1', 9),
      );
      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(parseUnits('4', 18));
      expect(await this.sl.getStakersPoolBalance(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getFirstMoneyOut(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getSherXUnderlying(this.tokenB.address)).to.eq(0);

      expect(await this.tokenA.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sl.balanceOf(this.carol.address)).to.eq(0);
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .tokenUnload(this.tokenA.address, this.removeMock.address, this.carol.address);

      expect(await this.sl.balanceOf(this.carol.address)).to.eq(parseEther('1'));

      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getStakersPoolBalance(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getFirstMoneyOut(this.tokenB.address)).to.eq(parseUnits('2', 6));
      expect(await this.sl.getSherXUnderlying(this.tokenB.address)).to.eq(parseUnits('3', 6));

      expect(await this.tokenA.balanceOf(this.carol.address)).to.be.closeTo(
        parseUnits('8.5', 18),
        parseUnits('1', 9),
      );
      expect(await this.sl.balanceOf(this.carol.address)).to.eq(parseUnits('1', 18));
    });
    it('Remove', async function () {
      await this.sl.c(this.gov).tokenDisableProtocol(this.tokenA.address, 0);
      await this.sl.c(this.gov).tokenRemove(this.tokenA.address);
    });
    it('Harvest fail', async function () {
      await expect(
        this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address),
      ).to.be.revertedWith('SENDER');
    });
  });
  describe('tokenRemove()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, constants.AddressZero, false);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).tokenRemove(this.tokenA.address);

      await expect(this.sl.isPremium(this.tokenA.address)).to.be.revertedWith('INVALID_TOKEN');
    });
  });
  describe('tokenRemove() ─ Premiums set', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, constants.AddressZero, true);
    });
    it('Do', async function () {
      await expect(this.sl.c(this.gov).tokenRemove(this.tokenA.address)).to.be.revertedWith(
        'PREMIUMS_SET',
      );
    });
  });
  describe('tokenRemove() ─ Active protocol', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, constants.AddressZero, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);
      await this.sl.c(this.gov).tokenDisableProtocol(this.tokenA.address, 0);
    });
    it('Do', async function () {
      await expect(this.sl.c(this.gov).tokenRemove(this.tokenA.address)).to.be.revertedWith(
        'ACTIVE_PROTOCOLS',
      );
    });
  });
  describe('tokenRemove() ─ Balance & FMO', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, false);

      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      await this.sl.c(this.gov).tokenDisableStakers(this.tokenA.address, 0);
    });
    it('Balance', async function () {
      await expect(this.sl.c(this.gov).tokenRemove(this.tokenA.address)).to.be.revertedWith(
        'BALANCE_SET',
      );
    });
  });
  describe('tokenRemove() ─ SherX', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, false);

      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenB.address, this.gov.address, constants.AddressZero, true);

      await this.sl
        .c(this.gov)
        .tokenInit(this.sl.address, this.gov.address, this.lockX.address, true);

      // Distribute SherX to tokenA stakers
      await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
      await this.sl.c(this.gov).setInitialWeight();
      await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);

      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.tokenB.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenB.address]);

      await this.sl.depositProtocolBalance(
        this.protocolX,
        parseUnits('100', this.tokenB.dec),
        this.tokenB.address,
      );

      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenB.address,
          parseUnits('1', this.tokenB.dec),
          parseUnits('1', this.tokenB.usdDec),
        );

      await this.sl.c(this.gov).setUnstakeWindow(1);
      await this.sl.activateCooldown(parseEther('1'), this.tokenA.address);
      await this.sl.unstake(0, this.alice.address, this.tokenA.address);

      await this.sl.c(this.gov).setWeights([this.tokenA.address], [0], Uint16Max);

      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenB.address,
          parseUnits('0', this.tokenB.dec),
          parseUnits('1', this.tokenB.usdDec),
        );

      // await this.sl
      //   .c(this.gov)
      //   .cleanProtocol(this.protocolX, 0, true, this.alice.address, this.tokenA.address);
      await this.sl.c(this.gov).tokenDisableStakers(this.tokenA.address, 0);
      // await this.sl.c(this.gov).tokenDisableProtocol(this.tokenA.address, 0);
    });
    it('Do', async function () {
      await expect(this.sl.c(this.gov).tokenRemove(this.tokenA.address)).to.be.revertedWith(
        'SHERX_SET',
      );
    });
  });
  describe('tokenRemove() ─ Readd, verify unstake', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl.c(this.gov).setUnstakeWindow(1);
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, false);

      await this.tokenA.approve(this.sl.address, parseEther('10000'));
      await this.lockA.approve(this.sl.address, parseEther('10000'));
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
      await this.sl.activateCooldown(parseEther('1'), this.tokenA.address);
      await this.sl.unstake(0, this.alice.address, this.tokenA.address);
    });
    it('Initial state', async function () {
      await expect(
        await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address),
      ).to.eq(1);
      await expect(
        await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address),
      ).to.eq(1);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).tokenDisableStakers(this.tokenA.address, 0);

      await this.sl.c(this.gov).tokenRemove(this.tokenA.address);
    });
    it('Readd', async function () {
      await this.sl
        .c(this.gov)
        .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, false);

      await expect(
        await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address),
      ).to.eq(1);
      await expect(
        await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address),
      ).to.eq(1);
    });
    it('Stake', async function () {
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
      await this.sl.activateCooldown(parseEther('1'), this.tokenA.address);
      await this.sl.unstake(1, this.alice.address, this.tokenA.address);

      await expect(
        await this.sl.getUnstakeEntrySize(this.alice.address, this.tokenA.address),
      ).to.eq(2);
      await expect(
        await this.sl.getInitialUnstakeEntry(this.alice.address, this.tokenA.address),
      ).to.eq(2);
    });
  });
});
