import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const [deployerSigner] = await hre.ethers.getSigners();

  console.log("Core - Setting Fees");

  const vaultsCore = await hre.deployments.get("VaultsCore");

  const feeDistributor = await hre.ethers.getContract("FeeDistributor", deployerSigner);

  const feePayees = [vaultsCore.address];
  const feeShares = [100];

  const tx = await feeDistributor.changePayees(feePayees, feeShares);
  const receipt = await tx.wait(1);
  console.log(`Set Payees to VaultsCore and shares to 100 (tx: ${receipt.transactionHash})`);
};

export default func;
func.id = "set_fees";
func.dependencies = ["Core"];
func.tags = ["SetCore", "SetFees"];
