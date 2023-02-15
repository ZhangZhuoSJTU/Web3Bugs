import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const lockExpiry = 1766271600; // 20 Dec 2025
  const balancerPoolIdPolygon = "0x77952e11e1ba727ffcea95a0f38ed7da586eebc7000200000000000000000072";
  const balancerPoolIdEthereum = "0x5b1c06c4923dbba4b27cfa270ffb2e60aa28615900020000000000000000004a";
  const balancerPoolIdFantom = "0x851553fd9bcd28befe450d3cfbb3f86f13832a1d000200000000000000000211";
  const MIMOEthereum = "0x90b831fa3bebf58e9744a14d638e25b4ee06f9bc";
  const MIMOPolygon = "0xadac33f543267c4d59a8c299cf804c303bc3e4ac";
  const MIMOFantom = "0x1D1764F04DE29da6b90ffBef372D1A45596C4855";
  const balancerEthereum = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
  const balancerFantom = "0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce";

  let MIMO;
  let balancer;
  let poolId;
  switch (hre.network.name) {
    case "polygon":
      balancer = balancerEthereum;
      poolId = balancerPoolIdPolygon;
      MIMO = MIMOPolygon;
      break;
    case "mainnet":
      balancer = balancerEthereum;
      poolId = balancerPoolIdEthereum;
      MIMO = MIMOEthereum;
      break;
    case "fantommainnet":
      balancer = balancerFantom;
      poolId = balancerPoolIdFantom;
      MIMO = MIMOFantom;
      break;
    case "rinkeby":
      balancer = balancerEthereum;
      poolId = balancerPoolIdEthereum;
      MIMO = "0xe1C8E6F826bFA18277aEDB289235a4F1D261eD7a";
      break;
    default:
      break;
  }

  if (!MIMO || !poolId) {
    throw new Error("no MIMO or poolID set for this network");
  }

  const addressProvider = await hre.deployments.get("AddressProvider");

  await deploy("MIMOBuyback", {
    from: deployer,
    args: [lockExpiry, poolId, addressProvider.address, MIMO, balancer],
    log: true,
    skipIfAlreadyDeployed: true,
  });
};

export default func;
func.id = "deploy_mimo_buyback";
func.tags = ["MIMOBuyback"];
