import { AccessControllerInstance, MIMOInstance, GovernanceAddressProviderInstance } from "../types/truffle-contracts";
import { assert } from "chai";
import { setupMIMO } from "./utils/helpers";

const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");

const { BN, expectRevert, expectEvent } = require("@openzeppelin/test-helpers");

const MIMO_MINTER_ROLE = web3.utils.keccak256("MIMO_MINTER_ROLE");
const MINT_AMOUNT = new BN(100);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

contract("MIMO", (accounts) => {
  const [owner, minter, nonMinter, address1] = accounts;

  let controller: AccessControllerInstance;
  let ga: GovernanceAddressProviderInstance;
  let mimo: MIMOInstance;

  beforeEach(async () => {
    controller = await AccessController.new({ from: owner });
    const addresses = await AddressProvider.new(controller.address);
    ga = await GovernanceAddressProvider.new(addresses.address);
    mimo = await setupMIMO(ga.address, controller, owner, [minter]);
  });

  it("non-minters should NOT be able to mint", async () => {
    const hasMinterRole = await controller.hasRole(MIMO_MINTER_ROLE, nonMinter);
    assert.equal(hasMinterRole, false);

    await expectRevert(mimo.mint(address1, MINT_AMOUNT, { from: nonMinter }), "Caller is not MIMO Minter");
  });

  it("minters should be able to mint", async () => {
    const hasMinterRole = await controller.hasRole(MIMO_MINTER_ROLE, minter);
    assert.equal(hasMinterRole, true);

    const tx = await mimo.mint(address1, MINT_AMOUNT, { from: minter });
    expectEvent(tx, "Transfer", { from: ZERO_ADDRESS, to: address1, value: MINT_AMOUNT });

    const newBalance = await mimo.balanceOf(address1);
    assert(newBalance.eq(MINT_AMOUNT));
  });

  it("non-minters should NOT be able to burn", async () => {
    await mimo.mint(address1, MINT_AMOUNT, { from: minter });
    await expectRevert(mimo.burn(address1, MINT_AMOUNT, { from: nonMinter }), "Caller is not MIMO Minter");
  });

  it("minters should be able to burn", async () => {
    await mimo.mint(address1, MINT_AMOUNT, { from: minter });

    const currentBalance = await mimo.balanceOf(address1);
    assert(currentBalance.eq(MINT_AMOUNT));

    const tx = await mimo.burn(address1, MINT_AMOUNT, { from: minter });
    expectEvent(tx, "Transfer", { from: address1, to: ZERO_ADDRESS, value: MINT_AMOUNT });

    const newBalance = await mimo.balanceOf(address1);
    assert.equal(newBalance.toNumber(), 0);
  });
});
