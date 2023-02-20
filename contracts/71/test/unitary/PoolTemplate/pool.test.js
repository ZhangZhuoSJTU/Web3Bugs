const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const {
  verifyBalances,
  verifyAllowance,

  verifyPoolsStatus,
  verifyPoolsStatusForIndex,

  verifyValueOfUnderlying,

  verifyIndexStatus,

  verifyVaultStatus_legacy,
  verifyVaultStatusOf_legacy,
  verifyDebtOf,

  verifyRate,
} = require("../test-utils");

const {
  ZERO_ADDRESS,
  TEST_ADDRESS,
  NULL_ADDRESS,
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

describe("Pool", function () {
  const initialMint = BigNumber.from("100000"); //initial token amount for users

  const depositAmount = BigNumber.from("10000"); //default deposit amount for test
  const depositAmountLarge = BigNumber.from("40000"); //default deposit amount (large) for test
  const defaultRate = BigNumber.from("1000000"); //initial rate between USDC and LP token
  const insureAmount = BigNumber.from("10000"); //default insure amount for test

  const governanceFeeRate = BigNumber.from("100000"); //10% of the Premium
  const RATE_DIVIDER = BigNumber.from("1000000"); //1e6
  const UTILIZATION_RATE_LENGTH_1E6 = BigNumber.from("1000000"); //1e6
  const padded1 = ethers.utils.hexZeroPad("0x1", 32);

  //market status tracker.
  let m1 = {
    totalSupply: BigNumber.from("0"),
    depositAmount: BigNumber.from("0"),
    marketBalance: BigNumber.from("0"),
    insured: BigNumber.from("0"),
    rate: BigNumber.from("0"),
    utilizationRate: BigNumber.from("0"),
    allInsuranceCount: BigNumber.from("0"),
    debt: BigNumber.from("0"),
  };

  //global status tracker
  let g = {
    totalBalance: BigNumber.from("0"),
    govBalance: BigNumber.from("0"),
  };

  //user balance tracker (this assumes there is only one market)
  let u = {};

  /** will be like below in the "before(async..." execution
   *
   * u = {
   *    "balance": BigNumber,
   *    "deposited": BigNumber,
   *    "lp": BigNumber
   *  }
   */

  //======== Function Wrappers ========//
  //execute function and update tracker.
  const approveDeposit = async ({ token, target, depositor, amount }) => {
    //execute
    await token.connect(depositor).approve(vault.address, amount);
    let tx = await target.connect(depositor).deposit(amount);

    //1. update user info => check
    let _mintAmount = (await tx.wait()).events[2].args["mint"].toString();

    u[`${depositor.address}`].balance =
      u[`${depositor.address}`].balance.sub(amount); //track user wallet
    u[`${depositor.address}`].deposited =
      u[`${depositor.address}`].deposited.add(amount); //track amount of deposited USDC
    u[`${depositor.address}`].lp =
      u[`${depositor.address}`].lp.add(_mintAmount); //track amount of LP token

    expect(await token.balanceOf(depositor.address)).to.equal(
      u[`${depositor.address}`].balance
    ); //sanity check
    expect(await target.balanceOf(depositor.address)).to.equal(
      u[`${depositor.address}`].lp
    ); //sanity check

    //2. update global and market status => check
    g.totalBalance = g.totalBalance.add(amount); //global balance of USDC increase

    m1.totalSupply = m1.totalSupply.add(_mintAmount); //market1 (Pool) total LP balance increase as much as newly minted LP token.
    m1.depositAmount = m1.depositAmount.add(amount); //USDC deposited
    m1.marketBalance = m1.marketBalance.add(amount); //USDC deposited

    if (!m1.depositAmount.isZero()) {
      m1.rate = defaultRate.mul(m1.marketBalance).div(m1.totalSupply); //rate = (USDC balance in this contract) / (LP totalBalance)
    } else {
      m1.rate = ZERO;
    }

    if (!m1.utilizationRate.isZero()) {
      m1.utilizationRate = UTILIZATION_RATE_LENGTH_1E6.mul(m1.insured).div(
        m1.marketBalance
      ); //how much ratio is locked (=bought as insurance) among the pool.
    } else {
      m1.utilizationRate = ZERO;
    }

    //sanity check
    await verifyPoolsStatus({
      pools: [
        {
          pool: target,
          totalSupply: m1.totalSupply,
          totalLiquidity: m1.marketBalance, //all deposited amount
          availableBalance: m1.marketBalance.sub(m1.insured), //all amount - locked amount = available amount
          rate: m1.rate,
          utilizationRate: m1.utilizationRate,
          allInsuranceCount: m1.allInsuranceCount,
        },
      ],
    });

    await verifyDebtOf({
      vault: vault,
      target: target.address,
      debt: m1.debt,
    });

    //sanity check
    await verifyValueOfUnderlying({
      template: target,
      valueOfUnderlyingOf: depositor.address,
      valueOfUnderlying: u[`${depositor.address}`].lp
        .mul(m1.rate)
        .div(defaultRate),
    });
  };

  const approveDepositAndWithdrawRequest = async ({
    token,
    target,
    depositor,
    amount,
  }) => {
    //execute
    await token.connect(depositor).approve(vault.address, amount);
    let tx = await target.connect(depositor).deposit(amount);
    await target.connect(depositor).requestWithdraw(amount);

    //update user info => check
    let _mintAmount = (await tx.wait()).events[2].args["mint"].toString();

    u[`${depositor.address}`].balance =
      u[`${depositor.address}`].balance.sub(amount);
    u[`${depositor.address}`].deposited =
      u[`${depositor.address}`].deposited.add(amount);
    u[`${depositor.address}`].lp =
      u[`${depositor.address}`].lp.add(_mintAmount);

    expect(await token.balanceOf(depositor.address)).to.equal(
      u[`${depositor.address}`].balance
    ); //sanity check
    expect(await target.balanceOf(depositor.address)).to.equal(
      u[`${depositor.address}`].lp
    ); //sanity check

    //update global and market status => check
    g.totalBalance = g.totalBalance.add(amount);

    m1.totalSupply = m1.totalSupply.add(_mintAmount);
    m1.depositAmount = m1.depositAmount.add(amount);
    m1.marketBalance = m1.marketBalance.add(amount);

    if (!m1.depositAmount.isZero()) {
      m1.rate = defaultRate.mul(m1.marketBalance).div(m1.totalSupply);
    } else {
      m1.rate = ZERO;
    }

    if (!m1.utilizationRate.isZero()) {
      m1.utilizationRate = UTILIZATION_RATE_LENGTH_1E6.mul(m1.insured).div(
        m1.marketBalance
      );
    } else {
      m1.utilizationRate = ZERO;
    }

    //sanity check of m1
    await verifyPoolsStatus({
      pools: [
        {
          pool: target,
          totalSupply: m1.totalSupply,
          totalLiquidity: m1.marketBalance,
          availableBalance: m1.marketBalance.sub(m1.insured),
          rate: m1.rate,
          utilizationRate: m1.utilizationRate,
          allInsuranceCount: m1.allInsuranceCount,
        },
      ],
    });

    await verifyDebtOf({
      vault: vault,
      target: target.address,
      debt: m1.debt,
    });

    //sanity check
    await verifyValueOfUnderlying({
      template: target,
      valueOfUnderlyingOf: depositor.address,
      valueOfUnderlying: u[`${depositor.address}`].lp
        .mul(m1.rate)
        .div(defaultRate),
    });
  };

  const withdraw = async ({ target, withdrawer, amount }) => {
    //execute
    let tx = await target.connect(withdrawer).withdraw(amount);

    let withdrawAmount = (await tx.wait()).events[2].args["retVal"].toString();

    //update user info => check
    u[`${withdrawer.address}`].balance =
      u[`${withdrawer.address}`].balance.add(withdrawAmount);
    u[`${withdrawer.address}`].deposited =
      u[`${withdrawer.address}`].deposited.sub(withdrawAmount);
    u[`${withdrawer.address}`].lp = u[`${withdrawer.address}`].lp.sub(amount);

    expect(await usdc.balanceOf(withdrawer.address)).to.equal(
      u[`${withdrawer.address}`].balance
    );
    expect(await target.balanceOf(withdrawer.address)).to.equal(
      u[`${withdrawer.address}`].lp
    );

    //update global and market status => check
    g.totalBalance = g.totalBalance.sub(withdrawAmount);

    m1.totalSupply = m1.totalSupply.sub(amount);
    m1.depositAmount = m1.depositAmount.sub(withdrawAmount);
    m1.marketBalance = m1.marketBalance.sub(withdrawAmount);

    if (!m1.totalSupply.isZero()) {
      m1.rate = defaultRate.mul(m1.marketBalance).div(m1.totalSupply);
    } else {
      m1.rate = ZERO;
    }

    if (!m1.utilizationRate.isZero()) {
      m1.utilizationRate = UTILIZATION_RATE_LENGTH_1E6.mul(m1.insured).div(
        m1.marketBalance
      );
    } else {
      m1.utilizationRate = ZERO;
    }

    await verifyPoolsStatus({
      pools: [
        {
          pool: target,
          totalSupply: m1.totalSupply,
          totalLiquidity: m1.marketBalance,
          availableBalance: m1.marketBalance.sub(m1.insured),
          rate: m1.rate,
          utilizationRate: m1.utilizationRate,
          allInsuranceCount: m1.allInsuranceCount,
        },
      ],
    });

    await verifyDebtOf({
      vault: vault,
      target: target.address,
      debt: m1.debt,
    });

    await verifyValueOfUnderlying({
      template: target,
      valueOfUnderlyingOf: withdrawer.address,
      valueOfUnderlying: u[`${withdrawer.address}`].lp
        .mul(m1.rate)
        .div(defaultRate),
    });
  };

  const insure = async ({ pool, insurer, amount, maxCost, span, target }) => {
    await usdc.connect(insurer).approve(vault.address, maxCost);
    let tx = await pool.connect(insurer).insure(amount, maxCost, span, target);

    let receipt = await tx.wait();
    let premium = receipt.events[2].args["premium"];

    let govFee = premium.mul(governanceFeeRate).div(RATE_DIVIDER);
    let fee = premium.sub(govFee);

    //update global and market status => check
    u[`${insurer.address}`].balance =
      u[`${insurer.address}`].balance.sub(premium);
    expect(await usdc.balanceOf(insurer.address)).to.equal(
      u[`${insurer.address}`].balance
    );

    //update global and market status => check
    m1.insured = m1.insured.add(amount);
    m1.marketBalance = m1.marketBalance.add(fee);
    g.govBalance = g.govBalance.add(govFee);
    g.totalBalance = g.totalBalance.add(premium);

    if (!m1.marketBalance.isZero()) {
      m1.utilizationRate = UTILIZATION_RATE_LENGTH_1E6.mul(m1.insured).div(
        m1.marketBalance
      );
    } else {
      m1.utilizationRate = ZERO;
    }

    if (!m1.depositAmount.isZero()) {
      m1.rate = defaultRate.mul(m1.marketBalance).div(m1.totalSupply);
    } else {
      m1.rate = ZERO;
    }

    m1.allInsuranceCount = m1.allInsuranceCount.add("1");

    await verifyPoolsStatus({
      pools: [
        {
          pool: pool,
          totalSupply: m1.totalSupply,
          totalLiquidity: m1.marketBalance,
          availableBalance: m1.marketBalance.sub(m1.insured),
          rate: m1.rate,
          utilizationRate: m1.utilizationRate,
          allInsuranceCount: m1.allInsuranceCount,
        },
      ],
    });

    await verifyDebtOf({
      vault: vault,
      target: pool.address,
      debt: m1.debt,
    });

    await verifyVaultStatus_legacy({
      vault: vault,
      valueAll: g.totalBalance,
      totalAttributions: g.totalBalance,
    });

    //return value
    return premium;
  };

  const redeem = async ({ pool, redeemer, id, proof }) => {
    let tx = await pool.connect(redeemer).redeem(id, proof);

    let receipt = await tx.wait();

    let insuredAmount = receipt.events[1].args["amount"];
    let payoutAmount = receipt.events[1].args["payout"];

    //update global and market status => check
    u[`${redeemer.address}`].balance =
      u[`${redeemer.address}`].balance.add(payoutAmount);
    expect(await usdc.balanceOf(redeemer.address)).to.equal(
      u[`${redeemer.address}`].balance
    );

    //update global and market status => check
    m1.insured = m1.insured.sub(insuredAmount);
    m1.debt = m1.debt.add(payoutAmount);

    if (!m1.marketBalance.isZero()) {
      m1.utilizationRate = UTILIZATION_RATE_LENGTH_1E6.mul(m1.insured).div(
        m1.marketBalance
      );
    } else {
      m1.utilizationRate = ZERO;
    }

    if (!m1.depositAmount.isZero()) {
      m1.rate = defaultRate.mul(m1.marketBalance).div(m1.totalSupply);
    } else {
      m1.rate = ZERO;
    }

    await verifyPoolsStatus({
      pools: [
        {
          pool: pool,
          totalSupply: m1.totalSupply,
          totalLiquidity: m1.marketBalance,
          availableBalance: m1.marketBalance.sub(m1.insured),
          rate: m1.rate,
          utilizationRate: m1.utilizationRate,
          allInsuranceCount: m1.allInsuranceCount,
        },
      ],
    });

    await verifyDebtOf({
      vault: vault,
      target: pool.address,
      debt: m1.debt,
    });

    await verifyVaultStatus_legacy({
      vault: vault,
      valueAll: g.totalBalance,
      totalAttributions: g.totalBalance,
    });
  };

  const resume = async ({ market }) => {
    await market.resume();

    //no update on user status
    //update global and market status => check
    let amount = m1.marketBalance.gte(m1.debt) ? m1.debt : m1.marketBalance;

    m1.debt = m1.debt.sub(amount);
    m1.marketBalance = m1.marketBalance.sub(amount);
    g.totalBalance = g.totalBalance.sub(amount);

    if (!m1.marketBalance.isZero()) {
      m1.utilizationRate = UTILIZATION_RATE_LENGTH_1E6.mul(m1.insured).div(
        m1.marketBalance
      );
    } else {
      m1.utilizationRate = ZERO;
    }

    if (!m1.depositAmount.isZero()) {
      m1.rate = defaultRate.mul(m1.marketBalance).div(m1.totalSupply);
    } else {
      m1.rate = ZERO;
    }

    expect(m1.debt).to.equal(ZERO);
    await verifyDebtOf({
      vault: vault,
      target: market.address,
      debt: m1.debt,
    });
  };

  const unlockBatch = async ({ market, ids }) => {
    for await (id of ids) {
      let amount = (await market.insurances(id)).amount;
      //update status
      m1.insured = m1.insured.sub(amount);

      if (!m1.depositAmount.isZero()) {
        m1.rate = defaultRate.mul(m1.marketBalance).div(m1.totalSupply);
      } else {
        m1.rate = ZERO;
      }

      if (!m1.utilizationRate.isZero()) {
        m1.utilizationRate = UTILIZATION_RATE_LENGTH_1E6.mul(m1.insured).div(
          m1.marketBalance
        );
      } else {
        m1.utilizationRate = ZERO;
      }
    }

    await market.unlockBatch(ids);

    await verifyPoolsStatus({
      pools: [
        {
          pool: market,
          totalSupply: m1.totalSupply,
          totalLiquidity: m1.marketBalance,
          availableBalance: m1.marketBalance.sub(m1.insured),
          rate: m1.rate,
          utilizationRate: m1.utilizationRate,
          allInsuranceCount: m1.allInsuranceCount,
        },
      ],
    });
  };

  const unlock = async ({ target, id }) => {
    let amount = (await target.insurances(id)).amount;

    await target.unlock(id);

    //update status
    m1.insured = m1.insured.sub(amount);

    if (!m1.depositAmount.isZero()) {
      m1.rate = defaultRate.mul(m1.marketBalance).div(m1.totalSupply);
    } else {
      m1.rate = ZERO;
    }

    if (!m1.utilizationRate.isZero()) {
      m1.utilizationRate = UTILIZATION_RATE_LENGTH_1E6.mul(m1.insured).div(
        m1.marketBalance
      );
    } else {
      m1.utilizationRate = ZERO;
    }

    await verifyPoolsStatus({
      pools: [
        {
          pool: target,
          totalSupply: m1.totalSupply,
          totalLiquidity: m1.marketBalance,
          availableBalance: m1.marketBalance.sub(m1.insured),
          rate: m1.rate,
          utilizationRate: m1.utilizationRate,
          allInsuranceCount: m1.allInsuranceCount,
        },
      ],
    });
  };

  const applyCover = async ({
    pool,
    pending,
    targetAddress,
    payoutNumerator,
    payoutDenominator,
    incidentTimestamp,
  }) => {
    const padded1 = ethers.utils.hexZeroPad("0x1", 32);
    const padded2 = ethers.utils.hexZeroPad("0x2", 32);

    const getLeaves = (target) => {
      return [
        { id: padded1, account: target },
        { id: padded1, account: TEST_ADDRESS },
        { id: padded2, account: TEST_ADDRESS },
        { id: padded2, account: NULL_ADDRESS },
        { id: padded1, account: NULL_ADDRESS },
      ];
    };

    //test for pools
    const encoded = (target) => {
      const list = getLeaves(target);

      return list.map(({ id, account }) => {
        return ethers.utils.solidityKeccak256(
          ["bytes32", "address"],
          [id, account]
        );
      });
    };

    const leaves = encoded(targetAddress);
    const tree = await new MerkleTree(leaves, keccak256, { sort: true });
    const root = await tree.getHexRoot();
    const leaf = leaves[0];
    const proof = await tree.getHexProof(leaf);
    //console.log("tree", tree.toString());
    //console.log("proof", leaves, proof, root, leaf);
    //console.log("verify", tree.verify(proof, leaf, root)); // true

    await pool.applyCover(
      pending,
      payoutNumerator,
      payoutDenominator,
      incidentTimestamp,
      root,
      "raw data",
      "metadata"
    );

    return proof;
  };

  const transferLP = async ({ market, from, to_address, amount }) => {
    await market.connect(from).transfer(to_address, amount);

    let balance = amount.mul(m1.rate).div(defaultRate);

    //update user info => check
    u[`${from.address}`].lp = u[`${from.address}`].lp.sub(amount);
    u[`${from.address}`].deposited =
      u[`${from.address}`].deposited.sub(balance);

    expect(await market.balanceOf(from.address)).to.equal(
      u[`${from.address}`].lp
    );
    await verifyValueOfUnderlying({
      template: market,
      valueOfUnderlyingOf: from.address,
      valueOfUnderlying: u[`${from.address}`].lp.mul(m1.rate).div(defaultRate),
    });

    u[`${to_address}`].lp = u[`${to_address}`].lp.add(amount);
    u[`${to_address}`].deposited = u[`${to_address}`].deposited.add(balance);

    expect(await market.balanceOf(to_address)).to.equal(u[`${to_address}`].lp);
    await verifyValueOfUnderlying({
      template: market,
      valueOfUnderlyingOf: to_address,
      valueOfUnderlying: u[`${to_address}`].lp.mul(m1.rate).div(defaultRate),
    });
  };

  const transferInsurance = async ({ market, from, to_address, id }) => {
    await market.connect(from).transferInsurance(id, to_address);
  };

  const createMarket = async ({ depositAmount, references, depositor }) => {
    await usdc.connect(depositor).approve(vault.address, depositAmount);

    let tx = await factory.createMarket(
      poolTemplate.address,
      "Here is metadata.",
      [depositAmount, depositAmount], //initialDeposit
      references
    );

    let receipt = await tx.wait();
    let createdMarketAddress = receipt.events[5].args["market"];

    //update vault
    u[`${depositor.address}`].balance =
      u[`${depositor.address}`].balance.sub(depositAmount);
    g.totalBalance = g.totalBalance.add(depositAmount);

    return createdMarketAddress;
  };

  before(async () => {
    //import
    [gov, alice, bob, chad, tom] = await ethers.getSigners();
    accounts = [gov, alice, bob, chad, tom];

    for (i = 0; i < accounts.length; i++) {
      u[`${accounts[i].address}`] = {
        balance: initialMint,
        deposited: ZERO,
        lp: ZERO,
      }; //will mint for them later
    }

    const Ownership = await ethers.getContractFactory("Ownership");
    const USDC = await ethers.getContractFactory("TestERC20Mock");
    const PoolTemplate = await ethers.getContractFactory("PoolTemplate");
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
    parameters = await Parameters.deploy(ownership.address);

    //set up
    await usdc.mint(gov.address, initialMint);
    await usdc.mint(chad.address, initialMint);
    await usdc.mint(bob.address, initialMint);
    await usdc.mint(alice.address, initialMint);
    await usdc.mint(tom.address, initialMint);

    await registry.setFactory(factory.address);

    await factory.approveTemplate(poolTemplate.address, true, false, true);
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
    await factory.approveReference(poolTemplate.address, 4, ZERO_ADDRESS, true); //everyone can be initialDepositor

    //set default parameters
    await parameters.setFeeRate(ZERO_ADDRESS, governanceFeeRate);
    await parameters.setGrace(ZERO_ADDRESS, "259200");
    await parameters.setLockup(ZERO_ADDRESS, "604800");
    await parameters.setMinDate(ZERO_ADDRESS, "604800");
    await parameters.setPremiumModel(ZERO_ADDRESS, premium.address);
    await parameters.setWithdrawable(ZERO_ADDRESS, "2592000");
    await parameters.setVault(usdc.address, vault.address);

    await factory.createMarket(
      poolTemplate.address,
      "Here is metadata.",
      [0, 0], //deposit 0 USDC
      [
        usdc.address,
        usdc.address,
        registry.address,
        parameters.address,
        gov.address,
      ]
    );

    const marketAddress = await factory.markets(0);
    market = await PoolTemplate.attach(marketAddress);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    //Check status
    await verifyVaultStatusOf_legacy({
      vault: vault,
      target: market.address,
      attributions: m1.marketBalance,
      underlyingValue: m1.marketBalance,
    });

    await verifyVaultStatusOf_legacy({
      vault: vault,
      target: gov.address,
      attributions: g.govBalance,
      underlyingValue: g.govBalance,
    });

    await verifyVaultStatus_legacy({
      vault: vault,
      valueAll: g.totalBalance,
      totalAttributions: g.totalBalance,
    });

    await verifyPoolsStatus({
      pools: [
        {
          pool: market,
          totalSupply: m1.totalSupply,
          totalLiquidity: m1.marketBalance,
          availableBalance: m1.marketBalance.sub(m1.insured),
          rate: m1.rate,
          utilizationRate: m1.utilizationRate,
          allInsuranceCount: m1.allInsuranceCount,
        },
      ],
    });

    //reset status
    for (i = 0; i < accounts.length; i++) {
      u[`${accounts[i].address}`] = {
        balance: initialMint,
        deposited: ZERO,
        lp: ZERO,
      }; //will mint for them later
    }

    g.totalBalance = ZERO;
    g.govBalance = ZERO;

    m1.totalSupply = ZERO;
    m1.depositAmount = ZERO;
    m1.marketBalance = ZERO;
    m1.insured = ZERO;
    m1.rate = ZERO;
    m1.utilizationRate = ZERO;
    m1.allInsuranceCount = ZERO;
    m1.debt = ZERO;

    //go back to initial block
    await restore(snapshotId);
  });

  describe("Condition", function () {
    it("Should contracts be deployed", async () => {
      expect(usdc.address).to.exist;
      expect(factory.address).to.exist;
      expect(poolTemplate.address).to.exist;
      expect(parameters.address).to.exist;
      expect(vault.address).to.exist;
      expect(market.address).to.exist;
    });
  });

  describe("PoolTemplate", function () {
    describe("initialize", function () {
      it("original contract cannot be initialize()", async () => {
        const PoolTemplate = await ethers.getContractFactory("PoolTemplate");
        pool = await PoolTemplate.deploy();

        await expect(
          pool.initialize(
            "Here is metadata.",
            [0, 0], //deposit 0 USDC
            [usdc.address, usdc.address, registry.address, parameters.address]
          )
        ).to.revertedWith("ERROR: INITIALIZATION_BAD_CONDITIONS");
      });

      it("initial deposit", async () => {
        expect(await usdc.balanceOf(gov.address)).to.equal(initialMint);

        let depositAmount = "1";

        let market2Address = await createMarket({
          depositAmount: depositAmount,
          references: [
            usdc.address,
            usdc.address,
            registry.address,
            parameters.address,
            gov.address,
          ],
          depositor: gov,
        });

        const PoolTemplate = await ethers.getContractFactory("PoolTemplate");
        let market2 = await PoolTemplate.attach(market2Address);

        expect(await market2.balanceOf(gov.address)).to.equal(depositAmount);
      });

      it("fail when _references[0] is zero address", async () => {
        //approve whatever an address can be in _references[0].
        await factory.approveReference(
          poolTemplate.address,
          0,
          ZERO_ADDRESS,
          true
        );

        //but this PoolTemplate doesn't want address(0)
        await expect(
          factory.createMarket(
            poolTemplate.address,
            "Here is metadata.",
            [0, 0], //deposit 0 USDC
            [
              ZERO_ADDRESS,
              usdc.address,
              registry.address,
              parameters.address,
              gov.address,
            ]
          )
        ).to.revertedWith("ERROR: INITIALIZATION_BAD_CONDITIONS");
      });

      it("fail when _references[1] is zero address", async () => {
        //approve whatever an address can be in _references[1].
        await factory.approveReference(
          poolTemplate.address,
          1,
          ZERO_ADDRESS,
          true
        );

        //but this PoolTemplate doesn't want address(0)
        await expect(
          factory.createMarket(
            poolTemplate.address,
            "Here is metadata.",
            [0, 0], //deposit 0 USDC
            [
              usdc.address,
              ZERO_ADDRESS,
              registry.address,
              parameters.address,
              gov.address,
            ]
          )
        ).to.revertedWith("ERROR: INITIALIZATION_BAD_CONDITIONS");
      });

      it("fail when _references[2] is zero address", async () => {
        //approve whatever an address can be in _references[1].
        await factory.approveReference(
          poolTemplate.address,
          2,
          ZERO_ADDRESS,
          true
        );

        //but this PoolTemplate doesn't want address(0)
        await expect(
          factory.createMarket(
            poolTemplate.address,
            "Here is metadata.",
            [0, 0], //deposit 0 USDC
            [
              usdc.address,
              usdc.address,
              ZERO_ADDRESS,
              parameters.address,
              gov.address,
            ]
          )
        ).to.revertedWith("ERROR: INITIALIZATION_BAD_CONDITIONS");
      });

      it("fail when _references[3] is zero address", async () => {
        //approve whatever an address can be in _references[1].
        await factory.approveReference(
          poolTemplate.address,
          3,
          ZERO_ADDRESS,
          true
        );

        //but this PoolTemplate doesn't want address(0)
        await expect(
          factory.createMarket(
            poolTemplate.address,
            "Here is metadata.",
            [0, 0], //deposit 0 USDC
            [
              usdc.address,
              usdc.address,
              registry.address,
              ZERO_ADDRESS,
              gov.address,
            ]
          )
        ).to.revertedWith("ERROR: INITIALIZATION_BAD_CONDITIONS");
      });

      it("fail when _references[4] is zero address", async () => {
        //approve whatever an address can be in _references[1].
        await factory.approveReference(
          poolTemplate.address,
          4,
          ZERO_ADDRESS,
          true
        );

        //but this PoolTemplate doesn't want address(0)
        await expect(
          factory.createMarket(
            poolTemplate.address,
            "Here is metadata.",
            [0, 0], //deposit 0 USDC
            [
              usdc.address,
              usdc.address,
              registry.address,
              parameters.address,
              ZERO_ADDRESS,
            ]
          )
        ).to.revertedWith("ERROR: INITIALIZATION_BAD_CONDITIONS");
      });

      it("fail when bytes(_metaData).length == 0", async () => {
        await expect(
          factory.createMarket(
            poolTemplate.address,
            "",
            [0, 0], //deposit 0 USDC
            [
              usdc.address,
              usdc.address,
              registry.address,
              parameters.address,
              gov.address,
            ]
          )
        ).to.revertedWith("ERROR: INITIALIZATION_BAD_CONDITIONS");
      });
    });

    describe("deposit", function () {
      it("success deposit", async () => {
        await approveDeposit({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });
      });

      it("fail when market is Payingout status", async () => {
        await approveDeposit({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        let incident = await now();
        await applyCover({
          pool: market,
          pending: 604800,
          targetAddress: ZERO_ADDRESS, //everyone
          payoutNumerator: 10000,
          payoutDenominator: 10000,
          incidentTimestamp: incident,
        });

        await expect(
          market.connect(alice).deposit(depositAmount)
        ).to.revertedWith("ERROR: DEPOSIT_DISABLED");
      });

      it("fail when amount is not more than zero", async () => {
        await expect(market.connect(alice).deposit(ZERO)).to.revertedWith(
          "ERROR: DEPOSIT_ZERO"
        );
      });
    });

    describe("requestWithdraw", function () {
      it("fail when amount is not more than zero", async () => {
        await expect(market.requestWithdraw(ZERO)).to.revertedWith(
          "ERROR: REQUEST_ZERO"
        );
      });
    });

    describe("withdraw", function () {
      it("allows withdraw", async function () {
        //deposit
        await approveDepositAndWithdrawRequest({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        //Forward 8days
        await moveForwardPeriods(8);

        //withdraw
        await withdraw({
          target: market,
          withdrawer: alice,
          amount: depositAmount,
        });
      });

      it("revert withdraw when payingout", async function () {
        await approveDeposit({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await market.connect(alice).requestWithdraw(depositAmount);

        let incident = await now();
        await applyCover({
          pool: market,
          pending: 604800,
          targetAddress: ZERO_ADDRESS, //everyone
          payoutNumerator: 10000,
          payoutDenominator: 10000,
          incidentTimestamp: incident,
        });

        await expect(
          market.connect(alice).withdraw(depositAmount)
        ).to.revertedWith("ERROR: WITHDRAWAL_PENDING");
      });

      it("revert withdraw when earlier than withdrawable timestamp", async () => {
        await approveDepositAndWithdrawRequest({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await expect(
          market.connect(alice).withdraw(depositAmount)
        ).to.revertedWith("ERROR: WITHDRAWAL_QUEUE");
      });

      it("revert when no deposit", async () => {
        await expect(
          market.connect(alice).withdraw(depositAmount)
        ).to.revertedWith("ERROR: NO_AVAILABLE_LIQUIDITY");
      });

      it("revert withdraw when not requested", async function () {
        await approveDeposit({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await moveForwardPeriods(8);

        //withdraw without request
        await expect(
          market.connect(alice).withdraw(depositAmount)
        ).to.revertedWith("ERROR: WITHDRAWAL_NO_ACTIVE_REQUEST");
      });

      it("revert withdraw when amount > requested", async function () {
        await approveDepositAndWithdrawRequest({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await moveForwardPeriods(8);

        await expect(
          market.connect(alice).withdraw(depositAmount.add(1))
        ).to.revertedWith("ERROR: WITHDRAWAL_EXCEEDED_REQUEST");
      });

      it("revert withdraw when withdrawable span is over", async function () {
        await approveDepositAndWithdrawRequest({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        //withdraw span is 30days(2592000)
        await moveForwardPeriods(40);

        await expect(
          market.connect(alice).withdraw(depositAmount)
        ).to.revertedWith("ERROR: WITHDRAWAL_NO_ACTIVE_REQUEST");
      });

      it("revert withdraw request more than balance", async function () {
        await approveDeposit({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await expect(
          market.connect(alice).requestWithdraw(depositAmount.add(1))
        ).to.revertedWith("ERROR: REQUEST_EXCEED_BALANCE");
      });

      it("revert withdraw with zero balance", async function () {
        await approveDepositAndWithdrawRequest({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await moveForwardPeriods(8);
        await expect(market.connect(alice).withdraw("0")).to.revertedWith(
          "ERROR: WITHDRAWAL_ZERO"
        );
      });

      it("revert withdraw when liquidity is locked for insurance", async function () {
        await approveDepositAndWithdrawRequest({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await usdc.connect(bob).approve(vault.address, insureAmount);

        await insure({
          pool: market,
          insurer: bob,
          amount: insureAmount,
          maxCost: insureAmount,
          span: WEEK,
          target: padded1,
        });

        await moveForwardPeriods(8);

        await expect(
          market.connect(alice).withdraw(depositAmount)
        ).to.revertedWith("ERROR: WITHDRAW_INSUFFICIENT_LIQUIDITY");
      });
    });

    describe("unlockBatch", function () {
      it("Unlocks an array of insurances", async () => {
        await approveDeposit({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await insure({
          pool: market,
          insurer: bob,
          amount: depositAmount.div("2"),
          maxCost: depositAmount,
          span: WEEK,
          target: padded1,
        });

        await insure({
          pool: market,
          insurer: bob,
          amount: depositAmount.div("2"),
          maxCost: depositAmount,
          span: WEEK,
          target: padded1,
        });

        await moveForwardPeriods(10);

        await unlockBatch({
          market: market,
          ids: [0, 1],
        });
      });
    });

    describe("allocateCredit", function () {
      it("reverts when trying to allocate zero", async () => {
        await expect(market.allocateCredit(ZERO)).to.revertedWith(
          "ERROR: ALLOCATE_CREDIT_BAD_CONDITIONS"
        );
      });

      it("accrue stored premium", async () => {});
    });

    describe("insure", function () {
      it("exeeded amount", async () => {
        await approveDepositAndWithdrawRequest({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await expect(
          market.connect(bob).insure(
            depositAmount.add(1), //more than deposited
            depositAmount,
            WEEK,
            padded1
          )
        ).to.revertedWith("ERROR: INSURE_EXCEEDED_AVAILABLE_BALANCE");
      });

      it("revert when exceed max cost", async () => {
        // 455
        // ERROR: INSURE_EXCEEDED_MAX_COST
        await approveDepositAndWithdrawRequest({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await expect(
          market.connect(bob).insure(
            depositAmount,
            ZERO, //zero
            WEEK,
            padded1
          )
        ).to.revertedWith("ERROR: INSURE_EXCEEDED_MAX_COST");
      });
      it("revert when exceed max period", async () => {
        // 456
        // ERROR: INSURE_EXCEEDED_MAX_SPAN
        await approveDepositAndWithdrawRequest({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await expect(
          market.connect(bob).insure(
            depositAmount,
            depositAmount,
            YEAR.add(1), //max is YEAR
            padded1
          )
        ).to.revertedWith("ERROR: INSURE_EXCEEDED_MAX_SPAN");
      });
      it("revert when blow min period", async () => {
        // 457
        // ERROR: INSURE_SPAN_BELOW_MIN
        await approveDepositAndWithdrawRequest({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await expect(
          market.connect(bob).insure(
            depositAmount,
            depositAmount,
            WEEK.sub(1), //min is WEEK
            padded1
          )
        ).to.revertedWith("ERROR: INSURE_SPAN_BELOW_MIN");
      });

      it("revert when market is pending", async () => {
        // 462
        // ERROR: INSURE_MARKET_PENDING"
        await approveDepositAndWithdrawRequest({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        incident = await now();
        await applyCover({
          pool: market,
          pending: 604800,
          targetAddress: ZERO_ADDRESS,
          payoutNumerator: 10000,
          payoutDenominator: 10000,
          incidentTimestamp: incident,
        });

        await expect(
          market
            .connect(bob)
            .insure(depositAmount, depositAmount, WEEK, padded1)
        ).to.revertedWith("ERROR: INSURE_MARKET_PENDING");
      });

      it("revert when paused", async () => {
        await approveDepositAndWithdrawRequest({
          token: usdc,
          target: market,
          depositor: alice,
          amount: depositAmount,
        });

        await market.setPaused(true);
        await expect(
          market.connect(bob).insure(insureAmount, insureAmount, WEEK, padded1)
        ).to.revertedWith("ERROR: INSURE_MARKET_PAUSED");
      });
    });

    describe("redeem", function () {
      it("should redeem the covered amount", async () => {});
    });

    describe("transferInsurance", function () {
      it("should transfer the insurance", async () => {});
    });

    describe("resume", function () {});
  });

  describe("Liquidity providing life cycles", function () {
    it("allows unlock liquidity only after an insurance period over", async function () {
      await approveDepositAndWithdrawRequest({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmount,
      });

      await moveForwardPeriods(8);

      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: WEEK,
        target: padded1,
      });

      await expect(market.unlock("0")).to.revertedWith(
        "ERROR: UNLOCK_BAD_COINDITIONS"
      );

      await moveForwardPeriods(10);

      await unlock({
        target: market,
        id: 0,
      });

      await withdraw({
        target: market,
        withdrawer: alice,
        amount: depositAmount,
      });
    });

    it("beforeTransfer works", async function () {
      await approveDepositAndWithdrawRequest({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmount,
      });

      await moveForwardPeriods(8);

      await transferLP({
        market: market,
        from: alice,
        to_address: tom.address,
        amount: depositAmount.div(2),
      });

      await expect(
        market.connect(alice).withdraw(depositAmount.div(2).add(1))
      ).to.revertedWith("ERROR: WITHDRAWAL_EXCEEDED_REQUEST");

      await withdraw({
        target: market,
        withdrawer: alice,
        amount: depositAmount.div(2),
      });
    });

    it("accrues premium after deposit", async function () {
      await approveDepositAndWithdrawRequest({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmount,
      });

      //id = 0
      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: YEAR,
        target: padded1,
      });

      //the premium paid second time should be allocated to both Alice and Chad
      //but the premium paid first time should be directly go to Alice
      await approveDeposit({
        token: usdc,
        target: market,
        depositor: chad,
        amount: depositAmount,
      });

      //id = 1
      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: YEAR,
        target: padded1,
      });

      //withdrawal also harvest accrued premium
      await moveForwardPeriods(369);

      await market.connect(alice).requestWithdraw(depositAmount);

      await unlock({
        target: market,
        id: 0,
      });

      await unlock({
        target: market,
        id: 1,
      });

      await moveForwardPeriods(8);

      await withdraw({
        target: market,
        withdrawer: alice,
        amount: depositAmount,
      });
    });

    it("revert deposit when paused (withdrawal is possible)", async function () {
      await approveDepositAndWithdrawRequest({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmount,
      });

      await market.setPaused(true);

      await usdc.connect(alice).approve(vault.address, depositAmount);
      await expect(
        market.connect(alice).deposit(depositAmount)
      ).to.revertedWith("ERROR: DEPOSIT_DISABLED");

      await moveForwardPeriods(8);

      await withdraw({
        target: market,
        withdrawer: alice,
        amount: depositAmount,
      });

      await verifyBalances({
        token: usdc,
        userBalances: {
          [alice.address]: initialMint,
        },
      });
    });

    it("devaluate underlying but premium is not affected when cover claim is accepted", async function () {
      //Simulation: partial payout
      await approveDepositAndWithdrawRequest({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmount,
      });

      //id=0
      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: WEEK,
        target: padded1,
      });

      let incident = await now();

      let proof = await applyCover({
        pool: market,
        pending: 604800,
        targetAddress: ZERO_ADDRESS,
        payoutNumerator: 5000,
        payoutDenominator: 10000,
        incidentTimestamp: incident,
      });

      await redeem({
        pool: market,
        redeemer: bob,
        id: 0,
        proof: proof,
      });

      await expect(market.unlock("0")).to.revertedWith(
        "ERROR: UNLOCK_BAD_COINDITIONS"
      );

      await moveForwardPeriods(11);

      await resume({
        market: market,
      });

      await withdraw({
        target: market,
        withdrawer: alice,
        amount: depositAmount,
      });

      //Simulation: full payout
      await approveDepositAndWithdrawRequest({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmount,
      });

      //id=1
      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount.div(10),
        maxCost: insureAmount.div(10),
        span: WEEK,
        target: padded1,
      });

      incident = await now();
      proof = await applyCover({
        pool: market,
        pending: 604800,
        targetAddress: ZERO_ADDRESS,
        payoutNumerator: 10000,
        payoutDenominator: 10000,
        incidentTimestamp: incident,
      });

      await redeem({
        pool: market,
        redeemer: bob,
        id: "1",
        proof: proof,
      });

      expect(await market.valueOfUnderlying(alice.address)).to.equal(
        u[alice.address].lp.mul(m1.rate).div(defaultRate)
      );

      await moveForwardPeriods(11);

      await resume({
        market: market,
      });

      await withdraw({
        target: market,
        withdrawer: alice,
        amount: depositAmount,
      });
    });
  });

  describe("Getting insured", function () {
    it("allows protection", async function () {
      await approveDepositAndWithdrawRequest({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmount,
      });

      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: WEEK,
        target: padded1,
      });

      let incident = await now();
      let proof = await applyCover({
        pool: market,
        pending: 604800,
        targetAddress: ZERO_ADDRESS,
        payoutNumerator: 5000,
        payoutDenominator: 10000,
        incidentTimestamp: incident,
      });

      await redeem({
        pool: market,
        redeemer: bob,
        id: "0",
        proof: proof,
      });

      await moveForwardPeriods(12);
      await resume({
        market: market,
      });

      await expect(market.unlock("0")).to.revertedWith(
        "ERROR: UNLOCK_BAD_COINDITIONS"
      );

      await withdraw({
        target: market,
        withdrawer: alice,
        amount: depositAmount,
      });
    });

    it("allows insurance transfer", async function () {
      await approveDepositAndWithdrawRequest({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmount,
      });

      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: WEEK,
        target: padded1,
      });

      await market.connect(bob).transferInsurance("0", tom.address);

      let incident = await now();
      let proof = await applyCover({
        pool: market,
        pending: 604800,
        targetAddress: ZERO_ADDRESS,
        payoutNumerator: 5000,
        payoutDenominator: 10000,
        incidentTimestamp: incident,
      });

      await redeem({
        pool: market,
        redeemer: tom,
        id: "0",
        proof: proof,
      });

      await moveForwardPeriods(11);
      await resume({
        market: market,
      });

      await withdraw({
        target: market,
        withdrawer: alice,
        amount: depositAmount,
      });

      await verifyBalances({
        token: usdc,
        userBalances: {
          [alice.address]: u[alice.address].balance,
          [tom.address]: u[tom.address].balance,
        },
      });
    });
    it("revert redemption when insurance is not m1 target", async function () {
      await approveDepositAndWithdrawRequest({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmount,
      });

      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: WEEK,
        target: padded1,
      });

      let incident = await now();
      let proof = await applyCover({
        pool: market,
        pending: 604800,
        targetAddress: ZERO_ADDRESS,
        payoutNumerator: 5000,
        payoutDenominator: 10000,
        incidentTimestamp: incident,
      });

      await moveForwardPeriods(12);

      await resume({
        market: market,
      });

      await expect(market.connect(bob).redeem("0", proof)).to.revertedWith(
        "ERROR: NO_APPLICABLE_INCIDENT"
      );

      await unlock({
        target: market,
        id: 0,
      });

      await withdraw({
        target: market,
        withdrawer: alice,
        amount: depositAmount,
      });

      await verifyBalances({
        token: usdc,
        userBalances: {
          [alice.address]: u[alice.address].balance,
        },
      });
    });
    it("revert getting insured when there is not enough liquidity", async function () {
      await approveDepositAndWithdrawRequest({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmount,
      });

      await expect(
        market
          .connect(bob)
          .insure(depositAmount.add(1), depositAmount, WEEK, padded1)
      ).to.revertedWith("ERROR: INSURE_EXCEEDED_AVAILABLE_BALANCE");

      await moveForwardPeriods(8);

      await withdraw({
        target: market,
        withdrawer: alice,
        amount: depositAmount,
      });

      await verifyBalances({
        token: usdc,
        userBalances: {
          [alice.address]: initialMint,
        },
      });
    });

    it("revert redemption when redemption period is over", async function () {
      await approveDepositAndWithdrawRequest({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmount,
      });

      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: WEEK,
        target: padded1,
      });

      let incident = await now();
      let proof = await applyCover({
        pool: market,
        pending: 604800,
        targetAddress: ZERO_ADDRESS,
        payoutNumerator: 5000,
        payoutDenominator: 10000,
        incidentTimestamp: incident,
      });

      await moveForwardPeriods(12);

      await resume({
        market: market,
      });

      await expect(market.connect(bob).redeem("0", proof)).to.revertedWith(
        "ERROR: NO_APPLICABLE_INCIDENT"
      );

      await unlock({
        target: market,
        id: 0,
      });

      await withdraw({
        target: market,
        withdrawer: alice,
        amount: depositAmount,
      });

      await verifyBalances({
        token: usdc,
        userBalances: {
          [alice.address]: u[alice.address].balance,
        },
      });
    });

    it("revert getting insured when paused, reporting, or payingout", async function () {
      //Can get insured in normal time
      await approveDeposit({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmountLarge,
      });

      await market.connect(alice).requestWithdraw("10000");

      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: WEEK,
        target: padded1,
      });

      //Cannot get insured when payingout
      let incident = await now();
      await applyCover({
        pool: market,
        pending: 604800,
        targetAddress: ZERO_ADDRESS,
        payoutNumerator: 10000,
        payoutDenominator: 10000,
        incidentTimestamp: incident,
      });

      await expect(
        market
          .connect(bob)
          .insure(insureAmount, insureAmount, DAY.mul(6), padded1)
      ).to.revertedWith("ERROR: INSURE_SPAN_BELOW_MIN");

      await moveForwardPeriods(11);

      await resume({
        market: market,
      });

      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: WEEK,
        target: padded1,
      });

      //Cannot get insured when paused
      await market.setPaused(true);
      await expect(
        market.connect(bob).insure(insureAmount, insureAmount, WEEK, padded1)
      ).to.revertedWith("ERROR: INSURE_MARKET_PAUSED");

      await market.setPaused(false);

      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: WEEK,
        target: padded1,
      });
    });

    it("revert more than 365 days insurance", async function () {
      //Can get insured in normal time
      await approveDeposit({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmountLarge,
      });
      await market.connect(alice).requestWithdraw("10000");

      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: YEAR,
        target: padded1,
      });
      //Cannot get insured for more than 365 days
      await expect(
        market
          .connect(bob)
          .insure(insureAmount, insureAmount, YEAR.add(DAY), padded1)
      ).to.revertedWith("ERROR: INSURE_EXCEEDED_MAX_SPAN");
    });

    it("revert insurance transfer if its expired or non existent", async function () {
      await approveDeposit({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmountLarge,
      });
      await market.connect(alice).requestWithdraw("10000");

      //when expired
      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: WEEK,
        target: padded1,
      });

      await moveForwardPeriods(9);

      await expect(
        market.connect(bob).transferInsurance("0", tom.address)
      ).to.revertedWith("ERROR: INSURANCE_TRANSFER_BAD_CONDITIONS");

      //when already redeemed
      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: WEEK,
        target: padded1,
      });

      let incident = await now();
      let proof = await applyCover({
        pool: market,
        pending: 604800,
        targetAddress: ZERO_ADDRESS,
        payoutNumerator: 5000,
        payoutDenominator: 10000,
        incidentTimestamp: incident,
      });

      await redeem({
        pool: market,
        redeemer: bob,
        id: "1",
        proof: proof,
      });

      await expect(
        market.connect(bob).transferInsurance("1", tom.address)
      ).to.revertedWith("ERROR: INSURANCE_TRANSFER_BAD_CONDITIONS");
    });
  });

  describe("Utilities", function () {
    it("retunrs accurate data", async function () {
      await approveDeposit({
        token: usdc,
        target: market,
        depositor: alice,
        amount: depositAmountLarge,
      });

      await market.connect(alice).requestWithdraw("10000");

      await insure({
        pool: market,
        insurer: bob,
        amount: insureAmount,
        maxCost: insureAmount,
        span: YEAR,
        target: padded1,
      });

      await insure({
        pool: market,
        insurer: chad,
        amount: insureAmount,
        maxCost: insureAmount,
        span: YEAR,
        target: padded1,
      });

      expect(await market.allInsuranceCount()).to.equal("2");
    });
  });
});
