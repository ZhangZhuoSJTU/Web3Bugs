import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { NETWORK_CONFIG } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const chainId = await hre.getChainId();
  const networkConfig = NETWORK_CONFIG[Number.parseInt(chainId)];
  const [deployerSigner] = await hre.ethers.getSigners();
  const collateralList = Object.keys(networkConfig.collaterals);
  const debtNotifier = await hre.ethers.getContract("DebtNotifier", deployerSigner);

  console.log("Core - Setting DebtNotifier");

  for (const element of collateralList) {
    const supplyMiner = await hre.ethers.getContract(`${element}SupplyMiner`, deployerSigner);
    console.log(`${element}SupplyMiner: ${supplyMiner.address}`);
    let collateral = networkConfig.collaterals[element].address;
    if ((!hre.network.live || networkConfig.isTestNet) && collateral === "") {
      const mockToken = await hre.deployments.get(`Mock${element}`);
      collateral = mockToken.address;
    }

    const tx = await debtNotifier.setCollateralSupplyMiner(collateral, supplyMiner.address);
    const receipt = await tx.wait(1);
    console.log(`Set ${element} SupplyMiner (tx: ${receipt.transactionHash})`);
  }
};

export default func;
func.id = "set_debt_notifier";
func.dependencies = ["Governance"];
func.tags = ["SetDebtNotifier", "SetGovernance"];
