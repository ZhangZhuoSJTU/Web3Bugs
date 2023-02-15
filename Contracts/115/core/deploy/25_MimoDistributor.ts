import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { NETWORK_CONFIG } from "../config/deployment";

const { time } = require("@openzeppelin/test-helpers");

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const chainId = await hre.getChainId();
  const networkConfig = NETWORK_CONFIG[Number.parseInt(chainId)];

  if (networkConfig.isTestNet) {
    const governanceAddressProvider = await hre.deployments.get("GovernanceAddressProvider");

    const mimoDistributor = await deploy("MIMODistributor", {
      from: deployer,
      args: [governanceAddressProvider.address, time.latest()],
      log: true,
      skipIfAlreadyDeployed: true,
    });

    await deploy("MIMODistributorV2", {
      from: deployer,
      args: [governanceAddressProvider.address, time.latest(), mimoDistributor.address],
      log: true,
      skipIfAlreadyDeployed: true,
    });
  }
};

export default func;
func.id = "deploy_mimo_distributor";
func.dependencies = ["Governance"];
func.tags = ["MIMODistributor", "LiquidityMining"];
