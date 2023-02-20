import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { INCEPTION_VAULT_COLLATERAL } from "../config/deployment";
import { EACProxyAggregatorAbi } from "../utils/abis/EACAggregatorProxy";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  let inceptionCollateral = INCEPTION_VAULT_COLLATERAL.address;
  let inceptionCollateralAggregator = INCEPTION_VAULT_COLLATERAL.usdAggregator;

  if (!hre.network.live) {
    if (inceptionCollateral === "") {
      const mockToken = await deploy("MockAAVE", {
        contract: "MockERC20",
        from: deployer,
        args: ["MockAAVE", "mAAVE", 18],
      });
      inceptionCollateral = mockToken.address;
    }

    if (inceptionCollateralAggregator === "") {
      const ethereumProvider = hre.ethers.getDefaultProvider("mainnet", { infura: process.env.INFURA_TOKEN });
      const chainlinkAaveUsdAggregator = new hre.ethers.Contract(
        "0x547a514d5e3769680Ce22B2361c10Ea13619e8a9",
        EACProxyAggregatorAbi,
        ethereumProvider,
      );
      const latestRoundData = await chainlinkAaveUsdAggregator.latestRoundData();
      const aaveStartPrice = await latestRoundData.answer.toString();
      const mockAggregator = await deploy("AaveUsdAggregator", {
        contract: "MockChainlinkAggregator",
        from: deployer,
        args: [8, aaveStartPrice, "AAVE / USD"],
        log: true,
        skipIfAlreadyDeployed: true,
      });
      inceptionCollateralAggregator = mockAggregator.address;
    }
  }
};

export default func;
func.id = "deploy_inception_vaults_collateral";
func.dependencies = ["AdminInceptionVault"];
func.tags = ["InceptionCollateral", "Inception"];
