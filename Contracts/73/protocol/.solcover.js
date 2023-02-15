module.exports = {
    mocha: {
        timeout: 100000,
    },
    testCommand: "npx hardhat deploy && npx hardhat test",
    skipFiles: [
        "test",
        "zeppelin",
        "rounds/AdjustableRoundsManager.sol",
        "pm/mixins/interfaces",
        "bonding/deprecated",
        "token/ArbitrumLivepeerToken.sol" // testnet only
    ],
};
