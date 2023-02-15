import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { NETWORK_CONFIG } from "../config/deployment";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const [deployerSigner] = await hre.ethers.getSigners();
  const chainId = await hre.getChainId();
  const networkConfig = NETWORK_CONFIG[Number.parseInt(chainId)];
  let tx;
  let receipt;

  const debtNotifier = await hre.deployments.get("DebtNotifier");
  const addressProvider = await hre.deployments.get("AddressProvider");
  const governorAlpha = await hre.deployments.get("GovernorAlpha");
  const timelock = await hre.deployments.get("Timelock");
  const votingEscrow = await hre.deployments.get("VotingEscrow");
  const vaultsCore = await hre.ethers.getContract("VaultsCore", deployerSigner);
  const governanceAddressProvider = await hre.ethers.getContract("GovernanceAddressProvider", deployerSigner);

  let mimo = networkConfig.mimoToken;
  if (networkConfig.isTestNet && mimo === "") {
    const mockMimo = await hre.deployments.get("MockMIMO");
    mimo = mockMimo.address;
  }

  tx = await vaultsCore.setDebtNotifier(debtNotifier.address);
  receipt = await tx.wait(1);
  console.log(`Set DebtNotifier on VaultsCore (tx: ${receipt.transactionHash})`);

  tx = await governanceAddressProvider.setParallelAddressProvider(addressProvider.address);
  receipt = await tx.wait(1);

  console.log(`Set AddressProvider on GovernanceAddressProvider (tx: ${receipt.transactionHash})`);

  tx = await governanceAddressProvider.setMIMO(mimo);
  receipt = await tx.wait(1);
  console.log(`Set AddressProvider on GovernanceAddressProvider (tx: ${receipt.transactionHash})`);

  tx = await governanceAddressProvider.setDebtNotifier(debtNotifier.address);
  receipt = await tx.wait(1);

  console.log(`Set DebtNotifier on GovernanceAddressProvider (tx: ${receipt.transactionHash})`);

  tx = await governanceAddressProvider.setGovernorAlpha(governorAlpha.address);
  receipt = await tx.wait(1);

  console.log(`Set GovernorAlpha on GovernanceAddressProvider (tx: ${receipt.transactionHash})`);

  tx = await governanceAddressProvider.setTimelock(timelock.address);
  receipt = await tx.wait(1);

  console.log(`Set Timelock on GovernanceAddressProvider (tx: ${receipt.transactionHash})`);

  tx = await governanceAddressProvider.setVotingEscrow(votingEscrow.address);
  receipt = await tx.wait(1);

  console.log(`Set votingEscrow on GovernanceAddressProvider (tx: ${receipt.transactionHash})`);
};

export default func;
func.id = "set_governance_providers";
func.dependencies = ["Governance"];
func.tags = ["SetGovernanceProviders", "SetGovernance"];
