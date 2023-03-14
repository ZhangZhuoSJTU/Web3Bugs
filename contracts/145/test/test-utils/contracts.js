const { ethers } = require('hardhat')

async function deploy(contractName, ...args) {
  const artifact = await ethers.getContractFactory(contractName)
  return artifact.deploy(...args)
}
module.exports = {
  deploy,
}
