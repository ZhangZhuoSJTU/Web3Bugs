import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const [deployerSigner] = await hre.ethers.getSigners();

  console.log("Core - Setting Access");

  const vaultsCore = await hre.deployments.get("VaultsCore");
  const feeDistributor = await hre.deployments.get("FeeDistributor");

  const accessController = await hre.ethers.getContract("AccessController", deployerSigner);
  let receipt;
  let tx;

  const minterRole = await accessController.MINTER_ROLE();
  tx = await accessController.grantRole(minterRole, feeDistributor.address);
  receipt = await tx.wait(1);
  console.log(`Granted MINTER_ROLE for FeeDistributor (tx: ${receipt.transactionHash})`);
  tx = await accessController.grantRole(minterRole, vaultsCore.address);
  receipt = await tx.wait(1);
  console.log(`Granted MINTER_ROLE for VaultsCore (tx: ${receipt.transactionHash})`);
};

export default func;
func.id = "set_access";
func.dependencies = ["Core"];
func.tags = ["SetCore", "SetAccess"];
