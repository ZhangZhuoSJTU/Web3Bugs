import {
  AccessControllerInstance,
  MIMOInstance,
  MIMODistributorInstance,
  GovernanceAddressProviderInstance,
} from "../../types/truffle-contracts";
import { PreUseAirdropInstance } from "../../types/truffle-contracts/PreUseAirdrop";
import { setupMIMO } from "../utils/helpers";

const { expectRevert } = require("@openzeppelin/test-helpers");

const MIMODistributor = artifacts.require("MIMODistributor");
const PreUseAirdrop = artifacts.require("PreUseAirdrop");

const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");

let a: GovernanceAddressProviderInstance;
let controller: AccessControllerInstance;
let mimoDistributor: MIMODistributorInstance;
let mimo: MIMOInstance;
let airdrop: PreUseAirdropInstance;

contract("PreUseAirdrop", (accounts) => {
  const [owner, A] = accounts;

  beforeEach(async () => {
    controller = await AccessController.new();
    const addresses = await AddressProvider.new(controller.address);
    a = await GovernanceAddressProvider.new(addresses.address);

    mimoDistributor = await MIMODistributor.new(a.address, 18700 * 1000);

    mimo = await setupMIMO(a.address, controller, owner, [mimoDistributor.address]);
    await a.setMIMO(mimo.address);
    airdrop = await PreUseAirdrop.new(a.address, mimoDistributor.address);
    const minterRole = await mimo.MIMO_MINTER_ROLE();
    await controller.grantRole(minterRole, airdrop.address);
  });

  it("should airdrop the listed addresses", async () => {
    const payout = await airdrop.payouts(0);
    await airdrop.airdrop();

    const balance = await mimo.balanceOf(payout[0]);

    assert.strictEqual(balance.toString(), payout[1].toString());
  });

  it("should not airdrop twice", async () => {
    const payout = await airdrop.payouts(0);
    await airdrop.airdrop();

    await expectRevert(airdrop.airdrop(), "Caller is not MIMO Minter");
    const balance = await mimo.balanceOf(payout[0]);

    assert.strictEqual(balance.toString(), payout[1].toString());
  });

  it("non manager should not be allowed to call", async () => {
    await expectRevert(airdrop.airdrop({ from: A }), "Caller is not a Manager");
  });
});
