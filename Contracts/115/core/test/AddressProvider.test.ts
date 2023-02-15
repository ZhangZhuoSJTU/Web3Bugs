import { AddressProviderInstance, AccessControllerInstance } from "../types/truffle-contracts";
import { assert } from "chai";

const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");

const { expectRevert } = require("@openzeppelin/test-helpers");

contract("AddressProvider", (accounts) => {
  const [, manager, other, address1, address2] = accounts;

  let controller: AccessControllerInstance;
  let a: AddressProviderInstance;

  beforeEach(async () => {
    controller = await AccessController.new();
    a = await AddressProvider.new(controller.address);

    const managerRole = await controller.MANAGER_ROLE();
    await controller.grantRole(managerRole, manager);
  });

  it("should initialize address provider with correct controller & empty addresses for everything else", async () => {
    const controllerAddress = await a.controller();
    assert.equal(controllerAddress, controller.address);

    const modulePromises = [
      a.config(),
      a.core(),
      a.stablex(),
      a.ratesManager(),
      a.priceFeed(),
      a.liquidationManager(),
      a.vaultsData(),
      a.feeDistributor(),
    ];

    const results = await Promise.all(modulePromises);
    results.forEach((moduleAddress) => {
      assert.equal(moduleAddress, "0x0000000000000000000000000000000000000000");
    });
  });

  it("manager should be able to update addresses", async () => {
    await Promise.all([
      a.setConfigProvider(address1, { from: manager }),
      a.setVaultsCore(address1, { from: manager }),
      a.setStableX(address1, { from: manager }),
      a.setRatesManager(address1, { from: manager }),
      a.setPriceFeed(address1, { from: manager }),
      a.setLiquidationManager(address1, { from: manager }),
      a.setVaultsDataProvider(address1, { from: manager }),
      a.setFeeDistributor(address1, { from: manager }),
    ]);

    const moduleAddressPromises = [
      a.config(),
      a.core(),
      a.stablex(),
      a.ratesManager(),
      a.priceFeed(),
      a.liquidationManager(),
      a.vaultsData(),
      a.feeDistributor(),
    ];
    const moduleAddresses = await Promise.all(moduleAddressPromises);
    moduleAddresses.forEach((moduleAddress) => {
      assert.equal(moduleAddress.toString(), address1);
    });

    await a.setAccessController(address1, { from: manager });

    const controllerAddress = await a.controller();
    assert.equal(controllerAddress, address1);
  });

  it("non-manager should NOT be able to update addresses", async () => {
    await Promise.all([
      a.setConfigProvider(address1, { from: manager }),
      a.setVaultsCore(address1, { from: manager }),
      a.setStableX(address1, { from: manager }),
      a.setRatesManager(address1, { from: manager }),
      a.setPriceFeed(address1, { from: manager }),
      a.setLiquidationManager(address1, { from: manager }),
      a.setVaultsDataProvider(address1, { from: manager }),
      a.setFeeDistributor(address1, { from: manager }),
    ]);

    await Promise.all([
      expectRevert(a.setAccessController(address2, { from: other }), "Caller is not a Manager"),
      expectRevert(a.setConfigProvider(address2, { from: other }), "Caller is not a Manager"),
      expectRevert(a.setVaultsCore(address2, { from: other }), "Caller is not a Manager"),
      expectRevert(a.setStableX(address2, { from: other }), "Caller is not a Manager"),
      expectRevert(a.setRatesManager(address2, { from: other }), "Caller is not a Manager"),
      expectRevert(a.setPriceFeed(address2, { from: other }), "Caller is not a Manager"),
      expectRevert(a.setLiquidationManager(address2, { from: other }), "Caller is not a Manager"),
      expectRevert(a.setVaultsDataProvider(address2, { from: other }), "Caller is not a Manager"),
      expectRevert(a.setFeeDistributor(address2, { from: other }), "Caller is not a Manager"),
    ]);
  });

  it.skip("every module should have the addressProvider readable & setable");
});
