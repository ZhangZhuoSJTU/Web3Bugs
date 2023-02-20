import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/dist/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy("BaseInceptionVaultsDataProvider", {
    contract: "InceptionVaultsDataProvider",
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_inception_vaults_data_provider";
func.dependencies = ["InceptionVaultsCore"];
func.tags = ["Inception", "InceptionVaultsDataProvider"];
