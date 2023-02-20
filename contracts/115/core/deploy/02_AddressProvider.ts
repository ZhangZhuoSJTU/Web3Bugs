import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const accessController = await hre.deployments.get("AccessController");

  console.log("Core 2");

  await deploy("AddressProvider", {
    from: deployer,
    args: [accessController.address],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_access_controller";
func.dependencies = ["AccessController"];
func.tags = ["AddressProvider", "Core"];
