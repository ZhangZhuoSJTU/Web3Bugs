import {
  AccessControllerInstance,
  MIMOInstance,
  GovernanceAddressProviderInstance,
  MIMOBuybackInstance,
  MIMOBuybackUniswapV2Instance,
} from "../../types/truffle-contracts";
import { setupMIMO } from "../utils/helpers";
const { BN, expectRevert, time } = require("@openzeppelin/test-helpers");

const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");
const PAR = artifacts.require("PAR");
const MIMOBuyBack = artifacts.require("MIMOBuyback");
const MIMOBuyBackUniswapV2 = artifacts.require("MIMOBuybackUniswapV2");

let mimoBuyBack: MIMOBuybackInstance | MIMOBuybackUniswapV2Instance;

let ga: GovernanceAddressProviderInstance;
let mimo: MIMOInstance;
let controller: AccessControllerInstance;

let lockExpiry: BN;

[MIMOBuyBack, MIMOBuyBackUniswapV2].forEach((buyback) => {
  contract(buyback.contractName, (accounts) => {
    const [owner, A] = accounts;
    beforeEach(async () => {
      controller = await AccessController.new();
      const a = await AddressProvider.new(controller.address);
      const par = await PAR.new(a.address);
      await a.setStableX(par.address);

      ga = await GovernanceAddressProvider.new(a.address);
      mimo = await setupMIMO(a.address, controller, owner);
      await ga.setMIMO(mimo.address);

      const managerRole = await controller.MANAGER_ROLE();
      await controller.grantRole(managerRole, owner);
      await controller.grantRole(web3.utils.keccak256("MIMO_MINTER_ROLE"), owner);

      const poolID = "0x5b1c06c4923dbba4b27cfa270ffb2e60aa28615900020000000000000000004a"; // PAR-MIMO
      const fantomRouter = "0xF491e7B69E4244ad4002BC14e878a34207E38c29";

      const poolOrRouter = buyback.contractName === "MIMOBuyback" ? poolID : fantomRouter;

      lockExpiry = (await time.latest()).add(time.duration.years(2));

      mimoBuyBack = await MIMOBuyBack.new(
        lockExpiry,
        poolOrRouter,
        a.address,
        mimo.address,
        "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      );
    });

    it("should not be possible to withdraw the MIMO before the expiry", async () => {
      const amount = new BN("1000000000000000000");
      await mimo.mint(mimoBuyBack.address, amount);
      await expectRevert(mimoBuyBack.withdrawMIMO(owner), "lock not expired yet");
    });

    it("should be possible to withdraw the MIMO after the expiry", async () => {
      const amount = new BN("1000000000000000000");

      await mimo.mint(mimoBuyBack.address, amount);

      await time.increaseTo(lockExpiry.add(time.duration.days(1)));

      await mimoBuyBack.withdrawMIMO(owner);

      const mimoBalanceAfter = await mimo.balanceOf(owner);
      assert.equal(mimoBalanceAfter.toString(), amount.toString());
    });

    it("should not be possible to withdraw as non manager", async () => {
      await expectRevert(mimoBuyBack.withdrawMIMO(A, { from: A }), "Caller is not a Manager");
    });

    it("should only allow a manager to enable whitelist", async () => {
      const isWhitelistEnabledBefore = await mimoBuyBack.whitelistEnabled();
      assert.isFalse(isWhitelistEnabledBefore);

      await expectRevert(mimoBuyBack.setWhitelistEnabled(true, { from: A }), "Caller is not a Manager");
      await mimoBuyBack.setWhitelistEnabled(true);

      const isWhitelistEnabledAfter = await mimoBuyBack.whitelistEnabled();
      assert.isTrue(isWhitelistEnabledAfter);
    });

    it("should not be possible to call buy MIMO if the whitelist is enabled and you're not a keeper", async () => {
      await mimoBuyBack.setWhitelistEnabled(true);
      await expectRevert(mimoBuyBack.buyMIMO({ from: A }), "Caller is not a Keeper");
    });

    it("should be possible to call buy MIMO if the whitelist is enabled and you're a keeper", async () => {
      await mimoBuyBack.setWhitelistEnabled(true);
      await controller.grantRole(web3.utils.keccak256("KEEPER_ROLE"), A);

      // Expecting a normal revert because the balancer pool does not exist in our tests
      // we test the actual buying using ganache and the scripts/tests/test-mimo-buyback.js file
      await expectRevert(mimoBuyBack.buyMIMO({ from: A }), "revert");
    });
  });
});
