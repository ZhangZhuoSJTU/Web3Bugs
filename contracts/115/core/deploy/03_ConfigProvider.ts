import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const addressProvider = await hre.deployments.get("AddressProvider");

  console.log("Core 3");

  await deploy("ConfigProvider", {
    from: deployer,
    args: [addressProvider.address],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_config_provider";
func.dependencies = ["AddressProvider"];
func.tags = ["ConfigProvider", "Core"];
