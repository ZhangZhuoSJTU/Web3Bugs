import hardhatConfig from "./hardhat.config"

export default {
    ...hardhatConfig,
    networks: {
        ...hardhatConfig.networks,
        hardhat: {
            allowUnlimitedContractSize: false,
            blockGasLimit: 15000000,
            gasPrice: 52000000000,
            forking: {
                url: process.env.NODE_URL || "",
                blockNumber: 12452435,
            },
        },
    },
}
