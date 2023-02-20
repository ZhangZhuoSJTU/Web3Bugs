import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  console.log("Core 1");

  await deploy("AccessController", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_access_controller";
func.dependencies = ["CheckConfig"];
func.tags = ["AccessController", "Core"];
