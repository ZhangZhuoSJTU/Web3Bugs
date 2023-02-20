import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { VOTING_ESCROW_NAME, VOTING_ESCROW_SYMBOL, NETWORK_CONFIG } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const chainId = await hre.getChainId();
  const networkConfig = NETWORK_CONFIG[Number.parseInt(chainId)];

  const governanceAddressProvider = await hre.deployments.get("GovernanceAddressProvider");
  console.log("Governance 1 - Deploying VotingMiner");

  const votingMiner = await deploy("VotingMiner", {
    from: deployer,
    args: [governanceAddressProvider.address],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  let MIMO = networkConfig.mimoToken;
  if ((!hre.network.live || networkConfig.isTestNet) && MIMO === "") {
    const mockMimo = await hre.deployments.get("MockMIMO");
    MIMO = mockMimo.address;
  }

  console.log("Governance 2 - Deploying VotingEscrow...");
  await deploy("VotingEscrow", {
    from: deployer,
    args: [MIMO, governanceAddressProvider.address, votingMiner.address, VOTING_ESCROW_NAME, VOTING_ESCROW_SYMBOL],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_voting_escrow";
func.dependencies = ["GovernanceAddressProvider"];
func.tags = ["VotingEscrow", "Governance"];
