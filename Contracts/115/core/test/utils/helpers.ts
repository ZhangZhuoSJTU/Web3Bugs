const { BN, time } = require("@openzeppelin/test-helpers");

import {
  VaultsCoreInstance,
  VaultsDataProviderInstance,
  MockWETHInstance,
  ConfigProviderInstance,
  AccessControllerInstance,
} from "../../types/truffle-contracts";

const PAR = artifacts.require("PAR");
const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const ConfigProvider = artifacts.require("ConfigProvider");
const VaultsCore = artifacts.require("VaultsCore");
const VaultsCoreState = artifacts.require("VaultsCoreState");
const VaultsDataProvider = artifacts.require("VaultsDataProvider");
const RatesManager = artifacts.require("RatesManager");
const LiquidationManager = artifacts.require("LiquidationManager");
const WETH = artifacts.require("MockWETH");
const PriceFeed = artifacts.require("PriceFeed");
const MockChainlinkAggregator = artifacts.require("MockChainlinkAggregator");
const FeeDistributor = artifacts.require("FeeDistributor");
const DebtNotifier = artifacts.require("DebtNotifier");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");
const MIMO = artifacts.require("MIMO");

const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
const MIMO_MINTER_ROLE = web3.utils.keccak256("MIMO_MINTER_ROLE");

const AMOUNT_ACCURACY = new BN(String(1e18));
const RATE_ACCURACY = new BN("1000000000000000000000000000"); // 1e27
const PRICE_ACCURACY = new BN(String(1e8));
const DEBT_LIMIT = AMOUNT_ACCURACY.mul(new BN("10000")); // 10k USDX
const MIN_LIQUIDATION_RATIO = new BN(String(15e17)); // 1.5 = 150%
const MIN_COLLATERAL_RATIO = new BN(String(16e17)); // 1.6 = 160%
const RATE_0BPS = RATE_ACCURACY; // Initial rate is 1 -> 0%
const RATE_50BPS = new BN("1000000000158153903837946258");
const RATE_150BPS = new BN("1000000000472114805215157979");
const RATE_2PCT = new BN(String(2e16)); // 2%
const ORIGINATION_FEE = new BN("0");
const LIQUIDATION_BONUS = new BN(String(5e16)); // 5%
const LIQUIDATION_FEE = new BN("0");
const EUR_PRICE = PRICE_ACCURACY; // 1 EUR = 1 USD
const WETH_PRICE = PRICE_ACCURACY.muln(300); // 300 USD

const constants = {
  DEFAULT_ADMIN_ROLE,
  AMOUNT_ACCURACY,
  RATE_ACCURACY,
  PRICE_ACCURACY,
  DEBT_LIMIT,
  MIN_LIQUIDATION_RATIO,
  MIN_COLLATERAL_RATIO,
  RATE_0BPS,
  RATE_50BPS,
  RATE_150BPS,
  RATE_2PCT,
  ORIGINATION_FEE,
  LIQUIDATION_BONUS,
  LIQUIDATION_FEE,
  EUR_PRICE,
  WETH_PRICE,
};

async function setCollateralConfig(
  config: ConfigProviderInstance,
  {
    collateralType,
    debtLimit = DEBT_LIMIT,
    liquidationRatio = MIN_LIQUIDATION_RATIO,
    minCollateralRatio = MIN_COLLATERAL_RATIO,
    borrowRate = RATE_50BPS,
    originationFee = ORIGINATION_FEE,
    liquidationBonus = LIQUIDATION_BONUS,
    liquidationFee = LIQUIDATION_FEE,
  }: {
    collateralType: string;
    debtLimit?: BN;
    liquidationRatio?: BN;
    minCollateralRatio?: BN;
    borrowRate?: BN;
    originationFee?: BN;
    liquidationBonus?: BN;
    liquidationFee?: BN;
  },
  txDetails?: { from?: string },
) {
  if (txDetails) {
    return config.setCollateralConfig(
      collateralType,
      debtLimit,
      liquidationRatio,
      minCollateralRatio,
      borrowRate,
      originationFee,
      liquidationBonus,
      liquidationFee,
      txDetails,
    );
  }

  return config.setCollateralConfig(
    collateralType,
    debtLimit,
    liquidationRatio,
    minCollateralRatio,
    borrowRate,
    originationFee,
    liquidationBonus,
    liquidationFee,
  );
}

async function deployAll() {
  const latestTime = await time.latest();
  const weth = await WETH.new();
  const controller = await AccessController.new();
  const a = await AddressProvider.new(controller.address);
  const coreState = await VaultsCoreState.new(a.address);
  const core = await VaultsCore.new(a.address, weth.address, coreState.address);
  const configProvider = await ConfigProvider.new(a.address);
  const rates = await RatesManager.new(a.address);
  const liquidator = await LiquidationManager.new(a.address);
  const lmAddresses = await GovernanceAddressProvider.new(a.address);
  const debtNotifier = await DebtNotifier.new(lmAddresses.address);
  const par = await PAR.new(a.address);
  const aggregator = await MockChainlinkAggregator.new(8, WETH_PRICE, "ETH / USD");
  const aggregatorEUR = await MockChainlinkAggregator.new(8, EUR_PRICE, "EUR / USD");
  const feed = await PriceFeed.new(a.address);
  const vaultsData = await VaultsDataProvider.new(a.address);

  await aggregator.setUpdatedAt(latestTime);
  await aggregatorEUR.setUpdatedAt(latestTime);
  await feed.setAssetOracle(weth.address, aggregator.address);
  await feed.setEurOracle(aggregatorEUR.address);

  await a.setAccessController(controller.address);
  await a.setConfigProvider(configProvider.address);
  await a.setVaultsCore(core.address);
  await a.setStableX(par.address);
  await a.setRatesManager(rates.address);
  await a.setPriceFeed(feed.address);
  await a.setLiquidationManager(liquidator.address);
  await a.setVaultsDataProvider(vaultsData.address);

  const accounts = await web3.eth.getAccounts();
  const [deployer] = accounts;

  const minterRole = await controller.MINTER_ROLE();
  await controller.grantRole(minterRole, core.address); // Allow core to mint and burn USDX
  await controller.grantRole(minterRole, deployer);

  const managerRole = await controller.MANAGER_ROLE();
  await controller.grantRole(managerRole, core.address);
  await controller.grantRole(managerRole, rates.address);
  await controller.grantRole(managerRole, liquidator.address);
  await controller.grantRole(managerRole, vaultsData.address);

  // Configure debtNotifier
  await core.setDebtNotifier(debtNotifier.address);
  lmAddresses.setParallelAddressProvider(a.address);
  lmAddresses.setDebtNotifier(debtNotifier.address);

  const contracts = {
    addresses: a,
    aggregator,
    aggregatorEUR,
    controller,
    weth,
    core,
    coreState,
    feed,
    rates,
    liquidator,
    vaultsData,
    lmAddresses,
    debtNotifier,
    config: configProvider,
    stablex: par,
  };
  return contracts;
}

async function basicSetup(
  config: {
    wethRate?: BN;
    wethDebtLimit?: BN;
    wethPrice?: BN;
    eurPrice?: BN;
    wethLiquidationRatio?: BN;
    wethMinCollateralRatio?: BN;
  } = {},
) {
  const c = await deployAll();

  // Set price for WETH
  if (config.wethPrice) {
    await c.aggregator.setLatestPrice(config.wethPrice);
  }

  if (config.eurPrice) {
    await c.aggregatorEUR.setLatestPrice(config.eurPrice);
  }

  // Add collateral type
  await setCollateralConfig(c.config, {
    collateralType: c.weth.address,
    borrowRate: config.wethRate ?? RATE_0BPS,
    debtLimit: config.wethDebtLimit ?? DEBT_LIMIT,
    liquidationRatio: config.wethLiquidationRatio ?? MIN_LIQUIDATION_RATIO,
    minCollateralRatio: config.wethMinCollateralRatio ?? MIN_COLLATERAL_RATIO,
  });

  return c;
}

async function fullSetup(config: {
  wethRate?: BN;
  wethDebtLimit?: BN;
  wethPrice?: BN;
  eurPrice?: BN;
  wethLiquidationRatio?: BN;
  wethMinCollateralRatio?: BN;
  payees: string[];
  shares: number[];
  insurance_shares: number;
}) {
  const c = await basicSetup(config);

  const payees = [...config.payees]; // Clone it
  const shares = [...config.shares];

  if (config.insurance_shares > 0) {
    payees.push(c.core.address);
    shares.push(config.insurance_shares);
  }

  const fees = await FeeDistributor.new(c.addresses.address);
  c.addresses.setFeeDistributor(fees.address);
  const managerRole = await c.controller.MANAGER_ROLE();
  await c.controller.grantRole(managerRole, fees.address);
  await fees.changePayees(payees, shares);

  const minterRole = await c.controller.MINTER_ROLE();
  await c.controller.grantRole(minterRole, fees.address);

  return { ...c, fees };
}

// Deploy MIMO and grants a list of minters the role to mint
async function setupMIMO(
  addressProviderAddress: string,
  controller: AccessControllerInstance,
  ownerAddress: string,
  minters: string[] = [ownerAddress],
) {
  const mimo = await MIMO.new(addressProviderAddress);

  // Require owner can grant roles through default admin role
  const hasAdminRole = await controller.hasRole(DEFAULT_ADMIN_ROLE, ownerAddress);
  assert.equal(hasAdminRole, true);

  // Grant minter role from access controller to a minterAddress
  await Promise.all(
    minters.map(async (minterAddress) => controller.grantRole(MIMO_MINTER_ROLE, minterAddress, { from: ownerAddress })),
  );
  const hasMinterRoles = await Promise.all(
    minters.map(async (minterAddress) => controller.hasRole(MIMO_MINTER_ROLE, minterAddress)),
  );
  for (const hasMinterRole of hasMinterRoles) {
    assert.equal(hasMinterRole, true);
  }

  return mimo;
}

async function depositAndBorrow(
  c: {
    core: VaultsCoreInstance;
    weth: MockWETHInstance;
    vaultsData: VaultsDataProviderInstance;
  },
  {
    vaultOwner,
    mint,
    deposit,
    borrow,
  }: {
    vaultOwner: string;
    mint: BN;
    borrow: BN;
    deposit: BN;
  },
) {
  await c.weth.mint(vaultOwner, mint);
  await c.weth.approve(c.core.address, deposit, { from: vaultOwner });
  await c.core.deposit(c.weth.address, deposit, { from: vaultOwner });

  const vaultId = await c.vaultsData.vaultId(c.weth.address, vaultOwner);

  if (!borrow.isZero()) {
    await c.core.borrow(vaultId, borrow, { from: vaultOwner });
  }

  const updatedVault = await c.vaultsData.vaults(vaultId);

  return { vaultId, ...updatedVault };
}

async function getTxFee(txReceipt: any): Promise<BN> {
  const { gasUsed } = txReceipt.receipt;
  const { gasPrice } = await web3.eth.getTransaction(txReceipt.tx);

  const txFee = new BN(gasUsed).mul(new BN(gasPrice));

  return txFee;
}

function cumulativeRateHelper(baseRate: BN, elapsedTime: BN) {
  let n = elapsedTime;
  let result;
  result = elapsedTime.isOdd() ? baseRate : RATE_ACCURACY;
  n = n.div(new BN(2));

  let x = baseRate;
  while (!n.isZero()) {
    // Console.log("result: %s; x: %s; n: %s", result, x, n);
    x = x.mul(x).divRound(RATE_ACCURACY);
    if (n.isOdd()) result = result.mul(x).divRound(RATE_ACCURACY);
    n = n.div(new BN(2));
  }

  return result;
}

function newRay(n: string) {
  return RATE_ACCURACY.mul(new BN(n));
}

export {
  cumulativeRateHelper,
  newRay,
  basicSetup,
  fullSetup,
  constants,
  depositAndBorrow,
  getTxFee,
  setCollateralConfig,
  setupMIMO,
};
