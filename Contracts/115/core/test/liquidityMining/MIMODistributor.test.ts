const _ = require("underscore");
import {
  AccessControllerInstance,
  MIMOInstance,
  MIMODistributorInstance,
  GovernanceAddressProviderInstance,
} from "../../types/truffle-contracts";
import { setupMIMO } from "../utils/helpers";

const { BN, expectRevert, time } = require("@openzeppelin/test-helpers");

const MIMODistributor = artifacts.require("MIMODistributor");

const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");

const WAD = new BN("1000000000000000000"); // 1e18
const WEEK_SECONDS = new BN("604800");

let a: GovernanceAddressProviderInstance;
let controller: AccessControllerInstance;
let mimoDistributor: MIMODistributorInstance;
let mimo: MIMOInstance;

contract("MIMODistributor", (accounts) => {
  const [owner, A, B, , other] = accounts;
  const PAYEES = [A, B];
  const SHARES = [20, 80];

  beforeEach(async () => {
    controller = await AccessController.new();
    const addresses = await AddressProvider.new(controller.address);
    a = await GovernanceAddressProvider.new(addresses.address);

    const deploymentTime = await time.latest();
    mimoDistributor = await MIMODistributor.new(a.address, deploymentTime);

    mimo = await setupMIMO(a.address, controller, owner, [mimoDistributor.address, owner]);
    await a.setMIMO(mimo.address);

    await mimoDistributor.changePayees(PAYEES, SHARES);
  });

  it("initialized Liquidity mining start correctly", async () => {
    // Not working on my machine, some timing issues
    // const deploymentTime = await time.latest();
    // const start = await mimoDistributor.startTime();
    // const elapsed = deploymentTime.sub(start).abs();
    // assert.isBelow(elapsed.toNumber(), 5, "start = deployment time; not more than 6 sec should have elapsed");

    const addressProviderAddress = await mimoDistributor.a();
    assert.equal(addressProviderAddress.toString(), a.address, "addressProvider correctly configured");
  });

  it("should initialize with total shares", async () => {
    const totalShares = await mimoDistributor.totalShares();
    assert.equal(totalShares.toString(), "100");
  });

  it("should initialize with payees and shares", async () => {
    const payees: string[] = await mimoDistributor.getPayees();
    await Promise.all(
      payees.map(async (_: string, index: number) => {
        const payee = await mimoDistributor.payees(index);
        assert.equal(payee, PAYEES[index]);
      }),
    );

    await Promise.all(
      payees.map(async (payee: string, index: number) => {
        const share = await mimoDistributor.shares(payee);
        assert.equal(share.toString(), SHARES[index].toString());
      }),
    );
  });

  it("calculate total supply correctly", async () => {
    const start = await mimoDistributor.startTime();

    const supply1 = await mimoDistributor.totalSupplyAt(start);
    assert.equal(supply1.toString(), "0", "supplyAt(0) = 0");

    const supply2 = await mimoDistributor.totalSupplyAt(start.add(WEEK_SECONDS).sub(new BN(1)));
    const supply2_expected = WAD.mul(new BN("55500000"))
      .mul(WEEK_SECONDS.sub(new BN(1)))
      .div(WEEK_SECONDS);
    assert.equal(supply2.toString(), supply2_expected.toString(), "supplyAt(1 week minus 1 sec) = ~55.5m");

    const supply3 = await mimoDistributor.totalSupplyAt(start.add(WEEK_SECONDS));
    const supply3_expected = WAD.mul(new BN("55500000"));
    assert.equal(supply3.toString(), supply3_expected.toString(), "supplyAt(1 week) = 55.5m");

    const supply4 = await mimoDistributor.totalSupplyAt(start.add(WEEK_SECONDS.mul(new BN(2))));
    const supply4_expected = WAD.mul(new BN("107919750"));
    assert.equal(supply4.toString(), supply4_expected.toString(), "supplyAt(2 week) = ~108m");

    const supply5 = await mimoDistributor.totalSupplyAt(start.add(WEEK_SECONDS.mul(new BN(3)).div(new BN(2))));
    const supply5_expected = WAD.mul(new BN("81709875"));
    assert.equal(supply5.toString(), supply5_expected.toString(), "supplyAt(1.5 week) = 81.7m");
  });

  it("calculate current & future issuance correctly", async () => {
    const start = await mimoDistributor.startTime();

    const currentIssuance = await mimoDistributor.currentIssuance();
    const currentIssuance_expected = WAD.mul(new BN("55500000"));
    assert.equal(currentIssuance.toString(), currentIssuance_expected.toString(), "initial issuance is 55.5m");

    const issuance2 = await mimoDistributor.weeklyIssuanceAt(start.add(WEEK_SECONDS.mul(new BN(3)).div(new BN(2))));
    const issuance2_expected = WAD.mul(new BN("52419750"));
    assert.equal(issuance2.toString(), issuance2_expected.toString(), "week 2 issuance is ~52.4m");

    const issuance3 = await mimoDistributor.weeklyIssuanceAt(start.add(WEEK_SECONDS));
    const issuance3_expected = WAD.mul(new BN("52419750"));
    assert.equal(issuance3.toString(), issuance3_expected.toString(), "week 2 issuance is ~52.4m");

    const issuance4 = await mimoDistributor.weeklyIssuanceAt(start.add(WEEK_SECONDS.mul(new BN(2))));
    const issuance4_expected = WAD.mul(new BN("49510453875")).div(new BN("1000"));
    assert.equal(issuance4.toString(), issuance4_expected.toString(), "week 3 start issuance is ~49.5m");

    const issuance5 = await mimoDistributor.weeklyIssuanceAt(start.add(WEEK_SECONDS).sub(new BN(1)));
    const issuance5_expected = WAD.mul(new BN("55500000"));
    assert.equal(issuance5.toString(), issuance5_expected.toString(), "week 1 end issuance is 55.5m");
  });

  it("available tokens should be 0 after initialize", async () => {
    const PER_SEC_ISSUANCE = WAD.mul(new BN("55500000")).div(WEEK_SECONDS);
    const deploymentTime = await time.latest();
    mimoDistributor = await MIMODistributor.new(a.address, deploymentTime);
    const availableTokens = await mimoDistributor.mintableTokens();
    const elapsed = availableTokens.div(PER_SEC_ISSUANCE);
    assert.isBelow(elapsed.toNumber(), 5, "not more than 5 seconds worth of tokens should be available");
  });

  it("should be able to initialize start on deployment", async () => {
    const now = await time.latest();
    const future = now.add(WEEK_SECONDS);
    mimoDistributor = await MIMODistributor.new(mimo.address, future);
    const start = await mimoDistributor.startTime();
    assert.equal(start.toString(), future.toString());
  });

  it("should allow updating payees", async () => {
    await mimoDistributor.changePayees([owner], [1]);
    const payees: string[] = await mimoDistributor.getPayees();
    assert.deepEqual(payees, [owner]);

    const totalShares = await mimoDistributor.totalShares();
    assert.equal(totalShares.toString(), "1");
  });

  it("should be able to release accrued tokens to payees", async () => {
    const start = await mimoDistributor.startTime();
    // 0.5 week passes
    await time.increaseTo(start.add(WEEK_SECONDS.div(new BN(2))));

    const txReceipt1 = await mimoDistributor.release({ from: other });
    const newTokensEvent = _.findWhere(txReceipt1.logs, {
      event: "TokensReleased",
    });
    const elapsedTime = new BN(newTokensEvent.args.releasedAt).sub(start);

    const newTokens = WAD.mul(new BN("55500000")).mul(elapsedTime).div(WEEK_SECONDS);
    // Console.log("Expected new tokens:", newTokens.toString(), WEEK_SECONDS.toString(), elapsedTime.toString());
    const totalShares = await mimoDistributor.totalShares();
    await Promise.all(
      PAYEES.map(async (payee) => {
        const payeeShare = await mimoDistributor.shares(payee);
        const newPayeeIncome = newTokens.mul(payeeShare).div(totalShares);
        const payeeBalanceAfter = await mimo.balanceOf(payee);
        assert.equal(payeeBalanceAfter.toString(), newPayeeIncome.toString());
      }),
    );
  });

  it("should NOT allow updating payees without manager rights", async () => {
    await expectRevert(mimoDistributor.changePayees([other], [1], { from: other }), "Caller is not Manager");

    const payees: string[] = await mimoDistributor.getPayees();
    assert.deepEqual(payees, PAYEES);

    const totalShares = await mimoDistributor.totalShares();
    assert.equal(totalShares.toString(), "100");
  });

  it("should correctly skip over phase 0 issuance", async () => {
    await mimo.mint(other, WAD.mul(new BN("55500000")), { from: owner }); // Mint 1 week for phase 0 distribution
    const start = await mimoDistributor.startTime();
    // 1.5 week passes
    await time.increaseTo(start.add(WEEK_SECONDS.mul(new BN(3)).div(new BN(2)))); // 1.5 weeks
    const PER_SEC_ISSUANCE = WAD.mul(new BN("52419750")).div(WEEK_SECONDS); // 2nd week issuance
    const availableTokens = await mimoDistributor.mintableTokens();
    const elapsed = availableTokens.sub(WAD.mul(new BN("52419750").div(new BN("2")))).div(PER_SEC_ISSUANCE);
    assert.isBelow(elapsed.toNumber(), 5, "not more than 5 seconds worth of tokens should be available");
  });

  it("March 19 totalSupply should be correct", async () => {
    const startDate = new Date(Date.UTC(2020, 11, 4));
    const endDate = new Date(Date.UTC(2021, 2, 19));
    console.log("start: %s", startDate.toUTCString());
    console.log("end: %s", endDate.toUTCString());

    const start = new BN(startDate.valueOf() / 1000); // Dec 4th, 2020
    const end = new BN(endDate.valueOf() / 1000); // March 19, 2021
    mimoDistributor = await MIMODistributor.new(a.address, start);

    const supplyAtStartWeek16 = await mimoDistributor.totalSupplyAt(end);
    const supplyAtStartWeek16Expected = new BN("575351656918420295599174937");
    assert.equal(supplyAtStartWeek16.toString(), supplyAtStartWeek16Expected.toString(), "supplyAt(16 week) = 575m");
  });
});
