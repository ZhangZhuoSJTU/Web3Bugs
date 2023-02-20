import {
  VaultsCoreStateInstance,
  MockWETHInstance,
  AccessControllerInstance,
  AddressProviderInstance,
  ConfigProviderInstance,
} from "../types/truffle-contracts";

const AccessController = artifacts.require("AccessController");
const AddressProvider = artifacts.require("AddressProvider");
const VaultsCore = artifacts.require("VaultsCore");
const VaultsCoreState = artifacts.require("VaultsCoreState");
const ConfigProvider = artifacts.require("ConfigProvider");
const WETH = artifacts.require("MockWETH");

contract("VaultsCore config & access control", () => {
  let controller: AccessControllerInstance;
  let a: AddressProviderInstance;
  let weth: MockWETHInstance;
  let coreState: VaultsCoreStateInstance;
  let config: ConfigProviderInstance;

  it("should be able to deploy vaults core", async () => {
    controller = await AccessController.new();
    a = await AddressProvider.new(controller.address);
    config = await ConfigProvider.new(a.address);
    weth = await WETH.new();
    await a.setConfigProvider(config.address);
    coreState = await VaultsCoreState.new(a.address);
    await VaultsCore.new(a.address, weth.address, coreState.address);
  });

  it.skip("manager should be able to update the rates Module");
  it.skip("non-manager should not be able to update the rates Module");
  it.skip("non-manager should not be able to update interest rates");
});
