import { AccessControllerInstance, AddressProviderInstance } from "../types/truffle-contracts";
import { expect } from "chai";

const { expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

const USDX = artifacts.require("USDX");
const PAR = artifacts.require("PAR");
const AddressProvider = artifacts.require("AddressProvider");
const AccessController = artifacts.require("AccessController");

const MINT_AMOUNT = 100;
const MINT_ADRESS = "0x515bA0a2E286AF10115284F151cF398688A69170";

const COINS = [USDX, PAR];

COINS.forEach((COIN) => {
  contract(COIN.contractName, (accounts) => {
    const [owner, other] = accounts;

    let controller: AccessControllerInstance;
    let a: AddressProviderInstance;
    let coin: any;
    beforeEach(async () => {
      controller = await AccessController.new();
      a = await AddressProvider.new(controller.address);
      coin = await COIN.new(a.address);

      const accounts = await web3.eth.getAccounts();
      const [deployer] = accounts;
      const minterRole = await controller.MINTER_ROLE();

      await controller.grantRole(minterRole, deployer);
    });

    it("USDX initializes correctly", async () => {
      const symbol = await coin.symbol();
      expect(symbol).to.equal(COIN.contractName);

      const name = await coin.name();
      expect(name).to.equal(`${COIN.contractName.slice(0, 3)} Stablecoin`);

      const decimals = await coin.decimals();
      expect(decimals.toNumber()).to.equal(18);

      const totalSupply = await coin.totalSupply();
      expect(totalSupply.toNumber()).to.equal(0);

      const minterRole = await controller.MINTER_ROLE();
      const ownerIsMinter = await controller.hasRole(minterRole, owner);
      expect(ownerIsMinter).to.equal(true);

      const otherIsNotMinter = await controller.hasRole(minterRole, other);
      expect(otherIsNotMinter).to.equal(false);
    });

    it("deployer is minter", async () => {
      const minterRole = await controller.MINTER_ROLE();
      const isMinter = await controller.hasRole(minterRole, owner);
      expect(isMinter).to.equal(true);
    });

    it("deployer can mint tokens", async () => {
      const txReceipt = await coin.mint(MINT_ADRESS, MINT_AMOUNT, { from: owner });
      const newTotalSupply = await coin.totalSupply();
      assert.equal(newTotalSupply.toNumber(), MINT_AMOUNT, "wrong new totalSupply");

      expectEvent(txReceipt, "Transfer", {
        from: "0x0000000000000000000000000000000000000000",
        to: MINT_ADRESS,
        value: MINT_AMOUNT.toString(),
      });

      const balance = await coin.balanceOf(MINT_ADRESS);
      expect(balance.toNumber()).to.equal(MINT_AMOUNT, "wrong balance minted");
    });

    it("non-deployer address shall not be able to mint", async () => {
      await expectRevert(coin.mint(MINT_ADRESS, MINT_AMOUNT, { from: other }), "Caller is not a minter");
    });

    it("deployer can burn tokens", async () => {
      await coin.mint(MINT_ADRESS, MINT_AMOUNT, { from: owner });
      const balanceAfterMint = await coin.balanceOf(MINT_ADRESS);
      expect(balanceAfterMint.toNumber()).to.equal(MINT_AMOUNT, "wrong balance minted");

      await coin.burn(MINT_ADRESS, 1, { from: owner });
      const balanceAfterBurn = await coin.balanceOf(MINT_ADRESS);
      expect(balanceAfterBurn.toNumber()).to.equal(MINT_AMOUNT - 1, "wrong balance after burning");
    });

    it("non-deployer address shall not be able to burn tokens", async () => {
      await coin.mint(MINT_ADRESS, MINT_AMOUNT, { from: owner });
      const balanceAfterMint = await coin.balanceOf(MINT_ADRESS);
      expect(balanceAfterMint.toNumber()).to.equal(MINT_AMOUNT, "wrong balance burned");

      await expectRevert(coin.burn(MINT_ADRESS, 1, { from: other }), "Caller is not a minter");
    });

    it("should be able to update the allowance with approve without having to go to 0", async () => {
      await coin.mint(owner, 100, { from: owner });
      await coin.approve(other, 50, { from: owner });
      await coin.approve(other, 100, { from: owner });
      await expectRevert(
        coin.transferFrom(owner, other, 101, { from: other }),
        "ERC20: transfer amount exceeds balance",
      );
      await coin.transferFrom(owner, other, 100, { from: other });
      const balance = await coin.balanceOf(other);

      expect(balance.toNumber()).to.equal(100, "wrong balance transferred");
    });
  });
});
