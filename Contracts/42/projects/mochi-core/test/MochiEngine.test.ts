import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract, Signer, BigNumber, constants } from 'ethers';
import { increase, mine } from './utils';

import { MochiCore } from '../src/MochiCore';

const unit = ethers.constants.WeiPerEther;
describe.only('MochiEngine', function () {
  let accounts: Signer[];
  let mochi: MochiCore;
  let cssr: Contract;
  let uniswap: Contract;
  let owner: Signer;
  let referrer: Signer;
  let alice: Signer;
  let bob: Signer;
  let coby: Signer;

  let collateral_0: Contract;
  beforeEach(async function () {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    referrer = accounts[1];
    alice = accounts[2];
    bob = accounts[3];
    coby = accounts[4];
    const CssrFactory = await ethers.getContractFactory('MockCssrRouter');
    cssr = await CssrFactory.deploy();
    mochi = new MochiCore(ethers.provider, owner);
    const MockCollateralFactory = await ethers.getContractFactory(
      'MockCollateral',
    );
    collateral_0 = await MockCollateralFactory.deploy();
    uniswap = await ethers.getContractAt(
      'IUniswapV2Router02',
      '0xf164fC0Ec4E93095b804a4795bBe1e041497b92a',
    );
    await mochi.deploy(
      '0xdc71417E173955d100aF4fc9673493Fff244514C',
      uniswap.address,
    );
    await mochi.setCSSR(cssr);
    await mochi.minter.connect(owner).addMinter(await owner.getAddress());
  });
  describe('vault', function () {
    it('deploy vault', async function () {
      await mochi.mochiProfile.registerAsset(collateral_0.address);
    });

    describe('asset management', function () {
      let vault: Contract;
      beforeEach(async function () {
        //await mochi.mochiProfile.registerAsset(collateral_0.address);
        //await mochi.mochiProfile.changeAssetClass([collateral_0.address], [5]);
        await mochi.mochiProfile.registerAssetByGov(
          [collateral_0.address],
          [2],
        );
        await mochi.mochiProfile.changeCreditCap(
          [collateral_0.address],
          [unit.mul(1_000_000_000_000)],
        );
        const vault_address = await mochi.vaultFactory.getVault(
          collateral_0.address,
        );
        vault = await ethers.getContractAt('MochiVault', vault_address);
        await collateral_0.approve(vault.address, unit.mul(1000000));
      });
      describe('mint', function () {
        it('should be able to mint', async function () {
          await vault.mint(
            await owner.getAddress(),
            ethers.constants.AddressZero,
          );
        });
      });
      describe('deposit', function () {
        it('should be able to deposit', async function () {
          await vault.mint(owner.getAddress(), ethers.constants.AddressZero);
          await vault.deposit(0, unit.mul(1000000));
        });
        it('should be able to deposit twice', async function () {
          await vault.mint(owner.getAddress(), ethers.constants.AddressZero);
          await vault.deposit(0, unit.mul(1000000));
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await vault.deposit(0, unit.mul(1000000));
        });
      });
      describe('withdraw', function () {
        it('should be able to deposit and then withdraw', async function () {
          await vault.mint(owner.getAddress(), ethers.constants.AddressZero);
          await vault.deposit(0, unit.mul(1000000));
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await vault.deposit(0, unit.mul(1000000));
          await increase(BigNumber.from(30 * 60));
          await vault.withdraw(0, unit.mul(1200000), '0x');
          await increase(BigNumber.from(86400 * 125));
          await vault.connect(owner).withdraw(0, unit.mul(800000), '0x');
        });
        it('should not be able to withdraw non approved', async function () {
          await vault.mint(owner.getAddress(), ethers.constants.AddressZero);
          await vault.deposit(0, unit.mul(1000000));
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await vault.deposit(0, unit.mul(1000000));
          await increase(BigNumber.from(30 * 60));
          await expect(
            vault.connect(alice).withdraw(0, unit.mul(1200000), '0x'),
          ).to.be.revertedWith('!approved');
        });
        it('should not be able to withdraw when invalid status', async function () {
          await vault.mint(owner.getAddress(), ethers.constants.AddressZero);
          await vault.deposit(0, unit.mul(1000000));
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await vault.deposit(0, unit.mul(1000000));
          await vault.borrow(0, unit.mul(1600000), '0x');
          await increase(BigNumber.from(86400 * 125));
          await expect(
            vault.withdraw(0, unit.mul(1200000), '0x'),
          ).to.be.revertedWith('!healthy');
        });
      });
      describe('borrow', function () {
        it('should be able to borrow when referrer', async function () {
          await vault.mint(owner.getAddress(), referrer.getAddress());
          await vault.deposit(0, unit.mul(1000000));
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await vault.borrow(0, unit.mul(800000), '0x');
          const detail = await vault.details(0);
          const debt = detail.debt;
          expect(debt).to.equal(unit.mul(804000));
          const debtIndex = await vault.debtIndex();
          expect(detail.debtIndex).to.equal(debtIndex.mul(1005).div(1000));
        });
        it('should be able to borrow', async function () {
          await vault.mint(owner.getAddress(), ethers.constants.AddressZero);
          await vault.deposit(0, unit.mul(1000000));
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await vault.borrow(0, unit.mul(800000), '0x');
          const detail = await vault.details(0);
          const debt = detail.debt;
          expect(debt).to.equal(unit.mul(804000));
          const debtIndex = await vault.debtIndex();
          expect(detail.debtIndex).to.equal(debtIndex.mul(1005).div(1000));
        });
        it('should not be able to borrow over max cf', async function () {
          await vault.mint(owner.getAddress(), ethers.constants.AddressZero);
          await vault.deposit(0, unit.mul(1000000));
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await expect(
            vault.borrow(0, unit.mul(800001), '0x'),
          ).to.be.revertedWith('>cf');
        });
        it('should not be able to borrow over max cf', async function () {
          await vault.mint(owner.getAddress(), ethers.constants.AddressZero);
          await vault.deposit(0, unit.mul(1000000));
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await vault.borrow(0, unit.mul(800000), '0x');
          await expect(
            vault.borrow(0, unit.mul(800001), '0x'),
          ).to.be.revertedWith('>cf');
        });
      });
      describe('increase', function () {
        it('increase should mint', async function () {
          await vault.increase(
            ethers.constants.MaxUint256,
            0,
            0,
            ethers.constants.AddressZero,
            '0x',
          );
        });
        it('increase should deposit', async function () {
          await vault.mint(owner.getAddress(), ethers.constants.AddressZero);
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await vault.increase(0, 1, 0, ethers.constants.AddressZero, '0x');
        });
        it('increase should borrow', async function () {
          await vault.mint(owner.getAddress(), ethers.constants.AddressZero);
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await vault.deposit(0, unit.mul(1000000));
          await vault.increase(
            0,
            0,
            unit.mul(10000),
            ethers.constants.AddressZero,
            '0x',
          );
        });
      });
      describe('repay', function () {
        it('should be able to repay when referrer', async function () {
          await vault.mint(owner.getAddress(), referrer.getAddress());
          await vault.deposit(0, unit.mul(1000000));
          let detail = await vault.details(0);
          expect(detail.debt).to.equal(await vault.debts());
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await vault.borrow(0, unit.mul(800000), '0x');
          detail = await vault.details(0);
          expect(unit.mul(800000)).to.equal(await vault.debts());
          await increase(BigNumber.from(86400 * 52 * 7 + 86400));
          await mine();
          await mochi.usdm
            .connect(owner)
            .approve(vault.address, unit.mul(8000000));
          await vault.repay(0, unit.mul(100));
          detail = await vault.details(0);
          expect(detail.debt).to.be.closeTo(await vault.debts(), 1000000);
          await vault.repay(0, unit.mul(799900));
          detail = await vault.details(0);
          expect(detail.debt).to.be.closeTo(await vault.debts(), 1000000);
          await mochi.minter
            .connect(owner)
            .mint(await owner.getAddress(), unit.mul('100000'));
          await vault.repay(0, detail.debt.mul(11).div(10));
          detail = await vault.details(0);
          expect(detail.debt).to.equal(0);
          expect(await vault.debts()).to.equal(0);
        });
        it('should be able to repay without referrer', async function () {
          await vault.mint(owner.getAddress(), ethers.constants.AddressZero);
          await vault.deposit(0, unit.mul(1000000));
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await vault.borrow(0, unit.mul(800000), '0x');
          const detail = await vault.details(0);
          await increase(BigNumber.from(86400 * 7 * 50));
          await mine();
          await mochi.usdm.connect(owner).approve(vault.address, unit.mul(100));
          await vault.repay(0, unit.mul(100));
        });
      });
      describe('liquidation', function () {
        it('should be able to liquidate', async function () {
          await vault.mint(owner.getAddress(), referrer.getAddress());
          await vault.mint(alice.getAddress(), referrer.getAddress());
          await collateral_0.transfer(
            alice.getAddress(),
            unit.mul(1000000000000000),
          );
          await collateral_0
            .connect(alice)
            .approve(vault.address, unit.mul(1000000000000000));
          await collateral_0
            .connect(alice)
            .approve(uniswap.address, unit.mul(1000000000000000));
          await vault.connect(alice).deposit(1, unit.mul(10000000000000));
          await vault.connect(alice).borrow(1, unit.mul(40000000), '0x');
          await mochi.usdm
            .connect(alice)
            .approve(uniswap.address, unit.mul(40000000));
          await uniswap
            .connect(alice)
            .addLiquidity(
              mochi.usdm.address,
              collateral_0.address,
              unit.mul(4000000),
              unit.mul(1000000),
              1,
              1,
              alice.getAddress(),
              ethers.constants.MaxUint256,
            );
          await vault.deposit(0, unit.mul(1000000));
          await collateral_0.approve(vault.address, unit.mul(1000000));
          await vault.borrow(0, unit.mul(800000), '0x');
          const detail = await vault.details(0);
          await increase(BigNumber.from(86400 * 7 * 700));
          await mine();
          await mochi.liquidator
            .connect(owner)
            .triggerLiquidation(collateral_0.address, 0);
          await mochi.minter
            .connect(owner)
            .mint(await owner.getAddress(), unit.mul('10000000000000000'));
          await mochi.usdm
            .connect(owner)
            .approve(mochi.liquidator.address, unit.mul('10000000000000000'));
          const auctionId = await mochi.liquidator.auctionId(
            collateral_0.address,
            0,
          );
          await mochi.liquidator.connect(owner).buy(auctionId);
        });
      });
    });
  });
});
