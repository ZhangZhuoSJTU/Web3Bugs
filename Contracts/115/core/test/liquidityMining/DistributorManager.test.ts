import {
  AccessControllerInstance,
  MIMOInstance,
  MIMODistributorInstance,
  EthereumDistributorInstance,
  DistributorManagerInstance,
  GovernanceAddressProviderInstance,
} from "../../types/truffle-contracts";
import { setupMIMO } from "../utils/helpers";

const { BN, time } = require("@openzeppelin/test-helpers");

const MIMODistributor = artifacts.require("MIMODistributor");
const EthereumDistributor = artifacts.require("EthereumDistributor");
const DistributorManager = artifacts.require("DistributorManager");

const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");

const WEEK_SECONDS = new BN("604800");

let a: GovernanceAddressProviderInstance;
let controller: AccessControllerInstance;
let mimoDistributor: MIMODistributorInstance;
let ethereumDistributor: EthereumDistributorInstance;
let distributorManager: DistributorManagerInstance;
let mimo: MIMOInstance;

contract("DistributorManager", (accounts) => {
  const [owner, A] = accounts;

  beforeEach(async () => {
    controller = await AccessController.new();
    const addresses = await AddressProvider.new(controller.address);
    a = await GovernanceAddressProvider.new(addresses.address);

    const deploymentTime = await time.latest();
    mimoDistributor = await MIMODistributor.new(a.address, deploymentTime);
    ethereumDistributor = await EthereumDistributor.new(a.address);
    distributorManager = await DistributorManager.new(a.address, mimoDistributor.address);

    mimo = await setupMIMO(a.address, controller, owner, [owner, mimoDistributor.address]);
    await a.setMIMO(mimo.address);

    await mimoDistributor.changePayees([ethereumDistributor.address], [100]);
    await ethereumDistributor.changePayees([A], [100]);
  });

  it("should be able to trigger release on all distributors", async () => {
    const start = await mimoDistributor.startTime();
    await time.increaseTo(start.add(WEEK_SECONDS));

    const availableTokens = await mimoDistributor.mintableTokens();
    await distributorManager.releaseAll();

    const BalanceOfA = await mimo.balanceOf(A);
    // Some accuracy issues, due to the time jumping in tests
    assert.equal(BalanceOfA.toString().slice(0, 6), availableTokens.toString().slice(0, 6));
  });
});
