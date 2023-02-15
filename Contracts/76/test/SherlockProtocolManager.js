const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id } = require('ethers/lib/utils');

const maxTokens = parseUnits('100000000000', 6);
const days7 = 60 * 60 * 24 * 7;
const days3 = 60 * 60 * 24 * 3;
const hours12 = 60 * 60 * 12;
const hours1point2 = hours12 / 10;
describe('SherlockProtocolManager ─ Stateless', function () {
  before(async function () {
    await prepare(this, ['SherlockProtocolManagerTest', 'ERC20Mock6d', 'SherlockMock']);

    await deploy(this, [['ERC20Mock6d', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['spm', this.SherlockProtocolManagerTest, [this.ERC20Mock6d.address]]]);
    await deploy(this, [['SherlockMock', this.SherlockMock, []]]);
  });
  describe('constructor', function () {
    it('Zero token', async function () {
      await expect(
        this.SherlockProtocolManagerTest.deploy(constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
  });
  describe('protocolAdd()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.spm
          .connect(this.bob)
          .protocolAdd(this.protocolX, this.alice.address, id('x'), parseEther('0.1'), 500),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero protocol', async function () {
      await expect(
        this.spm.protocolAdd(
          constants.HashZero,
          this.alice.address,
          id('x'),
          parseEther('0.1'),
          500,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero agent', async function () {
      await expect(
        this.spm.protocolAdd(
          this.protocolX,
          constants.AddressZero,
          id('x'),
          parseEther('0.1'),
          500,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero coverage', async function () {
      await expect(
        this.spm.protocolAdd(
          this.protocolX,
          this.alice.address,
          constants.HashZero,
          parseEther('0.1'),
          500,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Nonstaker exceed 100%', async function () {
      await expect(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('x'), parseEther('1.01'), 500),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Zero coverage amount', async function () {
      await expect(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('x'), parseEther('0.1'), 0),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Success', async function () {
      await this.spm.protocolAdd(
        this.protocolX,
        this.carol.address,
        id('t'),
        parseEther('0.1'),
        500,
      );
    });
  });
  describe('protocolUpdate()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.spm.connect(this.bob).protocolUpdate(this.protocolX, id('x'), parseEther('0.1'), 500),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero protocol', async function () {
      await expect(
        this.spm.protocolUpdate(constants.HashZero, id('x'), parseEther('0.1'), 500),
      ).to.be.revertedWith('ProtocolNotExists("' + constants.HashZero + '")');
    });
    it('Zero coverage', async function () {
      await expect(
        this.spm.protocolUpdate(this.protocolX, constants.HashZero, parseEther('0.1'), 500),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Nonstaker exceed 100%', async function () {
      await expect(
        this.spm.protocolUpdate(this.protocolX, id('x'), parseEther('1.1'), 500),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Zero coverage amount', async function () {
      await expect(
        this.spm.protocolUpdate(this.protocolX, id('x'), parseEther('0.1'), 0),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Protocol not exists', async function () {
      await expect(
        this.spm.protocolUpdate(this.protocolY, id('x'), parseEther('0.1'), 500),
      ).to.be.revertedWith('ProtocolNotExists("' + this.protocolY + '")');
    });
  });
  describe('protocolRemove()', function () {
    it('Invalid sender', async function () {
      await expect(this.spm.connect(this.bob).protocolRemove(this.protocolX)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Zero protocol', async function () {
      await expect(this.spm.protocolRemove(constants.HashZero)).to.be.revertedWith(
        'ProtocolNotExists("' + constants.HashZero + '")',
      );
    });
    it('Protocol not exists', async function () {
      await expect(this.spm.protocolRemove(this.protocolY)).to.be.revertedWith(
        'ProtocolNotExists("' + this.protocolY + '")',
      );
    });
  });
  describe('forceRemoveByActiveBalance()', function () {
    it('Zero protocol', async function () {
      await expect(this.spm.forceRemoveByActiveBalance(constants.HashZero)).to.be.revertedWith(
        'ProtocolNotExists("' + constants.HashZero + '")',
      );
    });
    it('Protocol not exists', async function () {
      await expect(this.spm.forceRemoveByActiveBalance(this.protocolY)).to.be.revertedWith(
        'ProtocolNotExists("' + this.protocolY + '")',
      );
    });
  });
  describe('forceRemoveBySecondsOfCoverage()', function () {
    it('Zero protocol', async function () {
      await expect(this.spm.forceRemoveBySecondsOfCoverage(constants.HashZero)).to.be.revertedWith(
        'ProtocolNotExists("' + constants.HashZero + '")',
      );
    });
    it('Protocol not exists', async function () {
      await expect(this.spm.forceRemoveBySecondsOfCoverage(this.protocolY)).to.be.revertedWith(
        'ProtocolNotExists("' + this.protocolY + '")',
      );
    });
  });
  describe('claimPremiumsForStakers()', function () {
    it('Invalid conditions', async function () {
      await expect(this.spm.claimPremiumsForStakers()).to.be.revertedWith('InvalidConditions()');
    });
  });
  describe('setMinActiveBalance()', function () {
    it('Invalid sender', async function () {
      await expect(this.spm.connect(this.bob).setMinActiveBalance(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Insane', async function () {
      await expect(this.spm.setMinActiveBalance(parseEther('1'))).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
  });
  describe('setProtocolPremium()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.spm.connect(this.bob).setProtocolPremium(this.protocolX, 1),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero protocol', async function () {
      await expect(this.spm.setProtocolPremium(constants.HashZero, 1)).to.be.revertedWith(
        'ProtocolNotExists("' + constants.HashZero + '")',
      );
    });
    it('Protocol not exists', async function () {
      await expect(this.spm.setProtocolPremium(this.protocolY, 1)).to.be.revertedWith(
        'ProtocolNotExists("' + this.protocolY + '")',
      );
    });
  });
  describe('setProtocolPremiums()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.spm.connect(this.bob).setProtocolPremiums([this.protocolX], [1]),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Unequal array length', async function () {
      await expect(this.spm.setProtocolPremiums([this.protocolX], [1, 2])).to.be.revertedWith(
        'UnequalArrayLength()',
      );
    });
    it('Zero array length', async function () {
      await expect(this.spm.setProtocolPremiums([], [])).to.be.revertedWith('InvalidArgument()');
    });
    it('Zero protocol', async function () {
      await expect(this.spm.setProtocolPremiums([constants.HashZero], [2])).to.be.revertedWith(
        'ProtocolNotExists("' + constants.HashZero + '")',
      );
    });
    it('Protocol not exists', async function () {
      await expect(
        this.spm.setProtocolPremiums([this.protocolX, this.protocolY], [0, 1]),
      ).to.be.revertedWith('ProtocolNotExists("' + this.protocolY + '")');
    });
  });
  describe('depositToActiveBalance()', function () {
    it('Zero protocol', async function () {
      await expect(this.spm.depositToActiveBalance(constants.HashZero, 1)).to.be.revertedWith(
        'ProtocolNotExists("' + constants.HashZero + '")',
      );
    });
    it('Zero amount', async function () {
      await expect(this.spm.depositToActiveBalance(this.protocolX, 0)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Protocol not exists', async function () {
      await expect(this.spm.depositToActiveBalance(this.protocolY, 1)).to.be.revertedWith(
        'ProtocolNotExists("' + this.protocolY + '")',
      );
    });
  });
  describe('withdrawActiveBalance()', function () {
    it('Zero protocol', async function () {
      await expect(this.spm.withdrawActiveBalance(constants.HashZero, 1)).to.be.revertedWith(
        'ProtocolNotExists("' + constants.HashZero + '")',
      );
    });
    it('Zero amount', async function () {
      await expect(this.spm.withdrawActiveBalance(this.protocolX, 0)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Protocol not exists', async function () {
      await expect(this.spm.withdrawActiveBalance(this.protocolY, 1)).to.be.revertedWith(
        'ProtocolNotExists("' + this.protocolY + '")',
      );
    });
    it('Protocol wrong agent', async function () {
      await expect(this.spm.withdrawActiveBalance(this.protocolX, 1)).to.be.revertedWith(
        'Unauthorized()',
      );
    });
    it('Protocol balance', async function () {
      await expect(
        this.spm.connect(this.carol).withdrawActiveBalance(this.protocolX, 1),
      ).to.be.revertedWith('InsufficientBalance("' + this.protocolX + '")');
    });
  });
  describe('transferProtocolAgent()', function () {
    it('Zero protocol', async function () {
      await expect(
        this.spm.transferProtocolAgent(constants.HashZero, this.bob.address),
      ).to.be.revertedWith('ProtocolNotExists("' + constants.HashZero + '")');
    });
    it('Zero protocol agent', async function () {
      await expect(
        this.spm.transferProtocolAgent(this.protocolX, constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Same protocol agent', async function () {
      await expect(
        this.spm.transferProtocolAgent(this.protocolX, this.alice.address),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Protocol not exists', async function () {
      await expect(
        this.spm.transferProtocolAgent(this.protocolY, this.bob.address),
      ).to.be.revertedWith('ProtocolNotExists("' + this.protocolY + '")');
    });
    it('Wrong protocol agent', async function () {
      await expect(
        this.spm.transferProtocolAgent(this.protocolX, this.bob.address),
      ).to.be.revertedWith('Unauthorized()');
    });
  });
  describe('nonStakersClaim()', function () {
    it('Zero protocol', async function () {
      await expect(
        this.spm.nonStakersClaim(constants.HashZero, 1, this.bob.address),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero amount', async function () {
      await expect(
        this.spm.nonStakersClaim(this.protocolX, 0, this.bob.address),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero receiver', async function () {
      await expect(
        this.spm.nonStakersClaim(this.protocolX, 1, constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Unitinitalized', async function () {
      await expect(
        this.spm.nonStakersClaim(this.protocolX, 1, this.bob.address),
      ).to.be.revertedWith('Transaction reverted: function returned an unexpected amount of data');

      await this.spm.setSherlockCoreAddress(this.SherlockMock.address);
    });
    it('Zero address', async function () {
      await expect(
        this.spm.nonStakersClaim(this.protocolX, 1, this.bob.address),
      ).to.be.revertedWith('Unauthorized()');

      await this.SherlockMock.setNonStakersAddress(this.bob.address);
    });
    it('Unauthorized', async function () {
      await expect(
        this.spm.nonStakersClaim(this.protocolX, 1, this.bob.address),
      ).to.be.revertedWith('Unauthorized()');
    });
    it('Exceed', async function () {
      await this.SherlockMock.setNonStakersAddress(this.alice.address);

      await expect(
        this.spm.nonStakersClaim(this.protocolX, 1, this.bob.address),
      ).to.be.revertedWith('InsufficientBalance("' + this.protocolX + '")');
    });
  });
});

describe('SherlockProtocolManager ─ Functional', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    await prepare(this, ['SherlockProtocolManagerTest', 'ERC20Mock6d', 'SherlockMock']);

    await deploy(this, [['ERC20Mock6d', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['spm', this.SherlockProtocolManagerTest, [this.ERC20Mock6d.address]]]);
    await deploy(this, [['sherlock', this.SherlockMock, []]]);

    await this.ERC20Mock6d.approve(this.spm.address, maxTokens);
    await timeTraveler.snapshot();
  });
  describe('protocolAdd()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(0);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      await expect(this.spm.protocolAgent(this.protocolX)).to.be.reverted;
      await expect(this.spm.activeBalance(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premium(this.protocolX)).to.be.reverted;
      await expect(this.spm.coverageAmounts(this.protocolX)).to.be.reverted;

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Do', async function () {
      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      // events
      expect(this.t0.events.length).to.eq(3);
      expect(this.t0.events[0].event).to.eq('ProtocolAgentTransfer');
      expect(this.t0.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t0.events[0].args.from).to.eq(constants.AddressZero);
      expect(this.t0.events[0].args.to).to.eq(this.alice.address);
      expect(this.t0.events[1].event).to.eq('ProtocolAdded');
      expect(this.t0.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t0.events[2].event).to.eq('ProtocolUpdated');
      expect(this.t0.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t0.events[2].args.coverage).to.eq(id('t'));
      expect(this.t0.events[2].args.nonStakers).to.eq(parseEther('0.1'));
      expect(this.t0.events[2].args.coverageAmount).to.eq(500);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t0.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t0.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premium(this.protocolX)).to.eq(0);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Do again', async function () {
      await expect(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      ).to.be.revertedWith('InvalidConditions()');
    });
  });
  describe('protocolAdd() - readd', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.spm.protocolAdd(
        this.protocolX,
        this.alice.address,
        id('t'),
        parseEther('0.1'),
        500,
      );
      await this.spm.protocolUpdate(this.protocolX, id('tx'), parseEther('0.2'), 1500);
      this.t0 = await meta(this.spm.protocolRemove(this.protocolX));
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(1500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(500);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t0.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(
        this.t0.time.add(days7),
      );

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      await expect(this.spm.activeBalance(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premium(this.protocolX)).to.be.reverted;
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(1500);
      expect(coverageAmounts[1]).to.eq(500);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Do', async function () {
      // same as normal add, removed variables are gone
      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      // events
      expect(this.t0.events.length).to.eq(3);
      expect(this.t0.events[0].event).to.eq('ProtocolAgentTransfer');
      expect(this.t0.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t0.events[0].args.from).to.eq(constants.AddressZero);
      expect(this.t0.events[0].args.to).to.eq(this.alice.address);
      expect(this.t0.events[1].event).to.eq('ProtocolAdded');
      expect(this.t0.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t0.events[2].event).to.eq('ProtocolUpdated');
      expect(this.t0.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t0.events[2].args.coverage).to.eq(id('t'));
      expect(this.t0.events[2].args.nonStakers).to.eq(parseEther('0.1'));
      expect(this.t0.events[2].args.coverageAmount).to.eq(500);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t0.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t0.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premium(this.protocolX)).to.eq(0);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
  });
  describe('protocolUpdate()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);

      await this.spm.protocolAdd(
        this.protocolX,
        this.alice.address,
        id('t'),
        parseEther('0.1'),
        500,
      );
      await this.spm.depositToActiveBalance(this.protocolX, maxTokens);
      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));

      await timeTraveler.mine(10);
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(10)),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(10),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium).sub(10),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers.mul(10));
    });
    it('Do', async function () {
      this.newPremium = parseUnits('10', 6);
      this.newPremiumStakers = parseUnits('8', 6);
      this.newPremiumNonStakers = parseUnits('2', 6);

      this.t2 = await meta(
        this.spm.protocolUpdate(this.protocolX, id('tx'), parseEther('0.2'), 1500),
      );

      // events
      expect(this.t2.events.length).to.eq(1);
      expect(this.t2.events[0].event).to.eq('ProtocolUpdated');
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[0].args.coverage).to.eq(id('tx'));
      expect(this.t2.events[0].args.nonStakers).to.eq(parseEther('0.2'));
      expect(this.t2.events[0].args.coverageAmount).to.eq(1500);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(11)),
      );
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t2.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(11),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.2'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(1500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(500);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.newPremiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(
        this.premiumStakers.mul(11),
      );

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(11)),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(11),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium).sub(11),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(1500);
      expect(coverageAmounts[1]).to.eq(500);

      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers.mul(11));
    });
    it('Verify', async function () {
      await timeTraveler.mine(1);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(11)),
      );
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t2.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(11),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.2'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(1500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(500);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.newPremiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(
        this.premiumStakers.mul(11),
      );

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(11)).sub(this.newPremium),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(11).add(this.newPremiumNonStakers),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium).sub(11).sub(1),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(1500);
      expect(coverageAmounts[1]).to.eq(500);

      expect(await this.spm.claimablePremiums()).to.eq(
        this.premiumStakers.mul(11).add(this.newPremiumStakers),
      );
    });
  });
  describe('protocolRemove() b0,p0', function () {
    // could have balance=0 + premium=0 <-- in case never been active (or made to this state)
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t0.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t0.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premium(this.protocolX)).to.eq(0);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Do', async function () {
      this.t1 = await meta(this.spm.protocolRemove(this.protocolX));

      // events
      expect(this.t1.events.length).to.eq(3);
      expect(this.t1.events[0].event).to.eq('ProtocolAgentTransfer');
      expect(this.t1.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[0].args.from).to.eq(this.alice.address);
      expect(this.t1.events[0].args.to).to.eq(constants.AddressZero);
      expect(this.t1.events[1].event).to.eq('ProtocolUpdated');
      expect(this.t1.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[1].args.coverage).to.eq(constants.HashZero);
      expect(this.t1.events[1].args.nonStakers).to.eq(0);
      expect(this.t1.events[1].args.coverageAmount).to.eq(0);
      expect(this.t1.events[2].event).to.eq('ProtocolRemoved');
      expect(this.t1.events[2].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(
        this.t1.time.add(days7),
      );

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      await expect(this.spm.activeBalance(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premium(this.protocolX)).to.be.reverted;
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('After 7 days', async function () {
      await timeTraveler.increaseTime(days7);
      await timeTraveler.mine(2);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(
        this.t1.time.add(days7),
      );

      await expect(this.spm.protocolAgent(this.protocolX)).to.be.reverted;
      await expect(this.spm.activeBalance(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premium(this.protocolX)).to.be.reverted;
      await expect(this.spm.coverageAmounts(this.protocolX)).to.be.reverted;

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
  });
  describe('protocolRemove() b!0,p0', function () {
    // could have balance + premium=0 <-- in case premium was set by 0 by gov first (or never set)
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
      await this.spm.depositToActiveBalance(this.protocolX, maxTokens);
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t0.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t0.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premium(this.protocolX)).to.eq(0);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(0);
    });
    it('Do', async function () {
      this.t1 = await meta(this.spm.protocolRemove(this.protocolX));

      // events
      expect(this.t1.events.length).to.eq(5);
      expect(this.t1.events[1].event).to.eq('ProtocolBalanceWithdrawn');
      expect(this.t1.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[1].args.amount).to.eq(maxTokens);
      expect(this.t1.events[2].event).to.eq('ProtocolAgentTransfer');
      expect(this.t1.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[2].args.from).to.eq(this.alice.address);
      expect(this.t1.events[2].args.to).to.eq(constants.AddressZero);
      expect(this.t1.events[3].event).to.eq('ProtocolUpdated');
      expect(this.t1.events[3].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[3].args.coverage).to.eq(constants.HashZero);
      expect(this.t1.events[3].args.nonStakers).to.eq(0);
      expect(this.t1.events[3].args.coverageAmount).to.eq(0);
      expect(this.t1.events[4].event).to.eq('ProtocolRemoved');
      expect(this.t1.events[4].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(
        this.t1.time.add(days7),
      );

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      await expect(this.spm.activeBalance(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premium(this.protocolX)).to.be.reverted;
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(maxTokens);
    });
  });
  describe('protocolRemove() b!0,p!0', function () {
    // could have balance + premium <-- in case active
    before(async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);

      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
      await this.spm.depositToActiveBalance(this.protocolX, maxTokens);

      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(0);
    });
    it('Do', async function () {
      this.t2 = await meta(this.spm.protocolRemove(this.protocolX));

      // events
      expect(this.t2.events.length).to.eq(6);
      expect(this.t2.events[0].event).to.eq('ProtocolPremiumChanged');
      expect(this.t2.events[0].args.oldPremium).to.eq(this.premium);
      expect(this.t2.events[0].args.newPremium).to.eq(0);
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].event).to.eq('ProtocolBalanceWithdrawn');
      expect(this.t2.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].args.amount).to.eq(maxTokens.sub(this.premium));
      expect(this.t2.events[3].event).to.eq('ProtocolAgentTransfer');
      expect(this.t2.events[3].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[3].args.from).to.eq(this.alice.address);
      expect(this.t2.events[3].args.to).to.eq(constants.AddressZero);
      expect(this.t2.events[4].event).to.eq('ProtocolUpdated');
      expect(this.t2.events[4].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[4].args.coverage).to.eq(constants.HashZero);
      expect(this.t2.events[4].args.nonStakers).to.eq(0);
      expect(this.t2.events[4].args.coverageAmount).to.eq(0);
      expect(this.t2.events[5].event).to.eq('ProtocolRemoved');
      expect(this.t2.events[5].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.premiumNonStakers,
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(this.premiumStakers);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(
        this.t2.time.add(days7),
      );

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      await expect(this.spm.activeBalance(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.premiumNonStakers);
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premium(this.protocolX)).to.be.reverted;
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.premium),
      );
    });
  });
  describe('protocolRemove() b0,p!0', function () {
    // could have premium + balance=0 <-- in case remove incentives have failed
    before(async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);

      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      this.balance = this.premium.mul(1000000);
      this.time = 30000000000000;
      await this.spm.depositToActiveBalance(this.protocolX, this.balance);

      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
      await timeTraveler.increaseTime(this.time);
      await timeTraveler.mine(1);
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(this.balance);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.balance.div(10));
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      // NOTE this is unwanted side effect
      // Hence the reason for the incentivized removal of protocols
      expect(await this.spm.claimablePremiums()).to.eq(
        BigNumber.from(this.time).mul(this.premiumStakers),
      );

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.balance),
      );
    });
    it('Do', async function () {
      this.t2 = await meta(this.spm.protocolRemove(this.protocolX));

      // events
      expect(this.t2.events.length).to.eq(5);
      expect(this.t2.events[0].event).to.eq('AccountingError');
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);
      const accountedAmount = BigNumber.from(this.time + 1).mul(this.premiumStakers);
      expect(this.t2.events[0].args.amount).to.eq(accountedAmount.sub(this.balance.div(10).mul(9)));
      expect(this.t2.events[0].args.insufficientTokens).to.eq(0);
      expect(this.t2.events[1].event).to.eq('ProtocolPremiumChanged');
      expect(this.t2.events[1].args.oldPremium).to.eq(this.premium);
      expect(this.t2.events[1].args.newPremium).to.eq(0);
      expect(this.t2.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].event).to.eq('ProtocolAgentTransfer');
      expect(this.t2.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].args.from).to.eq(this.alice.address);
      expect(this.t2.events[2].args.to).to.eq(constants.AddressZero);
      expect(this.t2.events[3].event).to.eq('ProtocolUpdated');
      expect(this.t2.events[3].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[3].args.coverage).to.eq(constants.HashZero);
      expect(this.t2.events[3].args.nonStakers).to.eq(0);
      expect(this.t2.events[3].args.coverageAmount).to.eq(0);
      expect(this.t2.events[4].event).to.eq('ProtocolRemoved');
      expect(this.t2.events[4].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.balance.div(10),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(
        this.balance.div(10).mul(9),
      );

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(
        this.t2.time.add(days7),
      );

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      await expect(this.spm.activeBalance(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.balance.div(10));
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premium(this.protocolX)).to.be.reverted;
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(this.balance.div(10).mul(9));

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.balance),
      );
    });
  });
  describe('forceRemoveByActiveBalance()', function () {
    before(async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);
      this.balanceMultiplier = BigNumber.from(100000);

      this.minActiveBalance = this.premium.mul(this.balanceMultiplier);

      await timeTraveler.revertSnapshot();

      await this.spm.privatesetMinActiveBalance(this.minActiveBalance);

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
      await this.spm.depositToActiveBalance(this.protocolX, this.minActiveBalance.mul(11));

      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(this.minActiveBalance.mul(11));
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(this.minActiveBalance.mul(11));
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        this.minActiveBalance.mul(11).div(this.premium),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.minActiveBalance.mul(11)),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(0);
    });
    it('Fail', async function () {
      await expect(this.spm.forceRemoveByActiveBalance(this.protocolX)).to.be.revertedWith(
        'InvalidConditions()',
      );

      this.skippedSeconds = this.minActiveBalance.mul(10).div(this.premium).add(1);

      await timeTraveler.increaseTime(Number(this.skippedSeconds - 2));
      await timeTraveler.mine(1);
    });
    it('Do', async function () {
      this.t2 = await meta(this.spm.connect(this.bob).forceRemoveByActiveBalance(this.protocolX));

      // events
      expect(this.t2.events.length).to.eq(6);
      expect(this.t2.events[0].event).to.eq('ProtocolPremiumChanged');
      expect(this.t2.events[0].args.oldPremium).to.eq(this.premium);
      expect(this.t2.events[0].args.newPremium).to.eq(0);
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[1].event).to.eq('ProtocolAgentTransfer');
      expect(this.t2.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[1].args.from).to.eq(this.alice.address);
      expect(this.t2.events[1].args.to).to.eq(constants.AddressZero);
      expect(this.t2.events[2].event).to.eq('ProtocolUpdated');
      expect(this.t2.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].args.coverage).to.eq(constants.HashZero);
      expect(this.t2.events[2].args.nonStakers).to.eq(0);
      expect(this.t2.events[2].args.coverageAmount).to.eq(0);
      expect(this.t2.events[3].event).to.eq('ProtocolRemoved');
      expect(this.t2.events[3].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[5].event).to.eq('ProtocolRemovedByArb');
      expect(this.t2.events[5].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[5].args.arb).to.eq(this.bob.address);
      expect(this.t2.events[5].args.profit).to.eq(this.minActiveBalance.sub(this.premium));

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(this.skippedSeconds),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(
        this.premiumStakers.mul(this.skippedSeconds),
      );

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(
        this.t2.time.add(days7),
      );

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      await expect(this.spm.activeBalance(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(this.skippedSeconds),
      );
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premium(this.protocolX)).to.be.reverted;
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(
        this.premiumStakers.mul(this.skippedSeconds),
      );

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.minActiveBalance.mul(11)),
      );

      // because of extra block mined, it is < minBalance (instead of equal)
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(
        this.minActiveBalance.sub(this.premium),
      );
    });
    it('After 7 days', async function () {
      await timeTraveler.increaseTime(days7);
      await timeTraveler.mine(2);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(this.skippedSeconds),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(
        this.premiumStakers.mul(this.skippedSeconds),
      );

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(
        this.t2.time.add(days7),
      );

      await expect(this.spm.protocolAgent(this.protocolX)).to.be.reverted;
      await expect(this.spm.activeBalance(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(this.skippedSeconds),
      );
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premium(this.protocolX)).to.be.reverted;
      await expect(this.spm.coverageAmounts(this.protocolX)).to.be.reverted;

      expect(await this.spm.claimablePremiums()).to.eq(
        this.premiumStakers.mul(this.skippedSeconds),
      );

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.minActiveBalance.mul(11)),
      );

      // because of extra block mined, it is < minBalance (instead of equal)
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(
        this.minActiveBalance.sub(this.premium),
      );
    });
  });
  describe('forceRemoveByActiveBalance(), no remaining', function () {
    before(async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);
      this.balanceMultiplier = BigNumber.from(100000);

      this.minActiveBalance = this.premium.mul(this.balanceMultiplier);

      await timeTraveler.revertSnapshot();

      await this.spm.privatesetMinActiveBalance(this.minActiveBalance);

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
      await this.spm.depositToActiveBalance(this.protocolX, this.minActiveBalance.mul(11));

      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(this.minActiveBalance.mul(11));
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(this.minActiveBalance.mul(11));
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        this.minActiveBalance.mul(11).div(this.premium),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.minActiveBalance.mul(11)),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(0);
    });
    it('Do', async function () {
      this.skippedSeconds = this.minActiveBalance.mul(11).div(this.premium).add(1);

      await timeTraveler.increaseTime(Number(this.skippedSeconds - 2));
      await timeTraveler.mine(1);

      this.t2 = await meta(this.spm.connect(this.bob).forceRemoveByActiveBalance(this.protocolX));

      // events
      expect(this.t2.events.length).to.eq(5);
      expect(this.t2.events[0].event).to.eq('ProtocolPremiumChanged');
      expect(this.t2.events[0].args.oldPremium).to.eq(this.premium);
      expect(this.t2.events[0].args.newPremium).to.eq(0);
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[1].event).to.eq('ProtocolAgentTransfer');
      expect(this.t2.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[1].args.from).to.eq(this.alice.address);
      expect(this.t2.events[1].args.to).to.eq(constants.AddressZero);
      expect(this.t2.events[2].event).to.eq('ProtocolUpdated');
      expect(this.t2.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].args.coverage).to.eq(constants.HashZero);
      expect(this.t2.events[2].args.nonStakers).to.eq(0);
      expect(this.t2.events[2].args.coverageAmount).to.eq(0);
      expect(this.t2.events[3].event).to.eq('ProtocolRemoved');
      expect(this.t2.events[3].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[4].event).to.eq('ProtocolRemovedByArb');
      expect(this.t2.events[4].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[4].args.arb).to.eq(this.bob.address);
      expect(this.t2.events[4].args.profit).to.eq(0);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(this.skippedSeconds - 1),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(
        this.premiumStakers.mul(this.skippedSeconds - 1),
      );

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(
        this.t2.time.add(days7),
      );

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      await expect(this.spm.activeBalance(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(this.skippedSeconds - 1),
      );
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premium(this.protocolX)).to.be.reverted;
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(
        this.premiumStakers.mul(this.skippedSeconds - 1),
      );

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.minActiveBalance.mul(11)),
      );

      // because of extra block mined, it is < minBalance (instead of equal)
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(0);
    });
  });
  describe('calcForceRemoveBySecondsOfCoverage()', function () {
    before(async function () {
      this.premium = parseUnits('1', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);
      this.balance = this.premium.mul(hours12);

      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      await this.spm.depositToActiveBalance(this.protocolX, this.balance);
      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
    });
    it('t=0', async function () {
      const t = await this.spm.viewCalcForceRemoveBySecondsOfCoverage(this.protocolX);
      expect(t[0]).to.eq(0);
      expect(t[1]).to.eq(false);
    });
    it('t=1', async function () {
      await timeTraveler.mine(1);

      const t = await this.spm.viewCalcForceRemoveBySecondsOfCoverage(this.protocolX);
      expect(t[0]).to.eq(this.premium);
      expect(t[1]).to.eq(true);
    });
    it('t=2', async function () {
      await timeTraveler.mine(1);

      const t = await this.spm.viewCalcForceRemoveBySecondsOfCoverage(this.protocolX);
      expect(t[0]).to.eq(this.premium.mul(2));
      expect(t[1]).to.eq(true);
    });
    it('t=10', async function () {
      await timeTraveler.mine(8);

      const t = await this.spm.viewCalcForceRemoveBySecondsOfCoverage(this.protocolX);
      expect(t[0]).to.eq(this.premium.mul(10));
      expect(t[1]).to.eq(true);
    });
    it('t=20', async function () {
      await timeTraveler.mine(10);

      const t = await this.spm.viewCalcForceRemoveBySecondsOfCoverage(this.protocolX);
      expect(t[0]).to.eq(this.premium.mul(20));
      expect(t[1]).to.eq(true);
    });
  });
  describe('forceRemoveBySecondsOfCoverage(), 50%', function () {
    before(async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);
      this.balance = this.premium.mul(hours12 + 1);

      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      await this.spm.depositToActiveBalance(this.protocolX, this.balance);
      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(this.balance);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(this.balance);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(hours12 + 1);
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.balance),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(0);
    });
    it('Fail', async function () {
      await expect(this.spm.forceRemoveBySecondsOfCoverage(this.protocolX)).to.be.revertedWith(
        'InvalidConditions()',
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(hours12);
    });
    it('Do', async function () {
      this.skipSeconds = hours12 / 2;

      await timeTraveler.increaseTime(Number(this.skipSeconds));
      await timeTraveler.mine(1);
      // check state pre removal

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(this.balance);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      // +1 seconds because of failed removal block
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(
        this.balance.sub(this.premium.mul(this.skipSeconds + 1)),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(this.skipSeconds + 1),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        hours12 - this.skipSeconds,
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(
        this.premiumStakers.mul(this.skipSeconds + 1),
      );

      this.t2 = await meta(
        this.spm.connect(this.bob).forceRemoveBySecondsOfCoverage(this.protocolX),
      );

      expect(this.t2.events.length).to.eq(8);
      expect(this.t2.events[0].event).to.eq('ProtocolPremiumChanged');
      expect(this.t2.events[0].args.oldPremium).to.eq(this.premium);
      expect(this.t2.events[0].args.newPremium).to.eq(0);
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].event).to.eq('ProtocolBalanceWithdrawn');
      expect(this.t2.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].args.amount).to.be.closeTo(this.balance.div(4), parseUnits('20', 6));
      expect(this.t2.events[3].event).to.eq('ProtocolAgentTransfer');
      expect(this.t2.events[3].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[3].args.from).to.eq(this.alice.address);
      expect(this.t2.events[3].args.to).to.eq(constants.AddressZero);
      expect(this.t2.events[4].event).to.eq('ProtocolUpdated');
      expect(this.t2.events[4].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[4].args.coverage).to.eq(constants.HashZero);
      expect(this.t2.events[4].args.nonStakers).to.eq(0);
      expect(this.t2.events[4].args.coverageAmount).to.eq(0);
      expect(this.t2.events[5].event).to.eq('ProtocolRemoved');
      expect(this.t2.events[5].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[7].event).to.eq('ProtocolRemovedByArb');
      expect(this.t2.events[7].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[7].args.arb).to.eq(this.bob.address);
      expect(this.t2.events[7].args.profit).to.be.closeTo(this.balance.div(4), parseUnits('20', 6));
    });
    it('Verify state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.t2.time.sub(this.t1.time).mul(this.premiumNonStakers),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(
        this.t2.time.sub(this.t1.time).mul(this.premiumStakers),
      );

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(
        this.t2.time.add(days7),
      );

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      await expect(this.spm.activeBalance(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.t2.time.sub(this.t1.time).mul(this.premiumNonStakers),
      );
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premium(this.protocolX)).to.be.reverted;
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(
        this.t2.time.sub(this.t1.time).mul(this.premiumStakers),
      );

      // reward is balance divided by 4 as the remaining balance was balance/2, because time was skipped
      // The reward at this point in time was ~50%
      // So the reward (balance/4) is send to caller
      // Remainder (balance/4) is send to protocol agent
      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.be.closeTo(
        maxTokens.sub(this.balance).add(this.balance.div(4)),
        parseUnits('20', 6),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.be.closeTo(
        this.balance.div(4),
        parseUnits('20', 6),
      );

      const prems = await this.spm.claimablePremiums();
      const prems2 = await this.spm.viewNonStakersClaimableByProtocol(this.protocolX);
      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(prems.add(prems2));
    });
  });
  describe('forceRemoveBySecondsOfCoverage(), 20%', function () {
    before(async function () {
      this.premium = parseUnits('1', 6);
      this.balance = this.premium.mul(hours12);

      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      await this.spm.depositToActiveBalance(this.protocolX, this.balance);
      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
    });
    it('skip time', async function () {
      this.skipSeconds = hours1point2 * 2 - 1;

      await timeTraveler.increaseTime(Number(this.skipSeconds));
      await timeTraveler.mine(1);
    });
    it('do', async function () {
      this.t2 = await meta(
        this.spm.connect(this.bob).forceRemoveBySecondsOfCoverage(this.protocolX),
      );
    });
    it('verify state', async function () {
      // balance is 100%-20% = 80%
      // 20% of 80% of balance
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.be.eq(
        this.balance.div(10).mul(2).div(10).mul(8),
      );
    });
  });
  describe('forceRemoveBySecondsOfCoverage(), 40%', function () {
    before(async function () {
      this.premium = parseUnits('1', 6);
      this.balance = this.premium.mul(hours12);

      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      await this.spm.depositToActiveBalance(this.protocolX, this.balance);
      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
    });
    it('skip time', async function () {
      this.skipSeconds = hours1point2 * 4 - 1;

      await timeTraveler.increaseTime(Number(this.skipSeconds));
      await timeTraveler.mine(1);
    });
    it('do', async function () {
      this.t2 = await meta(
        this.spm.connect(this.bob).forceRemoveBySecondsOfCoverage(this.protocolX),
      );
    });
    it('verify state', async function () {
      // balance is 100%-40% = 60%
      // 40% of 60% of balance
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.be.eq(
        this.balance.div(10).mul(4).div(10).mul(6),
      );
    });
  });
  describe('forceRemoveBySecondsOfCoverage(), 80%', function () {
    before(async function () {
      this.premium = parseUnits('1', 6);
      this.balance = this.premium.mul(hours12);

      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      await this.spm.depositToActiveBalance(this.protocolX, this.balance);
      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
    });
    it('skip time', async function () {
      this.skipSeconds = hours1point2 * 8 - 1;

      await timeTraveler.increaseTime(Number(this.skipSeconds));
      await timeTraveler.mine(1);
    });
    it('do', async function () {
      this.t2 = await meta(
        this.spm.connect(this.bob).forceRemoveBySecondsOfCoverage(this.protocolX),
      );
    });
    it('verify state', async function () {
      // balance is 100%-80% = 20%
      // 80% of 20% = 16
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.be.eq(
        this.balance.div(10).mul(8).div(10).mul(2),
      );
    });
  });
  describe('forceRemoveBySecondsOfCoverage(), 100%', function () {
    before(async function () {
      this.premium = parseUnits('1', 6);
      this.balance = this.premium.mul(hours12);

      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      await this.spm.depositToActiveBalance(this.protocolX, this.balance);
      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
    });
    it('skip time', async function () {
      this.skipSeconds = hours1point2 * 11 - 1;

      await timeTraveler.increaseTime(Number(this.skipSeconds));
      await timeTraveler.mine(1);
    });
    it('do', async function () {
      this.t2 = await meta(
        this.spm.connect(this.bob).forceRemoveBySecondsOfCoverage(this.protocolX),
      );
    });
    it('verify state', async function () {
      // balance is 100%-100% = 0%
      // 100% of 0% = 0
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.be.eq(0);
    });
  });
  describe('forceRemoveBySecondsOfCoverage(), no remaining', function () {
    before(async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);
      this.balance = this.premium.mul(hours12 + 1);

      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      await this.spm.depositToActiveBalance(this.protocolX, this.balance);
      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(this.balance);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(this.balance);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(hours12 + 1);
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.balance),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(0);
    });
    it('Do', async function () {
      this.skipSeconds = hours12 + 100;
      await timeTraveler.increaseTime(Number(this.skipSeconds));
      await timeTraveler.mine(1);
      // check state pre removal

      this.t2 = await meta(
        this.spm.connect(this.bob).forceRemoveBySecondsOfCoverage(this.protocolX),
      );

      expect(this.t2.events.length).to.eq(6);
      expect(this.t2.events[1].event).to.eq('ProtocolPremiumChanged');
      expect(this.t2.events[1].args.oldPremium).to.eq(this.premium);
      expect(this.t2.events[1].args.newPremium).to.eq(0);
      expect(this.t2.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].event).to.eq('ProtocolAgentTransfer');
      expect(this.t2.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].args.from).to.eq(this.alice.address);
      expect(this.t2.events[2].args.to).to.eq(constants.AddressZero);
      expect(this.t2.events[3].event).to.eq('ProtocolUpdated');
      expect(this.t2.events[3].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[3].args.coverage).to.eq(constants.HashZero);
      expect(this.t2.events[3].args.nonStakers).to.eq(0);
      expect(this.t2.events[3].args.coverageAmount).to.eq(0);
      expect(this.t2.events[4].event).to.eq('ProtocolRemoved');
      expect(this.t2.events[4].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[5].event).to.eq('ProtocolRemovedByArb');
      expect(this.t2.events[5].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[5].args.arb).to.eq(this.bob.address);
      expect(this.t2.events[5].args.profit).to.eq(0);
    });
    it('Verify state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.balance.div(this.premium).mul(this.premiumNonStakers),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(
        this.balance.div(this.premium).mul(this.premiumStakers),
      );

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(
        this.t2.time.add(days7),
      );

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      await expect(this.spm.activeBalance(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.balance.div(this.premium).mul(this.premiumNonStakers),
      );
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premium(this.protocolX)).to.be.reverted;
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(
        this.balance.div(this.premium).mul(this.premiumStakers),
      );

      // reward is balance divided by 4 as the remaining balance was balance/2, because time was skipped
      // The reward at this point in time was ~50%
      // So the reward (balance/4) is send to caller
      // Remainder (balance/4) is send to protocol agent
      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.balance),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(0);

      const prems = await this.spm.claimablePremiums();
      const prems2 = await this.spm.viewNonStakersClaimableByProtocol(this.protocolX);
      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(prems.add(prems2));
    });
  });
  describe('claimPremiumsForStakers()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.spm.setSherlockCoreAddress(this.bob.address);
    });
    it('initial state', async function () {
      expect(await this.spm.claimablePremiums()).to.eq(0);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(0);
      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(0);
    });
    it('do', async function () {
      this.t1 = await meta(this.spm.claimPremiumsForStakers());
      expect(this.t1.events.length).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(0);
      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(0);
    });
    it('add protocol', async function () {
      this.premium = parseUnits('10', 6);
      this.balance = this.premium.mul(1000000);

      this.t2 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), 0, 500),
      );
      await this.spm.depositToActiveBalance(this.protocolX, this.balance);

      this.t3 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));

      // verify state
      expect(await this.spm.claimablePremiums()).to.eq(0);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t3.time);
      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premium);

      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(0);
    });
    it('do again', async function () {
      this.t1 = await meta(this.spm.claimPremiumsForStakers());
      expect(this.t1.events.length).to.eq(1);

      expect(await this.spm.claimablePremiums()).to.eq(0);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premium);

      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(this.premium);
    });
    it('skip', async function () {
      await timeTraveler.mine(2);

      expect(await this.spm.claimablePremiums()).to.eq(this.premium.mul(2));
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premium);

      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(this.premium);
    });
    it('settle debt', async function () {
      this.t2 = await meta(this.spm.privateSettleTotalDebt());

      expect(await this.spm.claimablePremiums()).to.eq(this.premium.mul(3));
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(this.premium.mul(3));
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premium);

      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(this.premium);
    });
    it('do again', async function () {
      this.t3 = await meta(this.spm.claimPremiumsForStakers());
      expect(this.t1.events.length).to.eq(1);

      expect(await this.spm.claimablePremiums()).to.eq(0);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t3.time);
      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premium);

      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(this.premium.mul(5));
    });
  });
  describe('setMinActiveBalance()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('initial state', async function () {
      expect(await this.spm.minActiveBalance()).to.eq(0);
    });
    it('do fail', async function () {
      await expect(this.spm.setMinActiveBalance(parseUnits('30001', 6))).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
    it('do', async function () {
      this.b1 = parseUnits('300', 6);
      this.t1 = await meta(this.spm.setMinActiveBalance(this.b1));

      expect(this.t1.events.length).to.eq(1);
      expect(this.t1.events[0].event).to.eq('MinBalance');
      expect(this.t1.events[0].args.previous).to.eq(0);
      expect(this.t1.events[0].args.current).to.eq(this.b1);

      expect(await this.spm.minActiveBalance()).to.eq(this.b1);
    });
    it('do again', async function () {
      this.b2 = parseUnits('500', 6);
      this.t2 = await meta(this.spm.setMinActiveBalance(this.b2));

      expect(this.t2.events.length).to.eq(1);
      expect(this.t2.events[0].event).to.eq('MinBalance');
      expect(this.t2.events[0].args.previous).to.eq(this.b1);
      expect(this.t2.events[0].args.current).to.eq(this.b2);

      expect(await this.spm.minActiveBalance()).to.eq(this.b2);
    });
    it('do same', async function () {
      await expect(this.spm.setMinActiveBalance(this.b2)).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('setProtocolPremium()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t0.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t0.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premium(this.protocolX)).to.eq(0);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Insufficient balance', async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);

      await expect(this.spm.setProtocolPremium(this.protocolX, this.premium)).to.be.revertedWith(
        'InsufficientBalance("' + this.protocolX + '")',
      );
      await this.spm.depositToActiveBalance(this.protocolX, maxTokens);
    });
    it('Set same value (0)', async function () {
      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, 0));

      expect(this.t1.events.length).to.eq(0);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premium(this.protocolX)).to.eq(0);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Do', async function () {
      this.t2 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));

      // events
      expect(this.t2.events.length).to.eq(1);
      expect(this.t2.events[0].event).to.eq('ProtocolPremiumChanged');
      expect(this.t2.events[0].args.oldPremium).to.eq(0);
      expect(this.t2.events[0].args.newPremium).to.eq(this.premium);
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t2.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Mine', async function () {
      await timeTraveler.mine(1);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t2.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(maxTokens.sub(this.premium));
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.premiumNonStakers);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium).sub(1),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers);
    });
    it('Do again, t=3', async function () {
      this.newPremium = this.premium.mul(10);
      this.newPremiumStakers = this.premiumStakers.mul(10);
      this.newPremiumNonStakers = this.premiumNonStakers.mul(10);
      this.t3 = await meta(this.spm.setProtocolPremium(this.protocolX, this.newPremium));

      // events
      expect(this.t3.events.length).to.eq(1);
      expect(this.t3.events[0].event).to.eq('ProtocolPremiumChanged');
      expect(this.t3.events[0].args.oldPremium).to.eq(this.premium);
      expect(this.t3.events[0].args.newPremium).to.eq(this.newPremium);
      expect(this.t3.events[0].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(2)),
      );
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t3.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(2),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.newPremium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.newPremiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t3.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(
        this.premiumStakers.mul(2),
      );

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(2)),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(2),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.newPremium).sub(1),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.newPremium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers.mul(2));
    });
    it('Verify, t=4', async function () {
      await timeTraveler.mine(1);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(2)),
      );
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t3.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(2),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.newPremium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.newPremiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t3.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(
        this.premiumStakers.mul(2),
      );

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(2)).sub(this.newPremium),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(2).add(this.newPremiumNonStakers),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.newPremium).sub(2),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.newPremium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(
        this.premiumStakers.mul(2).add(this.newPremiumStakers),
      );
    });
    it('Accounting error', async function () {
      this.seconds = Number(maxTokens.div(this.newPremium).sub(2)) + 1;
      await timeTraveler.increaseTime(this.seconds);
      this.t5 = await meta(this.spm.setProtocolPremium(this.protocolX, 0));

      // prev internal balance - accrued debt because of evm_mine + set call
      const debt = maxTokens.sub(this.premium.mul(2)).sub(this.newPremium.mul(this.seconds + 1));
      const stakerDebt = -Number(debt.div(10).mul(9));
      // because two epochs of old premium have passed (1 token), breaking the last epoch, leaving 8 remaining
      const remainingBalance = this.premium.sub(this.premiumNonStakers.mul(2));
      // events
      expect(this.t5.events.length).to.eq(2);
      expect(this.t5.events[0].event).to.eq('AccountingError');
      expect(this.t5.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t5.events[0].args.amount).to.eq(stakerDebt);
      expect(this.t5.events[0].args.insufficientTokens).to.eq(0);
      expect(this.t5.events[1].event).to.eq('ProtocolPremiumChanged');
      expect(this.t5.events[1].args.oldPremium).to.eq(this.newPremium);
      expect(this.t5.events[1].args.newPremium).to.eq(0);
      expect(this.t5.events[1].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t5.time);
      // takes into account protocol balance
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.premiumNonStakers
          .mul(2)
          .add(this.newPremiumNonStakers.mul(this.seconds))
          .add(remainingBalance),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t5.time);
      // doesn't take into account protocol balane (reason why this.seconds + 1)
      // but the debt is subtracted
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(
        this.premiumStakers
          .mul(2)
          .add(this.newPremiumStakers.mul(this.seconds + 1))
          .sub(stakerDebt),
      );

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);
    });
  });
  describe('setProtocolPremiums(), single', function () {
    // same as setprotocolpremium
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
    });
    it('Initial state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t0.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t0.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premium(this.protocolX)).to.eq(0);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Insufficient balance', async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);

      await expect(
        this.spm.setProtocolPremiums([this.protocolX], [this.premium]),
      ).to.be.revertedWith('InsufficientBalance("' + this.protocolX + '")');
      await this.spm.depositToActiveBalance(this.protocolX, maxTokens);
    });
    it('Set same value (0)', async function () {
      this.t1 = await meta(this.spm.setProtocolPremiums([this.protocolX], [0]));

      expect(this.t1.events.length).to.eq(0);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premium(this.protocolX)).to.eq(0);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Do', async function () {
      this.t2 = await meta(this.spm.setProtocolPremiums([this.protocolX], [this.premium]));

      // events
      expect(this.t2.events.length).to.eq(1);
      expect(this.t2.events[0].event).to.eq('ProtocolPremiumChanged');
      expect(this.t2.events[0].args.oldPremium).to.eq(0);
      expect(this.t2.events[0].args.newPremium).to.eq(this.premium);
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t2.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Mine', async function () {
      await timeTraveler.mine(1);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t2.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(maxTokens.sub(this.premium));
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.premiumNonStakers);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium).sub(1),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers);
    });
  });
  describe('setProtocolPremiums()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
      this.t1 = await meta(
        this.spm.protocolAdd(this.protocolY, this.alice.address, id('t'), parseEther('0.1'), 1500),
      );
      await this.spm.depositToActiveBalance(this.protocolX, maxTokens.div(2));
      await this.spm.depositToActiveBalance(this.protocolY, maxTokens.div(2));
    });
    it('Initial state', async function () {
      // protocol x
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(maxTokens.div(2));
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t0.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(maxTokens.div(2));
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premium(this.protocolX)).to.eq(0);

      const coverageAmountsX = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmountsX[0]).to.eq(500);
      expect(coverageAmountsX[1]).to.eq(0);

      // protocol y
      expect(await this.spm.viewActiveBalance(this.protocolY)).to.eq(maxTokens.div(2));
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolY)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolY)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolY)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolY)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolY)).to.eq(1500);
      expect(await this.spm.viewPreviousCoverage(this.protocolY)).to.eq(0);
      expect(await this.spm.viewProtocolAgent(this.protocolY)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolY)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolY)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolY)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolY)).to.eq(maxTokens.div(2));
      expect(await this.spm.nonStakersClaimable(this.protocolY)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolY)).to.eq(0);
      expect(await this.spm.premium(this.protocolY)).to.eq(0);

      const coverageAmountsY = await this.spm.coverageAmounts(this.protocolY);
      expect(coverageAmountsY[0]).to.eq(1500);
      expect(coverageAmountsY[1]).to.eq(0);

      // global
      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(0);
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t1.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Do', async function () {
      this.premiumX = parseUnits('10', 6);
      this.premiumStakersX = parseUnits('9', 6);
      this.premiumNonStakersX = parseUnits('1', 6);

      this.premiumY = parseUnits('20', 6);
      this.premiumStakersY = parseUnits('18', 6);
      this.premiumNonStakersY = parseUnits('2', 6);

      this.t2 = await meta(
        this.spm.setProtocolPremiums(
          [this.protocolX, this.protocolY],
          [this.premiumX, this.premiumY],
        ),
      );

      // protocol x
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(maxTokens.div(2));
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t2.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premiumX);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(maxTokens.div(2));
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(2).div(this.premiumX),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premiumX);

      const coverageAmountsX = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmountsX[0]).to.eq(500);
      expect(coverageAmountsX[1]).to.eq(0);

      // protocol y
      expect(await this.spm.viewActiveBalance(this.protocolY)).to.eq(maxTokens.div(2));
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolY)).to.eq(this.t2.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolY)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolY)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolY)).to.eq(this.premiumY);
      expect(await this.spm.viewCurrentCoverage(this.protocolY)).to.eq(1500);
      expect(await this.spm.viewPreviousCoverage(this.protocolY)).to.eq(0);
      expect(await this.spm.viewProtocolAgent(this.protocolY)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolY)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolY)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolY)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolY)).to.eq(maxTokens.div(2));
      expect(await this.spm.nonStakersClaimable(this.protocolY)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolY)).to.eq(
        maxTokens.div(2).div(this.premiumY),
      );
      expect(await this.spm.premium(this.protocolY)).to.eq(this.premiumY);

      const coverageAmountsY = await this.spm.coverageAmounts(this.protocolY);
      expect(coverageAmountsY[0]).to.eq(1500);
      expect(coverageAmountsY[1]).to.eq(0);

      // global
      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(
        this.premiumStakersX.add(this.premiumStakersY),
      );
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Mine', async function () {
      await timeTraveler.mine(5);

      // protocol x
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(maxTokens.div(2));
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t2.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premiumX);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(
        maxTokens.div(2).sub(this.premiumX.mul(5)),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakersX.mul(5),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(2).div(this.premiumX).sub(5),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premiumX);

      const coverageAmountsX = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmountsX[0]).to.eq(500);
      expect(coverageAmountsX[1]).to.eq(0);

      // protocol y
      expect(await this.spm.viewActiveBalance(this.protocolY)).to.eq(maxTokens.div(2));
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolY)).to.eq(this.t2.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolY)).to.eq(0);
      expect(await this.spm.viewNonStakersPercentage(this.protocolY)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolY)).to.eq(this.premiumY);
      expect(await this.spm.viewCurrentCoverage(this.protocolY)).to.eq(1500);
      expect(await this.spm.viewPreviousCoverage(this.protocolY)).to.eq(0);
      expect(await this.spm.viewProtocolAgent(this.protocolY)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolY)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolY)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolY)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolY)).to.eq(
        maxTokens.div(2).sub(this.premiumY.mul(5)),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolY)).to.eq(
        this.premiumNonStakersY.mul(5),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolY)).to.eq(
        maxTokens.div(2).div(this.premiumY).sub(5),
      );
      expect(await this.spm.premium(this.protocolY)).to.eq(this.premiumY);

      const coverageAmountsY = await this.spm.coverageAmounts(this.protocolY);
      expect(coverageAmountsY[0]).to.eq(1500);
      expect(coverageAmountsY[1]).to.eq(0);

      // global
      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(
        this.premiumStakersX.add(this.premiumStakersY),
      );
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t2.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(
        this.premiumStakersX.add(this.premiumStakersY).mul(5),
      );
    });
    it('Do again', async function () {
      this.premiumX2 = parseUnits('100', 6);
      this.premiumStakersX2 = parseUnits('90', 6);
      this.premiumNonStakersX2 = parseUnits('10', 6);

      this.premiumY2 = parseUnits('200', 6);
      this.premiumStakersY2 = parseUnits('180', 6);
      this.premiumNonStakersY2 = parseUnits('20', 6);

      this.t3 = await meta(
        this.spm.setProtocolPremiums(
          [this.protocolX, this.protocolY],
          [this.premiumX2, this.premiumY2],
        ),
      );

      // protocol x
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(
        maxTokens.div(2).sub(this.premiumX.mul(6)),
      );
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolX)).to.eq(this.t3.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolX)).to.eq(
        this.premiumNonStakersX.mul(6),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolX)).to.eq(this.premiumX2);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolX)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(
        maxTokens.div(2).sub(this.premiumX.mul(6)),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakersX.mul(6),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(2).div(this.premiumX2).sub(1),
      );
      expect(await this.spm.premium(this.protocolX)).to.eq(this.premiumX2);

      const coverageAmountsX = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmountsX[0]).to.eq(500);
      expect(coverageAmountsX[1]).to.eq(0);

      // protocol y
      expect(await this.spm.viewActiveBalance(this.protocolY)).to.eq(
        maxTokens.div(2).sub(this.premiumY.mul(6)),
      );
      expect(await this.spm.viewLastAccountedEachProtocol(this.protocolY)).to.eq(this.t3.time);
      expect(await this.spm.viewNonStakersClaimableByProtocol(this.protocolY)).to.eq(
        this.premiumNonStakersY.mul(6),
      );
      expect(await this.spm.viewNonStakersPercentage(this.protocolY)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewPremium(this.protocolY)).to.eq(this.premiumY2);
      expect(await this.spm.viewCurrentCoverage(this.protocolY)).to.eq(1500);
      expect(await this.spm.viewPreviousCoverage(this.protocolY)).to.eq(0);
      expect(await this.spm.viewProtocolAgent(this.protocolY)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolY)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolClaimDeadline(this.protocolY)).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolY)).to.eq(this.alice.address);
      expect(await this.spm.activeBalance(this.protocolY)).to.eq(
        maxTokens.div(2).sub(this.premiumY.mul(6)),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolY)).to.eq(
        this.premiumNonStakersY.mul(6),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolY)).to.eq(
        maxTokens.div(2).div(this.premiumY2).sub(1),
      );
      expect(await this.spm.premium(this.protocolY)).to.eq(this.premiumY2);

      const coverageAmountsY = await this.spm.coverageAmounts(this.protocolY);
      expect(coverageAmountsY[0]).to.eq(1500);
      expect(coverageAmountsY[1]).to.eq(0);

      // global
      expect(await this.spm.viewAllPremiumsPerSecToStakers()).to.eq(
        this.premiumStakersX2.add(this.premiumStakersY2),
      );
      expect(await this.spm.viewLastAccountedGlobal()).to.eq(this.t3.time);
      expect(await this.spm.viewLastClaimablePremiumsForStakers()).to.eq(
        this.premiumStakersX.add(this.premiumStakersY).mul(6),
      );

      expect(await this.spm.claimablePremiums()).to.eq(
        this.premiumStakersX.add(this.premiumStakersY).mul(6),
      );
    });
  });
  describe('depositToActiveBalance()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
    });
    it('Verify state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(maxTokens);
      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(0);
    });
    it('Do', async function () {
      this.amount = parseUnits('100', 6);
      this.t1 = await meta(this.spm.depositToActiveBalance(this.protocolX, this.amount));

      expect(this.t1.events.length).to.eq(3);
      expect(this.t1.events[2].event).to.eq('ProtocolBalanceDeposited');
      expect(this.t1.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[2].args.amount).to.eq(this.amount);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(this.amount);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(this.amount);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.amount),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(this.amount);
    });
    it('Do again', async function () {
      this.amount2 = parseUnits('200', 6);
      this.t2 = await meta(this.spm.depositToActiveBalance(this.protocolX, this.amount2));

      expect(this.t2.events.length).to.eq(3);
      expect(this.t2.events[2].event).to.eq('ProtocolBalanceDeposited');
      expect(this.t2.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].args.amount).to.eq(this.amount2);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(this.amount.add(this.amount2));
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(this.amount.add(this.amount2));

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.amount.add(this.amount2)),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(
        this.amount.add(this.amount2),
      );
    });
  });
  describe('withdrawActiveBalance()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
    });
    it('Verify state', async function () {
      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(0);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(maxTokens);
      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(0);
    });
    it('Do insufficient', async function () {
      await expect(this.spm.withdrawActiveBalance(this.protocolX, 1)).to.be.revertedWith(
        'InsufficientBalance("' + this.protocolX + '")',
      );

      this.amount = 60 * 60 * 24 * 8;
      this.t1 = await meta(this.spm.depositToActiveBalance(this.protocolX, this.amount));
      await this.spm.setProtocolPremium(this.protocolX, 1);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(this.amount);
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(this.amount);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.amount),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(this.amount);
    });
    it('Do insufficient time', async function () {
      await expect(this.spm.withdrawActiveBalance(this.protocolX, 60 * 60 * 25)).to.be.revertedWith(
        'InsufficientBalance("' + this.protocolX + '")',
      );
    });
    it('Do', async function () {
      this.withdraw = 60 * 60 * 23;
      this.t1 = await meta(this.spm.withdrawActiveBalance(this.protocolX, this.withdraw));

      expect(this.t1.events.length).to.eq(2);
      expect(this.t1.events[1].event).to.eq('ProtocolBalanceWithdrawn');
      expect(this.t1.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[1].args.amount).to.eq(this.withdraw);

      expect(await this.spm.viewActiveBalance(this.protocolX)).to.eq(
        this.amount - this.withdraw - 2,
      );
      expect(await this.spm.activeBalance(this.protocolX)).to.eq(this.amount - this.withdraw - 2);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.amount - this.withdraw),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(this.amount - this.withdraw);
    });
  });
  describe('transferProtocolAgent()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
    });
    it('Verify state', async function () {
      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
    });
    it('Do', async function () {
      this.t1 = await meta(this.spm.transferProtocolAgent(this.protocolX, this.bob.address));

      expect(this.t1.events.length).to.eq(1);
      expect(this.t1.events[0].event).to.eq('ProtocolAgentTransfer');
      expect(this.t1.events[0].args.from).to.eq(this.alice.address);
      expect(this.t1.events[0].args.to).to.eq(this.bob.address);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(this.bob.address);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.bob.address);
    });
    it('Remove', async function () {
      await this.spm.protocolRemove(this.protocolX);

      expect(await this.spm.viewProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.spm.viewRemovedProtocolAgent(this.protocolX)).to.eq(this.bob.address);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.bob.address);

      await expect(
        this.spm.transferProtocolAgent(this.protocolX, this.bob.address),
      ).to.be.revertedWith('ProtocolNotExists');
    });
  });
  describe('nonStakersClaim()', function () {
    before(async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);
      this.balance = this.premium.mul(1000000);

      await timeTraveler.revertSnapshot();

      await this.spm.setSherlockCoreAddress(this.sherlock.address);
      await this.sherlock.setNonStakersAddress(this.alice.address);

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      await this.spm.depositToActiveBalance(this.protocolX, this.balance);
      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
    });
    it('Initial state', async function () {
      await timeTraveler.mine(1);

      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.premiumNonStakers);
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(this.balance);
    });
    it('Do', async function () {
      this.t2 = await meta(
        this.spm.nonStakersClaim(this.protocolX, this.premiumNonStakers.mul(2), this.bob.address),
      );
      expect(this.t2.events.length).to.eq(1);

      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(
        this.premiumNonStakers.mul(2),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(
        this.balance.sub(this.premiumNonStakers.mul(2)),
      );
    });
    it('Do again', async function () {
      await timeTraveler.mine(2);

      this.t2 = await meta(
        this.spm.nonStakersClaim(this.protocolX, this.premiumNonStakers.mul(2), this.bob.address),
      );
      expect(this.t2.events.length).to.eq(1);

      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.premiumNonStakers);
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(
        this.premiumNonStakers.mul(4),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(
        this.balance.sub(this.premiumNonStakers.mul(4)),
      );
    });
    it('Remove protocol', async function () {
      await this.spm.protocolRemove(this.protocolX);

      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(2),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(
        this.premiumNonStakers.mul(4),
      );
    });
    it('Mine', async function () {
      await timeTraveler.mine(10);

      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(2),
      );
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(
        this.premiumNonStakers.mul(4),
      );
    });
    it('Do again', async function () {
      this.t3 = await meta(
        this.spm.nonStakersClaim(this.protocolX, this.premiumNonStakers.mul(2), this.bob.address),
      );
      expect(this.t2.events.length).to.eq(1);

      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(
        this.premiumNonStakers.mul(6),
      );
    });
  });
  describe('illiquid edge case', function () {
    // create protocol1 with higher debt then balance
    // create protocol2 with sufficient balance, so contract holds enough tokens
    // call global claim, moving more then wanted tokens
    // update premium of protocol1

    before(async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);
      this.balance = this.premium.mul(1000000);
      this.time = 1000000 * 1.5;

      await timeTraveler.revertSnapshot();

      //await this.sherlock.updateNonStakersAddress(this.bob.address);
      await this.spm.setSherlockCoreAddress(this.sherlock.address);

      await this.spm.protocolAdd(
        this.protocolX,
        this.alice.address,
        id('t'),
        parseEther('0.1'),
        500,
      );

      await this.spm.protocolAdd(
        this.protocolY,
        this.alice.address,
        id('t'),
        parseEther('0.1'),
        500,
      );

      await this.spm.depositToActiveBalance(this.protocolX, this.balance);
      await this.spm.depositToActiveBalance(this.protocolY, this.balance.mul(10));

      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
      await timeTraveler.increaseTime(this.time);
      await timeTraveler.mine(1);
    });
    it('Initial state', async function () {
      expect(await this.ERC20Mock6d.balanceOf(this.sherlock.address)).to.eq(0);
    });
    it('Do claim', async function () {
      await this.spm.claimPremiumsForStakers();

      this.stakerAmount = this.premiumStakers.mul(this.time + 1);
      expect(await this.ERC20Mock6d.balanceOf(this.sherlock.address)).to.eq(this.stakerAmount);
    });
    it('Do update', async function () {
      this.t2 = await meta(
        this.spm.protocolUpdate(this.protocolX, id('xa'), parseEther('0.1'), 1500),
      );

      expect(this.t2.events[0].event).to.eq('AccountingError');
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);

      const balanceMeantForStakers = this.balance.div(10).mul(9);
      const accountedAmount = this.premiumStakers.mul(this.time + 2); // 1 epoch more than accounted amount
      this.insufficient = this.stakerAmount.sub(balanceMeantForStakers);

      // subtract balance destined for stakers from accounted amount
      expect(this.t2.events[0].args.amount).to.eq(accountedAmount.sub(balanceMeantForStakers));
      // substract balance destined for stakers from actual amout sent
      expect(this.t2.events[0].args.insufficientTokens).to.eq(this.insufficient);
    });
    it('Mine', async function () {
      await timeTraveler.mine(5);

      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers.mul(5));
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.balance.div(10));
    });
    it('Mine', async function () {
      await timeTraveler.mine(4);

      // note non stakers claimable doesn't change
      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers.mul(9));
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.balance.div(10));
    });
    it('Do claim', async function () {
      await this.spm.claimPremiumsForStakers();

      this.stakerAmount2 = this.premiumStakers.mul(10);
      expect(await this.ERC20Mock6d.balanceOf(this.sherlock.address)).to.eq(
        this.stakerAmount.add(this.stakerAmount2),
      );
    });
    it('Do update', async function () {
      this.t2 = await meta(this.spm.setProtocolPremium(this.protocolX, 0));

      expect(this.t2.events[0].event).to.eq('AccountingError');
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);

      // 90% of 11 premiums
      const debtMeantForStakers = this.premium.mul(11).div(10).mul(9);
      const accountedAmount = this.premium.mul(9);

      expect(this.t2.events[0].args.amount).to.eq(debtMeantForStakers);
      expect(this.t2.events[0].args.insufficientTokens).to.eq(accountedAmount);

      const claimable = await this.spm.nonStakersClaimable(this.protocolX);
      const balance = await this.spm.activeBalance(this.protocolY);
      // send both token amount to make accounting work again
      this.b = claimable.add(balance).sub(this.insufficient).sub(accountedAmount);
      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(this.b);
    });
    it('Mine', async function () {
      await timeTraveler.mine(5);

      // note non stakers claimable doesn't change
      expect(await this.spm.claimablePremiums()).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.balance.div(10));

      expect(await this.ERC20Mock6d.balanceOf(this.spm.address)).to.eq(this.b);
    });
  });
  describe('sweep, eol', function () {
    before(async function () {
      this.balance = parseUnits('10000', 6);

      await timeTraveler.revertSnapshot();

      // await this.sherlock.setNonStakersAddress(this.alice.address);

      // deposit active balance
      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
      await this.spm.depositToActiveBalance(this.protocolX, this.balance);
    });
    it('Initial state', async function () {
      await expect(this.spm.isActive()).to.be.revertedWith(
        'Transaction reverted: function returned an unexpected amount of data',
      );
      await expect(this.spm.sweep(this.bob.address, [this.ERC20Mock6d.address])).to.be.revertedWith(
        'Transaction reverted: function returned an unexpected amount of data',
      );

      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(0);
    });
    it('Do zero', async function () {
      await expect(
        this.spm.sweep(constants.AddressZero, [this.ERC20Mock6d.address]),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Set core', async function () {
      await this.sherlock.updateSherlockProtocolManager(this.spm.address);
      await this.spm.setSherlockCoreAddress(this.sherlock.address);

      expect(await this.spm.isActive()).to.eq(true);
      await expect(this.spm.sweep(this.bob.address, [this.ERC20Mock6d.address])).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
    it('Do', async function () {
      await this.sherlock.updateSherlockProtocolManager(constants.AddressZero);

      expect(await this.spm.isActive()).to.eq(false);
      await this.spm.sweep(this.bob.address, [this.ERC20Mock6d.address]);

      expect(await this.ERC20Mock6d.balanceOf(this.bob.address)).to.eq(this.balance);
    });
  });
});
