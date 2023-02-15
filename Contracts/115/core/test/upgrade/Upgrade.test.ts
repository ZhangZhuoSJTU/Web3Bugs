import {
  AddressProviderV1Instance,
  VaultsCoreInstance,
  VaultsCoreV1Instance,
  VaultsCoreStateInstance,
  ConfigProviderInstance,
  ConfigProviderV1Instance,
  LiquidationManagerInstance,
  LiquidationManagerV1Instance,
  FeeDistributorInstance,
  PriceFeedInstance,
  FeeDistributorV1Instance,
  UpgradeInstance,
  MockWETHInstance,
  PARInstance,
  MockChainlinkAggregatorInstance,
  AccessControllerInstance,
} from "../../types/truffle-contracts/index";
import { assert } from "chai";

const { BN, time } = require("@openzeppelin/test-helpers");
import { constants } from "../utils/helpers";

const PAR = artifacts.require("PAR");
const WETH = artifacts.require("MockWETH");
const AccessController = artifacts.require("AccessController");
const AddressProviderV1 = artifacts.require("AddressProviderV1");
const ConfigProvider = artifacts.require("ConfigProvider");
const VaultsCore = artifacts.require("VaultsCore");
const VaultsCoreState = artifacts.require("VaultsCoreState");
const VaultsDataProviderV1 = artifacts.require("VaultsDataProviderV1");
const LiquidationManager = artifacts.require("LiquidationManager");
const FeeDistributor = artifacts.require("FeeDistributor");
const VaultsCoreV1 = artifacts.require("VaultsCoreV1");
const ConfigProviderV1 = artifacts.require("ConfigProviderV1");
const LiquidationManagerV1 = artifacts.require("LiquidationManagerV1");
const FeeDistributorV1 = artifacts.require("FeeDistributorV1");
const Upgrade = artifacts.require("Upgrade");
const RatesManager = artifacts.require("RatesManager");
const MockChainlinkAggregator = artifacts.require("MockChainlinkAggregator");
const PriceFeed = artifacts.require("PriceFeed");
const DebtNotifier = artifacts.require("DebtNotifier");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");

const DEPOSIT_AMOUNT = constants.AMOUNT_ACCURACY; // 1 ETH
const BORROW_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("50")); // 50 PAR

contract("V2 Upgrade", (accounts) => {
  const [owner, other, bpool] = accounts;
  const vaultId = "1";

  let controller: AccessControllerInstance;
  let addresses: AddressProviderV1Instance;
  let weth: MockWETHInstance;
  let par: PARInstance;
  let upgrade: UpgradeInstance;
  let aggregator: MockChainlinkAggregatorInstance;

  let v1: {
    core: VaultsCoreV1Instance;
    config: ConfigProviderV1Instance;
    liquidator: LiquidationManagerV1Instance;
    fees: FeeDistributorV1Instance;
    feed: PriceFeedInstance;
  };

  let v2: {
    coreState: VaultsCoreStateInstance;
    core: VaultsCoreInstance;
    config: ConfigProviderInstance;
    liquidator: LiquidationManagerInstance;
    fees: FeeDistributorInstance;
    feed: PriceFeedInstance;
  };

  beforeEach(async () => {
    controller = await AccessController.new();
    addresses = await AddressProviderV1.new(controller.address);
    par = await PAR.new(addresses.address);
    weth = await WETH.new();

    aggregator = await MockChainlinkAggregator.new(8, constants.WETH_PRICE, "ETH / USD");
    const aggregatorEUR = await MockChainlinkAggregator.new(8, constants.EUR_PRICE, "EUR / USD");
    const rates = await RatesManager.new(addresses.address);
    const feed = await PriceFeed.new(addresses.address);
    const lmAddresses = await GovernanceAddressProvider.new(addresses.address);
    const debtNotifier = await DebtNotifier.new(lmAddresses.address);
    const vaultsData = await VaultsDataProviderV1.new(addresses.address);

    const coreV1 = await VaultsCoreV1.new(addresses.address);
    const configV1 = await ConfigProviderV1.new(addresses.address);
    const liquidatorV1 = await LiquidationManagerV1.new(addresses.address);
    const feesV1 = await FeeDistributorV1.new(addresses.address);
    const feedV1 = await PriceFeed.new(addresses.address);

    v1 = {
      core: coreV1,
      config: configV1,
      liquidator: liquidatorV1,
      fees: feesV1,
      feed: feedV1,
    };

    const coreState = await VaultsCoreState.new(addresses.address);
    const core = await VaultsCore.new(addresses.address, weth.address, coreState.address);
    const config = await ConfigProvider.new(addresses.address);
    const liquidator = await LiquidationManager.new(addresses.address);
    const fees = await FeeDistributor.new(addresses.address);
    v2 = {
      coreState,
      core,
      config,
      liquidator,
      fees,
      feed,
    };

    await addresses.setStableX(par.address);
    await addresses.setAccessController(controller.address);
    await addresses.setRatesManager(rates.address);
    await addresses.setPriceFeed(feed.address);
    await addresses.setVaultsDataProvider(vaultsData.address);
    await addresses.setVaultsCore(v1.core.address);
    await addresses.setConfigProvider(v1.config.address);
    await addresses.setLiquidationManager(v1.liquidator.address);
    await addresses.setFeeDistributor(v1.fees.address);

    await v1.config.setCollateralConfig(
      weth.address,
      constants.DEBT_LIMIT,
      constants.MIN_LIQUIDATION_RATIO,
      constants.RATE_50BPS,
      constants.ORIGINATION_FEE,
    );

    const latestTime = await time.latest();
    await aggregator.setUpdatedAt(latestTime);
    await aggregatorEUR.setUpdatedAt(latestTime);
    await feed.setAssetOracle(weth.address, aggregator.address);
    await feed.setEurOracle(aggregatorEUR.address);

    const MINTER_ROLE = await controller.MINTER_ROLE();
    await controller.grantRole(MINTER_ROLE, coreV1.address);
    await controller.grantRole(MINTER_ROLE, feesV1.address);

    upgrade = await Upgrade.new(
      addresses.address,
      core.address,
      coreState.address,
      liquidator.address,
      config.address,
      fees.address,
      debtNotifier.address,
      feed.address,
      bpool,
    );

    const DEFAULT_ADMIN_ROLE = await controller.DEFAULT_ADMIN_ROLE();
    await controller.grantRole(DEFAULT_ADMIN_ROLE, upgrade.address);
  });

  it("should initialize contract address correctly", async () => {
    const a = await upgrade.a();
    const core = await upgrade.core();
    const config = await upgrade.config();
    const liquidationManager = await upgrade.liquidationManager();
    const feeDistributor = await upgrade.feeDistributor();

    assert.equal(a, addresses.address);
    assert.equal(core, v2.core.address);
    assert.equal(config, v2.config.address);
    assert.equal(liquidationManager, v2.liquidator.address);
    assert.equal(feeDistributor, v2.fees.address);
  });

  it("should upgrade correctly without payees", async () => {
    await weth.mint(v1.core.address, DEPOSIT_AMOUNT);

    const oneYearLater = time.duration.years(1).add(await time.latest());
    await time.increaseTo(oneYearLater);
    await upgrade.upgrade();

    const coreAddr = await addresses.core();
    const configAddr = await addresses.config();
    const liquidationManagerAddr = await addresses.liquidationManager();
    const feeDistributorAddr = await addresses.feeDistributor();
    assert.equal(coreAddr, v2.core.address);
    assert.equal(configAddr, v2.config.address);
    assert.equal(liquidationManagerAddr, v2.liquidator.address);
    assert.equal(feeDistributorAddr, v2.fees.address);

    const wethBalance = await weth.balanceOf(v2.core.address);
    assert.equal(wethBalance.toString(), DEPOSIT_AMOUNT.toString());

    const configResult = await v2.config.collateralConfigs(await v2.config.collateralIds(weth.address));

    assert.equal(configResult.collateralType.toString(), weth.address);
    assert.equal(configResult.debtLimit.toString(), constants.DEBT_LIMIT);
    assert.equal(configResult.liquidationRatio.toString(), constants.MIN_LIQUIDATION_RATIO);
    assert.equal(configResult.minCollateralRatio.toString(), constants.MIN_LIQUIDATION_RATIO);
    assert.equal(configResult.borrowRate.toString(), constants.RATE_50BPS);
    assert.equal(configResult.originationFee.toString(), constants.ORIGINATION_FEE);
    assert.equal(configResult.liquidationBonus.toString(), constants.LIQUIDATION_BONUS);
    assert.equal(configResult.liquidationFee.toString(), constants.LIQUIDATION_FEE);

    const cumulativeRateV1 = await v1.core.cumulativeRates(weth.address);
    const lastRefreshV1 = await v1.core.lastRefresh(weth.address);
    const cumulativeRateV2 = await v2.coreState.cumulativeRates(weth.address);
    const lastRefreshV2 = await v2.coreState.lastRefresh(weth.address);

    assert.notEqual(cumulativeRateV2.toString(), constants.RATE_ACCURACY.toString());
    assert.equal(cumulativeRateV2.toString(), cumulativeRateV1.toString());
    assert.equal(lastRefreshV2.toString(), lastRefreshV1.toString());

    const payees = await v2.fees.getPayees();
    assert.deepEqual(payees, [bpool, v2.core.address]);

    const shares = await Promise.all(
      payees.map(async (payee: string) => {
        const share = await v2.fees.shares(payee);
        return share.toString();
      }),
    );
    assert.deepEqual(shares, ["90", "10"]);
  });

  describe("Test vault functionality", async () => {
    beforeEach(async () => {
      await v1.config.setCollateralBorrowRate(weth.address, constants.RATE_0BPS);

      const core = await VaultsCore.at(await addresses.core());
      await weth.mint(owner, DEPOSIT_AMOUNT);
      await weth.approve(core.address, DEPOSIT_AMOUNT);
      await core.deposit(weth.address, DEPOSIT_AMOUNT);
      await core.borrow(vaultId, BORROW_AMOUNT);

      await upgrade.upgrade();
    });

    it("should borrow and repay in v2 correctly", async () => {
      const core = await VaultsCore.at(await addresses.core());
      await core.borrow(vaultId, BORROW_AMOUNT);

      await core.repayAll(vaultId);
    });

    it("should liquidate in v2 correctly", async () => {
      const accounts = await web3.eth.getAccounts();
      const [deployer] = accounts;
      const minterRole = await controller.MINTER_ROLE();
      await controller.grantRole(minterRole, deployer);
      await par.mint(other, BORROW_AMOUNT);

      await aggregator.setLatestPrice(String(55e8)); // $55

      const core = await VaultsCore.at(await addresses.core());
      await core.liquidate(vaultId, { from: other });
    });
  });
});
