const { expect } = require('chai');
const { constants } = require('ethers');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, Uint32Max } = require('./utilities');

describe('Stateless', function () {
  before(async function () {
    await prepare(this, ['ERC20Mock', 'NativeLock', 'ForeignLock', 'StrategyMock']);
    await solution(this, 'sl', this.gov);

    await deploy(this, [
      ['tokenA', this.ERC20Mock, ['TokenA', 'A', parseEther('1000')]],
      ['tokenB', this.ERC20Mock, ['TokenB', 'B', parseEther('1000')]],
      ['tokenC', this.ERC20Mock, ['TokenC', 'C', parseEther('1000')]],
      ['tokenDisable', this.ERC20Mock, ['TokenDis', 'Dis', parseEther('1000')]],
    ]);

    await deploy(this, [
      ['lockA', this.ForeignLock, ['Lock TokenA', 'lockA', this.sl.address, this.tokenA.address]],
      ['lockB', this.ForeignLock, ['Lock TokenB', 'lockB', this.sl.address, this.tokenB.address]],
      ['lockC', this.ForeignLock, ['Lock TokenC', 'lockC', this.sl.address, this.tokenC.address]],
      [
        'lockWGov',
        this.ForeignLock,
        ['Lock WGov', 'LockWGov', this.gov.address, this.tokenC.address],
      ],
      ['lockWSupply', this.NativeLock, ['Lock WSupply', 'LockWSupply', this.gov.address]],
      [
        'lockDisable',
        this.ForeignLock,
        ['Lock TokenDis', 'lockDis', this.sl.address, this.tokenDisable.address],
      ],
      ['strategyMockA', this.StrategyMock, [this.tokenA.address, this.sl.address]],
      ['strategyMockB', this.StrategyMock, [this.tokenB.address, this.sl.address]],
    ]);
    // Add tokenA as valid token
    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

    // Add protocolX as valid protocol
    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);

    // Setting up tokenDisable
    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenDisable.address, this.gov.address, this.lockDisable.address, true);
    await this.sl.c(this.gov).tokenDisableStakers(this.tokenDisable.address, 1);
    await this.sl.c(this.gov).tokenDisableProtocol(this.tokenDisable.address, 1);

    // Setting up lockWSupply
    await this.lockWSupply.connect(this.gov).mint(this.gov.address, parseEther('1'));
    await this.lockWSupply.connect(this.gov).transferOwnership(this.sl.address);
  });
  describe('Gov ─ State Changing', function () {
    describe('setInitialGovMain()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.setInitialGovMain(this.gov.address)).to.be.revertedWith('NOT_DEV');
      });
      it('Invalid gov', async function () {
        await expect(
          this.sl.c(this.gov).setInitialGovMain(constants.AddressZero),
        ).to.be.revertedWith('ZERO_GOV');
      });
      it('Success', async function () {
        await expect(this.sl.c(this.gov).setInitialGovMain(this.gov.address)).to.be.revertedWith(
          'ALREADY_SET',
        );
      });
    });
    describe('transferGovMain()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.transferGovMain(this.gov.address)).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid gov', async function () {
        await expect(this.sl.c(this.gov).transferGovMain(constants.AddressZero)).to.be.revertedWith(
          'ZERO_GOV',
        );
      });
      it('Invalid gov (same)', async function () {
        await expect(this.sl.c(this.gov).transferGovMain(this.gov.address)).to.be.revertedWith(
          'SAME_GOV',
        );
      });
      it('Success', async function () {
        await this.sl.c(this.gov).transferGovMain(this.alice.address);
        await this.sl.transferGovMain(this.gov.address);
      });
    });
    describe('setWatsonsAddress()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.setWatsonsAddress(this.gov.address)).to.be.revertedWith(
          'NOT_GOV_MAIN',
        );
      });
      it('Invalid watsons', async function () {
        await expect(
          this.sl.c(this.gov).setWatsonsAddress(constants.AddressZero),
        ).to.be.revertedWith('ZERO_WATS');
      });
    });
    describe('setUnstakeWindow()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.setUnstakeWindow(1)).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid window', async function () {
        await expect(this.sl.c(this.gov).setUnstakeWindow(25000001)).to.be.revertedWith('MAX');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).setUnstakeWindow(1);
      });
    });
    describe('setCooldown()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.setCooldown(1)).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid cooldown', async function () {
        await expect(this.sl.c(this.gov).setCooldown(25000001)).to.be.revertedWith('MAX');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).setCooldown(1);
      });
    });
    describe('protocolAdd()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.protocolAdd(this.nonProtocol1, this.gov.address, this.gov.address, []),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl.c(this.gov).protocolAdd(this.protocolX, this.gov.address, this.gov.address, []),
        ).to.be.revertedWith('COVERED');
      });
      it('Invalid protocol (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolAdd(constants.HashZero, this.gov.address, this.gov.address, []),
        ).to.be.revertedWith('ZERO_PROTOCOL');
      });
      it('Invalid agent (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolAdd(this.nonProtocol1, constants.AddressZero, this.gov.address, []),
        ).to.be.revertedWith('ZERO_AGENT');
      });
      it('Invalid manager (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolAdd(this.nonProtocol1, this.gov.address, constants.AddressZero, []),
        ).to.be.revertedWith('ZERO_MANAGER');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolAdd(this.nonProtocol1, this.gov.address, this.gov.address, [
              this.tokenB.address,
            ]),
        ).to.be.revertedWith('INIT');
      });
      it('Success', async function () {
        await this.sl
          .c(this.gov)
          .protocolAdd(this.nonProtocol1, this.gov.address, this.gov.address, [
            this.tokenA.address,
          ]);
      });
    });
    describe('protocolUpdate()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.protocolUpdate(this.protocolX, this.gov.address, this.gov.address),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl.c(this.gov).protocolUpdate(this.nonProtocol2, this.gov.address, this.gov.address),
        ).to.be.revertedWith('NOT_COVERED');
      });
      it('Invalid protocol (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolUpdate(constants.HashZero, this.gov.address, this.gov.address),
        ).to.be.revertedWith('ZERO_PROTOCOL');
      });
      it('Invalid agent (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolUpdate(this.protocolX, constants.AddressZero, this.gov.address),
        ).to.be.revertedWith('ZERO_AGENT');
      });
      it('Invalid manager (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolUpdate(this.protocolX, this.gov.address, constants.AddressZero),
        ).to.be.revertedWith('ZERO_MANAGER');
      });
      it('Success', async function () {
        await this.sl
          .c(this.gov)
          .protocolUpdate(this.protocolX, this.gov.address, this.gov.address);
      });
    });
    describe('protocolDepositAdd()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.protocolDepositAdd(this.protocolX, [this.tokenA.address]),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl.c(this.gov).protocolDepositAdd(this.nonProtocol2, [this.tokenA.address]),
        ).to.be.revertedWith('NOT_COVERED');
      });
      it('Invalid protocol (zero)', async function () {
        await expect(
          this.sl.c(this.gov).protocolDepositAdd(constants.HashZero, [this.tokenA.address]),
        ).to.be.revertedWith('ZERO_PROTOCOL');
      });
      it('Invalid lengths (zero)', async function () {
        await expect(
          this.sl.c(this.gov).protocolDepositAdd(this.nonProtocol2, []),
        ).to.be.revertedWith('ZERO');
      });
      it('Already added', async function () {
        await expect(
          this.sl.c(this.gov).protocolDepositAdd(this.protocolX, [this.tokenA.address]),
        ).to.be.revertedWith('ALREADY_ADDED');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.c(this.gov).protocolDepositAdd(this.protocolX, [this.tokenB.address]),
        ).to.be.revertedWith('INIT');
      });
    });
    describe('protocolRemove()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.protocolRemove(this.protocolX)).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid protocol', async function () {
        await expect(this.sl.c(this.gov).protocolRemove(this.nonProtocol2)).to.be.revertedWith(
          'NOT_COVERED',
        );
      });
      it('Invalid protocol (zero)', async function () {
        await expect(this.sl.c(this.gov).protocolRemove(constants.HashZero)).to.be.revertedWith(
          'NOT_COVERED',
        );
      });
      it('~ state helper ~', async function () {
        await this.sl
          .c(this.gov)
          .cleanProtocol(this.nonProtocol1, 1, false, this.alice.address, this.tokenA.address);
      });
      it('Success', async function () {
        await this.sl.c(this.gov).protocolRemove(this.nonProtocol1);
      });
    });
    describe('tokenInit()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.tokenInit(this.tokenB.address, this.gov.address, this.lockB.address, true),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid lock', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenInit(this.tokenA.address, this.gov.address, this.lockB.address, true),
        ).to.be.revertedWith('WRONG_LOCK');
      });
      it('Invalid token (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenInit(constants.AddressZero, this.gov.address, this.lockB.address, true),
        ).to.be.revertedWith('ZERO_TOKEN');
      });
      it('Invalid stake (owner)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenInit(this.tokenC.address, this.gov.address, this.lockWGov.address, true),
        ).to.be.revertedWith('OWNER');
      });
      it('Invalid govpool (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenInit(this.tokenB.address, constants.AddressZero, this.lockB.address, true),
        ).to.be.revertedWith('ZERO_GOV');
      });
      it('Invalid supply', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenInit(this.tokenC.address, this.gov.address, this.lockWSupply.address, true),
        ).to.be.revertedWith('SUPPLY');
      });
      it('Invalid underlying', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenInit(this.tokenB.address, this.gov.address, this.lockA.address, true),
        ).to.be.revertedWith('UNDERLYING');
      });
      it('Invalid stakes', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenInit(this.tokenA.address, constants.AddressZero, this.lockA.address, false),
        ).to.be.revertedWith('STAKES_SET');
      });
      it('Invalid premiums', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenInit(this.tokenA.address, constants.AddressZero, constants.AddressZero, true),
        ).to.be.revertedWith('PREMIUMS_SET');
      });
      it('Success', async function () {
        await this.sl
          .c(this.gov)
          .tokenInit(this.tokenB.address, this.gov.address, this.lockB.address, true);
      });
    });
    describe('tokenDisableStakers()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.tokenDisableStakers(this.tokenA.address, 0)).to.be.revertedWith(
          'NOT_GOV_MAIN',
        );
      });
      it('Invalid index', async function () {
        await expect(
          this.sl.c(this.gov).tokenDisableStakers(this.tokenA.address, 1),
        ).to.be.revertedWith('INDEX');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.c(this.gov).tokenDisableStakers(this.tokenC.address, 0),
        ).to.be.revertedWith('INDEX');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).tokenDisableStakers(this.tokenB.address, 1);
      });
    });
    describe('tokenDisableProtocol()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.tokenDisableProtocol(this.tokenA.address, 0)).to.be.revertedWith(
          'NOT_GOV_MAIN',
        );
      });
      it('Invalid index', async function () {
        await expect(
          this.sl.c(this.gov).tokenDisableProtocol(this.tokenA.address, 1),
        ).to.be.revertedWith('INDEX');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.c(this.gov).tokenDisableProtocol(this.tokenC.address, 0),
        ).to.be.revertedWith('INDEX');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).tokenDisableProtocol(this.tokenB.address, 1);
      });
    });
    describe('tokenUnload()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.tokenUnload(this.tokenA.address, this.alice.address, this.gov.address),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenUnload(this.tokenC.address, this.alice.address, this.gov.address),
        ).to.be.revertedWith('EMPTY');
      });
      it('Invalid native', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenUnload(this.tokenA.address, constants.AddressZero, this.alice.address),
        ).to.be.revertedWith('ZERO_NATIVE');
      });
      it('Invalid sherx', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenUnload(this.tokenA.address, this.alice.address, constants.AddressZero),
        ).to.be.revertedWith('ZERO_REMAIN');
      });
      it('Stakes set', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenUnload(this.tokenA.address, this.alice.address, this.alice.address),
        ).to.be.revertedWith('STAKES_SET');
      });
      it('Success', async function () {
        await this.sl
          .c(this.gov)
          .tokenUnload(this.tokenB.address, this.alice.address, this.carol.address);
      });
    });
    describe('tokenRemove()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.tokenRemove(this.tokenA.address)).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid token', async function () {
        await expect(this.sl.c(this.gov).tokenRemove(this.tokenC.address)).to.be.revertedWith(
          'EMPTY',
        );
      });
      it('Invalid token (zero)', async function () {
        await expect(this.sl.c(this.gov).tokenRemove(constants.AddressZero)).to.be.revertedWith(
          'EMPTY',
        );
      });
      it('Not disabled', async function () {
        await expect(this.sl.c(this.gov).tokenRemove(this.tokenA.address)).to.be.revertedWith(
          'STAKES_SET',
        );
      });
      it('Success', async function () {
        await this.sl.c(this.gov).tokenRemove(this.tokenB.address);
      });
    });
  });
  describe('Gov ─ View Methods', function () {
    describe('getGovMain()', function () {});
    describe('getWatsons()', function () {});
    describe('getWatsonsSherXWeight()', function () {});
    describe('getWatsonsSherXPerBlock()', function () {});
    describe('getWatsonsUnmintedSherX()', function () {});
    describe('getUnstakeWindow()', function () {});
    describe('getCooldown()', function () {});
    describe('getTokens()', function () {});
    describe('getProtocolIsCovered()', function () {});
    describe('getProtocolManager()', function () {});
    describe('getProtocolAgent()', function () {});
  });
  describe('GovDev ─ State Changing', function () {
    describe('transferGovDev()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.transferGovDev(this.gov.address)).to.be.revertedWith('NOT_DEV');
      });
      it('Invalid gov (same)', async function () {
        await expect(this.sl.c(this.gov).transferGovDev(this.gov.address)).to.be.revertedWith(
          'SAME_DEV',
        );
      });
    });
    describe('updateSolution()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.updateSolution([], constants.AddressZero, [])).to.be.revertedWith(
          'NOT_DEV',
        );
      });
      it('Success', async function () {
        await this.sl.c(this.gov).updateSolution([], constants.AddressZero, []);
      });
    });
  });
  describe('GovDev ─ View Methods', function () {
    describe('getGovDev()', function () {});
  });
  describe('Manager ─ State Changing', function () {
    describe('setTokenPrice(address,uint256)', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl['setTokenPrice(address,uint256)'](this.tokenA.address, parseEther('1')),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid token (sherx)', async function () {
        await expect(
          this.sl.c(this.gov)['setTokenPrice(address,uint256)'](this.sl.address, parseEther('1')),
        ).to.be.revertedWith('SHERX');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setTokenPrice(address,uint256)'](this.tokenB.address, parseEther('1')),
        ).to.be.revertedWith('WHITELIST');
      });
    });
    describe('setTokenPrice(address[],uint256[])', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl['setTokenPrice(address[],uint256[])']([this.tokenA.address], [parseEther('1')]),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid length', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setTokenPrice(address[],uint256[])'](
              [this.tokenA.address],
              [parseEther('2'), parseEther('1')],
            ),
        ).to.be.revertedWith('LENGTH');
      });
      it('Invalid token (sherx)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setTokenPrice(address[],uint256[])']([this.sl.address], [parseEther('2')]),
        ).to.be.revertedWith('SHERX');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setTokenPrice(address[],uint256[])']([this.tokenB.address], [parseEther('2')]),
        ).to.be.revertedWith('WHITELIST');
      });
    });
    describe('setPPm(bytes32,address,uint256)', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl['setProtocolPremium(bytes32,address,uint256)'](
            this.protocolX,
            this.tokenA.address,
            parseEther('1'),
          ),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32,address,uint256)'](
              this.nonProtocol2,
              this.tokenA.address,
              parseEther('1'),
            ),
        ).to.be.revertedWith('NON_PROTOCOL');
      });
      it('Invalid token (sherx)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32,address,uint256)'](
              this.protocolX,
              this.sl.address,
              parseEther('1'),
            ),
        ).to.be.revertedWith('SHERX');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32,address,uint256)'](
              this.protocolX,
              this.tokenB.address,
              parseEther('1'),
            ),
        ).to.be.revertedWith('WHITELIST');
      });
    });
    describe('setPPm(bytes32,address[],uint256[])', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl['setProtocolPremium(bytes32,address[],uint256[])'](
            this.protocolX,
            [this.tokenA.address],
            [parseEther('1')],
          ),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid length', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32,address[],uint256[])'](
              this.protocolX,
              [this.tokenA.address],
              [parseEther('1'), parseEther('2')],
            ),
        ).to.be.revertedWith('LENGTH');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32,address[],uint256[])'](
              this.nonProtocol2,
              [this.tokenA.address],
              [parseEther('1')],
            ),
        ).to.be.revertedWith('NON_PROTOCOL');
      });
      it('Invalid token (sherx)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32,address[],uint256[])'](
              this.nonProtocol2,
              [this.sl.address],
              [parseEther('1')],
            ),
        ).to.be.revertedWith('SHERX');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32,address[],uint256[])'](
              this.protocolX,
              [this.tokenB.address],
              [parseEther('1')],
            ),
        ).to.be.revertedWith('WHITELIST');
      });
    });
    describe('setPPm(bytes32[],address[][],uint256[][])', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl['setProtocolPremium(bytes32[],address[][],uint256[][])'](
            [this.protocolX],
            [[this.tokenA.address]],
            [[parseEther('1')]],
          ),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid length 1', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32[],address[][],uint256[][])'](
              [this.protocolX],
              [[this.tokenA.address], [this.tokenA.address]],
              [[parseEther('1')]],
            ),
        ).to.be.revertedWith('LENGTH_1');
      });
      it('Invalid length 2', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32[],address[][],uint256[][])'](
              [this.protocolX],
              [[this.tokenA.address]],
              [[parseEther('1')], [parseEther('2')]],
            ),
        ).to.be.revertedWith('LENGTH_2');
      });
      it('Invalid length 3', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32[],address[][],uint256[][])'](
              [this.protocolX],
              [[this.tokenA.address]],
              [[parseEther('1'), parseEther('2')]],
            ),
        ).to.be.revertedWith('LENGTH_3');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32[],address[][],uint256[][])'](
              [this.nonProtocol2],
              [[this.tokenA.address]],
              [[parseEther('1')]],
            ),
        ).to.be.revertedWith('NON_PROTOCOL');
      });
      it('Invalid token (sherx)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32[],address[][],uint256[][])'](
              [this.protocolX],
              [[this.sl.address]],
              [[parseEther('1')]],
            ),
        ).to.be.revertedWith('SHERX');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremium(bytes32[],address[][],uint256[][])'](
              [this.protocolX],
              [[this.tokenB.address]],
              [[parseEther('1')]],
            ),
        ).to.be.revertedWith('WHITELIST');
      });
    });
    describe('setPPmAndTokenPrice(bytes32,address,uint256,uint256)', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
            this.protocolX,
            this.tokenA.address,
            parseEther('1'),
            parseEther('2'),
          ),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
              this.nonProtocol2,
              this.tokenA.address,
              parseEther('1'),
              parseEther('2'),
            ),
        ).to.be.revertedWith('NON_PROTOCOL');
      });
      it('Invalid token (sherx)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
              this.protocolX,
              this.sl.address,
              parseEther('1'),
              parseEther('2'),
            ),
        ).to.be.revertedWith('SHERX');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
              this.protocolX,
              this.tokenB.address,
              parseEther('1'),
              parseEther('2'),
            ),
        ).to.be.revertedWith('WHITELIST');
      });
    });
    describe('setPPmAndTokenPrice(bytes32,address[],uint256[],uint256[])', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address],
            [parseEther('1')],
            [parseEther('10')],
          ),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid length 1', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
              this.protocolX,
              [this.tokenA.address],
              [parseEther('1'), parseEther('2')],
              [parseEther('10')],
            ),
        ).to.be.revertedWith('LENGTH_1');
      });
      it('Invalid length 2', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
              this.protocolX,
              [this.tokenA.address],
              [parseEther('1')],
              [parseEther('10'), parseEther('2')],
            ),
        ).to.be.revertedWith('LENGTH_2');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
              this.nonProtocol2,
              [this.tokenA.address],
              [parseEther('1')],
              [parseEther('10')],
            ),
        ).to.be.revertedWith('NON_PROTOCOL');
      });
      it('Invalid token (sherx)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
              this.protocolX,
              [this.sl.address],
              [parseEther('1')],
              [parseEther('10')],
            ),
        ).to.be.revertedWith('SHERX');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
              this.protocolX,
              [this.tokenB.address],
              [parseEther('1')],
              [parseEther('10')],
            ),
        ).to.be.revertedWith('WHITELIST');
      });
    });
    describe('setPPmAndTokenPrice(bytes32[],address,uint256[],uint256)', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl['setProtocolPremiumAndTokenPrice(bytes32[],address,uint256[],uint256)'](
            [this.protocolX],
            this.tokenA.address,
            [parseEther('1')],
            parseEther('10'),
          ),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid length', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32[],address,uint256[],uint256)'](
              [this.protocolX],
              this.tokenA.address,
              [parseEther('1'), parseEther('2')],
              parseEther('10'),
            ),
        ).to.be.revertedWith('LENGTH');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32[],address,uint256[],uint256)'](
              [this.nonProtocol2],
              this.tokenA.address,
              [parseEther('1')],
              parseEther('10'),
            ),
        ).to.be.revertedWith('NON_PROTOCOL');
      });
      it('Invalid token (sherx)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32[],address,uint256[],uint256)'](
              [this.protocolX],
              this.sl.address,
              [parseEther('1')],
              parseEther('10'),
            ),
        ).to.be.revertedWith('SHERX');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32[],address,uint256[],uint256)'](
              [this.protocolX],
              this.tokenB.address,
              [parseEther('1')],
              parseEther('10'),
            ),
        ).to.be.revertedWith('WHITELIST');
      });
    });
    describe('setPPmAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
            [this.protocolX],
            [[this.tokenA.address]],
            [[parseEther('1')]],
            [[parseEther('10')]],
          ),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid length 1', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
              [this.protocolX],
              [[this.tokenA.address], [this.tokenA.address]],
              [[parseEther('1')]],
              [[parseEther('10')]],
            ),
        ).to.be.revertedWith('LENGTH_1');
      });
      it('Invalid length 2', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
              [this.protocolX],
              [[this.tokenA.address]],
              [[parseEther('1')], [parseEther('1')]],
              [[parseEther('10')]],
            ),
        ).to.be.revertedWith('LENGTH_2');
      });
      it('Invalid length 3', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
              [this.protocolX],
              [[this.tokenA.address]],
              [[parseEther('1')]],
              [[parseEther('10')], [parseEther('10')]],
            ),
        ).to.be.revertedWith('LENGTH_3');
      });
      it('Invalid length 4', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
              [this.protocolX],
              [[this.tokenA.address]],
              [[parseEther('1'), parseEther('1')]],
              [[parseEther('10')]],
            ),
        ).to.be.revertedWith('LENGTH_4');
      });
      it('Invalid length 5', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
              [this.protocolX],
              [[this.tokenA.address]],
              [[parseEther('1')]],
              [[parseEther('10'), parseEther('10')]],
            ),
        ).to.be.revertedWith('LENGTH_5');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
              [this.nonProtocol2],
              [[this.tokenA.address]],
              [[parseEther('1')]],
              [[parseEther('10')]],
            ),
        ).to.be.revertedWith('NON_PROTOCOL');
      });
      it('Invalid token (sherx)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
              [this.protocolX],
              [[this.sl.address]],
              [[parseEther('1')]],
              [[parseEther('10')]],
            ),
        ).to.be.revertedWith('SHERX');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
              [this.protocolX],
              [[this.tokenB.address]],
              [[parseEther('1')]],
              [[parseEther('10')]],
            ),
        ).to.be.revertedWith('WHITELIST');
      });
    });
  });
  describe('Manager ─ View Methods', function () {});
  describe('Payout ─ State Changing', function () {
    describe('setInitialGovPayout()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.setInitialGovPayout(this.gov.address)).to.be.revertedWith('NOT_DEV');
      });
      it('Invalid gov', async function () {
        await expect(
          this.sl.c(this.gov).setInitialGovPayout(constants.AddressZero),
        ).to.be.revertedWith('ZERO_GOV');
      });
      it('Success', async function () {
        await expect(this.sl.c(this.gov).setInitialGovPayout(this.gov.address)).to.be.revertedWith(
          'ALREADY_SET',
        );
      });
    });
    describe('transferGovPayout()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.transferGovPayout(this.gov.address)).to.be.revertedWith(
          'NOT_GOV_MAIN',
        );
      });
      it('Invalid gov', async function () {
        await expect(
          this.sl.c(this.gov).transferGovPayout(constants.AddressZero),
        ).to.be.revertedWith('ZERO_GOV');
      });
      it('Invalid gov (same)', async function () {
        await expect(this.sl.c(this.gov).transferGovPayout(this.gov.address)).to.be.revertedWith(
          'SAME_GOV',
        );
      });
      it('Success', async function () {
        await this.sl.c(this.gov).transferGovPayout(this.alice.address);
        await this.sl.c(this.gov).transferGovPayout(this.gov.address);
      });
    });
    describe('payout()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.payout(this.bob.address, [], [], [], [], this.tokenC.address),
        ).to.be.revertedWith('NOT_GOV_PAY');
      });
      it('Invalid payout (zero)', async function () {
        await expect(
          this.sl.c(this.gov).payout(constants.AddressZero, [], [], [], [], this.tokenC.address),
        ).to.be.revertedWith('ZERO_PAY');
      });
      it('Invalid payout (this)', async function () {
        await expect(
          this.sl.c(this.gov).payout(this.sl.address, [], [], [], [], this.tokenC.address),
        ).to.be.revertedWith('THIS_PAY');
      });
      it('Invalid length 1', async function () {
        await expect(
          this.sl.c(this.gov).payout(this.bob.address, [], [1], [], [], this.tokenC.address),
        ).to.be.revertedWith('LENGTH_1');
      });
      it('Invalid length 2', async function () {
        await expect(
          this.sl.c(this.gov).payout(this.bob.address, [], [], [1], [], this.tokenC.address),
        ).to.be.revertedWith('LENGTH_2');
      });
      it('Invalid length 3', async function () {
        await expect(
          this.sl.c(this.gov).payout(this.bob.address, [], [], [], [1], this.tokenC.address),
        ).to.be.revertedWith('LENGTH_3');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .payout(this.bob.address, [this.tokenB.address], [1], [1], [1], this.tokenC.address),
        ).to.be.revertedWith('INIT');
      });
      it('Success', async function () {
        await this.sl
          .c(this.gov)
          .payout(this.bob.address, [this.tokenA.address], [0], [0], [0], this.tokenC.address);
      });
    });
  });
  describe('Payout ─ View Methods', function () {
    describe('getGovPayout()', function () {
      it('Do', async function () {
        expect(await this.sl.getGovPayout()).to.eq(this.gov.address);
      });
    });
  });
  describe('Pool ─ State Changing', function () {
    describe('setCooldownFee()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.setCooldownFee(Uint32Max, this.tokenA.address)).to.be.revertedWith(
          'NOT_GOV_MAIN',
        );
      });
      it('Invalid fee', async function () {
        await expect(this.sl.c(this.gov).setCooldownFee(Uint32Max.add(1), this.tokenA.address)).to
          .be.reverted;
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.c(this.gov).setCooldownFee(Uint32Max, this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).setCooldownFee(Uint32Max, this.tokenA.address);
      });
    });
    describe('depositProtocolBalance()', function () {
      it('Invalid protocol', async function () {
        await expect(
          this.sl.depositProtocolBalance(this.nonProtocol1, 1, this.tokenA.address),
        ).to.be.revertedWith('PROTOCOL');
      });
      it('Invalid amount', async function () {
        await expect(
          this.sl.depositProtocolBalance(this.protocolX, 0, this.tokenA.address),
        ).to.be.revertedWith('AMOUNT');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.depositProtocolBalance(this.protocolX, 1, this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Invalid token (disabled)', async function () {
        await expect(
          this.sl.depositProtocolBalance(this.protocolX, 1, this.tokenDisable.address),
        ).to.be.revertedWith('NO_DEPOSIT');
      });
      it('Success', async function () {
        await expect(
          this.sl.depositProtocolBalance(this.protocolX, 1, this.tokenA.address),
        ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
      });
    });
    describe('withdrawProtocolBalance()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.withdrawProtocolBalance(this.protocolX, 1, this.bob.address, this.tokenA.address),
        ).to.be.revertedWith('SENDER');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .withdrawProtocolBalance(this.nonProtocol1, 1, this.bob.address, this.tokenA.address),
        ).to.be.revertedWith('SENDER');
      });
      it('Invalid amount', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .withdrawProtocolBalance(this.protocolX, 0, this.bob.address, this.tokenA.address),
        ).to.be.revertedWith('AMOUNT');
      });
      it('Invalid receiver', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .withdrawProtocolBalance(this.protocolX, 1, constants.AddressZero, this.tokenA.address),
        ).to.be.revertedWith('RECEIVER');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .withdrawProtocolBalance(this.protocolX, 1, this.bob.address, constants.AddressZero),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Success', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .withdrawProtocolBalance(this.protocolX, 1, this.bob.address, this.tokenA.address),
        ).to.be.reverted;
      });
    });
    describe('stake()', function () {
      it('Invalid amount', async function () {
        await expect(this.sl.stake(0, this.bob.address, this.tokenA.address)).to.be.revertedWith(
          'AMOUNT',
        );
      });
      it('Invalid receiver', async function () {
        await expect(
          this.sl.stake(1, constants.AddressZero, this.tokenA.address),
        ).to.be.revertedWith('RECEIVER');
      });
      it('Invalid token', async function () {
        await expect(this.sl.stake(1, this.bob.address, this.tokenB.address)).to.be.revertedWith(
          'INVALID_TOKEN',
        );
      });
      it('Invalid token (disabled)', async function () {
        await expect(
          this.sl.stake(1, this.bob.address, this.tokenDisable.address),
        ).to.be.revertedWith('NO_STAKES');
      });
      it('Success', async function () {
        await expect(this.sl.stake(1, this.bob.address, this.tokenA.address)).to.be.reverted;
      });
    });
    describe('activateCooldown()', function () {
      it('Invalid amount', async function () {
        await expect(this.sl.activateCooldown(0, this.tokenA.address)).to.be.revertedWith('AMOUNT');
      });
      it('Invalid token', async function () {
        await expect(this.sl.activateCooldown(1, this.tokenB.address)).to.be.revertedWith(
          'INVALID_TOKEN',
        );
      });
      it('Success', async function () {
        await expect(
          this.sl.activateCooldown(parseEther('1'), this.tokenA.address),
        ).to.be.revertedWith('SafeMath: division by zero');
      });
    });
    describe('cancelCooldown()', function () {
      it('Invalid id', async function () {
        await expect(this.sl.cancelCooldown(0, this.tokenA.address)).to.be.reverted;
      });
      it('Invalid token', async function () {
        await expect(this.sl.cancelCooldown(0, this.tokenB.address)).to.be.revertedWith(
          'INVALID_TOKEN',
        );
      });
      it('Success', async function () {
        await expect(this.sl.cancelCooldown(0, this.tokenA.address)).to.be.reverted;
      });
    });
    describe('unstakeWindowExpiry()', function () {
      it('Invalid account/id', async function () {
        await expect(this.sl.unstakeWindowExpiry(this.alice.address, 0, this.tokenA.address)).to.be
          .reverted;
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.unstakeWindowExpiry(this.alice.address, 0, this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
    });
    describe('unstake()', function () {
      it('Invalid id', async function () {
        await expect(this.sl.unstake(0, this.alice.address, this.tokenA.address)).to.be.reverted;
      });
      it('Invalid receiver', async function () {
        await expect(
          this.sl.unstake(0, constants.AddressZero, this.tokenA.address),
        ).to.be.revertedWith('RECEIVER');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.unstake(0, this.alice.address, this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Success', async function () {
        await expect(this.sl.unstake(0, this.alice.address, this.tokenA.address)).to.be.reverted;
      });
    });
    describe('payOffDebtAll()', function () {
      it('Invalid token', async function () {
        await expect(this.sl.payOffDebtAll(this.tokenB.address)).to.be.revertedWith(
          'INVALID_TOKEN',
        );
      });
      it('Success', async function () {
        await this.sl.payOffDebtAll(this.tokenA.address);
      });
    });
    describe('cleanProtocol()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.cleanProtocol(this.protocolX, 0, false, this.bob.address, this.tokenA.address),
        ).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Invalid receiver', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .cleanProtocol(this.protocolX, 0, false, constants.AddressZero, this.tokenA.address),
        ).to.be.revertedWith('RECEIVER');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .cleanProtocol(this.protocolX, 0, false, this.bob.address, this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Invalid token (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .cleanProtocol(this.protocolX, 0, false, this.bob.address, constants.AddressZero),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Invalid index (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .cleanProtocol(this.protocolY, 0, false, this.bob.address, this.tokenA.address),
        ).to.be.revertedWith('INDEX');
      });
      it('Success', async function () {
        await this.sl
          .c(this.gov)
          .cleanProtocol(this.protocolX, 0, false, this.bob.address, this.tokenA.address);
      });
    });
  });
  describe('Pool ─ View Methods', function () {
    describe('getCooldownFee()', function () {});
    describe('getSherXWeight()', function () {});
    describe('getGovPool()', function () {});
    describe('isInitialized()', function () {});
    describe('isStake()', function () {});
    describe('getProtocolBalance()', function () {});
    describe('getProtocolPremium()', function () {});
    describe('getLockToken()', function () {});
    describe('isProtocol()', function () {});
    describe('getProtocols()', function () {});
    describe('getUnstakeEntry()', function () {});
    describe('getTotalAccruedDebt()', function () {});
    describe('getFirstMoneyOut()', function () {});
    describe('getAccruedDebt()', function () {});
    describe('getTotalPremiumPerBlock()', function () {});
    describe('getPremiumLastPaid()', function () {});
    describe('getSherXUnderlying()', function () {});
    describe('getUnstakeEntrySize()', function () {});
    describe('getInitialUnstakeEntry()', function () {});
    describe('getStakersPoolBalance()', function () {});
    describe('getStakerPoolBalance()', function () {});
    describe('getTotalUnmintedSherX()', function () {});
    describe('getUnallocatedSherXStored()', function () {});
    describe('getUnallocatedSherXTotal()', function () {});
    describe('getUnallocatedSherXFor()', function () {});
    describe('getTotalSherXPerBlock(address)', function () {});
    describe('getSherXPerBlock(address)', function () {});
    describe('getSherXPerBlock(address,address)', function () {});
    describe('getSherXPerBlock(uint256,address)', function () {});
    describe('LockToTokenXRate()', function () {});
    describe('LockToToken()', function () {});
    describe('TokenToLockXRate()', function () {});
    describe('TokenToLock()', function () {});
  });
  describe('ISherX ─ State Changing', function () {
    describe('_beforeTokenTransfer()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl._beforeTokenTransfer(this.alice.address, this.bob.address, 1)).to.be
          .reverted;
      });
    });
    describe('setInitialWeight()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.setInitialWeight()).to.be.revertedWith('NOT_GOV_MAIN');
      });
      it('Success', async function () {
        await expect(this.sl.c(this.gov).setInitialWeight()).to.be.revertedWith('WATS_UNSET');
      });
    });
    describe('setWeights()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.setWeights([this.tokenB.address], [1], 0)).to.be.revertedWith(
          'NOT_GOV_MAIN',
        );
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.c(this.gov).setWeights([this.tokenB.address], [1], 0),
        ).to.be.revertedWith('DISABLED');
      });
      it('Invalid lengths', async function () {
        await expect(this.sl.c(this.gov).setWeights([], [1], 0)).to.be.revertedWith('LENGTH');
      });
      it('Success', async function () {
        await expect(
          this.sl.c(this.gov).setWeights([this.tokenA.address], [parseEther('1')], 0),
        ).to.be.revertedWith('SUM');
      });
    });
    describe('harvest()', function () {
      it('Success', async function () {
        await this.sl['harvest()']();
      });
    });
    describe('harvest(address)', function () {
      it('Success', async function () {
        await this.sl['harvest(address)'](this.lockA.address);
      });
    });
    describe('harvest(address[])', function () {
      it('Success', async function () {
        await this.sl['harvest(address[])']([this.lockA.address, this.lockB.address]);
      });
    });
    describe('harvestFor(address)', function () {
      it('Success', async function () {
        await this.sl['harvestFor(address)'](this.bob.address);
      });
    });
    describe('harvestFor(address,address)', function () {
      it('Success', async function () {
        await this.sl['harvestFor(address,address)'](this.bob.address, this.lockA.address);
      });
    });
    describe('harvestFor(address,address[])', function () {
      it('Success', async function () {
        await this.sl['harvestFor(address,address[])'](this.bob.address, [
          this.lockA.address,
          this.lockB.address,
        ]);
      });
    });
    describe('redeem()', function () {
      it('Invalid amount', async function () {
        await expect(this.sl.redeem(0, this.bob.address)).to.be.revertedWith('AMOUNT');
      });
      it('Invalid receiver', async function () {
        await expect(this.sl.redeem(1, constants.AddressZero)).to.be.revertedWith('RECEIVER');
      });
      it('Success', async function () {
        await expect(this.sl.redeem(1, this.bob.address)).to.be.revertedWith(
          'SafeMath: subtraction overflow',
        );
      });
    });
  });
  describe('ISherX ─ View Methods', function () {
    describe('getTotalUsdPerBlock()', function () {});
    describe('getTotalUsdPoolStored()', function () {});
    describe('getTotalUsdPool()', function () {});
    describe('getTotalUsdLastSettled()', function () {});
    describe('getStoredUsd()', function () {});
    describe('getTotalSherXUnminted()', function () {});
    describe('getTotalSherX()', function () {});
    describe('getSherXPerBlock()', function () {});
    describe('getSherXLastAccrued()', function () {});
    describe('getSherXBalance()', function () {});
    describe('getSherXBalance()', function () {});
    describe('calcUnderlying()', function () {});
    describe('calcUnderlying(uint256)', function () {});
    describe('calcUnderlying(address)', function () {});
    describe('calcUnderlyingInStoredUSD()', function () {});
    describe('calcUnderlyingInStoredUSD(uint256)', function () {});
  });
  describe('ISherXERC20 ─ State Changing', function () {
    describe('initializeSherXERC20()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.initializeSherXERC20('SHERX', 'SHR')).to.be.revertedWith('NOT_DEV');
      });
      it('Invalid name', async function () {
        await expect(this.sl.c(this.gov).initializeSherXERC20('', 'SHR')).to.be.revertedWith(
          'NAME',
        );
      });
      it('Invalid symbol', async function () {
        await expect(this.sl.c(this.gov).initializeSherXERC20('SHERX', '')).to.be.revertedWith(
          'SYMBOL',
        );
      });
      it('Success', async function () {
        await this.sl.c(this.gov).initializeSherXERC20('SHERX', 'SHR');
      });
    });
    describe('increaseApproval()', function () {
      it('Invalid spender', async function () {
        await expect(
          this.sl.c(this.gov).increaseApproval(constants.AddressZero, 1),
        ).to.be.revertedWith('SPENDER');
      });
      it('Invalid amount', async function () {
        await expect(
          this.sl.c(this.gov).increaseApproval(this.alice.address, 0),
        ).to.be.revertedWith('AMOUNT');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).increaseApproval(this.alice.address, 1);
      });
    });
    describe('decreaseApproval()', function () {
      it('Invalid spender', async function () {
        await expect(
          this.sl.c(this.gov).decreaseApproval(constants.AddressZero, 1),
        ).to.be.revertedWith('SPENDER');
      });
      it('Invalid amount', async function () {
        await expect(
          this.sl.c(this.gov).decreaseApproval(this.alice.address, 0),
        ).to.be.revertedWith('AMOUNT');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).decreaseApproval(this.alice.address, 1);
      });
    });
    describe('approve()', function () {
      it('Invalid spender', async function () {
        await expect(this.sl.approve(constants.AddressZero, 1)).to.be.revertedWith('SPENDER');
      });
    });
    describe('transfer()', function () {});
    describe('transferFrom()', function () {
      it('Invalid from', async function () {
        await expect(
          this.sl.transferFrom(constants.AddressZero, constants.AddressZero, 0),
        ).to.be.revertedWith('FROM');
      });
    });
  });
  describe('ISherXERC20 ─ View Methods', function () {
    describe('name()', function () {});
    describe('symbol()', function () {});
    describe('decimals()', function () {});
  });
  describe('PoolStrategy ─ State Changing', function () {
    describe('strategyRemove()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.strategyRemove(this.tokenA.address)).to.be.revertedWith('GOV');
      });
      it('Invalid token', async function () {
        await expect(this.sl.strategyRemove(this.tokenB.address)).to.be.revertedWith(
          'INVALID_TOKEN',
        );
      });
    });
    describe('strategyUpdate()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.strategyUpdate(this.strategyMockA.address, this.tokenA.address),
        ).to.be.revertedWith('GOV');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.strategyUpdate(this.strategyMockA.address, this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Invalid strategy', async function () {
        await expect(
          this.sl.strategyUpdate(this.strategyMockB.address, this.tokenA.address),
        ).to.be.revertedWith('WANT');
      });
    });
    describe('strategyDeposit()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.strategyDeposit(parseEther('1'), this.tokenA.address),
        ).to.be.revertedWith('GOV');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.strategyDeposit(parseEther('1'), this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Invalid amount', async function () {
        await expect(this.sl.strategyDeposit(0, this.tokenA.address)).to.be.revertedWith('AMOUNT');
      });
      it('No strategy', async function () {
        await expect(
          this.sl.c(this.gov).strategyDeposit(parseEther('1'), this.tokenA.address),
        ).to.be.revertedWith('STRATEGY');
      });
    });
    describe('strategyWithdraw()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.strategyWithdraw(parseEther('1'), this.tokenA.address),
        ).to.be.revertedWith('GOV');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.strategyWithdraw(parseEther('1'), this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Invalid amount', async function () {
        await expect(this.sl.strategyWithdraw(0, this.tokenA.address)).to.be.revertedWith('AMOUNT');
      });
      it('No strategy', async function () {
        await expect(
          this.sl.c(this.gov).strategyWithdraw(parseEther('1'), this.tokenA.address),
        ).to.be.revertedWith('STRATEGY');
      });
    });
    describe('strategyWithdrawAll()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.strategyWithdrawAll(this.tokenA.address)).to.be.revertedWith('GOV');
      });
      it('Invalid token', async function () {
        await expect(this.sl.strategyWithdrawAll(this.tokenB.address)).to.be.revertedWith(
          'INVALID_TOKEN',
        );
      });
      it('No strategy', async function () {
        await expect(
          this.sl.c(this.gov).strategyWithdrawAll(this.tokenA.address),
        ).to.be.revertedWith('STRATEGY');
      });
    });
  });
  describe('PoolStrategy ─ View Methods', function () {
    describe('getStrategy()', function () {});
  });
});
