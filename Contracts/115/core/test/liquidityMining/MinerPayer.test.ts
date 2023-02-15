import { zeroAddress } from "ethereumjs-util";
import {
  MinerPayerInstance,
  MIMOInstance,
  GovernanceAddressProviderInstance,
  AccessControllerInstance,
} from "../../types/truffle-contracts";

const { BN } = require("@openzeppelin/test-helpers");

import { setupMIMO } from "../utils/helpers";
const MinerPayer = artifacts.require("MinerPayer");
const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");

let minerPayer: MinerPayerInstance;
let controller: AccessControllerInstance;
let a: GovernanceAddressProviderInstance;
let mimo: MIMOInstance;

const { expectRevert } = require("@openzeppelin/test-helpers");
const WAD = new BN("1000000000000000000");

// Return the numtype balance of MIMO of a given address
const getBalanceStr = async (contract: MIMOInstance, address: string) => (await contract.balanceOf(address)).toString();

contract("Miner Payer", (accounts) => {
  const [owner, A, B, C, D] = accounts;

  beforeEach(async () => {
    controller = await AccessController.new();
    const addresses = await AddressProvider.new(controller.address);
    a = await GovernanceAddressProvider.new(addresses.address);

    mimo = await setupMIMO(a.address, controller, owner, [owner]);
    await a.setMIMO(mimo.address);
    await controller.grantRole(web3.utils.keccak256("KEEPER_ROLE"), owner);
    minerPayer = await MinerPayer.new(a.address);
    await mimo.mint(minerPayer.address, WAD.muln(10));
  });

  it("Successfully deploy", async () => {
    assert.equal((await mimo.balanceOf(minerPayer.address)).toString(), WAD.muln(10).toString());
  });

  it("Pay out to miners", async () => {
    const inTotalTokens = WAD.muln(10);
    const inShares = [10, 20, 30];
    const totalInShares = inShares.reduce((a, b) => a + b, 0);

    await minerPayer.changePayees([A, B, C], inShares);
    const totalShares = await minerPayer.totalShares();
    assert.equal(totalShares.toNumber(), totalInShares);

    await minerPayer.release(inTotalTokens);

    await Promise.all(
      [A, B, C].map(async (payee, index) => {
        const inIncome = inTotalTokens.mul(new BN(inShares[index])).div(new BN(totalInShares));
        const minerMimoBal = await mimo.balanceOf(payee);
        assert.equal(inIncome.toString(), minerMimoBal.toString());
      }),
    );
    assert.equal(await getBalanceStr(mimo, minerPayer.address), "1");
  });

  it("Maintain atomicity if a contract doesn't have enough to fill the request", async () => {
    const inTotalTokens = WAD.muln(100);
    await expectRevert(minerPayer.release(inTotalTokens), "Contract doesn't hold enough MIMO to distribute");
    assert.equal(await getBalanceStr(mimo, minerPayer.address), WAD.muln(10).toString());
    assert.equal(await getBalanceStr(mimo, A), "0");
    assert.equal(await getBalanceStr(mimo, B), "0");
    assert.equal(await getBalanceStr(mimo, C), "0");
  });

  it("Revert for invalid values of totalAmount", async () => {
    await expectRevert(minerPayer.release(-1), "value out-of-bounds");

    assert.equal(await getBalanceStr(mimo, minerPayer.address), WAD.muln(10).toString());
    assert.equal(await getBalanceStr(mimo, A), "0");
    assert.equal(await getBalanceStr(mimo, B), "0");
    assert.equal(await getBalanceStr(mimo, C), "0");
  });

  it("Only whitelist can mint address", async () => {
    await expectRevert(minerPayer.release(10, { from: A }), "Caller is not a Keeper");
    assert.equal(await getBalanceStr(mimo, minerPayer.address), WAD.muln(10).toString());
    assert.equal(await getBalanceStr(mimo, A), "0");
    assert.equal(await getBalanceStr(mimo, B), "0");
    assert.equal(await getBalanceStr(mimo, C), "0");
  });

  it("Only managers can change miner amounts", async () => {
    await expectRevert(minerPayer.changePayees([A, B, C], [10, 20, 30], { from: A }), "Caller is not a manager");
    assert.equal((await minerPayer.totalShares()).toNumber(), 0);
  });

  it("Should revert for invalid amounts and miners arrays", async () => {
    await expectRevert(minerPayer.changePayees([A, B, C, D], [30, 30, 30]), "Payees and shares mismatched");

    await expectRevert(minerPayer.changePayees([A, B, C], [10, 30, 30, 30]), "Payees and shares mismatched");

    assert.equal((await minerPayer.totalShares()).toNumber(), 0);
  });

  it("Shouldn't send anything to 0x address", async () => {
    await expectRevert(minerPayer.changePayees([A, B, zeroAddress()], [10, 20, 30]), "Payee is the zero address");
    assert.equal((await minerPayer.totalShares()).toNumber(), 0);
  });

  it("Handle empty inputs for amounts and miners", async () => {
    await minerPayer.changePayees([], []);
    assert.equal((await minerPayer.totalShares()).toNumber(), 0);
  });
});
