require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-web3')
require('solidity-coverage')
require('@nomiclabs/hardhat-etherscan')
require('hardhat-spdx-license-identifier')

const PRIVATE_KEY = `0x${process.env.PRIVATE_KEY || 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'}`

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    networks: {
        local: {
            url: 'http://localhost:8545'
        },
        hardhat: {
            chainId: 1337,
        },
        mainnet: {
            url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
            chainId: 1,
            gasPrice: 20000000000, // 20 gwei
            accounts: [ PRIVATE_KEY ]
        },
        rinkeby: {
            url: `https://rinkeby.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
            chainId: 4,
            gasPrice: 2000000000, // 2 gwei
            accounts: [ PRIVATE_KEY ]
        }
    },
    solidity: {
        version: '0.6.11',
    },
    mocha: {
        timeout: 0
    },
    etherscan: {
        apiKey: `${process.env.ETHERSCAN || ''}`
    },
    spdxLicenseIdentifier: {
        runOnCompile: true
    }
}
