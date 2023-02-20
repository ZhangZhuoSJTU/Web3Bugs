import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  await deploy("BaseAdminInceptionVault", {
    contract: "AdminInceptionVault",
    from: deployer,
    args: [],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_admin_inception_vault";
func.dependencies = ["Governance"];
func.tags = ["AdminInceptionVault", "Inception"];
