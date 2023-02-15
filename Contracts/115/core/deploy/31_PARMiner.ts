import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const governanceAddressProvider = await hre.deployments.get("GovernanceAddressProvider");

  await deploy("PARMiner", {
    from: deployer,
    args: [governanceAddressProvider.address],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_par_miner";
func.dependencies = ["GovernanceAddressProvider"];
func.tags = ["PARMiner"];
