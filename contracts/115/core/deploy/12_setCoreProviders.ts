import { TransactionReceipt, TransactionResponse } from "@ethersproject/abstract-provider";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const [deployerSigner] = await hre.ethers.getSigners();

  console.log("Core - Setting Addresses");

  const accessController = await hre.deployments.get("AccessController");
  const configProvider = await hre.deployments.get("ConfigProvider");
  const vaultsCore = await hre.deployments.get("VaultsCore");
  const par = await hre.deployments.get("PAR");
  const ratesManager = await hre.deployments.get("RatesManager");
  const priceFeed = await hre.deployments.get("PriceFeed");
  const liquidationManager = await hre.deployments.get("LiquidationManager");
  const feeDistributor = await hre.deployments.get("FeeDistributor");
  const vaultsDataProvider = await hre.deployments.get("VaultsDataProvider");
  const addressProviderContract = await hre.ethers.getContract("AddressProvider", deployerSigner);
  let receipt: TransactionReceipt;
  let tx: TransactionResponse;

  tx = await addressProviderContract.setAccessController(accessController.address);
  receipt = await tx.wait(1);
  console.log(`Set AccessController on AddressProvider (tx: ${receipt.transactionHash})`);

  tx = await addressProviderContract.setConfigProvider(configProvider.address);
  receipt = await tx.wait(1);
  console.log(`Set ConfigProvider on AddressProvider (tx: ${receipt.transactionHash})`);

  tx = await addressProviderContract.setVaultsCore(vaultsCore.address);
  receipt = await tx.wait(1);
  console.log(`Set VaultsCore on AddressProvider (tx: ${receipt.transactionHash})`);

  tx = await addressProviderContract.setStableX(par.address);
  receipt = await tx.wait(1);
  console.log(`Set PAR on AddressProvider (tx: ${receipt.transactionHash})`);

  tx = await addressProviderContract.setRatesManager(ratesManager.address);
  receipt = await tx.wait(1);
  console.log(`Set RatesManager on AddressProvider (tx: ${receipt.transactionHash})`);

  tx = await addressProviderContract.setPriceFeed(priceFeed.address);
  receipt = await tx.wait(1);
  console.log(`Set PriceFeed on AddressProvider (tx: ${receipt.transactionHash})`);

  tx = await addressProviderContract.setLiquidationManager(liquidationManager.address);
  receipt = await tx.wait(1);
  console.log(`Set LiquidationManager on AddressProvider (tx: ${receipt.transactionHash})`);

  tx = await addressProviderContract.setFeeDistributor(feeDistributor.address);
  receipt = await tx.wait(1);
  console.log(`Set FeeDistributor on AddressProvider (tx: ${receipt.transactionHash})`);

  tx = await addressProviderContract.setVaultsDataProvider(vaultsDataProvider.address);
  receipt = await tx.wait(1);
  console.log(`Set VaultsDataProvider on AddressProvider (tx: ${receipt.transactionHash})`);
};

export default func;
func.id = "set_providers";
func.dependencies = ["Core"];
func.tags = ["SetCore", "SetCoreProviders"];
