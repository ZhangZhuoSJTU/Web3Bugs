const externalAddrs  = {
  // https://data.chain.link/eth-usd
  // CHAINLINK_ETHUSD_PROXY: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", 
  CHAINLINK_ETHUSD_PROXY: "0x976B3D034E162d8bD72D6b9C989d545b839003b0", 
  // https://docs.tellor.io/tellor/integration/reference-page
  TELLOR_MASTER:"0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0",
  // https://uniswap.org/docs/v2/smart-contracts/factory/
  // UNISWAP_V2_FACTORY: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  // UNISWAP_V2_ROUTER02: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  UNISWAP_V2_FACTORY: "0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10",
  UNISWAP_V2_ROUTER02: "0x60aE616a2155Ee3d9A68541Ba4544862310933d4",
  // https://etherscan.io/token/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
  // WETH_ERC20: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  WETH_ERC20: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
  
}

const liquityAddrs = {
  GENERAL_SAFE:"0x8be7e24263c199ebfcfd6aebca83f8d7ed85a5dd",  // Hardhat dev address
  YETI_SAFE:"0x20c81d658aae3a8580d990e441a9ef2c9809be74",  //  Hardhat dev address
  DEPLOYER: "0x31c57298578f7508B5982062cfEc5ec8BD346247" // hardhat first account
}

const beneficiaries = {
  TEST_INVESTOR_A: "0xdad05aa3bd5a4904eb2a9482757be5da8d554b3d",
  TEST_INVESTOR_B: "0x625b473f33b37058bf8b9d4c3d3f9ab5b896996a",
  TEST_INVESTOR_C: "0x9ea530178b9660d0fae34a41a02ec949e209142e",
  TEST_INVESTOR_D: "0xffbb4f4b113b05597298b9d8a7d79e6629e726e8",
  TEST_INVESTOR_E: "0x89ff871dbcd0a456fe92db98d190c38bc10d1cc1"
}

const OUTPUT_FILE = './mainnetDeployment/localForkDeploymentOutput.json'

const TO_SAVE_FILENAME = 'localForkDeploymentOutput.json'

const waitFunction = async () => {
  // Fast forward time 1000s (local mainnet fork only)
  ethers.provider.send("evm_increaseTime", [1000])
  ethers.provider.send("evm_mine") 
}

const GAS_PRICE = 1000
const TX_CONFIRMATIONS = 1 // for local fork test

module.exports = {
  externalAddrs,
  liquityAddrs,
  beneficiaries,
  OUTPUT_FILE,
  TO_SAVE_FILENAME,
  waitFunction,
  GAS_PRICE,
  TX_CONFIRMATIONS,
};
