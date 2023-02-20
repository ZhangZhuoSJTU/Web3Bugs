import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";

import { resolve } from "path";

import { config as dotenvConfig } from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenvConfig({ path: resolve(__dirname, "./.env") });

const chainIds = {
    goerli: 5,
    hardhat: 31337,
    kovan: 42,
    mainnet: 1,
    rinkeby: 4,
    ropsten: 3,
};

const compilerSettings = {
    metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/solidity-template/issues/31
        bytecodeHash: "none",
    },
    // Disable the optimizer when debugging
    // https://hardhat.org/hardhat-network/#solidity-optimizer-support
    optimizer: {
        enabled: true,
        runs: 800,
    },
};

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    gasReporter: {
        currency: "USD",
        enabled: true,
        excludeContracts: [],
        src: "./contracts",
    },
    networks: {
        hardhat: {
            chainId: chainIds.hardhat,
            allowUnlimitedContractSize: true,
        },
        mainnet: {
            url: process.env.NODE_URL || "",
        },
        kovan: {
            url: process.env.NODE_URL || "",
            gasPrice: 3000000000,
        },
        forking: {
            url: process.env.NODE_URL || "",
        },
        rinkeby: { url: process.env.NODE_URL || "", gasPrice: 3000000000 },
    },
    paths: {
        artifacts: "./artifacts",
        cache: "./cache",
        sources: "./contracts",
        tests: "./test",
    },
    solidity: {
        compilers: [
            {
                version: "0.6.12",
                settings: compilerSettings,
            },
            {
                version: "0.8.11",
                settings: compilerSettings,
            },
        ],
    },
    typechain: {
        outDir: "types/generated",
        target: "ethers-v5",
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_KEY,
    },
};

export default config;
