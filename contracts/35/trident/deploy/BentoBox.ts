import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunction: DeployFunction = async function ({ ethers, deployments, getNamedAccounts, getChainId }: HardhatRuntimeEnvironment) {
  console.log("Running BentoBox deploy script");

  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = Number(await getChainId());

  const weth9 = await deploy("WETH9", {
    from: deployer,
    args: [],
    deterministicDeployment: false,
  });

  const { address } = await deploy("BentoBoxV1", {
    from: deployer,
    args: [chainId === 42 ? "0xd0A1E359811322d97991E03f863a0C30C2cF029C" : weth9.address],
    deterministicDeployment: false,
  });

  console.log("BentoBoxV1 deployed at ", address);
};

export default deployFunction;

deployFunction.tags = ["BentoBoxV1"];

// for testing purposes we redeploy bentobox (with strategy delay of 0)
deployFunction.skip = ({ getChainId }) =>
  new Promise(async (resolve, reject) => {
    try {
      const chainId = await getChainId();
      resolve(chainId !== "31337" /*  && chainId !== "42" */);
    } catch (error) {
      reject(error);
    }
  });
