import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { NETWORK_CONFIG } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const chainId = await hre.getChainId();
  const networkConfig = NETWORK_CONFIG[Number.parseInt(chainId)];

  const adminInceptionVaultBase = await hre.deployments.get("BaseAdminInceptionVault");
  const inceptionVaultsCoreBase = await hre.deployments.get("BaseInceptionVaultsCore");
  const inceptionVaultsDataProviderBase = await hre.deployments.get("BaseInceptionVaultsDataProvider");
  const addressProvider = await hre.deployments.get("AddressProvider");
  const debtNotifier = await hre.deployments.get("DebtNotifier");

  let weth = networkConfig.collaterals.WETH.address;
  let mimo = networkConfig.mimoToken;

  if (networkConfig.isTestNet) {
    if (weth === "") {
      const mockWeth = await hre.deployments.get("MockWETH");
      weth = mockWeth.address;
    }

    if (mimo === "") {
      const mockMimo = await hre.deployments.get("MockMIMO");
      mimo = mockMimo.address;
    }
  }

  await deploy("InceptionVaultFactory", {
    from: deployer,
    args: [
      adminInceptionVaultBase.address,
      inceptionVaultsCoreBase.address,
      inceptionVaultsDataProviderBase.address,
      addressProvider.address,
      debtNotifier.address,
      weth,
      mimo,
    ],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_inception_vault_factory";
func.dependencies = ["AdminInceptionVault", "InceptionVaultsCore", "InceptionVaultsDataProvider"];
func.tags = ["InceptionVaultFactory", "Inception"];
