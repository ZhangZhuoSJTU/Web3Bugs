import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {expect, use} from 'chai';

import {ethers} from 'hardhat';
import {
  L1Migrator,
  L1Migrator__factory,
  IL2Migrator__factory,
} from '../../../typechain';
import {FakeContract, smock} from '@defi-wonderland/smock';

use(smock.matchers);

describe('L1Migrator', function() {
  let l1Migrator: L1Migrator;

  let l1EOA: SignerWithAddress;
  let notL1EOA: SignerWithAddress;
  let governor: SignerWithAddress;
  let owner: SignerWithAddress;

  // mocks
  let inboxMock: FakeContract;
  let outboxMock: FakeContract;
  let bridgeMock: FakeContract;
  let bondingManagerMock: FakeContract;
  let ticketBrokerMock: FakeContract;
  let bridgeMinterMock: FakeContract;
  let tokenMock: FakeContract;
  let l1LPTGatewayMock: FakeContract;
  let mockInboxEOA: SignerWithAddress;
  let mockOutboxEOA: SignerWithAddress;
  let mockBridgeEOA: SignerWithAddress;
  let mockBondingManagerEOA: SignerWithAddress;
  let mockTicketBrokerEOA: SignerWithAddress;
  let mockL2MigratorEOA: SignerWithAddress;
  let mockBridgeMinterEOA: SignerWithAddress;
  let mockTokenEOA: SignerWithAddress;
  let mockL1LPTGatewayEOA: SignerWithAddress;

  const ADMIN_ROLE =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  const GOVERNOR_ROLE = ethers.utils.solidityKeccak256(
      ['string'],
      ['GOVERNOR_ROLE'],
  );

  class L1MigratorSigner {
    signer: SignerWithAddress;
    l1Migrator: string;
    chainId: number;

    constructor(
        signer: SignerWithAddress,
        l1Migrator: string,
        chainId: number,
    ) {
      this.signer = signer;
      this.l1Migrator = l1Migrator;
      this.chainId = chainId;
    }

    signMigrateDelegator(l1Addr: string, l2Addr: string): Promise<string> {
      const types = {
        MigrateDelegator: [
          {name: 'l1Addr', type: 'address'},
          {name: 'l2Addr', type: 'address'},
        ],
      };

      return this.signer._signTypedData(this.domain(), types, {
        l1Addr,
        l2Addr,
      });
    }

    signMigrateUnbondingLocks(
        l1Addr: string,
        l2Addr: string,
        unbondingLockIds: number[],
    ) {
      const types = {
        MigrateUnbondingLocks: [
          {name: 'l1Addr', type: 'address'},
          {name: 'l2Addr', type: 'address'},
          {name: 'unbondingLockIds', type: 'uint256[]'},
        ],
      };

      return this.signer._signTypedData(this.domain(), types, {
        l1Addr,
        l2Addr,
        unbondingLockIds,
      });
    }

    signMigrateSender(l1Addr: string, l2Addr: string): Promise<string> {
      const types = {
        MigrateSender: [
          {name: 'l1Addr', type: 'address'},
          {name: 'l2Addr', type: 'address'},
        ],
      };

      return this.signer._signTypedData(this.domain(), types, {
        l1Addr,
        l2Addr,
      });
    }

    domain(): any {
      return {
        name: 'Livepeer L1Migrator',
        version: '1',
        chainId: this.chainId,
        verifyingContract: this.l1Migrator,
      };
    }
  }

  beforeEach(async function() {
    [
      owner,
      governor,
      l1EOA,
      notL1EOA,
      mockInboxEOA,
      mockOutboxEOA,
      mockBridgeEOA,
      mockBondingManagerEOA,
      mockTicketBrokerEOA,
      mockL2MigratorEOA,
      mockBridgeMinterEOA,
      mockTokenEOA,
      mockL1LPTGatewayEOA,
    ] = await ethers.getSigners();

    const L1Migrator: L1Migrator__factory = await ethers.getContractFactory(
        'L1Migrator',
    );
    l1Migrator = await L1Migrator.deploy(
        mockInboxEOA.address,
        mockBondingManagerEOA.address,
        mockTicketBrokerEOA.address,
        mockBridgeMinterEOA.address,
        mockTokenEOA.address,
        mockL1LPTGatewayEOA.address,
        mockL2MigratorEOA.address,
    );
    await l1Migrator.deployed();

    await l1Migrator.grantRole(GOVERNOR_ROLE, governor.address);

    inboxMock = await smock.fake('IInbox', {
      address: mockInboxEOA.address,
    });

    outboxMock = await smock.fake('IOutbox', {
      address: mockOutboxEOA.address,
    });

    bridgeMock = await smock.fake('IBridge', {
      address: mockBridgeEOA.address,
    });

    bondingManagerMock = await smock.fake(
        'contracts/L1/gateway/L1Migrator.sol:IBondingManager',
        {
          address: mockBondingManagerEOA.address,
        },
    );

    ticketBrokerMock = await smock.fake(
        'contracts/L1/gateway/L1Migrator.sol:ITicketBroker',
        {
          address: mockTicketBrokerEOA.address,
        },
    );

    bridgeMinterMock = await smock.fake('IBridgeMinter', {
      address: mockBridgeMinterEOA.address,
    });

    tokenMock = await smock.fake(
        'contracts/L1/gateway/L1Migrator.sol:ApproveLike',
        {
          address: mockTokenEOA.address,
        },
    );

    l1LPTGatewayMock = await smock.fake('IL1LPTGateway', {
      address: mockL1LPTGatewayEOA.address,
    });

    inboxMock.bridge.returns(bridgeMock.address);
    bridgeMock.activeOutbox.returns(outboxMock.address);
  });

  describe('constructor', () => {
    it('sets addresses', async () => {
      const inboxAddr = await l1Migrator.inbox();
      expect(inboxAddr).to.equal(mockInboxEOA.address);

      const bondingManagerAddr = await l1Migrator.bondingManagerAddr();
      expect(bondingManagerAddr).to.equal(mockBondingManagerEOA.address);

      const ticketBrokerAddr = await l1Migrator.ticketBrokerAddr();
      expect(ticketBrokerAddr).to.equal(mockTicketBrokerEOA.address);

      const l2MigratorAddr = await l1Migrator.l2MigratorAddr();
      expect(l2MigratorAddr).to.equal(mockL2MigratorEOA.address);

      const initialPaused = await l1Migrator.paused();
      expect(initialPaused).to.be.true;
    });
  });

  describe('AccessControl', async function() {
    describe('add governor', async function() {
      describe('caller is not admin', async function() {
        it('should not be able to set governor', async function() {
          const tx = l1Migrator
              .connect(l1EOA)
              .grantRole(GOVERNOR_ROLE, governor.address);

          await expect(tx).to.be.revertedWith(
              // eslint-disable-next-line
            `AccessControl: account ${l1EOA.address.toLowerCase()} is missing role ${ADMIN_ROLE}`
          );
        });
      });

      describe('caller is admin', async function() {
        it('should set governor', async function() {
          await l1Migrator
              .connect(owner)
              .grantRole(GOVERNOR_ROLE, governor.address);

          const hasControllerRole = await l1Migrator.hasRole(
              GOVERNOR_ROLE,
              governor.address,
          );
          expect(hasControllerRole).to.be.true;
        });
      });
    });

    describe('unpause', async function() {
      describe('caller is not governor', async function() {
        it('should not be able to unpause system', async function() {
          const tx = l1Migrator.unpause();

          await expect(tx).to.be.revertedWith(
              // eslint-disable-next-line
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${GOVERNOR_ROLE}`
          );
        });
      });

      describe('caller is governor', async function() {
        it('should unpause system', async function() {
          await l1Migrator.connect(governor).unpause();

          const isPaused = await l1Migrator.paused();
          expect(isPaused).to.be.false;
        });
      });
    });

    describe('pause', async function() {
      beforeEach(async function() {
        await l1Migrator.connect(governor).unpause();
      });

      describe('caller is not governor', async function() {
        it('should not be able to pause system', async function() {
          const tx = l1Migrator.connect(owner).pause();

          await expect(tx).to.be.revertedWith(
              // eslint-disable-next-line
            `AccessControl: account ${owner.address.toLowerCase()} is missing role ${GOVERNOR_ROLE}`
          );
        });
      });

      describe('caller is governor', async function() {
        it('should pause system', async function() {
          await l1Migrator.connect(governor).pause();

          const isPaused = await l1Migrator.paused();
          expect(isPaused).to.be.true;
        });
      });
    });
  });

  describe('migrateDelegator', () => {
    describe('migrator is paused', () => {
      it('reverts tx', async () => {
        const tx = l1Migrator
            .connect(l1EOA)
            .migrateDelegator(
                l1EOA.address,
                ethers.constants.AddressZero,
                '0x',
                0,
                0,
                0,
                {
                  value: ethers.utils.parseEther('1'),
                },
            );
        await expect(tx).to.be.revertedWith('Pausable: paused');
      });
    });

    describe('migrator is unpaused', () => {
      beforeEach(async function() {
        await l1Migrator.connect(governor).unpause();
      });

      it('reverts for null l2Addr', async () => {
        const tx = l1Migrator
            .connect(l1EOA)
            .migrateDelegator(
                l1EOA.address,
                ethers.constants.AddressZero,
                '0x',
                0,
                0,
                0,
                {
                  value: ethers.utils.parseEther('1'),
                },
            );
        await expect(tx).to.be.revertedWith(
            'L1Migrator#requireValidMigration: INVALID_L2_ADDR',
        );
      });

      it('reverts for failed auth', async () => {
        // Invalid msg.sender + invalid non-null signature
        const sig = await notL1EOA.signMessage('foo');
        let tx = l1Migrator
            .connect(notL1EOA)
            .migrateDelegator(l1EOA.address, l1EOA.address, sig, 0, 0, 0, {
              value: ethers.utils.parseEther('1'),
            });
        await expect(tx).to.be.revertedWith(
            'L1Migrator#requireValidMigration: FAIL_AUTH',
        );

        // Invalid msg.sender + null signature
        tx = l1Migrator
            .connect(notL1EOA)
            .migrateDelegator(l1EOA.address, l1EOA.address, '0x', 0, 0, 0, {
              value: ethers.utils.parseEther('1'),
            });
        await expect(tx).to.be.revertedWith(
            'L1Migrator#requireValidMigration: FAIL_AUTH',
        );
      });

      it('does not revert for successful auth', async () => {
        // Valid msg.sender
        let tx = l1Migrator
            .connect(l1EOA)
            .migrateDelegator(l1EOA.address, l1EOA.address, '0x', 0, 0, 0, {
              value: ethers.utils.parseEther('1'),
            });
        await expect(tx).to.not.reverted;

        // Invalid msg.sender + valid signature
        const network = await ethers.provider.getNetwork();
        const l1MigratorSigner = new L1MigratorSigner(
            l1EOA,
            l1Migrator.address,
            network.chainId,
        );
        const sig = await l1MigratorSigner.signMigrateDelegator(
            l1EOA.address,
            l1EOA.address,
        );
        tx = l1Migrator
            .connect(notL1EOA)
            .migrateDelegator(l1EOA.address, l1EOA.address, sig, 0, 0, 0, {
              value: ethers.utils.parseEther('1'),
            });
        await expect(tx).to.not.reverted;
      });

      it('reads BondingManager state and creates a retryable ticket', async () => {
        const seqNo = 7;
        const stake = 100;
        const fees = 200;
        const delegatedStake = 300;
        const delegate = notL1EOA.address;

        inboxMock.createRetryableTicket.returns(seqNo);
        bondingManagerMock.pendingStake.returns(stake);
        bondingManagerMock.pendingFees.returns(fees);
        bondingManagerMock.getDelegator.returns([
          0,
          0,
          delegate,
          delegatedStake,
          0,
          0,
          0,
        ]);

        const maxGas = 111;
        const gasPriceBid = 222;
        const maxSubmissionCost = 333;

        // createRetryableTicket()
        const migrateDelegatorParams = {
          l1Addr: l1EOA.address,
          l2Addr: l1EOA.address,
          stake,
          delegatedStake,
          fees,
          delegate,
        };
        const l2Calldata =
          IL2Migrator__factory.createInterface().encodeFunctionData(
              'finalizeMigrateDelegator',
              [migrateDelegatorParams],
          );

        const tx = await l1Migrator
            .connect(l1EOA)
            .migrateDelegator(
                l1EOA.address,
                l1EOA.address,
                '0x',
                maxGas,
                gasPriceBid,
                maxSubmissionCost,
                {
                  value: maxSubmissionCost + maxGas * gasPriceBid,
                },
            );

        expect(inboxMock.createRetryableTicket).to.be.calledOnceWith(
            mockL2MigratorEOA.address,
            0,
            maxSubmissionCost,
            l1EOA.address,
            l1EOA.address,
            maxGas,
            gasPriceBid,
            l2Calldata,
        );

        // MigrateDelegatorInitiated Event
        await expect(tx).to.emit(l1Migrator, 'MigrateDelegatorInitiated');
        // The assertion below does not work until https://github.com/EthWorks/Waffle/issues/245 is fixed
        // .withArgs(seqNo, migrateDelegatorParams)
      });
    });
  });

  describe('migrateUnbondingLocks', () => {
    describe('migrator is paused', () => {
      it('reverts tx', async () => {
        const tx = l1Migrator
            .connect(l1EOA)
            .migrateUnbondingLocks(
                l1EOA.address,
                ethers.constants.AddressZero,
                [],
                '0x',
                0,
                0,
                0,
                {
                  value: ethers.utils.parseEther('1'),
                },
            );
        await expect(tx).to.be.revertedWith('Pausable: paused');
      });
    });

    describe('migrator is unpaused', () => {
      beforeEach(async function() {
        await l1Migrator.connect(governor).unpause();
      });

      it('reverts for failed auth', async () => {
        // Invalid msg.sender + invalid non-null signature
        const sig = await notL1EOA.signMessage('foo');
        let tx = l1Migrator
            .connect(notL1EOA)
            .migrateUnbondingLocks(
                l1EOA.address,
                l1EOA.address,
                [],
                sig,
                0,
                0,
                0,
                {
                  value: ethers.utils.parseEther('1'),
                },
            );
        await expect(tx).to.be.revertedWith(
            'L1Migrator#requireValidMigration: FAIL_AUTH',
        );

        // Invalid msg.sender + null signature
        tx = l1Migrator
            .connect(notL1EOA)
            .migrateUnbondingLocks(
                l1EOA.address,
                l1EOA.address,
                [],
                '0x',
                0,
                0,
                0,
                {
                  value: ethers.utils.parseEther('1'),
                },
            );
        await expect(tx).to.be.revertedWith(
            'L1Migrator#requireValidMigration: FAIL_AUTH',
        );
      });

      it('does not revert for successful auth', async () => {
        // Valid msg.sender
        let tx = l1Migrator
            .connect(l1EOA)
            .migrateUnbondingLocks(
                l1EOA.address,
                l1EOA.address,
                [],
                '0x',
                0,
                0,
                0,
                {
                  value: ethers.utils.parseEther('1'),
                },
            );
        await expect(tx).to.not.reverted;

        // Invalid msg.sender + valid signature
        const network = await ethers.provider.getNetwork();
        const l1MigratorSigner = new L1MigratorSigner(
            l1EOA,
            l1Migrator.address,
            network.chainId,
        );
        const sig = await l1MigratorSigner.signMigrateUnbondingLocks(
            l1EOA.address,
            l1EOA.address,
            [1, 2],
        );
        tx = l1Migrator
            .connect(notL1EOA)
            .migrateUnbondingLocks(
                l1EOA.address,
                l1EOA.address,
                [1, 2],
                sig,
                0,
                0,
                0,
            );
        // await tx
        await expect(tx).to.not.reverted;
      });

      it('reads BondingManager state and creates a retryable ticket', async () => {
        const seqNo = 7;
        const unbondingLockIds = [1, 2];
        const lock1Amount = 100;
        const lock2Amount = 200;
        const delegate = notL1EOA.address;

        inboxMock.createRetryableTicket.returns(seqNo);
        bondingManagerMock.getDelegatorUnbondingLock
            .whenCalledWith(l1EOA.address, 1)
            .returns([lock1Amount, 0]);
        bondingManagerMock.getDelegatorUnbondingLock
            .whenCalledWith(l1EOA.address, 2)
            .returns([lock2Amount, 0]);
        bondingManagerMock.getDelegator.returns([0, 0, delegate, 0, 0, 0, 0]);

        const maxGas = 111;
        const gasPriceBid = 222;
        const maxSubmissionCost = 333;

        // createRetryableTicket()
        const migrateUnbondingLocksParams = {
          l1Addr: l1EOA.address,
          l2Addr: l1EOA.address,
          total: lock1Amount + lock2Amount,
          unbondingLockIds,
          delegate,
        };
        const l2Calldata =
          IL2Migrator__factory.createInterface().encodeFunctionData(
              'finalizeMigrateUnbondingLocks',
              [migrateUnbondingLocksParams],
          );

        const tx = await l1Migrator
            .connect(l1EOA)
            .migrateUnbondingLocks(
                l1EOA.address,
                l1EOA.address,
                unbondingLockIds,
                '0x',
                maxGas,
                gasPriceBid,
                maxSubmissionCost,
                {
                  value: maxSubmissionCost + maxGas * gasPriceBid,
                },
            );

        expect(inboxMock.createRetryableTicket).to.be.calledOnceWith(
            mockL2MigratorEOA.address,
            0,
            maxSubmissionCost,
            l1EOA.address,
            l1EOA.address,
            maxGas,
            gasPriceBid,
            l2Calldata,
        );

        // MigrateUnbondingLocksInitiated Event
        await expect(tx).to.emit(l1Migrator, 'MigrateUnbondingLocksInitiated');
        // The assertion below does not work until https://github.com/EthWorks/Waffle/issues/245 is fixed
        // .withArgs(seqNo, migrateUnbondingLocksParams)
      });
    });
  });

  describe('migrateSender', () => {
    describe('migrator is paused', () => {
      it('reverts tx', async () => {
        const tx = l1Migrator
            .connect(l1EOA)
            .migrateSender(
                l1EOA.address,
                ethers.constants.AddressZero,
                '0x',
                0,
                0,
                0,
                {
                  value: ethers.utils.parseEther('1'),
                },
            );
        await expect(tx).to.be.revertedWith('Pausable: paused');
      });
    });

    describe('migrator is unpaused', () => {
      beforeEach(async function() {
        await l1Migrator.connect(governor).unpause();
      });

      it('reverts for null l2Addr', async () => {
        const tx = l1Migrator
            .connect(l1EOA)
            .migrateSender(
                l1EOA.address,
                ethers.constants.AddressZero,
                '0x',
                0,
                0,
                0,
                {
                  value: ethers.utils.parseEther('1'),
                },
            );
        await expect(tx).to.be.revertedWith(
            'L1Migrator#requireValidMigration: INVALID_L2_ADDR',
        );
      });

      it('reverts for failed auth', async () => {
        // Invalid msg.sender + invalid non-null signature
        const sig = await notL1EOA.signMessage('foo');
        let tx = l1Migrator
            .connect(notL1EOA)
            .migrateSender(l1EOA.address, l1EOA.address, sig, 0, 0, 0, {
              value: ethers.utils.parseEther('1'),
            });
        await expect(tx).to.be.revertedWith(
            'L1Migrator#requireValidMigration: FAIL_AUTH',
        );

        // Invalid msg.sender + null signature
        tx = l1Migrator
            .connect(notL1EOA)
            .migrateSender(l1EOA.address, l1EOA.address, '0x', 0, 0, 0, {
              value: ethers.utils.parseEther('1'),
            });
        await expect(tx).to.be.revertedWith(
            'L1Migrator#requireValidMigration: FAIL_AUTH',
        );
      });

      it('does not revert for successful auth', async () => {
        // Valid msg.sender
        let tx = l1Migrator
            .connect(l1EOA)
            .migrateSender(l1EOA.address, l1EOA.address, '0x', 0, 0, 0, {
              value: ethers.utils.parseEther('1'),
            });
        await expect(tx).to.not.reverted;

        // Invalid msg.sender + valid signature
        const network = await ethers.provider.getNetwork();
        const l1MigratorSigner = new L1MigratorSigner(
            l1EOA,
            l1Migrator.address,
            network.chainId,
        );
        const sig = await l1MigratorSigner.signMigrateSender(
            l1EOA.address,
            l1EOA.address,
        );
        tx = l1Migrator
            .connect(notL1EOA)
            .migrateSender(l1EOA.address, l1EOA.address, sig, 0, 0, 0, {
              value: ethers.utils.parseEther('1'),
            });
        await expect(tx).to.not.reverted;
      });

      it('reads TicketBroker state and creates a retryable ticket', async () => {
        const seqNo = 7;
        const deposit = 100;
        const reserve = 200;

        inboxMock.createRetryableTicket.returns(seqNo);
        ticketBrokerMock.getSenderInfo.returns([
          {
            deposit,
            withdrawRound: 0,
          },
          {
            fundsRemaining: reserve,
            claimedInCurrentRound: 0,
          },
        ]);

        const maxGas = 111;
        const gasPriceBid = 222;
        const maxSubmissionCost = 333;

        // createRetryableTicket()
        const migrateSenderParams = {
          l1Addr: l1EOA.address,
          l2Addr: l1EOA.address,
          deposit,
          reserve,
        };
        const l2Calldata =
          IL2Migrator__factory.createInterface().encodeFunctionData(
              'finalizeMigrateSender',
              [migrateSenderParams],
          );

        const tx = await l1Migrator
            .connect(l1EOA)
            .migrateSender(
                l1EOA.address,
                l1EOA.address,
                '0x',
                maxGas,
                gasPriceBid,
                maxSubmissionCost,
                {
                  value: maxSubmissionCost + maxGas * gasPriceBid,
                },
            );

        expect(inboxMock.createRetryableTicket).to.be.calledOnceWith(
            mockL2MigratorEOA.address,
            0,
            maxSubmissionCost,
            l1EOA.address,
            l1EOA.address,
            maxGas,
            gasPriceBid,
            l2Calldata,
        );

        // MigrateSenderInitiated Event
        await expect(tx).to.emit(l1Migrator, 'MigrateSenderInitiated');
        // The assertion below does not work until https://github.com/EthWorks/Waffle/issues/245 is fixed
        // .withArgs(seqNo, migrateSenderParams)
      });
    });
  });

  describe('migrateETH', () => {
    describe('migrator is paused', () => {
      it('fails to send tx to L2', async () => {
        const amount = 200;
        const seqNo = 7;

        bridgeMinterMock.withdrawETHToL1Migrator.returns(amount);
        inboxMock.createRetryableTicket.returns(seqNo);

        const maxGas = 111;
        const gasPriceBid = 222;
        const maxSubmissionCost = 333;

        const l1CallValue = 300;
        const tx = l1Migrator
            .connect(l1EOA)
            .migrateETH(maxGas, gasPriceBid, maxSubmissionCost, {
              value: l1CallValue,
            });

        await expect(tx).to.be.revertedWith('Pausable: paused');
      });
    });

    describe('migrator is unpaused', () => {
      beforeEach(async function() {
        await l1Migrator.connect(governor).unpause();
      });

      it('withdraws from BridgeMinter and sends tx to L2', async () => {
        const amount = 200;
        const seqNo = 7;

        bridgeMinterMock.withdrawETHToL1Migrator.returns(amount);
        inboxMock.createRetryableTicket.returns(seqNo);

        const maxGas = 111;
        const gasPriceBid = 222;
        const maxSubmissionCost = 333;

        const l1CallValue = 300;
        const tx = await l1Migrator
            .connect(l1EOA)
            .migrateETH(maxGas, gasPriceBid, maxSubmissionCost, {
              value: l1CallValue,
            });

        expect(bridgeMinterMock.withdrawETHToL1Migrator).to.be.calledOnce;
        expect(inboxMock.createRetryableTicket).to.be.calledOnceWith(
            mockL2MigratorEOA.address,
            amount,
            maxSubmissionCost,
            l1Migrator.address,
            l1Migrator.address,
            maxGas,
            gasPriceBid,
            '0x',
        );

        await expect(tx)
            .to.emit(l1Migrator, 'TxToL2')
            .withArgs(l1Migrator.address, mockL2MigratorEOA.address, seqNo, '0x');
      });
    });
  });

  describe('migrateLPT', () => {
    describe('migrator is paused', () => {
      it('fails to send tx to L2', async () => {
        const amount = 200;
        const seqNo = 7;

        bridgeMinterMock.withdrawETHToL1Migrator.returns(amount);
        inboxMock.createRetryableTicket.returns(seqNo);

        const maxGas = 111;
        const gasPriceBid = 222;
        const maxSubmissionCost = 333;

        const l1CallValue = 300;
        const tx = l1Migrator
            .connect(l1EOA)
            .migrateLPT(maxGas, gasPriceBid, maxSubmissionCost, {
              value: l1CallValue,
            });

        await expect(tx).to.be.revertedWith('Pausable: paused');
      });
    });

    describe('migrator is unpaused', () => {
      beforeEach(async function() {
        await l1Migrator.connect(governor).unpause();
      });

      it('withdraws from BridgeMinter and calls outboundTransfer() on L1LPTGateway', async () => {
        const amount = 200;
        const seqNo = 7;

        bridgeMinterMock.withdrawLPTToL1Migrator.returns(amount);
        inboxMock.createRetryableTicket.returns(seqNo);

        const maxGas = 111;
        const gasPriceBid = 222;
        const maxSubmissionCost = 333;

        const l1CallValue = 300;
        const tx = await l1Migrator
            .connect(l1EOA)
            .migrateLPT(maxGas, gasPriceBid, maxSubmissionCost, {
              value: l1CallValue,
            });

        expect(bridgeMinterMock.withdrawLPTToL1Migrator).to.be.calledOnce;
        expect(tokenMock.approve).to.be.calledOnceWith(
            mockL1LPTGatewayEOA.address,
            amount,
        );

        const encodedData = ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'bytes'],
            [maxSubmissionCost, '0x'],
        );
        expect(l1LPTGatewayMock.outboundTransfer).to.be.calledOnceWith(
            mockTokenEOA.address,
            mockL2MigratorEOA.address,
            amount,
            maxGas,
            gasPriceBid,
            encodedData,
        );
        // Check if the mock L1LPTGateway received the msg.value from migrateLPT()
        // This confirms that the msg.value is forwarded to the outboundTransfer() call
        await expect(tx).to.changeEtherBalance(
            mockL1LPTGatewayEOA,
            l1CallValue,
        );
      });
    });
  });
});
