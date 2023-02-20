import { NETWORK_CONFIG } from "../config/deployment";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const chainId = await hre.getChainId();
  const networkConfig = NETWORK_CONFIG[Number.parseInt(chainId)];
  const collateralList = Object.keys(networkConfig.collaterals);

  if (!hre.network.live || NETWORK_CONFIG[Number.parseInt(chainId)].isTestNet) {
    console.log("Deploying Mock tokens");

    for (const element of collateralList) {
      if (networkConfig.collaterals[element].address === "") {
        await (element === "USDC"
          ? deploy("MockUSDC", {
              contract: "MockERC20",
              from: deployer,
              args: ["USD Coin", "USDC", 6],
              log: true,
              skipIfAlreadyDeployed: true,
            })
          : element === "WETH"
          ? deploy("MockWETH", {
              contract: "MockWETH",
              from: deployer,
              args: [],
              log: true,
              skipIfAlreadyDeployed: true,
            })
          : deploy(`Mock${element}`, {
              from: deployer,
              args: [],
              log: true,
              skipIfAlreadyDeployed: true,
            }));
      }
    }

    if (networkConfig.mimoToken === "") {
      await deploy("MockMIMO", {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: true,
      });
    }
  }
};

export default func;
func.id = "deploy_mock_tokens";
func.dependencies = ["CheckConfig"];
func.tags = ["MockTokens", "Core", "Governance", "Distributor"];
