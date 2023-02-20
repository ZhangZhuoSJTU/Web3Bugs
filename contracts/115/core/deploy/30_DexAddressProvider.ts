import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { DEXES } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const addressProvider = await hre.deployments.get("AddressProvider");

  await deploy("DexAddressProvider", {
    from: deployer,
    args: [addressProvider.address, DEXES],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_dex_address_provider";
func.dependencies = ["AddressProvider"];
func.tags = ["DexAddressProvider", "GovernanceV2"];
