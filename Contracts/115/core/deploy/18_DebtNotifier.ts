import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const governanceAddressProvider = await hre.deployments.get("GovernanceAddressProvider");

  console.log("Core 13");

  await deploy("DebtNotifier", {
    from: deployer,
    args: [governanceAddressProvider.address],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deply_debt_notifier";
func.dependencies = ["GovernanceAddressProvider"];
func.tags = ["DebtNotifier", "Governance", "GovernanceV2"];
