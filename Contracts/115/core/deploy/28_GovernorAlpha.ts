import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer, guardian } = await hre.getNamedAccounts();

  const governanceAddressProvider = await hre.deployments.get("GovernanceAddressProvider");

  console.log("Governance 4 - Deploying GovernorAlpha...");

  await deploy("GovernorAlpha", {
    from: deployer,
    args: [governanceAddressProvider.address, guardian],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_governor_alpha";
func.dependencies = ["GovernanceAddressProvider"];
func.tags = ["GovernorAlpha", "Governance"];
