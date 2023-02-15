import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy("BaseInceptionVaultsCore", {
    contract: "InceptionVaultsCore",
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_inception_vaults_core";
func.dependencies = ["AdminInceptionVault"];
func.tags = ["InceptionVaultsCore", "Inception", "InceptionCollateral"];
