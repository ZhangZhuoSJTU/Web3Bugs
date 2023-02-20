import 'dotenv/config'
import { HardhatUserConfig } from 'hardhat/types'
import 'hardhat-deploy'
import '@nomiclabs/hardhat-ethers'
import 'hardhat-gas-reporter'
import '@typechain/hardhat'
import 'solidity-coverage'
import { node_url, accounts } from './utils/network'
import '@nomiclabs/hardhat-etherscan'
import '@tenderly/hardhat-tenderly'

require('./tasks/generateDiamondABI.ts')

// While waiting for hardhat PR: https://github.com/nomiclabs/hardhat/pull/1542
// if (process.env.HARDHAT_FORK) {
//   process.env['HARDHAT_DEPLOY_FORK'] = process.env.HARDHAT_FORK
// }

const PKEY = process.env.PRIVATE_KEY || null

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: 0,
    simpleERC20Beneficiary: 1,
  },
  networks: {
    hardhat: {
      chainId: 1337,
      initialBaseFeePerGas: 0, // to fix : https://github.com/sc-forks/solidity-coverage/issues/652, see https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136
      // process.env.HARDHAT_FORK will specify the network that the fork is made from.
      // this line ensure the use of the corresponding accounts
      accounts: accounts(process.env.HARDHAT_FORK),
      forking: process.env.HARDHAT_FORK
        ? {
            // TODO once PR merged : network: process.env.HARDHAT_FORK,
            url: node_url(process.env.HARDHAT_FORK),
            blockNumber: process.env.HARDHAT_FORK_NUMBER
              ? parseInt(process.env.HARDHAT_FORK_NUMBER)
              : undefined,
          }
        : undefined,
    },
    localhost: {
      url: node_url('localhost'),
      accounts: PKEY ? [PKEY] : accounts(),
    },
    staging: {
      url: node_url('rinkeby'),
      accounts: PKEY ? [PKEY] : accounts('rinkeby'),
    },
    production: {
      url: node_url('mainnet'),
      accounts: PKEY ? [PKEY] : accounts('mainnet'),
    },
    mainnet: {
      url: node_url('mainnet'),
      accounts: PKEY ? [PKEY] : accounts('mainnet'),
    },
    rinkeby: {
      url: node_url('rinkeby'),
      accounts: PKEY ? [PKEY] : accounts('rinkeby'),
    },
    ropsten: {
      url: node_url('ropsten'),
      accounts: PKEY ? [PKEY] : accounts('ropsten'),
    },
    kovan: {
      url: node_url('kovan'),
      accounts: PKEY ? [PKEY] : accounts('kovan'),
    },
    goerli: {
      url: node_url('goerli'),
      accounts: PKEY ? [PKEY] : accounts('goerli'),
    },
    mumbai: {
      url: node_url('mumbai'),
      accounts: PKEY ? [PKEY] : accounts('mumbai'),
    },
    arbitrum_rinkeby: {
      url: node_url('arbitrum_rinkeby'),
      accounts: PKEY ? [PKEY] : accounts('arbitrum_rinkeby'),
    },
    polygon: {
      url: node_url('polygon'),
      accounts: PKEY ? [PKEY] : accounts('polygon'),
    },
    xdai: {
      url: node_url('xdai'),
      accounts: PKEY ? [PKEY] : accounts('xdai'),
    },
    bsc: {
      url: node_url('bsc'),
      accounts: PKEY ? [PKEY] : accounts('bsc'),
    },
    fantom: {
      url: node_url('fantom'),
      accounts: PKEY ? [PKEY] : accounts('fantom'),
    },
    avax: {
      chainId: 43114,
      url: node_url('avax'),
      accounts: PKEY ? [PKEY] : accounts('avax'),
    },
    moon_river: {
      url: node_url('moon_river'),
      accounts: PKEY ? [PKEY] : accounts('moon_river'),
    },
    arbitrum: {
      url: node_url('arbitrum'),
      accounts: PKEY ? [PKEY] : accounts('arbitrum'),
    },
    optimism: {
      url: node_url('optimism'),
      accounts: PKEY ? [PKEY] : accounts('optimism'),
    },
    celo: {
      url: node_url('celo'),
      accounts: PKEY ? [PKEY] : accounts('celo'),
    },
    moonbeam: {
      url: node_url('moonbeam'),
      accounts: PKEY ? [PKEY] : accounts('moonbeam'),
    },
    fuse: {
      url: node_url('fuse'),
      accounts: PKEY ? [PKEY] : accounts('fuse'),
    },
    boba: {
      url: node_url('boba'),
      accounts: PKEY ? [PKEY] : accounts('boba'),
    },
  },
  paths: {
    sources: 'src',
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 100,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    maxMethodDiff: 10,
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  mocha: {
    timeout: 0,
  },
  tenderly: {
    project: 'production',
    username: 'tenderly@li.finance',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  deterministicDeployment: process.env.STAGING
    ? undefined
    : (network: string) => {
        const deployments: Record<string, string> = {
          1: '0xf8a58085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf326a0b1fd9f4102283a663738983f1aac789e979e220a1b649faa74033f507b911af5a061dd0f2f6f2341ee95913cf94b3b8a49cac9fdd7be6310da7acd7a96e31958d7',
          3: '0xf8a58085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf329a0fcbc37c4f06154e91c2ae76cb8ee1e9fc8984237652ced1d286f1998232d9831a03d0b74194f7ad804a2df756ca0f69f499b500fd3d2f94b3ea1b8a3150805c394',
          4: '0xf8a58085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf32ca0c39cd41588456865453604a6bcfe26b9e5185b435d2535d8b065265d6cd82f71a036c5b462321656f53c06a6f9e017487ab49a67b47d2dcf34e0b4dc7a1e225380',
          5: '0xf8a58085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf32da0c2afd9accc83266bbdbd1f8422a651e28e8491cb439c22cc55ce49475f1b2449a073a65d2fcf2a98d7476a3d6e6e25d1ba95286cd690fb8c0c6c7e784c5f7518d4',
          10: '0xf8a58085012a05f200830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf337a0260a8b91b226d37d757a9a38b39f6ccf497a5f614a0c85a3b2f4d689ca716aa8a06093d8281e605dd3673d33e8bbb702f0d997b4a1d180702d7546c6e5e59db955',
          56: '0xf8a68085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf38193a0531f6ac702a2e2df6b5b450e7d42a1300d0946c9adfc8e3bdcd92a6a3c423d58a069cb351294648c7ce633d6d68edb0539573fafa416fe1dcc399d8f37478e2cb3',
          100: '0xf8a68085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf381eca0bf51651c6019d8572fe921ef406c8d2cb86659c4bee764b4b3484c72d9cd98e0a03a9df2ed21116639884a540437774466e262b64dbccb3e8b870c0fb1eb054220',
          122: '0xf8a78085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3820118a0ab189142c24a1de57b06c467b6d05ace53b3a725f8da3f6cd0769925e7eca815a02733b7f0ceee32fae5bd7ebbcc48df9f81c840aec90ab496514ede45773880c7',
          137: '0xf8a78085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3820136a0540c4320317a1dc7db507d5ac6c6724b087e6a6a5a3a95ff283f903acba2d0cba06aa15f091248e1a207aafcb7177838426d804a281bbc1fb42ca3ec7f2418fd87',
          250: '0xf8a78085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3820217a06112925b9520e7ec9c2fadbd352ede608efd15497b021eee23f1724d49cfdcd2a05a1b29add75f1bc9d1ba056ddae0c9371fc3520a573223e8a119399aeb3006ab',
          288: '0xf8a78085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3820264a0a87fbf0017a713e50c47c96dafd8efd6855737d245c45a84ac0d6bd47efc0f67a0204b4fdf55475dd5d7fc86811a416bf278e5d4a7d95781fbc11b5e4b39b91e86',
          1284: '0xf8a78085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3820a2ca09ae56c29db91b123c0368681381e401fdc35e4a4d0c177d4b3ba5580816b00caa065f117e1fefb65492ae1589d051bb9dcfaa5da97851cd56ba6059c3ad78e564e',
          1285: '0xf8a78085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3820a2da03092f146b7329600757704e4633aaf6e6ee149111ca0b57cff6ea2bf5e80b96aa0193957662dfd092c83315ea7b5406e5ca4bef82d4cb6588505fe4a2054f0c3a6',
          1337: '0xf8a78085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3820a95a00db349575a2d83fcd1b6173175bb1831fe36ec37d578dd830800f379ed3690c2a031fcf67ffb9cd9a159ea2f28f18f1485d93486fceef4c6ccbb4d2e13d2931152',
          42161:
            '0xf8a88085012a05f200830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf383014986a004ed3a4bf51398c176780944363c55122b2b9f9ed4afb53e3793eda60a4c82e1a04d3647daba62155047f8a6742c763da905731c59b90391c219f8c84a6127b002',
          42220:
            '0xf8a88085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3830149fca091845137eb1af5c368689522876b59d0c417ebf15f451c0b951c658c377ca8f8a01c5bd46a5c90caacdc520917321e0cac4b971e5efcaf8563a2fde547f34c0221',
          43114:
            '0xf8a88085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3830150f8a0f6f8627f4101ee602b4cb2d859d18bda34ef2a1f2a43e8dedcf31f3648cf1335a006e7824753ba1cf69dea4852a28a8a53507a3dee5e7cb3eb99a77292b82e3bcd',
        }

        return {
          factory: '0x2Fd525b8B2e2a69d054dCCB033a0e33E0B4AB370',
          deployer: '0x954e3EB8DE035ec1Bc8FE8FA0091D5B87AB17D47',
          funding: '10000000000000000',
          signedTx: deployments[network],
        }
      },
}

export default config
