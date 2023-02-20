import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BOOST_CONFIG } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const governanceAddressProvider = await hre.deployments.get("GovernanceAddressProvider");
  console.log("Governance 1 - Deploying VotingMiner");

  await deploy("VotingMinerV2", {
    from: deployer,
    args: [governanceAddressProvider.address, BOOST_CONFIG],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_voting_escrow";
func.dependencies = ["GovernanceAddressProvider"];
func.tags = ["VotingMinerV2", "GovernanceV2"];
