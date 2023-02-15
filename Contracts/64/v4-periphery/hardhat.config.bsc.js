const config = require('./hardhat.config');

config.etherscan = {
    apiKey: process.env.BSCSCAN_API_KEY,
};

module.exports = config;
