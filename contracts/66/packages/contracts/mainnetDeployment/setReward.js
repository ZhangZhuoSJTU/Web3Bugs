const MainnetDeploymentHelper = require("../utils/mainnetDeploymentHelpers.js")
const toBigNum = ethers.BigNumber.from;
const { TimeValues: timeVals } = require("../utils/testHelpers.js")

async function setReward(configParams) {
  const date = new Date()
  console.log(date.toUTCString())
  const deployerWallet = (await ethers.getSigners())[0]
  // const account2Wallet = (await ethers.getSigners())[1]
  console.log('BWB b4 get gas');
  const basefee = await ethers.provider.getGasPrice();
  console.log('BWB after get gas');
  const gasPrice = toBigNum(basefee).add(toBigNum('10000000000')) // add tip
  configParams.GAS_PRICE = gasPrice;

  const mdh = new MainnetDeploymentHelper(configParams, deployerWallet)
  const deploymentState = mdh.loadPreviousDeployment()

  const factory = await ethers.getContractFactory("Pool2Unipool", deployerWallet)

  const pngPool2Unipool = await mdh.loadOrDeploy(factory, 'pngUnipool', deploymentState);
  console.log(`pngPool2Unipool address ${pngPool2Unipool.address}`);
  //const pools = {pngPool2Unipool: pngPool2Unipool, tjPool2Unipool: tjPool2Unipool}
  const pool = pngPool2Unipool;

   const isRenounced = await mdh.isOwnershipRenounced(pool);
    if (!isRenounced) {
      const tx = await mdh.sendAndWaitForTransaction(pool.setReward(timeVals.SECONDS_IN_ONE_WEEK * 4, {gasPrice}));
      console.log(`Rewards set for ${name} in ${tx.transactionHash}`);
    } else {
      console.log(`Rewards already set for ${name}`);
    }
}

module.exports = {
  setReward
}
