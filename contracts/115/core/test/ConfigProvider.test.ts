import {
  AddressProviderInstance,
  AccessControllerInstance,
  ConfigProviderInstance,
  VaultsCoreInstance,
  VaultsCoreStateInstance,
  MockWETHInstance,
} from "../types/truffle-contracts";
import { assert } from "chai";
const { constants, basicSetup, setCollateralConfig } = require("./utils/helpers");

const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const ConfigProvider = artifacts.require("ConfigProvider");
const VaultsCore = artifacts.require("VaultsCore");
const VaultsCoreState = artifacts.require("VaultsCoreState");
const WETH = artifacts.require("MockWETH");

const { BN, expectRevert } = require("@openzeppelin/test-helpers");

const COLLATERAL_TYPE = "0xf25186B5081Ff5cE73482AD761DB0eB0d25abfBF"; // Random address
const ORIGINATION_FEE = constants.AMOUNT_ACCURACY.div(new BN(1000)); /// / 10BPS
const LIQUIDATION_FEE = constants.AMOUNT_ACCURACY.div(new BN(2000)); // 5BPS

contract("ConfigProvider", (accounts) => {
  const [, manager, other] = accounts;

  let controller: AccessControllerInstance;
  let a: AddressProviderInstance;
  let weth: MockWETHInstance;
  let config: ConfigProviderInstance;
  let core: VaultsCoreInstance;
  let coreState: VaultsCoreStateInstance;

  beforeEach(async () => {
    controller = await AccessController.new();
    a = await AddressProvider.new(controller.address);
    config = await ConfigProvider.new(a.address);
    weth = await WETH.new();
    coreState = await VaultsCoreState.new(a.address);
    core = await VaultsCore.new(a.address, weth.address, coreState.address);
    await a.setVaultsCore(core.address);
    await a.setConfigProvider(config.address);

    const managerRole = await controller.MANAGER_ROLE();
    await controller.grantRole(managerRole, manager);
  });

  it("should initialize config provider with correct addressProvider & correct default values", async () => {
    const addressProviderAddress = await config.a();
    assert.equal(addressProviderAddress, a.address);

    const numberCollateralConfigs = await config.numCollateralConfigs();
    assert.equal(numberCollateralConfigs.toString(), "0");
  });

  it("manager should be able to add a collateral config", async () => {
    await setCollateralConfig(
      config,
      { collateralType: COLLATERAL_TYPE, originationFee: ORIGINATION_FEE, liquidationFee: LIQUIDATION_FEE },
      { from: manager },
    );

    const numberCollateralConfigs = await config.numCollateralConfigs();
    assert.equal(numberCollateralConfigs.toString(), "1");

    const configResult = await config.collateralConfigs(numberCollateralConfigs);

    assert.equal(configResult.collateralType.toString(), COLLATERAL_TYPE);
    assert.equal(configResult.debtLimit.toString(), constants.DEBT_LIMIT);
    assert.equal(configResult.liquidationRatio.toString(), constants.MIN_LIQUIDATION_RATIO);
    assert.equal(configResult.minCollateralRatio.toString(), constants.MIN_COLLATERAL_RATIO);
    assert.equal(configResult.borrowRate.toString(), constants.RATE_50BPS);
    assert.equal(configResult.originationFee.toString(), ORIGINATION_FEE);
    assert.equal(configResult.liquidationBonus.toString(), constants.LIQUIDATION_BONUS);
    assert.equal(configResult.liquidationFee.toString(), LIQUIDATION_FEE);

    const collateralDebtLimit = await config.collateralDebtLimit(COLLATERAL_TYPE);
    assert.equal(collateralDebtLimit.toString(), constants.DEBT_LIMIT);

    const collateralLiquidationRatio = await config.collateralLiquidationRatio(COLLATERAL_TYPE);
    assert.equal(collateralLiquidationRatio.toString(), constants.MIN_LIQUIDATION_RATIO);

    const collateralMinCollateralRatio = await config.collateralMinCollateralRatio(COLLATERAL_TYPE);
    assert.equal(collateralMinCollateralRatio.toString(), constants.MIN_COLLATERAL_RATIO);

    const collateralBorrowRate = await config.collateralBorrowRate(COLLATERAL_TYPE);
    assert.equal(collateralBorrowRate.toString(), constants.RATE_50BPS);

    const collateralOriginationFee = await config.collateralOriginationFee(COLLATERAL_TYPE);
    assert.equal(collateralOriginationFee.toString(), ORIGINATION_FEE);

    const collateralLiquidationBonus = await config.collateralLiquidationBonus(COLLATERAL_TYPE);
    assert.equal(collateralLiquidationBonus.toString(), constants.LIQUIDATION_BONUS);

    const collateralLiquidationFee = await config.collateralLiquidationFee(COLLATERAL_TYPE);
    assert.equal(collateralLiquidationFee.toString(), LIQUIDATION_FEE.toString());
  });

  it("manager should be able to update existing collateral config", async () => {
    // We need a full setup with ratesmanager, vaultsdata, etc because updating the borrowrate triggers a refresh
    const { config, controller } = await basicSetup({
      wethRate: constants.RATE_50BPS,
    });

    const managerRole = await controller.MANAGER_ROLE();
    await controller.grantRole(managerRole, manager);

    await setCollateralConfig(
      config,
      { collateralType: COLLATERAL_TYPE, originationFee: ORIGINATION_FEE, liquidationFee: LIQUIDATION_FEE },
      { from: manager },
    );

    const numberCollateralConfigs = await config.numCollateralConfigs();
    assert.equal(numberCollateralConfigs.toString(), "2");

    await config.setCollateralDebtLimit(COLLATERAL_TYPE, 0, { from: manager });
    await config.setCollateralLiquidationRatio(COLLATERAL_TYPE, 0, { from: manager });
    await config.setCollateralMinCollateralRatio(COLLATERAL_TYPE, 0, { from: manager });
    await config.setCollateralBorrowRate(COLLATERAL_TYPE, 0, { from: manager });
    await config.setCollateralOriginationFee(COLLATERAL_TYPE, 0, { from: manager });
    await config.setCollateralLiquidationBonus(COLLATERAL_TYPE, 0, { from: manager });
    await config.setCollateralLiquidationFee(COLLATERAL_TYPE, 0, { from: manager });

    const configResult = await config.collateralConfigs(numberCollateralConfigs);

    assert.equal(configResult.collateralType.toString(), COLLATERAL_TYPE);
    assert.equal(configResult.debtLimit.toString(), "0");
    assert.equal(configResult.liquidationRatio.toString(), "0");
    assert.equal(configResult.minCollateralRatio.toString(), "0");
    assert.equal(configResult.borrowRate.toString(), "0");
    assert.equal(configResult.originationFee.toString(), "0");
    assert.equal(configResult.liquidationBonus.toString(), "0");
    assert.equal(configResult.liquidationFee.toString(), "0");

    const collateralDebtLimit = await config.collateralDebtLimit(COLLATERAL_TYPE);
    assert.equal(collateralDebtLimit.toString(), "0");

    const collateralLiquidationRatio = await config.collateralLiquidationRatio(COLLATERAL_TYPE);
    assert.equal(collateralLiquidationRatio.toString(), "0");

    const collateralMinCollateralRatio = await config.collateralMinCollateralRatio(COLLATERAL_TYPE);
    assert.equal(collateralMinCollateralRatio.toString(), "0");

    const collateralBorrowRate = await config.collateralBorrowRate(COLLATERAL_TYPE);
    assert.equal(collateralBorrowRate.toString(), "0");

    const collateralOriginationFee = await config.collateralOriginationFee(COLLATERAL_TYPE);
    assert.equal(collateralOriginationFee.toString(), "0");

    const collateralLiquidationBonus = await config.collateralLiquidationBonus(COLLATERAL_TYPE);
    assert.equal(collateralLiquidationBonus.toString(), "0");

    const collateralLiquidationFee = await config.collateralLiquidationFee(COLLATERAL_TYPE);
    assert.equal(collateralLiquidationFee.toString(), "0");
  });

  it("should not setCollateralConfig with open ratio smaller collateral ratio", async () => {
    await expectRevert.unspecified(
      setCollateralConfig(
        config,
        {
          collateralType: COLLATERAL_TYPE,
          originationFee: ORIGINATION_FEE,
          minCollateralRatio: constants.MIN_LIQUIDATION_RATIO.sub(new BN(1)),
        },
        { from: manager },
      ),
    );
  });

  it("NON-manager should NOT be able to set setCollateralConfig", async () => {
    await expectRevert.unspecified(
      setCollateralConfig(
        config,
        {
          collateralType: COLLATERAL_TYPE,
          originationFee: ORIGINATION_FEE,
        },
        { from: other },
      ),
    );
  });

  it("should not setCollateralLiquidationRatio with collateral ratio larger than open ratio", async () => {
    await setCollateralConfig(
      config,
      { collateralType: COLLATERAL_TYPE, originationFee: ORIGINATION_FEE },
      { from: manager },
    );

    await expectRevert.unspecified(
      config.setCollateralLiquidationRatio(COLLATERAL_TYPE, constants.MIN_COLLATERAL_RATIO.add(new BN(1)), {
        from: manager,
      }),
    );
  });

  it("should not setCollateralMinCollateralRatio with open ratio smaller collateral ratio", async () => {
    await setCollateralConfig(
      config,
      { collateralType: COLLATERAL_TYPE, originationFee: ORIGINATION_FEE },
      { from: manager },
    );

    await expectRevert.unspecified(
      config.setCollateralMinCollateralRatio(COLLATERAL_TYPE, constants.MIN_LIQUIDATION_RATIO.sub(new BN(1)), {
        from: manager,
      }),
    );
  });

  it("should not setCollateralLiquidationFee higher than 100%", async () => {
    await config.setCollateralLiquidationFee(COLLATERAL_TYPE, constants.AMOUNT_ACCURACY.sub(new BN(1)), {
      from: manager,
    });
    await expectRevert.unspecified(
      config.setCollateralLiquidationFee(COLLATERAL_TYPE, constants.AMOUNT_ACCURACY, {
        from: manager,
      }),
    );
  });

  /*

  Struct CollateralConfig {
    address collateralType;
    uint256 debtLimit;
    uint256 liquidationRatio;
    uint256 borrowRate;
    uint256 originationFee;
  }

  function collateralConfigs(uint256 _id) external view returns (CollateralConfig memory);

  function collateralIds(address _collateralType) external view returns (uint256);

  function numCollateralConfigs() external view returns (uint256);

  function liquidationBonus() external view returns (uint256);

  event CollateralUpdated(
    address collateralType,
    uint256 debtLimit,
    uint256 liquidationRatio,
    uint256 borrowRate,
    uint256 originationFee
  );
  event CollateralRemoved(address collateralType);

  function setCollateralConfig(
    address _collateralType,
    uint256 _debtLimit,
    uint256 _liquidationRatio,
    uint256 _borrowRate,
    uint256 _originationFee
  ) external;

  function removeCollateral(address _collateralType) external;
 function setCollateralDebtLimit(address _collateralType, uint256 _debtLimit) external;
 function setCollateralLiquidationRatio(address _collateralType, uint256 _liquidationRatio) external;
 function setCollateralBorrowRate(address _collateralType, uint256 _borrowRate) external;
 function setCollateralOriginationFee(address _collateralType, uint256 _originationFee) external;
 function setLiquidationBonus(uint256 _bonus) external;
 function collateralDebtLimit(address _collateralType) external view returns (uint256);
 function collateralLiquidationRatio(address _collateralType) external view returns (uint256);
 function collateralBorrowRate(address _collateralType) external view returns (uint256);
 function collateralOriginationFee(address _collateralType) external view returns (uint256);

  */
});
