import {FakeContract, smock} from '@defi-wonderland/smock';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signers';
import {expect, use} from 'chai';

import {ethers} from 'hardhat';
import {DelegatorPool, DelegatorPool__factory} from '../../../typechain';

use(smock.matchers);

describe('DelegatorPool', function() {
  let delegatorPool: DelegatorPool;

  let bondingManagerMock: FakeContract;

  let delegator: SignerWithAddress;
  let delegator1: SignerWithAddress;
  let delegator2: SignerWithAddress;
  let mockL2MigratorEOA: SignerWithAddress;
  let mockBondingManagerEOA: SignerWithAddress;

  class StakeAndFees {
    public claimedStake = 0;
    public pendingStake;
    public pendingFees;

    public sequence = 0;

    constructor(
      public readonly initialStake: number,
      public readonly initialFees: number,
    ) {
      this.pendingStake = initialStake;
      this.pendingFees = initialFees;
    }

    calculateClaim(stake: number) {
      const owedStake =
        (this.pendingStake * stake) / (this.initialStake - this.claimedStake);

      const owedFees =
        (this.pendingFees * stake) / (this.initialStake - this.claimedStake);

      return {
        owedStake,
        owedFees,
      };
    }

    updateStakeAndFees(stake: number, fees: number) {
      this.pendingStake += stake;
      this.pendingFees += fees;
    }

    async createTx(caller: SignerWithAddress, stake: number) {
      const {owedStake, owedFees} = this.calculateClaim(stake);

      bondingManagerMock.pendingStake.returns(this.pendingStake);
      bondingManagerMock.pendingFees.returns(this.pendingFees);

      const tx = await delegatorPool
          .connect(mockL2MigratorEOA)
          .claim(caller.address, stake);

      this.claimedStake += stake;

      this.pendingStake -= owedStake;
      this.pendingFees -= owedFees;

      return {tx, seq: this.sequence++, owedStake, owedFees};
    }

    async testClaim(caller: SignerWithAddress, stake: number) {
      const {tx, seq, owedStake, owedFees} = await this.createTx(
          caller,
          stake,
      );

      expect(bondingManagerMock.withdrawFees.atCall(seq)).to.be.calledWith(
          caller.address,
          owedFees,
      );

      expect(bondingManagerMock.transferBond.atCall(seq)).to.be.calledWith(
          caller.address,
          owedStake,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
      );

      await expect(tx)
          .to.emit(delegatorPool, 'Claimed')
          .withArgs(caller.address, owedStake, owedFees);

      return {owedStake, owedFees};
    }
  }

  const pendingStake = 900;
  const pendingFees = 90;

  beforeEach(async function() {
    [
      delegator,
      delegator1,
      delegator2,
      mockL2MigratorEOA,
      mockBondingManagerEOA,
    ] = await ethers.getSigners();

    const DelegatorPool: DelegatorPool__factory =
      await ethers.getContractFactory('DelegatorPool');

    delegatorPool = await DelegatorPool.deploy();

    bondingManagerMock = await smock.fake(
        'contracts/L2/pool/DelegatorPool.sol:IBondingManager',
        {
          address: mockBondingManagerEOA.address,
        },
    );

    bondingManagerMock.pendingStake.returns(pendingStake);
    bondingManagerMock.pendingFees.returns(pendingFees);

    await delegatorPool
        .connect(mockL2MigratorEOA)
        .initialize(mockBondingManagerEOA.address);
  });

  describe('initialize', () => {
    it('sets addresses correctly', async () => {
      const bondingManagerAddr = await delegatorPool.bondingManager();
      expect(bondingManagerAddr).to.equal(mockBondingManagerEOA.address);

      const migratorAddr = await delegatorPool.migrator();
      expect(migratorAddr).to.equal(mockL2MigratorEOA.address);
    });

    it('sets initial stake correctly', async () => {
      const initialStake = await delegatorPool.initialStake();
      expect(initialStake).to.equal(pendingStake);
    });

    it('should fail when already initialized', async () => {
      const tx = delegatorPool.initialize(mockBondingManagerEOA.address);
      await expect(tx).to.be.revertedWith(
          'Initializable: contract is already initialized',
      );
    });
  });

  describe('claim', () => {
    describe('caller is not migrator', () => {
      it('fails when called claim', async () => {
        const tx = delegatorPool.connect(delegator).claim(delegator.address, 1);
        await expect(tx).to.be.revertedWith(
            'DelegatorPool#claim: NOT_MIGRATOR',
        );
      });
    });

    describe('caller is migrator', () => {
      const stake = 900;
      const fees = 90;

      describe('full claim - only single delegator in pool', () => {
        it('fails if everything already claimed', async () => {
          await delegatorPool
              .connect(mockL2MigratorEOA)
              .claim(delegator.address, stake);

          const tx = delegatorPool
              .connect(mockL2MigratorEOA)
              .claim(delegator.address, stake);

          await expect(tx).to.be.revertedWith(
              'DelegatorPool#claim: FULLY_CLAIMED',
          );
        });

        it('emits claimed event', async () => {
          const tx = await delegatorPool
              .connect(mockL2MigratorEOA)
              .claim(delegator.address, stake);

          await expect(tx)
              .to.emit(delegatorPool, 'Claimed')
              .withArgs(delegator.address, stake, fees);
        });

        it('claim stake and fee', async () => {
          const runner = new StakeAndFees(stake, fees);
          await runner.testClaim(delegator, stake);
        });
      });

      describe('proportional claim - multiple delegators in pool', () => {
        const totalStake = 900;
        const totalFees = 90;

        const d0Stake = 200;
        const d1Stake = 300;
        const d2Stake = 400;
        // sum(d1+d2+d3...+dn) must equal totalStake

        it('no rewards/no increase in stake', async () => {
          const runner = new StakeAndFees(totalStake, totalFees);

          await runner.testClaim(delegator, d0Stake);
          await runner.testClaim(delegator1, d1Stake);
          await runner.testClaim(delegator2, d2Stake);
        });

        it('adds rewards - rewards are added once', async () => {
          const runner = new StakeAndFees(totalStake, totalFees);
          expect(runner.pendingStake).to.equal(totalStake);

          await runner.testClaim(delegator, d0Stake);

          runner.updateStakeAndFees(700, 70);
          expect(runner.pendingStake).to.equal(1400);

          await runner.testClaim(delegator1, d1Stake);
          expect(runner.pendingStake).to.equal(800);

          await runner.testClaim(delegator2, d2Stake);
          expect(runner.pendingStake).to.equal(0);
        });

        it('adds rewards - reward gets double after each claim', async () => {
          const runner = new StakeAndFees(totalStake, totalFees);

          await runner.testClaim(delegator, d0Stake);

          runner.updateStakeAndFees(runner.pendingStake, runner.pendingFees); // pending doubled
          const {owedStake: d1} = await runner.testClaim(delegator1, d1Stake);
          expect(d1).to.equal(d1Stake * 2);

          runner.updateStakeAndFees(runner.pendingStake, runner.pendingFees); // pending doubled
          const {owedStake: d2} = await runner.testClaim(delegator2, d2Stake);
          expect(d2).to.equal(d2Stake * 4);
        });
      });
    });
  });
});
