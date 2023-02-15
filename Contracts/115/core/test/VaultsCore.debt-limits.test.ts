import {
  VaultsCoreInstance,
  VaultsDataProviderInstance,
  ConfigProviderInstance,
  MockWETHInstance,
  RatesManagerInstance,
  AccessControllerInstance,
  USDXInstance,
} from "../types/truffle-contracts";

const { BN, expectRevert } = require("@openzeppelin/test-helpers");
const { basicSetup, constants } = require("./utils/helpers");

const DEPOSIT_AMOUNT = constants.AMOUNT_ACCURACY; // 1 ETH
const WETH_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 ETH
const BORROW_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 USDX

// includes tests for calculating total debt and vault debt
contract("VaultsCore Debt Limits", (accounts) => {
  const [, other] = accounts;

  let c: {
    weth: MockWETHInstance;
    controller: AccessControllerInstance;
    config: ConfigProviderInstance;
    stablex: USDXInstance;
    core: VaultsCoreInstance;
    rates: RatesManagerInstance;
    vaultsData: VaultsDataProviderInstance;
  };

  beforeEach(async () => {
    c = await basicSetup({
      wethDebtLimit: BORROW_AMOUNT,
    });
    await c.weth.mint(other, WETH_AMOUNT); // Mint some test WETH

    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: other });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: other });
  });

  it("should be able to borrow up to the collateral debt limit, but not beyond", async () => {
    const vaultId = await c.vaultsData.vaultId(c.weth.address, other);

    await c.core.borrow(vaultId, BORROW_AMOUNT, { from: other });

    await expectRevert.unspecified(c.core.borrow(vaultId, 1, { from: other }));
  });

  it("should be able to update the collateral debt limit", async () => {
    await c.config.setCollateralDebtLimit(c.weth.address, 0);
    const vaultId = await c.vaultsData.vaultId(c.weth.address, other);

    await expectRevert.unspecified(c.core.borrow(vaultId, 1, { from: other }));
  });
});
