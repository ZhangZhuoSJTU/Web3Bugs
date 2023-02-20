const config = require('./hardhat.config');

config.etherscan = {
    apiKey: process.env.POLYGONSCAN_API_KEY,
};

module.exports = config;
