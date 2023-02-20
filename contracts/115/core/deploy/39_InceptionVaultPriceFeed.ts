import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const chainlinkInceptionPriceFeed = await deploy("ChainlinkInceptionPriceFeed", {
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  const inceptionVaultFactory = await hre.ethers.getContract("InceptionVaultFactory");
  await inceptionVaultFactory.addPriceFeed(chainlinkInceptionPriceFeed.address);
};

export default func;
func.id = "deploy_inception_vault_price_feed";
func.dependencies = ["Governance"];
func.tags = ["Inception", "InceptionVaultPriceFeed"];
