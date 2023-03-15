const fs = require('fs');
const dotenv = require('dotenv');
const taskNames = require('hardhat/builtin-tasks/task-names');

require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');
require('hardhat-gas-reporter');
require('hardhat-deploy');
require('solidity-coverage');

dotenv.config();

const defaultNetwork = 'localhost';

function mnemonic() {
  try {
    return fs.readFileSync('./mnemonic.txt').toString().trim();
  } catch (e) {
    if (defaultNetwork !== 'localhost') {
      console.log('☢️ WARNING: No mnemonic file created for a deploy account.');
    }
  }
  return '';
}

const infuraId = process.env.INFURA_ID;

module.exports = {
  defaultNetwork,
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: 'http://localhost:8545',
      blockGasLimit: 0x1fffffffffffff,
    },
    rinkeby: {
      url: 'https://rinkeby.infura.io/v3/' + infuraId,
      accounts: {
        mnemonic: mnemonic(),
      },
    },
    mainnet: {
      url: 'https://mainnet.infura.io/v3/' + infuraId,
      accounts: {
        mnemonic: mnemonic(),
      },
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    feeCollector: {
      default: 0,
    },
  },
  solidity: {
    version: '0.8.6',
    settings: {
      optimizer: {
        enabled: true,
        // https://docs.soliditylang.org/en/v0.8.10/internals/optimizer.html#:~:text=Optimizer%20Parameter%20Runs,-The%20number%20of&text=A%20%E2%80%9Cruns%E2%80%9D%20parameter%20of%20%E2%80%9C,is%202**32%2D1%20.
        runs: 1000000,
      },
    },
  },
  mocha: {
    bail: true,
    timeout: 12000,
  },
  gasReporter: {
    currency: 'USD',
    // gasPrice: 21,
    enabled: !!process.env.REPORT_GAS,
    showTimeSpent: true,
  },
  etherscan: {
    apiKey: `${process.env.ETHERSCAN_API_KEY}`,
  },
};

// List details of deployer account.
task('account', 'Get balance informations for the deployment account.', async (_, { ethers }) => {
  const hdkey = require('ethereumjs-wallet/hdkey');
  const bip39 = require('bip39');
  let mnemonic = fs.readFileSync('./mnemonic.txt').toString().trim();
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const hdwallet = hdkey.fromMasterSeed(seed);
  const wallet_hdpath = "m/44'/60'/0'/0/";
  const account_index = 0;
  let fullPath = wallet_hdpath + account_index;
  const wallet = hdwallet.derivePath(fullPath).getWallet();
  var EthUtil = require('ethereumjs-util');
  const address = '0x' + EthUtil.privateToAddress(wallet._privKey).toString('hex');

  console.log('Deployer Account: ' + address);
  for (let n in config.networks) {
    try {
      let provider = new ethers.providers.JsonRpcProvider(config.networks[n].url);
      let balance = await provider.getBalance(address);
      console.log(' -- ' + n + ' --  -- -- 📡 ');
      console.log('   balance: ' + ethers.utils.formatEther(balance));
      console.log('   nonce: ' + (await provider.getTransactionCount(address)));
    } catch (e) {
      console.log(e);
    }
  }
});

task('compile:one', 'Compiles a single contract in isolation')
  .addPositionalParam('contractName')
  .setAction(async function (args, env) {
    const sourceName = env.artifacts.readArtifactSync(args.contractName).sourceName;

    const dependencyGraph = await env.run(taskNames.TASK_COMPILE_SOLIDITY_GET_DEPENDENCY_GRAPH, {
      sourceNames: [sourceName],
    });

    const resolvedFiles = dependencyGraph.getResolvedFiles().filter((resolvedFile) => {
      return resolvedFile.sourceName === sourceName;
    });

    const compilationJob = await env.run(
      taskNames.TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOB_FOR_FILE,
      {
        dependencyGraph,
        file: resolvedFiles[0],
      },
    );

    await env.run(taskNames.TASK_COMPILE_SOLIDITY_COMPILE_JOB, {
      compilationJob,
      compilationJobs: [compilationJob],
      compilationJobIndex: 0,
      emitsArtifacts: true,
      quiet: true,
    });
  });

task('deploy-ballot', 'Deploy a buffer ballot of a given duration')
  .addParam('duration', 'Set the ballot duration (in seconds)')
  .setAction(async (taskArgs, hre) => {
    try {
      const { get, deploy } = deployments;
      const [deployer] = await hre.ethers.getSigners();

      // Take the previously deployed
      const JBFundingCycleStoreDeployed = await get('JBFundingCycleStore');

      const JB3DayReconfigurationBufferBallot = await deploy('JBReconfigurationBufferBallot', {
        from: deployer.address,
        log: true,
        args: [taskArgs.duration, JBFundingCycleStoreDeployed.address],
      });

      console.log('Buffer ballot deployed at ' + JB3DayReconfigurationBufferBallot.address);
    } catch (error) {
      console.log(error);
    }
  });
