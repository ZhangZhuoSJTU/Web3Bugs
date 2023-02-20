import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { NETWORK_CONFIG } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const chainId = await hre.getChainId();
  const networkConfig = NETWORK_CONFIG[Number.parseInt(chainId)];
  const collateralList = Object.keys(networkConfig.collaterals);
  const governanceAddressProvider = await hre.deployments.get("GovernanceAddressProvider");

  for (const element of collateralList) {
    await deploy(`${element}SupplyMiner`, {
      from: deployer,
      contract: "SupplyMiner",
      args: [governanceAddressProvider.address],
      log: true,
      skipIfAlreadyDeployed: true,
    });
  }
};

export default func;
func.id = "deploy_supply_miners";
func.dependencies = ["GovernanceAddressProvider"];
func.tags = ["SupplyMiners", "Governance"];
