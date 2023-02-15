import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { TIMELOCK_DELAY } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer, guardian } = await hre.getNamedAccounts();

  console.log("Governance 3 - Deploying Timelock...");

  await deploy("Timelock", {
    from: deployer,
    args: [guardian, TIMELOCK_DELAY],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_timelock";
func.tags = ["Timelock", "Governance"];
