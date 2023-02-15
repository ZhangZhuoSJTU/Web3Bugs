import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "./plugins/contracts";
import { config as dotenv } from "dotenv";
import "./tasks/verify";

dotenv();

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            forking: process.env["MAINNET_RPC"]
                ? {
                      url: process.env["MAINNET_RPC"],
                      blockNumber: 13268999,
                  }
                : undefined,

            accounts: process.env["MAINNET_TEST_PK"]
                ? [
                      {
                          privateKey: process.env["MAINNET_TEST_PK"],
                          balance: (10 ** 20).toString(),
                      },
                  ]
                : undefined,
        },
        localhost: {
            url: "http://localhost:8545",
        },
        kovan: {
            url: process.env["KOVAN_RPC"],
            gasMultiplier: 1.1,
            accounts: process.env["KOVAN_DEPLOYER_PK"]
                ? [process.env["KOVAN_DEPLOYER_PK"]]
                : undefined,
        },
        mainnet: {
            url: process.env["MAINNET_RPC"],
            gasMultiplier: 1.1,
            accounts: process.env["MAINNET_DEPLOYER_PK"]
                ? [process.env["MAINNET_DEPLOYER_PK"]]
                : undefined,
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        protocolTreasury: {
            default: 0,
        },
        admin: {
            // temporary
            default: "0x9a3CB5A473e1055a014B9aE4bc63C21BBb8b82B3",
            kovan: "0xF7526b58c96BF3f81AF1Dc6aCa4224802C305F01",
        },
        mStrategy: {
            // temporary
            default: "0xF2BF7baa673a5Ac03D64f999b449Cc7F3C9a0F3A",
        },
        mStrategyTreasury: {
            // temporary
            default: "0xe3317d016914c7c985284654B01c7C265377B668",
        },
        test: {
            default: "0x9a3CB5A473e1055a014B9aE4bc63C21BBb8b82B3",
        },
        wbtc: {
            default: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            kovan: "0xd1b98b6607330172f1d991521145a22bce793277",
        },
        yearnVaultRegistry: {
            default: "0x50c1a2eA0a861A967D9d0FFE2AE4012c2E053804",
        },
        usdc: {
            default: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
            kovan: "0xe22da380ee6b445bb8273c81944adeb6e8450422",
        },
        weth: {
            default: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
            kovan: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
        },
        aaveLendingPool: {
            default: "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9",
            kovan: "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",
        },
        uniswapV3Factory: {
            default: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
            kovan: "0x74e838ecf981aaef2523aa5b666175da319d8d31",
        },
        uniswapV3PositionManager: {
            default: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
            kovan: "0x815BCC87613315327E04e4A3b7c96a79Ae80760c",
        },
        uniswapV3Router: {
            default: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            kovan: "0x8a0B62Fbcb1B862BbF1ad31c26a72b7b746EdFC1",
        },
    },

    solidity: {
        compilers: [
            {
                version: "0.8.9",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                    evmVersion: "istanbul",
                },
            },
            {
                version: "0.7.6",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                    evmVersion: "istanbul",
                },
            },
        ],
    },
    etherscan: {
        apiKey: process.env["ETHERSCAN_API_KEY"],
    },
    mocha: {
        timeout: 800000,
    },
};

export default config;
