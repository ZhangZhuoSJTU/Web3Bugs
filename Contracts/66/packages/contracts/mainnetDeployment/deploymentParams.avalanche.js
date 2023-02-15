const externalAddrs  = {
  // https://data.chain.link/avalanche/mainnet/crypto-usd/avax-usd
  CHAINLINK_ETHUSD_PROXY: "0x0a77230d17318075983913bc2145db16c7366156", 
  // https://docs.tellor.io/tellor/integration/reference-page
  // this address is not valid for Tellor. It is just a copy of the Chainlink one
  TELLOR_MASTER:"0x62ac8210fFaB46A8dd209dE6165af103f41AAB71",
  // https://uniswap.org/docs/v2/smart-contracts/factory/
  // Pangolin 
  UNISWAP_V2_FACTORY: "0xefa94DE7a4656D787667C749f7E1223D71E9FD88",
  UNISWAP_V2_ROUTER02: "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106",
  TJ_FACTORY: "0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10",
  TJ_ROUTER02: "0x60aE616a2155Ee3d9A68541Ba4544862310933d4",

  WETH_ERC20: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
}

const liquityAddrsTest = {
  GENERAL_SAFE:"0x8be7e24263c199ebfcfd6aebca83f8d7ed85a5dd",  // Hardhat dev address
  YETI_SAFE:"0x20c81d658aae3a8580d990e441a9ef2c9809be74",  //  Hardhat dev address
  // YETI_SAFE:"0x66aB6D9362d4F35596279692F0251Db635165871",
  DEPLOYER: "0x5604d5Bf34e0347921264d5475C21e2BeAFBADf5" // Mainnet test deployment address
}

const liquityAddrs = {
  GENERAL_SAFE:"0x7B4a14CD122BFE2e717c27914a024D05eC3061B9", // TODO
  YETI_SAFE:"0x41f8a18b165De90383bf23CbcE5c0244ECDeeaA7", // TODO
  DEPLOYER: "0x5604d5Bf34e0347921264d5475C21e2BeAFBADf5",
}

/*
const beneficiaries = {
  TEST_INVESTOR_A: "",
  TEST_INVESTOR_B: "",
  TEST_INVESTOR_C: ""
}
*/
const beneficiaries = {
  ADVISOR_A: {address: "0x96AC61b54cDB56fA7f1E30E6065E9fDFaB779dfF"},
  ADVISOR_B: {address: "0xeD9b765D6638BEfF21c12F595A1AE60d3830C07c"},
  ADVISOR_C: {address: "0x5E2e604dB6965A51ed0e50F8C7Ec91820317b8C6", unlockTime: 1664769600},
  ADVISOR_D: {address: "0x98731Bd7Cd3824293C7373bDE0DDC22fbd7f4963", unlockTime: 1665460800},
  
}

const OUTPUT_FILE = './mainnetDeployment/avalancheDeploymentOutput.json'

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => {
  return delay(90000) // wait 90s
}

const GAS_PRICE = 225000000000 //225000000000 // 1 Gwei
const TX_CONFIRMATIONS = 1

//C-chain explorer doesn't support verification api
//const ETHERSCAN_BASE_URL = 'https://cchain.explorer.avax-test.network/address'
const ETHERSCAN_BASE_URL = undefined;

module.exports = {
  externalAddrs,
  liquityAddrs,
  beneficiaries,
  OUTPUT_FILE,
  waitFunction,
  GAS_PRICE,
  TX_CONFIRMATIONS,
  ETHERSCAN_BASE_URL,
};
