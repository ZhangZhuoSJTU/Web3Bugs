const { mainnetDeploy } = require('./mainnetDeployment.js')
const configParams = require("./deploymentParams.localFork.js")

const ETH_WHALE = "0x53d284357ec70ce289d6d64134dfac8e511c8a3d"
//const TEST_DEPLOYER_PRIVATEKEY = '0xbbfbee4961061d506ffbb11dfea64eba16355cbf1d9c29613126ba7fec0aed5d'

async function main() {
  // const deployerWallet = new ethers.Wallet("0xb9253e5a74f3e2c9eaacd396fa367d2d999bb2dc1bbefcf1abd62d1f350b9db8", ethers.provider)
  // const deployerWallet = (await ethers.getSigners())[0]
  //
  // // Impersonate the whale (artificially assume control of its pk)
  // await hre.network.provider.request({
  //   method: "hardhat_impersonateAccount",
  //   params: [ETH_WHALE]
  // })
  // console.log(`whale address from import: ${ETH_WHALE}`)
  //
  // // Get the ETH whale signer
  // const whale = await ethers.provider.getSigner(ETH_WHALE)
  // console.log(`whale addr : ${await whale.getAddress()}`)
  // console.log(`whale ETH balance: ${ await ethers.provider.getBalance(whale.getAddress())}`)
  //
  // // Send ETH to the deployer's address
  // await whale.sendTransaction({
  //   to:  deployerWallet.address,
  //   value: ethers.utils.parseEther("20.0")
  // })
  //
  // // Stop impersonating whale
  // await network.provider.request({
  //   method: "hardhat_stopImpersonatingAccount",
  //   params: [ETH_WHALE]
  // })

  await mainnetDeploy(configParams)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
