import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunction: DeployFunction = async function ({
  deployments,
  getNamedAccounts,
  ethers,
}: HardhatRuntimeEnvironment) {
  console.log("Running HybridPoolFactory deploy script");
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const masterDeployer = await ethers.getContract("MasterDeployer");
  const { address } = await deploy("HybridPoolFactory", {
    from: deployer,
    deterministicDeployment: false,
    args: [masterDeployer.address],
  });
  if (!(await masterDeployer.whitelistedFactories(address))) {
    console.log("Add HybridPoolFactory to MasterDeployer whitelist");
    await (await masterDeployer.addToWhitelist(address)).wait();
  }

  console.log("HybridPoolFactory deployed at ", address);
};

export default deployFunction;

deployFunction.dependencies = ["MasterDeployer"];

deployFunction.tags = ["HybridPoolFactory"];
