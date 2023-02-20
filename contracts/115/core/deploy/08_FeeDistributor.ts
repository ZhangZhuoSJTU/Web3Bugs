import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const addressProvider = await hre.deployments.get("AddressProvider");

  console.log("Core 8");

  await deploy("FeeDistributor", {
    from: deployer,
    args: [addressProvider.address],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_fee_distributor";
func.dependencies = ["AddressProvider"];
func.tags = ["FeeDistributor", "Core"];
