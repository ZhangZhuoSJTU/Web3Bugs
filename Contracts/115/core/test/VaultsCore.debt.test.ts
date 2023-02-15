const _ = require("underscore");
import {
  VaultsCoreInstance,
  VaultsCoreStateInstance,
  VaultsDataProviderInstance,
  MockWETHInstance,
  RatesManagerInstance,
  AccessControllerInstance,
  USDXInstance,
  ConfigProviderInstance,
} from "../types/truffle-contracts";

const { BN, time } = require("@openzeppelin/test-helpers");
const { cumulativeRateHelper, basicSetup, constants } = require("./utils/helpers");

const DEPOSIT_AMOUNT = constants.AMOUNT_ACCURACY; // 1 ETH
const WETH_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 ETH
const BORROW_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 USDX

// includes tests for calculating total debt and vault debt
contract("VaultsCore Debt", (accounts) => {
  const [owner, other] = accounts;

  let c: {
    weth: MockWETHInstance;
    controller: AccessControllerInstance;
    stablex: USDXInstance;
    core: VaultsCoreInstance;
    coreState: VaultsCoreStateInstance;
    vaultsData: VaultsDataProviderInstance;
    rates: RatesManagerInstance;
    config: ConfigProviderInstance;
  };

  beforeEach(async () => {
    c = await basicSetup();

    await c.weth.mint(other, WETH_AMOUNT); // Mint some test WETH

    // Open vault 1 with collateral
    await c.weth.approve(c.core.address, DEPOSIT_AMOUNT, { from: other });
    await c.core.deposit(c.weth.address, DEPOSIT_AMOUNT, { from: other });
  });

  it("total debt outstanding should be correctly calculated without interest", async () => {
    const debt = await c.vaultsData.debt();
    assert.equal(debt.toString(), "0");

    const vaultId = await c.vaultsData.vaultCount();

    await c.core.borrow(vaultId, BORROW_AMOUNT, { from: other });

    const newDebt = await c.vaultsData.debt();
    assert.equal(newDebt.toString(), BORROW_AMOUNT.toString());
  });

  it("total debt outstanding should be correctly calculated with interest applied", async () => {
    const vaultId = await c.vaultsData.vaultCount();
    await c.core.borrow(vaultId, BORROW_AMOUNT, { from: other });

    await c.config.setCollateralBorrowRate(c.weth.address, constants.RATE_50BPS, { from: owner });
    const initialRateUpdateBlockTime = await time.latest();

    const oneYearLater = time.duration.years(1).add(initialRateUpdateBlockTime);
    await time.increaseTo(oneYearLater);

    const txReceipt = await c.coreState.refresh({ from: other }); // Anyone should be able to call this

    const cumulativeRateUpdatedEvent = _.findWhere(txReceipt.logs, {
      event: "CumulativeRateUpdated",
    });
    const elapsedTime = new BN(cumulativeRateUpdatedEvent.args.elapsedTime);
    assert.isBelow(
      elapsedTime.sub(time.duration.years(1)).toNumber(),
      10,
      "elapsedTime should not be off by more than 10 sec",
    );

    const rateAnnualized = cumulativeRateHelper(constants.RATE_50BPS, elapsedTime);

    const debt = await c.vaultsData.debt();
    const expectedTotalDebt = BORROW_AMOUNT.mul(rateAnnualized).div(constants.RATE_ACCURACY);
    assert.equal(debt.toString(), expectedTotalDebt.toString());
  });

  it.skip("total debt outstanding should be correctly calculated for multiple vaults");
});
