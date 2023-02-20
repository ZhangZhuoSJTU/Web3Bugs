import {
  AccessControllerInstance,
  MIMOInstance,
  EthereumDistributorInstance,
  GovernanceAddressProviderInstance,
} from "../../types/truffle-contracts";
import { setupMIMO } from "../utils/helpers";

const { BN } = require("@openzeppelin/test-helpers");

const EthereumDistributor = artifacts.require("EthereumDistributor");

const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");

const WAD = new BN("1000000000000000000"); // 1e18

let a: GovernanceAddressProviderInstance;
let controller: AccessControllerInstance;
let ethereumDistributor: EthereumDistributorInstance;
let mimo: MIMOInstance;

contract("EthereumDistributor", (accounts) => {
  const [owner, A, B] = accounts;
  const PAYEES = [A, B];
  const SHARES = [20, 80];

  beforeEach(async () => {
    controller = await AccessController.new();
    const addresses = await AddressProvider.new(controller.address);
    a = await GovernanceAddressProvider.new(addresses.address);

    ethereumDistributor = await EthereumDistributor.new(a.address);

    mimo = await setupMIMO(a.address, controller, owner, [owner]);
    await a.setMIMO(mimo.address);

    await ethereumDistributor.changePayees(PAYEES, SHARES);
  });

  it("should be able to release tokens to payees", async () => {
    const totalTokens = WAD.muln(10);

    await mimo.mint(ethereumDistributor.address, totalTokens);
    await ethereumDistributor.release();

    const totalShares = await ethereumDistributor.totalShares();

    await Promise.all(
      PAYEES.map(async (payee) => {
        const payeeShare = await ethereumDistributor.shares(payee);
        const newPayeeIncome = totalTokens.mul(payeeShare).div(totalShares);
        const payeeBalanceAfter = await mimo.balanceOf(payee);
        assert.equal(payeeBalanceAfter.toString(), newPayeeIncome.toString());
      }),
    );
  });
});
