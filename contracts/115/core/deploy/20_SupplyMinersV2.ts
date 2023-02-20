import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BOOST_CONFIG, NETWORK_CONFIG } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const chainId = await hre.getChainId();
  const networkConfig = NETWORK_CONFIG[Number.parseInt(chainId)];
  const collateralList = Object.keys(networkConfig.collaterals);
  const governanceAddressProvider = await hre.deployments.get("GovernanceAddressProvider");

  for (const element of collateralList) {
    let collateral = networkConfig.collaterals[element].address;
    if (collateral === "") {
      const mockCollateral = await hre.deployments.get(`Mock${element}`);
      collateral = mockCollateral.address;
    }

    await deploy(`${element}SupplyMinerV2`, {
      from: deployer,
      contract: "SupplyMinerV2",
      args: [governanceAddressProvider.address, BOOST_CONFIG, collateral],
      log: true,
      skipIfAlreadyDeployed: true,
    });
  }
};

export default func;
func.id = "deploy_supply_miners";
func.dependencies = ["GovernanceAddressProvider"];
func.tags = ["SupplyMinersV2", "GovernanceV2"];
