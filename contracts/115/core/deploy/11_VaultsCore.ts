import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { NETWORK_CONFIG } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const chainId = await hre.getChainId();
  const networkConfig = NETWORK_CONFIG[Number.parseInt(chainId)];

  const addressProvider = await hre.deployments.get("AddressProvider");
  const coreState = await hre.deployments.get("VaultsCoreState");

  let WETH = networkConfig.collaterals[networkConfig.baseToken].address;

  console.log("Core 11");

  if ((!hre.network.live || networkConfig.isTestNet) && networkConfig.collaterals.WETH.address === "") {
    const mockBaseToken = await hre.deployments.get(`Mock${networkConfig.baseToken}`);
    WETH = mockBaseToken.address;
  }

  await deploy("VaultsCore", {
    from: deployer,
    args: [addressProvider.address, WETH, coreState.address],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_vaults_core";
func.dependencies = ["AddressProvider", "VaultsCoreState"];
func.tags = ["VaultsCore", "Core"];
