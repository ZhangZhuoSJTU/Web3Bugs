import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const configs: any = {
  polygon: {
    pool: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
    usdcOracle: "0xfe4a8cc5b5b2366c1b58bea3858e81843581b2f7",
    eurOracle: "0x73366fe0aa0ded304479862808e02506fe556a98",
  },
};

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  console.log("deployer is", deployer);
  console.log("network is", hre.network.name);

  const config = configs[hre.network.name];
  if (!config) {
    console.error("Unsupported network");
  }

  await deploy("GUniLPOracle", {
    from: deployer,
    args: [8, "PAR/EUR GUni LP Oracle", config.pool, config.usdcOracle, config.eurOracle],
    log: true,
  });
};

export default func;
func.id = "deploy_balancerv2_lp_oracle";
func.tags = ["Oracle"];
