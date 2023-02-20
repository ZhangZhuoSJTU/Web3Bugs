import {
  AccessControllerInstance,
  MIMOInstance,
  MIMODistributorInstance,
  MIMODistributorV2Instance,
  GovernanceAddressProviderInstance,
} from "../../types/truffle-contracts";
import { setupMIMO } from "../utils/helpers";

const { BN, time } = require("@openzeppelin/test-helpers");

const MIMODistributor = artifacts.require("MIMODistributor");
const MIMODistributorV2 = artifacts.require("MIMODistributorV2");

const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");

const MIMO_MINTER_ROLE = web3.utils.keccak256("MIMO_MINTER_ROLE");
const WEEK_SECONDS = new BN("604800");

let a: GovernanceAddressProviderInstance;
let controller: AccessControllerInstance;
let mimoDistributor: MIMODistributorInstance;
let mimoDistributorV2: MIMODistributorV2Instance;
let mimo: MIMOInstance;

contract("MIMODistributorV2", (accounts) => {
  const [owner, A, B] = accounts;
  const PAYEES = [A, B];
  const SHARES = [20, 80];

  const startDate = new Date(Date.UTC(2020, 11, 4));
  const start = new BN(startDate.valueOf() / 1000); // Dec 4th, 2020
  const startDateV2 = new Date(Date.UTC(2021, 8, 10, 0, 0, 0));
  const startV2 = new BN(startDateV2.valueOf() / 1000);

  beforeEach(async () => {
    controller = await AccessController.new();
    const addresses = await AddressProvider.new(controller.address);
    a = await GovernanceAddressProvider.new(addresses.address);

    mimoDistributor = await MIMODistributor.new(a.address, start);

    mimo = await setupMIMO(a.address, controller, owner, [mimoDistributor.address, owner]);
    await a.setMIMO(mimo.address);

    await mimoDistributor.changePayees(PAYEES, SHARES);
    mimoDistributorV2 = await MIMODistributorV2.new(a.address, startV2, mimoDistributor.address);
    await controller.grantRole(MIMO_MINTER_ROLE, mimoDistributorV2.address);
    await mimoDistributorV2.changePayees(PAYEES, SHARES);
  });

  it("should calculate first weekly issuance correctly", async () => {
    const weeklyIssuance = await mimoDistributor.weeklyIssuanceAt(startV2);
    const weeklyIssuanceV2 = await mimoDistributorV2.weeklyIssuanceAt(startV2);
    assert.equal(weeklyIssuance.div(new BN(4)).toString(), weeklyIssuanceV2.toString());
  });

  it("should calculate total supply after two weeks correctly", async () => {
    const oneWeekLater = startV2.add(WEEK_SECONDS);
    const twoWeeksLater = oneWeekLater.add(WEEK_SECONDS);
    const totalSupplyAtV1 = await mimoDistributor.totalSupplyAt(startV2);
    const totalSupplyAtV2 = await mimoDistributorV2.totalSupplyAt(twoWeeksLater);
    const firstWeekIssuance = await mimoDistributorV2.weeklyIssuanceAt(startV2);
    const secondWeekIssuance = await mimoDistributorV2.weeklyIssuanceAt(oneWeekLater);
    const expectedTotalSupply = totalSupplyAtV1.add(firstWeekIssuance).add(secondWeekIssuance);

    assert.equal(totalSupplyAtV2.div(new BN(1000)).toString(), expectedTotalSupply.div(new BN(1000)).toString());
  });

  it("should never go above 1B supply", async () => {
    const fiftyYearsLater = startV2.add(time.duration.years(50));
    const totalSupplyAtV2 = await mimoDistributorV2.totalSupplyAt(fiftyYearsLater);

    const billion = new BN("1000000000000000000000000000");
    assert.isTrue(totalSupplyAtV2.lte(billion));
  });

  it.skip("should release all remaining tokens", async () => {
    await mimoDistributor.release();

    await time.increase(time.duration.weeks(1));
    await mimoDistributorV2.release();

    const newMimoSupply = await mimo.totalSupply();
    const totalSupplyAtV2 = await mimoDistributorV2.totalSupplyAt(await time.latest());
    assert.equal(newMimoSupply.div(new BN(1000)).toString(), totalSupplyAtV2.div(new BN(1000)).toString());
  });

  it("should log all expected supply", async () => {
    const oct21 = new BN(new Date(Date.UTC(2021, 9, 1)).valueOf() / 1000);
    const oct22 = new BN(new Date(Date.UTC(2022, 9, 1)).valueOf() / 1000);
    const oct23 = new BN(new Date(Date.UTC(2023, 9, 1)).valueOf() / 1000);
    const oct24 = new BN(new Date(Date.UTC(2024, 9, 1)).valueOf() / 1000);
    const oct25 = new BN(new Date(Date.UTC(2025, 9, 1)).valueOf() / 1000);
    const oct26 = new BN(new Date(Date.UTC(2026, 9, 1)).valueOf() / 1000);
    const oct27 = new BN(new Date(Date.UTC(2027, 9, 1)).valueOf() / 1000);
    const oct28 = new BN(new Date(Date.UTC(2028, 9, 1)).valueOf() / 1000);
    const oct35 = new BN(new Date(Date.UTC(2035, 9, 1)).valueOf() / 1000);
    const oct50 = new BN(new Date(Date.UTC(2050, 9, 1)).valueOf() / 1000);
    const oct75 = new BN(new Date(Date.UTC(2075, 9, 1)).valueOf() / 1000);
    const oct100 = new BN(new Date(Date.UTC(2100, 9, 1)).valueOf() / 1000);
    console.log(
      "Oct 1st 2021",
      (await mimoDistributor.totalSupplyAt(oct21)).toString(),
      "vs",
      (await mimoDistributorV2.totalSupplyAt(oct21)).toString(),
    );
    console.log(
      "Oct 1st 2022",
      (await mimoDistributor.totalSupplyAt(oct22)).toString(),
      "vs",
      (await mimoDistributorV2.totalSupplyAt(oct22)).toString(),
    );
    console.log(
      "Oct 1st 2023",
      (await mimoDistributor.totalSupplyAt(oct23)).toString(),
      "vs",
      (await mimoDistributorV2.totalSupplyAt(oct23)).toString(),
    );
    console.log(
      "Oct 1st 2024",
      (await mimoDistributor.totalSupplyAt(oct24)).toString(),
      "vs",
      (await mimoDistributorV2.totalSupplyAt(oct24)).toString(),
    );
    console.log(
      "Oct 1st 2025",
      (await mimoDistributor.totalSupplyAt(oct25)).toString(),
      "vs",
      (await mimoDistributorV2.totalSupplyAt(oct25)).toString(),
    );
    console.log(
      "Oct 1st 2026",
      (await mimoDistributor.totalSupplyAt(oct26)).toString(),
      "vs",
      (await mimoDistributorV2.totalSupplyAt(oct26)).toString(),
    );
    console.log(
      "Oct 1st 2027",
      (await mimoDistributor.totalSupplyAt(oct27)).toString(),
      "vs",
      (await mimoDistributorV2.totalSupplyAt(oct27)).toString(),
    );
    console.log(
      "Oct 1st 2028",
      (await mimoDistributor.totalSupplyAt(oct28)).toString(),
      "vs",
      (await mimoDistributorV2.totalSupplyAt(oct28)).toString(),
    );
    console.log(
      "Oct 1st 2035",
      (await mimoDistributor.totalSupplyAt(oct35)).toString(),
      "vs",
      (await mimoDistributorV2.totalSupplyAt(oct35)).toString(),
    );
    console.log(
      "Oct 1st 2050",
      (await mimoDistributor.totalSupplyAt(oct50)).toString(),
      "vs",
      (await mimoDistributorV2.totalSupplyAt(oct50)).toString(),
    );
    console.log(
      "Oct 1st 2075",
      (await mimoDistributor.totalSupplyAt(oct75)).toString(),
      "vs",
      (await mimoDistributorV2.totalSupplyAt(oct75)).toString(),
    );
    console.log(
      "Oct 1st 2100",
      (await mimoDistributor.totalSupplyAt(oct100)).toString(),
      "vs",
      (await mimoDistributorV2.totalSupplyAt(oct100)).toString(),
    );
  });
});
