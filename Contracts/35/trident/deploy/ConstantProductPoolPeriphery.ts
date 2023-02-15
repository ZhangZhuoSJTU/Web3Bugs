import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BENTOBOX_ADDRESS, ChainId, WNATIVE } from "@sushiswap/sdk";

const deployFunction: DeployFunction = async function ({ deployments, getNamedAccounts, ethers, getChainId }: HardhatRuntimeEnvironment) {
  console.log("Running ConstantProductPoolPeriphery deploy script");

  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = Number(await getChainId());

  const masterDeployer = await ethers.getContract("MasterDeployer");

  let bentoBoxV1Address;
  let wethAddress;

  if (chainId === 31337) {
    bentoBoxV1Address = (await ethers.getContract("BentoBoxV1")).address;
    wethAddress = (await ethers.getContract("WETH9")).address;
  } else {
    if (!(chainId in WNATIVE)) {
      throw Error(`No WETH on chain #${chainId}!`);
    } else if (!(chainId in BENTOBOX_ADDRESS)) {
      throw Error(`No BENTOBOX on chain #${chainId}!`);
    }
    bentoBoxV1Address = BENTOBOX_ADDRESS[chainId as ChainId];
    wethAddress = WNATIVE[chainId as ChainId].address;
  }

  const positionManager = await deploy("ConcentratedLiquidityPoolManager", {
    from: deployer,
    deterministicDeployment: false,
    args: [bentoBoxV1Address, wethAddress, masterDeployer.address],
  });

  console.log("ConcentratedLiquidityPoolManager deployed at ", positionManager.address);

  const factory = await deploy("ConcentratedLiquidityPoolFactory", {
    from: deployer,
    deterministicDeployment: false,
    args: [masterDeployer.address, positionManager.address],
  });

  if (!(await masterDeployer.whitelistedFactories(factory.address))) {
    console.log("Add ConcentratedLiquidityPoolFactory to MasterDeployer whitelist");
    await (await masterDeployer.addToWhitelist(factory.address)).wait();
  }

  console.log("ConcentratedLiquidityPoolFactory deployed at ", factory.address);
};

export default deployFunction;

deployFunction.dependencies = ["MasterDeployer"];

deployFunction.tags = ["ConstantProductPoolPeriphery"];
