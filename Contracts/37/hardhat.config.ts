import { task } from 'hardhat/config';

import 'solidity-coverage';
import 'hardhat-gas-reporter';
import 'hardhat-deploy';
import 'hardhat-abi-exporter';
import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import 'dotenv/config';

if (process.env.HARDHAT_FORK) {
  process.env['HARDHAT_DEPLOY_FORK'] = process.env.HARDHAT_FORK;
}

function getNodeUrl(networkName: string) : string {
  if (networkName === 'localhost') {
    // do not use ETH_NODE_URI
    return 'http://localhost:8545';
  }
  const nodeUriEnvVar = 'ETH_NODE_URI_' + networkName.toUpperCase();
  
  const uri = process.env[nodeUriEnvVar];
  if (!uri) {
    throw new Error(
      `network ${networkName} node URI is not configured. Set ${nodeUriEnvVar} environment variables.`
    );
  }

  return uri;
}

const TEST_ACCOUNTS_KEYS = [
  "0x6c6c264916401a7c067c014c61e8c89dba5525e904a6631fd84ccc6e0829f0b3",
  "0xddb0d7ed4eae780e20fef9bf8d4591b3766526cee8b7307ebb8ea597cd16d066",
  "0x18728648caa52cc938670482acfdcb9196d002b8c06b902679d7b4429df97ef3",
  "0x35ed970f932d0e41f4bd7e1e95ca44a0229c73408f9b6f9cf4f949f3699599cc"
];

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args: any, hre: any) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  typechain: {
    outDir: `./typechain`,
  },
  abiExporter: {
    path: './abi-artifacts',
    clear: false,
    flat: true,
    only: [],
    spacing: 2
  },
  solidity: {
    compilers: [
      {
        version: "0.8.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 800
          }
        }
      }
    ]
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
      // process.env.HARDHAT_FORK will specify the network that the fork is made from.
      forking: process.env.HARDHAT_FORK
        ? {
            url: getNodeUrl(process.env.HARDHAT_FORK),
            blockNumber: process.env.HARDHAT_FORK_NUMBER
              ? parseInt(process.env.HARDHAT_FORK_NUMBER)
              : undefined,
          }
        : undefined,
      accounts: TEST_ACCOUNTS_KEYS.map(privateKey => ({ privateKey, balance: "10000000000000000000000000" }))
    }
  },
  namedAccounts: {
    deployer: {
      default: 0
    },
    daiHolder: '0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0',
    aDaiHolder: '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296',
    aWethHolder: '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296',
    cDaiHolder: '0x9b4772e59385ec732bccb06018e318b7b3477459',
    lidoOracleMember1: '0x140Bd8FbDc884f48dA7cb1c09bE8A2fAdfea776E',
    lidoOracleMember2: '0x1d0813bf088BE3047d827D98524fBf779Bc25F00',
    lidoOracleMember3: '0x404335BcE530400a5814375E7Ec1FB55fAff3eA2',
    usdcHolder: "0x700fb29Ec8AC5B7f4Ff981B700b47B57E8350ccE"
  },
  mocha: {
    timeout: 120000
  }
};
