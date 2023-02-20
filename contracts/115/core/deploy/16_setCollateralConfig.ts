import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { NETWORK_CONFIG } from "../config/deployment";
import { setCollateralConfig } from "../utils/helper";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const [deployerSigner] = await hre.ethers.getSigners();
  const chainId = await hre.getChainId();
  const networkConfig = NETWORK_CONFIG[Number.parseInt(chainId)];
  const collateralList = Object.keys(networkConfig.collaterals);

  const configProvider = await hre.ethers.getContract("ConfigProvider", deployerSigner);

  console.log("Core - Setting CollateralConfig");

  for (const element of collateralList) {
    let collateral = networkConfig.collaterals[element].address;
    if ((!hre.network.live || networkConfig.isTestNet) && collateral === "") {
      const mockToken = await hre.deployments.get(`Mock${element}`);
      collateral = mockToken.address;
    }

    await setCollateralConfig(configProvider, element, collateral);
  }
};

export default func;
func.id = "set_collateral_config";
func.dependencies = ["Core"];
func.tags = ["SetCore", "SetCollateralConfig"];
