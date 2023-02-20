const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const {
  verifyBalance,
  verifyBalances,
  verifyAllowance,
  verifyPoolsStatus,
  verifyPoolsStatus_legacy,
  verifyPoolsStatusForIndex,
  verifyPoolsStatusForIndex_legacy,
  verifyIndexStatus,
  verifyCDSStatus,
  verifyCDSStatusOf,
  verifyVaultStatus,
  verifyVaultStatusOf,
} = require("../test-utils");

const {
  ZERO_ADDRESS,
  long,
  short,
  YEAR,
  WEEK,
  DAY,
  ZERO,
} = require("../constant-utils");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

async function moveForwardPeriods(days) {
  await ethers.provider.send("evm_increaseTime", [DAY.mul(days).toNumber()]);
  await ethers.provider.send("evm_mine");

  return true;
}

async function now() {
  return BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
}

async function setNextBlock(time) {
  await ethers.provider.send("evm_setNextBlockTimestamp", [time.toNumber()]);
}

describe("CDS", function () {
  const initialMint = BigNumber.from("100000"); //initial token amount for users
  const depositAmount = BigNumber.from("10000"); //default deposit amount for test
  const defaultRate = BigNumber.from("1000000"); //initial rate between USDC and LP token

  const governanceFeeRate = BigNumber.from("100000"); //10% of the Premium

  before(async () => {
    //import
    [gov, alice, bob, chad, tom] = await ethers.getSigners();
    const Ownership = await ethers.getContractFactory("Ownership");
    const USDC = await ethers.getContractFactory("TestERC20Mock");
    const PoolTemplate = await ethers.getContractFactory("PoolTemplate");
    const CDSTemplate = await ethers.getContractFactory("CDSTemplate");
    const Factory = await ethers.getContractFactory("Factory");
    const Vault = await ethers.getContractFactory("Vault");
    const Registry = await ethers.getContractFactory("Registry");
    const PremiumModel = await ethers.getContractFactory("TestPremiumModel");
    const Parameters = await ethers.getContractFactory("Parameters");
    const Contorller = await ethers.getContractFactory("ControllerMock");

    //deploy
    ownership = await Ownership.deploy();
    usdc = await USDC.deploy();
    registry = await Registry.deploy(ownership.address);
    factory = await Factory.deploy(registry.address, ownership.address);
    premium = await PremiumModel.deploy();
    controller = await Contorller.deploy(usdc.address, ownership.address);
    vault = await Vault.deploy(
      usdc.address,
      registry.address,
      controller.address,
      ownership.address
    );

    poolTemplate = await PoolTemplate.deploy();
    cdsTemplate = await CDSTemplate.deploy();
    parameters = await Parameters.deploy(ownership.address);

    //set up
    await usdc.mint(alice.address, initialMint);
    await usdc.mint(bob.address, initialMint);
    await usdc.mint(chad.address, initialMint);

    await usdc.connect(alice).approve(vault.address, initialMint);
    await usdc.connect(bob).approve(vault.address, initialMint);
    await usdc.connect(chad).approve(vault.address, initialMint);

    await registry.setFactory(factory.address);

    await factory.approveTemplate(poolTemplate.address, true, false, true);
    await factory.approveTemplate(cdsTemplate.address, true, false, true);

    await factory.approveReference(poolTemplate.address, 0, usdc.address, true);
    await factory.approveReference(poolTemplate.address, 1, usdc.address, true);
    await factory.approveReference(
      poolTemplate.address,
      2,
      registry.address,
      true
    );
    await factory.approveReference(
      poolTemplate.address,
      3,
      parameters.address,
      true
    );
    await factory.approveReference(poolTemplate.address, 4, ZERO_ADDRESS, true);

    await factory.approveReference(
      cdsTemplate.address,
      2,
      parameters.address,
      true
    );
    await factory.approveReference(cdsTemplate.address, 0, usdc.address, true);
    await factory.approveReference(
      cdsTemplate.address,
      1,
      registry.address,
      true
    );

    //set default parameters
    await parameters.setFeeRate(ZERO_ADDRESS, governanceFeeRate);

    await parameters.setGrace(ZERO_ADDRESS, DAY.mul("3"));

    await parameters.setLockup(ZERO_ADDRESS, WEEK);
    await parameters.setWithdrawable(ZERO_ADDRESS, WEEK.mul(2));

    await parameters.setMinDate(ZERO_ADDRESS, WEEK);

    await parameters.setPremiumModel(ZERO_ADDRESS, premium.address);

    await parameters.setVault(usdc.address, vault.address);
    await parameters.setMaxList(ZERO_ADDRESS, "10");

    //market1
    await factory.createMarket(
      poolTemplate.address,
      "Here is metadata.",
      [0, 0],
      [
        usdc.address,
        usdc.address,
        registry.address,
        parameters.address,
        gov.address,
      ]
    );
    const marketAddress1 = await factory.markets(0);
    market1 = await PoolTemplate.attach(marketAddress1);

    await factory.createMarket(
      cdsTemplate.address,
      "Here is metadata.",
      [0, 0],
      [usdc.address, registry.address, parameters.address]
    );
    const marketAddress2 = await factory.markets(1);
    cds = await CDSTemplate.attach(marketAddress2);

    await registry.setCDS(ZERO_ADDRESS, cds.address);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();

    {
      //sanity check
      await verifyCDSStatus({
        cds: cds,
        surplusPool: ZERO,
        crowdPool: ZERO,
        totalSupply: ZERO,
        totalLiquidity: ZERO,
        rate: ZERO,
      });

      await verifyCDSStatusOf({
        cds: cds,
        targetAddress: alice.address,
        valueOfUnderlying: ZERO,
        withdrawTimestamp: ZERO,
        withdrawAmount: ZERO,
      });

      await verifyVaultStatus({
        vault: vault,
        balance: ZERO,
        valueAll: ZERO,
        totalAttributions: ZERO,
        totalDebt: ZERO,
      });

      await verifyVaultStatusOf({
        vault: vault,
        target: cds.address,
        attributions: ZERO,
        underlyingValue: ZERO,
        debt: ZERO,
      });

      await verifyBalances({
        token: usdc,
        userBalances: {
          [alice.address]: initialMint,
          [cds.address]: ZERO,
          [vault.address]: ZERO,
        },
      });

      await verifyBalances({
        token: cds,
        userBalances: {
          [alice.address]: ZERO,
          [cds.address]: ZERO,
          [vault.address]: ZERO,
        },
      });
    }
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("CDSTemplate", function () {
    describe("initialize", function () {
      it("should set configs after initialization", async () => {
        expect(await cds.initialized()).to.equal(true);
        expect(await cds.registry()).to.equal(registry.address);
        expect(await cds.parameters()).to.equal(parameters.address);
        expect(await cds.vault()).to.equal(vault.address);
        expect(await cds.name()).to.equal("InsureDAO-CDS");
        expect(await cds.symbol()).to.equal("iCDS");
        expect(await cds.decimals()).to.equal(18); //MockERC20 decimals
      });

      it("reverts when already initialized", async () => {
        // 91
        // "ERROR: INITIALIZATION_BAD_CONDITIONS"
        await expect(
          cds.initialize(
            "Here is metadata.",
            [0, 0],
            [usdc.address, registry.address, parameters.address]
          )
        ).to.revertedWith("ERROR: INITIALIZATION_BAD_CONDITIONS");
      });

      it("reverts when address is zero and/or metadata is empty 1", async () => {
        await factory.approveReference(
          cdsTemplate.address,
          0,
          ZERO_ADDRESS,
          true
        );

        await expect(
          factory.createMarket(
            cdsTemplate.address,
            "Here is metadata.",
            [0, 0],
            [ZERO_ADDRESS, registry.address, parameters.address]
          )
        ).to.revertedWith("ERROR: INITIALIZATION_BAD_CONDITIONS");
      });

      it("reverts when address is zero and/or metadata is empty 2", async () => {
        await factory.approveReference(
          cdsTemplate.address,
          1,
          ZERO_ADDRESS,
          true
        );

        await expect(
          factory.createMarket(
            cdsTemplate.address,
            "Here is metadata.",
            [0, 0],
            [usdc.address, ZERO_ADDRESS, parameters.address]
          )
        ).to.revertedWith("ERROR: INITIALIZATION_BAD_CONDITIONS");
      });

      it("reverts when address is zero and/or metadata is empty 3", async () => {
        await factory.approveReference(
          cdsTemplate.address,
          2,
          ZERO_ADDRESS,
          true
        );

        await expect(
          factory.createMarket(
            cdsTemplate.address,
            "Here is metadata.",
            [0, 0],
            [usdc.address, registry.address, ZERO_ADDRESS]
          )
        ).to.revertedWith("ERROR: INITIALIZATION_BAD_CONDITIONS");
      });

      it("reverts when address is zero and/or metadata is empty 4", async () => {
        await expect(
          factory.createMarket(
            cdsTemplate.address,
            "",
            [0, 0],
            [usdc.address, registry.address, parameters.address]
          )
        ).to.revertedWith("ERROR: INITIALIZATION_BAD_CONDITIONS");
      });
    });

    describe("deposit", function () {
      it("should increase the crowd pool size and attribution", async () => {
        let tx = await cds.connect(alice).deposit(depositAmount);

        {
          //sanity check
          let mintAmount = (await tx.wait()).events[3].args["value"]; //new minted LP
          await expect(mintAmount).to.equal(depositAmount);

          await verifyCDSStatus({
            cds: cds,
            surplusPool: ZERO,
            crowdPool: depositAmount, //deposit goes into crowdPool
            totalSupply: mintAmount,
            totalLiquidity: depositAmount,
            rate: defaultRate,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: depositAmount,
            withdrawTimestamp: ZERO,
            withdrawAmount: ZERO,
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount,
            valueAll: depositAmount,
            totalAttributions: depositAmount,
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount,
            underlyingValue: depositAmount,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [cds.address]: ZERO,
              [vault.address]: depositAmount,
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: mintAmount,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });

      it("should return larger amount of iToken when the rate is low(when compensated)", async () => {
        //setup
        await cds.connect(bob).deposit(depositAmount); //LP:USDC = 1:1

        await registry.supportMarket(chad.address); //now bob can act like a market

        let compensate = depositAmount.div(2);
        await cds.connect(chad).compensate(compensate); //LP:USDC = 1:0.5

        let tx = await cds.connect(alice).deposit(depositAmount); //LP mintAmount should be depositAmount*2

        {
          //sanity check
          let mintAmount = (await tx.wait()).events[3].args["value"]; //new minted LP
          await expect(mintAmount).to.equal(depositAmount.mul(2));

          await verifyCDSStatus({
            cds: cds,
            surplusPool: ZERO,
            crowdPool: depositAmount.sub(compensate).add(depositAmount),
            totalSupply: depositAmount.add(mintAmount),
            totalLiquidity: depositAmount.sub(compensate).add(depositAmount),
            rate: defaultRate
              .mul(depositAmount.sub(compensate).add(depositAmount))
              .div(depositAmount.add(mintAmount)),
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: bob.address,
            valueOfUnderlying: depositAmount.sub(compensate),
            withdrawTimestamp: ZERO,
            withdrawAmount: ZERO,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: depositAmount,
            withdrawTimestamp: ZERO,
            withdrawAmount: ZERO,
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount.mul(2),
            valueAll: depositAmount.mul(2),
            totalAttributions: depositAmount.mul(2),
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount.sub(compensate).add(depositAmount), //unless Controller contract earn interest from investment, ..
            underlyingValue: depositAmount.sub(compensate).add(depositAmount), //.. these two are always the same
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [bob.address]: initialMint.sub(depositAmount),
              [chad.address]: initialMint,
              [cds.address]: ZERO,
              [vault.address]: depositAmount.mul(2),
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: mintAmount,
              [bob.address]: depositAmount,
              [chad.address]: ZERO,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });

      it("revert when the deposit amount is zero", async () => {
        await expect(cds.deposit(0)).to.revertedWith("ERROR: DEPOSIT_ZERO");
      });

      it("revert when paused", async () => {
        await cds.setPaused(true);
        await expect(cds.deposit(0)).to.revertedWith("ERROR: PAUSED");
      });

      it("revert when paused", async () => {
        await cds.setPaused(true);
        await expect(cds.deposit(0)).to.revertedWith("ERROR: PAUSED");
      });

      it("dilute LP value when CDS system is failed", async () => {
        await cds.connect(alice).deposit(depositAmount);

        await registry.supportMarket(chad.address); //now chad can act like a market

        let compensate = depositAmount.add(1); //more than deposited
        await cds.connect(chad).compensate(compensate);

        let totalSupply = await cds.totalSupply();

        let tx = await cds.connect(bob).deposit(depositAmount);

        let mintedAmount = (await tx.wait()).events[2].args["mint"];

        expect(mintedAmount).to.equal(totalSupply.mul(depositAmount));

        {
          //sanity check

          await verifyCDSStatus({
            cds: cds,
            surplusPool: ZERO,
            crowdPool: depositAmount, //deposit goes into crowdPool
            totalSupply: depositAmount.add(mintedAmount),
            totalLiquidity: depositAmount,
            rate: defaultRate
              .mul(depositAmount)
              .div(depositAmount.add(mintedAmount)),
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: ZERO,
            withdrawTimestamp: ZERO,
            withdrawAmount: ZERO,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: bob.address,
            valueOfUnderlying: depositAmount.sub(1), //
            withdrawTimestamp: ZERO,
            withdrawAmount: ZERO,
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount.mul(2),
            valueAll: depositAmount.mul(2),
            totalAttributions: depositAmount.mul(2),
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount,
            underlyingValue: depositAmount,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [bob.address]: initialMint.sub(depositAmount),
              [chad.address]: initialMint,
              [cds.address]: ZERO,
              [vault.address]: depositAmount.mul(2),
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: depositAmount,
              [bob.address]: mintedAmount,
              [chad.address]: ZERO,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });
    });

    describe("fund", function () {
      it("should increase the surplus pool size", async () => {
        await cds.connect(alice).fund(depositAmount);

        {
          //sanity check
          await verifyCDSStatus({
            cds: cds,
            surplusPool: depositAmount, //fund() goes to surplusPool
            crowdPool: ZERO,
            totalSupply: ZERO, //LP isn't minted
            totalLiquidity: depositAmount,
            rate: ZERO,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: ZERO, //doesn't count
            withdrawTimestamp: ZERO,
            withdrawAmount: ZERO,
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount,
            valueAll: depositAmount,
            totalAttributions: depositAmount, //attribution of CDS exists
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount,
            underlyingValue: depositAmount,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [cds.address]: ZERO,
              [vault.address]: depositAmount,
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: ZERO,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });

      it("revert when paused", async () => {
        await cds.setPaused(true);

        //EXECUTE
        await expect(cds.connect(alice).fund(depositAmount)).to.revertedWith(
          "ERROR: PAUSED"
        );
      });
    });

    describe("defund", function () {
      beforeEach(async () => {
        await cds.connect(alice).fund(depositAmount);

        {
          //sanity check
          await verifyCDSStatus({
            cds: cds,
            surplusPool: depositAmount, //fund() goes to surplusPool
            crowdPool: ZERO,
            totalSupply: ZERO, //LP isn't minted
            totalLiquidity: depositAmount,
            rate: ZERO,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: ZERO, //doesn't count
            withdrawTimestamp: ZERO,
            withdrawAmount: ZERO,
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount,
            valueAll: depositAmount,
            totalAttributions: depositAmount, //attribution of CDS exists
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount,
            underlyingValue: depositAmount,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [cds.address]: ZERO,
              [vault.address]: depositAmount,
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: ZERO,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });

      it("success", async () => {
        await cds.defund(depositAmount);

        {
          //sanity check
          await verifyCDSStatus({
            cds: cds,
            surplusPool: ZERO, //decrease
            crowdPool: ZERO,
            totalSupply: ZERO,
            totalLiquidity: ZERO, //decrease
            rate: ZERO,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: ZERO,
            withdrawTimestamp: ZERO,
            withdrawAmount: ZERO,
          });

          await verifyVaultStatus({
            vault: vault,
            balance: ZERO, //decrease
            valueAll: ZERO, //decrease
            totalAttributions: ZERO, //decrease
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: ZERO, //decrease
            underlyingValue: ZERO, //decrease
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [gov.address]: depositAmount, //increase. defund() goes to msg.sender (with onlyOwner modifier)
              [alice.address]: initialMint.sub(depositAmount),
              [cds.address]: ZERO,
              [vault.address]: ZERO, //decrease
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: ZERO,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });

      it("revert onlyOwner", async () => {
        await expect(cds.connect(alice).defund(depositAmount)).to.revertedWith(
          "ERROR: ONLY_OWNER"
        );
      });
    });

    describe("requestWithdraw", function () {
      beforeEach(async () => {
        let tx = await cds.connect(alice).deposit(depositAmount);

        {
          //sanity check
          let mintAmount = (await tx.wait()).events[3].args["value"]; //new minted LP
          await expect(mintAmount).to.equal(depositAmount);

          await verifyCDSStatus({
            cds: cds,
            surplusPool: ZERO,
            crowdPool: depositAmount, //deposit goes into crowdPool
            totalSupply: mintAmount,
            totalLiquidity: depositAmount,
            rate: defaultRate,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: depositAmount,
            withdrawTimestamp: ZERO,
            withdrawAmount: ZERO,
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount,
            valueAll: depositAmount,
            totalAttributions: depositAmount,
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount,
            underlyingValue: depositAmount,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [cds.address]: ZERO,
              [vault.address]: depositAmount,
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: mintAmount,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });

      it("should update timestamp and amount", async () => {
        //setup
        let next = (await now()).add(10);
        await setNextBlock(next);

        //EXECUTE
        await expect(cds.connect(alice).requestWithdraw(depositAmount));

        {
          //sanity check
          await verifyCDSStatus({
            cds: cds,
            surplusPool: ZERO,
            crowdPool: depositAmount,
            totalSupply: depositAmount,
            totalLiquidity: depositAmount,
            rate: defaultRate,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: depositAmount,
            withdrawTimestamp: next, //set
            withdrawAmount: depositAmount, //set
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount,
            valueAll: depositAmount,
            totalAttributions: depositAmount,
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount,
            underlyingValue: depositAmount,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [cds.address]: ZERO,
              [vault.address]: depositAmount,
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: depositAmount,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });

      it("revert when _amount exceed balance", async () => {
        await expect(
          cds.connect(alice).requestWithdraw(depositAmount.add(1))
        ).to.revertedWith("ERROR: REQUEST_EXCEED_BALANCE");
      });

      it("amount should not be zero", async () => {
        await expect(cds.connect(alice).requestWithdraw(ZERO)).to.revertedWith(
          "ERROR: REQUEST_ZERO"
        );
      });
    });

    describe("_beforeTokenTransfer", function () {
      beforeEach(async () => {
        await cds.connect(alice).deposit(depositAmount);

        next = (await now()).add(10);
        await setNextBlock(next);

        await expect(cds.connect(alice).requestWithdraw(depositAmount));

        {
          //sanity check
          await verifyCDSStatus({
            cds: cds,
            surplusPool: ZERO,
            crowdPool: depositAmount,
            totalSupply: depositAmount,
            totalLiquidity: depositAmount,
            rate: defaultRate,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: depositAmount,
            withdrawTimestamp: next, //set
            withdrawAmount: depositAmount, //set
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount,
            valueAll: depositAmount,
            totalAttributions: depositAmount,
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount,
            underlyingValue: depositAmount,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [cds.address]: ZERO,
              [vault.address]: depositAmount,
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: depositAmount,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });

      it("should decrease the request amount", async () => {
        await cds.connect(alice).transfer(bob.address, depositAmount.div(2)); //transfer half of LP token

        {
          //sanity check
          await verifyCDSStatus({
            cds: cds,
            surplusPool: ZERO,
            crowdPool: depositAmount,
            totalSupply: depositAmount,
            totalLiquidity: depositAmount,
            rate: defaultRate,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: depositAmount.div(2), //changed
            withdrawTimestamp: next, //set
            withdrawAmount: depositAmount.div(2), //changed
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount,
            valueAll: depositAmount,
            totalAttributions: depositAmount,
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount,
            underlyingValue: depositAmount,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [cds.address]: ZERO,
              [vault.address]: depositAmount,
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: depositAmount.div(2), //decrease
              [bob.address]: depositAmount.div(2), //new holder
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });
    });

    describe("withdraw", function () {
      //deposit and request withdraw
      beforeEach(async () => {
        await cds.connect(alice).deposit(depositAmount);

        next = (await now()).add(10);
        await setNextBlock(next);

        await expect(cds.connect(alice).requestWithdraw(depositAmount));

        {
          //sanity check
          await verifyCDSStatus({
            cds: cds,
            surplusPool: ZERO,
            crowdPool: depositAmount,
            totalSupply: depositAmount,
            totalLiquidity: depositAmount,
            rate: defaultRate,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: depositAmount,
            withdrawTimestamp: next, //set
            withdrawAmount: depositAmount, //set
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount,
            valueAll: depositAmount,
            totalAttributions: depositAmount,
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount,
            underlyingValue: depositAmount,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [cds.address]: ZERO,
              [vault.address]: depositAmount,
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: depositAmount,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });

      it("should decrease the crowd pool size and attributions", async () => {
        await moveForwardPeriods(7);

        let tx = await cds.connect(alice).withdraw(depositAmount);
        returnValue = (await tx.wait()).events[2].args["retVal"];

        await expect(returnValue).to.equal(depositAmount);

        {
          //sanity check
          await verifyCDSStatus({
            cds: cds,
            surplusPool: ZERO,
            crowdPool: ZERO, //decrease
            totalSupply: ZERO,
            totalLiquidity: ZERO,
            rate: ZERO,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: ZERO,
            withdrawTimestamp: next, //no change. user can withdraw half now, and half later.
            withdrawAmount: ZERO, //should reduce request amount
          });

          await verifyVaultStatus({
            vault: vault,
            balance: ZERO,
            valueAll: ZERO,
            totalAttributions: ZERO,
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: ZERO,
            underlyingValue: ZERO,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint, //withdrawed to here
              [cds.address]: ZERO,
              [vault.address]: ZERO, //withdrawed from here
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: ZERO, //should burn iToken
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });

      it("reverts when the market is paused", async () => {
        await cds.setPaused(true);

        await moveForwardPeriods(7);

        await expect(
          cds.connect(alice).withdraw(depositAmount)
        ).to.revertedWith("ERROR: PAUSED");
      });

      it("reverts when lockup is not ends", async () => {
        await moveForwardPeriods(6);

        await expect(
          cds.connect(alice).withdraw(depositAmount)
        ).to.revertedWith("ERROR: WITHDRAWAL_QUEUE");
      });

      it("reverts when withdrawable priod ends", async () => {
        await moveForwardPeriods(7);
        await moveForwardPeriods(14);

        await expect(
          cds.connect(alice).withdraw(depositAmount)
        ).to.revertedWith("ERROR: WITHDRAWAL_NO_ACTIVE_REQUEST");
      });

      it("reverts when the withdraw amount exceeded the request", async () => {
        await moveForwardPeriods(7);

        await expect(
          cds.connect(alice).withdraw(depositAmount.add(1))
        ).to.revertedWith("ERROR: WITHDRAWAL_EXCEEDED_REQUEST");
      });

      it("reverts when withdraw zero amount", async () => {
        await moveForwardPeriods(7);

        await expect(cds.connect(alice).withdraw(ZERO)).to.revertedWith(
          "ERROR: WITHDRAWAL_ZERO"
        );
      });
    });

    describe("compensate", function () {
      beforeEach(async () => {
        await cds.connect(alice).deposit(depositAmount);

        {
          //sanity check
          await verifyCDSStatus({
            cds: cds,
            surplusPool: ZERO,
            crowdPool: depositAmount, //deposit goes into crowdPool
            totalSupply: depositAmount,
            totalLiquidity: depositAmount,
            rate: defaultRate,
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: depositAmount,
            withdrawTimestamp: ZERO,
            withdrawAmount: ZERO,
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount,
            valueAll: depositAmount,
            totalAttributions: depositAmount,
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount,
            underlyingValue: depositAmount,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [cds.address]: ZERO,
              [vault.address]: depositAmount,
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: depositAmount,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });

      it("should decrease the surplus pool and crowd pool", async () => {
        await registry.supportMarket(chad.address); //now bob can act like a market

        await cds.connect(bob).fund(depositAmount);

        let compensate = BigNumber.from("1000"); //since surplusPool and crowdPool have equal value, compensate evenly.
        await cds.connect(chad).compensate(compensate);

        {
          //sanity check
          await verifyCDSStatus({
            cds: cds,
            surplusPool: depositAmount.sub(compensate.div(2)), //compensate evenly
            crowdPool: depositAmount.sub(compensate.div(2)), //compensate evenly
            totalSupply: depositAmount,
            totalLiquidity: depositAmount.mul(2).sub(compensate),
            rate: defaultRate
              .mul(depositAmount.sub(compensate.div(2)))
              .div(depositAmount), //defaultRate * deposited balance / totalSupply
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: depositAmount.sub(compensate.div(2)),
            withdrawTimestamp: ZERO,
            withdrawAmount: ZERO,
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount.mul(2), //no changes
            valueAll: depositAmount.mul(2),
            totalAttributions: depositAmount.mul(2),
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount.mul(2).sub(compensate),
            underlyingValue: depositAmount.mul(2).sub(compensate),
            debt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: chad.address,
            attributions: compensate,
            underlyingValue: compensate,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [bob.address]: initialMint.sub(depositAmount),
              [chad.address]: initialMint,
              [cds.address]: ZERO,
              [vault.address]: depositAmount.mul(2),
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: depositAmount,
              [bob.address]: ZERO,
              [chad.address]: ZERO,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });

      it("should decrease as much as deposited when CDS has insufficient amount", async () => {
        await registry.supportMarket(chad.address); //now chad can act like a market

        let compensate = depositAmount.add(1); //more than deposited
        let tx = await cds.connect(chad).compensate(compensate);

        //should conpensete "depositedAmount", and shortage should be 1.
        let compensated = (await tx.wait()).events[0].args["amount"];
        await expect(compensated).to.equal(depositAmount);

        let shortage = compensate - compensated;

        {
          //sanity check
          await verifyCDSStatus({
            cds: cds,
            surplusPool: ZERO, //totally used
            crowdPool: ZERO, //totally used
            totalSupply: depositAmount,
            totalLiquidity: ZERO,
            rate: ZERO, //defaultRate * deposited balance / totalSupply
          });

          await verifyCDSStatusOf({
            cds: cds,
            targetAddress: alice.address,
            valueOfUnderlying: ZERO,
            withdrawTimestamp: ZERO,
            withdrawAmount: ZERO,
          });

          await verifyVaultStatus({
            vault: vault,
            balance: depositAmount, //no changes
            valueAll: depositAmount,
            totalAttributions: depositAmount,
            totalDebt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: cds.address,
            attributions: depositAmount.sub(depositAmount), //transfer from here
            underlyingValue: ZERO,
            debt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: chad.address,
            attributions: depositAmount, //transfer to here
            underlyingValue: depositAmount,
            debt: ZERO,
          });

          await verifyVaultStatusOf({
            vault: vault,
            target: chad.address,
            attributions: compensated,
            underlyingValue: compensated,
            debt: ZERO,
          });

          await verifyBalances({
            token: usdc,
            userBalances: {
              [alice.address]: initialMint.sub(depositAmount),
              [bob.address]: initialMint,
              [chad.address]: initialMint,
              [cds.address]: ZERO,
              [vault.address]: depositAmount,
            },
          });

          await verifyBalances({
            token: cds,
            userBalances: {
              [alice.address]: depositAmount,
              [bob.address]: ZERO,
              [chad.address]: ZERO,
              [cds.address]: ZERO,
              [vault.address]: ZERO,
            },
          });
        }
      });
    });

    describe("changeMetadata", function () {
      it("should change Metadata", async () => {
        expect(await cds.metadata()).to.equal("Here is metadata.");

        await cds.changeMetadata("New metadata");

        expect(await cds.metadata()).to.equal("New metadata");
      });

      it("revert when not admin", async () => {
        await expect(
          cds.connect(alice).changeMetadata("New metadata")
        ).to.revertedWith("ERROR: ONLY_OWNER");
      });
    });
  });
});
