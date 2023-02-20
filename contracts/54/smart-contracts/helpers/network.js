/* eslint-disable global-require */
const fs = require('fs')
const resolve = require('path').resolve
const debug = require('debug')
const networksConfigs = require('../networks.js')

const log = debug('hardhat:config')

const getNetworkName = (chainId) => {
  const networkName = Object.keys(networksConfigs).find((name) => {
    return networksConfigs[name].chainId === chainId
  })
  if (!networkName) throw new Error(`Network ${chainId} not supported.`)
  return networksConfigs[networkName].name
}
/**
 * https://hardhat.org/hardhat-network/reference/#config
 * Ether:
 * + An object describing an HD wallet. This is the default. It can have any of the following fields:
 *       - mnemonic: a 12 or 24 word mnemonic phrase as defined by BIP39. Default value: "test test test test test test test test test test test junk"
 *       - initialIndex: The initial index to derive. Default value: 0.
 *       - path: The HD parent of all the derived keys. Default value: "m/44'/60'/0'/0".
 *       - count: The number of accounts to derive. Default value: 20.
 *       - accountsBalance: string with the balance (in wei) assigned to every account derived. Default value: "10000000000000000000000" (10000 ETH).
 * + An array of the initial accounts that the Hardhat Network will create. Each of them must be an object with privateKey and balance fields.
 * @returns
 */
const getAccounts = (networkName) => {
  if (process.env.CI === 'true') {
    return {
      mnemonic: 'test test test test test test test test test test test junk',
      initialIndex: 0,
    }
  }

  const networkAccountsFile = resolve(`./accounts.${networkName}.js`)
  if (fs.existsSync(networkAccountsFile)) {
    // eslint-disable-next-line import/no-dynamic-require
    const accounts = require(networkAccountsFile)
    if (accounts) {
      return accounts
    }
  }

  const accountsFile = resolve('./accounts.js')
  if (fs.existsSync(accountsFile)) {
    log(
      `No ${networkAccountsFile} file. Trying with the default one: ${accountsFile}.`
    )
    // eslint-disable-next-line import/no-dynamic-require
    const accounts = require(accountsFile)
    if (accounts) {
      return accounts
    }
  }

  throw new Error(
    `Missing accounts file: '${accountsFile}'. Please create it with an 'accounts' value from https://hardhat.org/hardhat-network/reference/#config`
  )
}

const getHardhatNetwork = () => {
  const networks = {}
  Object.keys(networksConfigs).forEach((name) => {
    networks[name] = {
      ...networksConfigs[name],
      accounts: getAccounts(name),
    }
  })
  return networks
}

module.exports = {
  getNetworkName,
  getHardhatNetwork,
}
