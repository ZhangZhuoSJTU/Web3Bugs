require("@nomiclabs/hardhat-waffle");
require('@nomiclabs/hardhat-web3')
require('hardhat-spdx-license-identifier')
require('hardhat-docgen')

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    solidity: "0.8.9",
    networks: {
        local: {
            url: 'http://localhost:8545',
            chainId: 1337
        }
    },
    spdxLicenseIdentifier: {
        runOnCompile: true
    },
    docgen: {
        clear: true,
    }
};
