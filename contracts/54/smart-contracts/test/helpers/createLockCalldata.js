const { ethers } = require('hardhat')

module.exports = async ({
  args, // func args to unpack
  from, // if needed
  signature, // solidity signature string
}) => {
  // use fully qualified path to avoid confusion during upgrades test
  const { interface } = await ethers.getContractFactory(
    'contracts/PublicLock.sol:PublicLock'
  )

  const func =
    signature || 'initialize(address,uint256,address,uint256,uint256,string)'

  // creator
  const [defaultSigner] = await ethers.getSigners()
  const lockCreator = from || defaultSigner.address
  const calldata = await interface.encodeFunctionData(func, [
    lockCreator,
    ...args,
  ])
  return calldata
}
