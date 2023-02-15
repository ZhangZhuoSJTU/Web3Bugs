import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BOOST_CONFIG, DEMAND_MINER_TOKENS, FEE_CONFIG, MULTISIG } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  if (hre.network.live) {
    const { deploy } = hre.deployments;
    const { deployer } = await hre.getNamedAccounts();
    const chainId = await hre.getChainId();
    const demandMinerTokens = DEMAND_MINER_TOKENS[Number.parseInt(chainId)];
    const demandMinerTokenList = Object.keys(demandMinerTokens);
    const multisig = MULTISIG[Number.parseInt(chainId)];

    const governanceAddressProvider = await hre.deployments.get("GovernanceAddressProvider");

    for (const element of demandMinerTokenList) {
      await deploy(`${element}DemandMinerV2`, {
        from: deployer,
        contract: "DemandMinerV2",
        args: [governanceAddressProvider.address, demandMinerTokens[element], multisig, BOOST_CONFIG, FEE_CONFIG],
        log: true,
        skipIfAlreadyDeployed: true,
      });
    }
  }
};

export default func;
func.id = "deploy_demand_miners_v2";
func.dependencies = ["GovernanceAddressProvider"];
func.tags = ["DemandMinersV2", "GovernanceV2"];
