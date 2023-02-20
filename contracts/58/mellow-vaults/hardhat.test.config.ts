import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-contract-sizer";
import "hardhat-deploy";
import "@typechain/hardhat";
import "./plugins/contracts";
import defaultConfig from "./hardhat.config";
import { lensPath, set } from "ramda";
import { MultiSolcUserConfig, SolcUserConfig } from "hardhat/types";

const config: HardhatUserConfig = {
    ...defaultConfig,
    networks: {
        ...defaultConfig.networks,
        hardhat: {
            ...(defaultConfig.networks?.hardhat || {}),
            initialBaseFeePerGas: 0,
            allowUnlimitedContractSize: true,
        },
    },
    namedAccounts: {
        ...defaultConfig.namedAccounts,
        admin: {
            default: 4,
        },
        stranger: {
            default: 5,
        },
        treasury: {
            default: 6,
        },
        stranger1: {
            default: 8,
        },
        stranger2: {
            default: 9,
        },
        wbtcRichGuy: {
            default: "0x000af223187a63f3b0bf6fe5a76ddc79e03ccb55",
        },
    },
    solidity: {
        compilers: (
            defaultConfig.solidity as MultiSolcUserConfig
        ).compilers.map((x: SolcUserConfig) =>
            set(
                lensPath(["settings", "optimizer"]),
                {
                    enabled: false,
                    details: {
                        yul: true,
                        yulDetails: {
                            stackAllocation: true,
                        },
                    },
                },
                x
            )
        ),
    },
    typechain: {
        outDir: "test/types",
        target: "ethers-v5",
        alwaysGenerateOverloads: false,
    },
};

export default config;
