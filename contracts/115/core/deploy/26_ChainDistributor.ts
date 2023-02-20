import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { MAINNET_CONTRACTS } from "../config/deployment";
import { capitalizeFirstLetter } from "../utils/helper";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const networkName = capitalizeFirstLetter(hre.network.name);

  console.log(`Deploying ${networkName}Distributor...`);

  await deploy(`${networkName}Distributor`, {
    contract: "PolygonDistributor",
    from: deployer,
    args: [
      MAINNET_CONTRACTS.GovernanceAddressProvider,
      MAINNET_CONTRACTS.RootChainManager,
      MAINNET_CONTRACTS.ERC20PredicateProxy,
    ],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_sidechain_distributor";
func.tags = ["ChainDistributor"];
