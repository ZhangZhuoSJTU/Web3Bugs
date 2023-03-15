const { ethers } = require('hardhat');

/**
 * Deploys a second version of many contracts for projects to migrate onto as a consequence of https://github.com/jbx-protocol/juice-contracts-v2/pull/268.
 *
 * Example usage:
 *
 * npx hardhat deploy --network rinkeby --tag 2
 */
module.exports = async ({ deployments, getChainId }) => {
  console.log("Deploying 2");

  const { deploy } = deployments;
  const [deployer] = await ethers.getSigners();

  let multisigAddress;
  let chainId = await getChainId();
  let baseDeployArgs = {
    from: deployer.address,
    log: true,
    skipIfAlreadyDeployed: true,
  };

  console.log({ deployer: deployer.address, chain: chainId });

  switch (chainId) {
    // mainnet
    case '1':
      multisigAddress = '0xAF28bcB48C40dBC86f52D459A6562F658fc94B1e';
      break;
    // rinkeby
    case '4':
      multisigAddress = '0xAF28bcB48C40dBC86f52D459A6562F658fc94B1e';
      break;
    // hardhat / localhost
    case '31337':
      multisigAddress = deployer.address;
      break;
  }

  console.log({ multisigAddress });

  // Reuse the JBOperatorStore contract.
  const JBOperatorStore = await deploy('JBOperatorStore', {
    ...baseDeployArgs,
    args: [],
  });

  // Reuse the JBPrices contract.
  const JBPrices = await deploy('JBPrices', {
    ...baseDeployArgs,
    args: [deployer.address],
  });

  // Reuse the JBProjects contract.
  const JBProjects = await deploy('JBProjects', {
    ...baseDeployArgs,
    args: [JBOperatorStore.address],
  });

  // Reuse the currencies library.
  const JBCurrencies = await deploy('JBCurrencies', {
    ...baseDeployArgs,
    args: [],
  });

  // Get the future address of JBFundingCycleStore
  const transactionCount = await deployer.getTransactionCount();

  const FundingCycleStoreFutureAddress = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: transactionCount + 1,
  });

  // Deploy a JBDirectory.
  const JBDirectory = await deploy('JBDirectory', {
    ...baseDeployArgs,
    skipIfAlreadyDeployed: false,
    contract: "contracts/JBDirectory.sol:JBDirectory",
    args: [
      JBOperatorStore.address,
      JBProjects.address,
      FundingCycleStoreFutureAddress,
      deployer.address,
    ],
  });

  // Deploy a JBFundingCycleStore.
  const JBFundingCycleStore = await deploy('JBFundingCycleStore', {
    ...baseDeployArgs,
    skipIfAlreadyDeployed: false,
    contract: "contracts/JBFundingCycleStore.sol:JBFundingCycleStore",
    args: [JBDirectory.address],
  });

  // Deploy a JB3DayReconfigurationBufferBallot.
  await deploy('JB3DayReconfigurationBufferBallot', {
    ...baseDeployArgs,
    skipIfAlreadyDeployed: false,
    contract: "contracts/JBReconfigurationBufferBallot.sol:JBReconfigurationBufferBallot",
    args: [259200, JBFundingCycleStore.address],
  });

  // Deploy a JB7DayReconfigurationBufferBallot.
  await deploy('JB7DayReconfigurationBufferBallot', {
    ...baseDeployArgs,
    skipIfAlreadyDeployed: false,
    contract: "contracts/JBReconfigurationBufferBallot.sol:JBReconfigurationBufferBallot",
    args: [604800, JBFundingCycleStore.address],
  });

  // Deploy a JBTokenStore.
  const JBTokenStore = await deploy('JBTokenStore', {
    ...baseDeployArgs,
    skipIfAlreadyDeployed: false,
    contract: "contracts/JBTokenStore.sol:JBTokenStore",
    args: [JBOperatorStore.address, JBProjects.address, JBDirectory.address],
  });

  // Deploy a JBSplitStore.
  const JBSplitStore = await deploy('JBSplitsStore', {
    ...baseDeployArgs,
    skipIfAlreadyDeployed: false,
    contract: "contracts/JBSplitsStore.sol:JBSplitsStore",
    args: [JBOperatorStore.address, JBProjects.address, JBDirectory.address],
  });

  // Deploy a JBETHERC20SplitsPayerDeployer contract.
  await deploy('JBETHERC20SplitsPayerDeployer', {
    ...baseDeployArgs,
    skipIfAlreadyDeployed: false,
    contract: "contracts/JBETHERC20SplitsPayerDeployer.sol:JBETHERC20SplitsPayerDeployer",
    args: [],
  });

  // Deploy a JBController contract.
  const JBController = await deploy('JBController', {
    ...baseDeployArgs,
    skipIfAlreadyDeployed: false,
    contract: "contracts/JBController.sol:JBController",
    args: [
      JBOperatorStore.address,
      JBProjects.address,
      JBDirectory.address,
      JBFundingCycleStore.address,
      JBTokenStore.address,
      JBSplitStore.address,
    ],
  });

  // Deploy a JBSingleTokenPaymentTerminalStore contract.
  const JBSingleTokenPaymentTerminalStore = await deploy('JBSingleTokenPaymentTerminalStore', {
    ...baseDeployArgs,
    skipIfAlreadyDeployed: false,
    contract: "contracts/JBSingleTokenPaymentTerminalStore.sol:JBSingleTokenPaymentTerminalStore",
    args: [JBDirectory.address, JBFundingCycleStore.address, JBPrices.address],
  });

  // Get references to contract that will have transactions triggered.
  const jbDirectoryContract = new ethers.Contract(JBDirectory.address, JBDirectory.abi);
  const jbCurrenciesLibrary = new ethers.Contract(JBCurrencies.address, JBCurrencies.abi);

  // Get a reference to USD and ETH currency indexes.
  const ETH = await jbCurrenciesLibrary.connect(deployer).ETH();

  // Deploy a JBETHPaymentTerminal contract.
  await deploy('JBETHPaymentTerminal', {
    ...baseDeployArgs,
    skipIfAlreadyDeployed: false,
    contract: "contracts/JBETHPaymentTerminal.sol:JBETHPaymentTerminal",
    args: [
      ETH,
      JBOperatorStore.address,
      JBProjects.address,
      JBDirectory.address,
      JBSplitStore.address,
      JBPrices.address,
      JBSingleTokenPaymentTerminalStore.address,
      multisigAddress,
    ],
  });

  let isAllowedToSetFirstController = await jbDirectoryContract
    .connect(deployer)
    .isAllowedToSetFirstController(JBController.address);

  console.log({ isAllowedToSetFirstController });

  // If needed, allow the controller to set projects' first controller, then transfer the ownership of the JBDirectory to the multisig.
  if (!isAllowedToSetFirstController) {
    let tx = await jbDirectoryContract
      .connect(deployer)
      .setIsAllowedToSetFirstController(JBController.address, true);
    await tx.wait();
  }

  // If needed, transfer the ownership of the JBDirectory contract to the multisig.
  if ((await jbDirectoryContract.connect(deployer).owner()) != multisigAddress)
    await jbDirectoryContract.connect(deployer).transferOwnership(multisigAddress);

  console.log('Done');
};

module.exports.tags = ['2'];
module.exports.dependencies = ['1']; 