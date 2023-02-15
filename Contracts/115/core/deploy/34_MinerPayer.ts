import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const GovernanceAddressProviderAddress = "0x5e072BeFbDDF76F7f4553f0Ae6dE1C37532107d3";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  console.log("deployer is", deployer);

  await deploy("MinerPayer", {
    from: deployer,
    args: [GovernanceAddressProviderAddress],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_miner_payer";
func.tags = ["MinerPayer"];
