import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { BOOST_CONFIG } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const dexAddressProvider = await hre.deployments.get("DexAddressProvider");
  const governanceAddressProvider = await hre.deployments.get("GovernanceAddressProvider");

  await deploy("PARMinerV2", {
    from: deployer,
    args: [governanceAddressProvider.address, dexAddressProvider.address, BOOST_CONFIG],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_par_miner_v2";
func.dependencies = ["GovernanceAddressProvider", "DexAddressProvider"];
func.tags = ["PARMinerV2", "GovernanceV2"];
