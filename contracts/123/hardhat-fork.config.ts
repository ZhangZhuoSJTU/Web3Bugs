import hardhatConfig from "./hardhat.config";

export default {
    ...hardhatConfig,
    networks: {
        ...hardhatConfig.networks,
        hardhat: {
            allowUnlimitedContractSize: false,
            forking: {
                url: process.env.NODE_URL || "",
            },
        },
    },
};
