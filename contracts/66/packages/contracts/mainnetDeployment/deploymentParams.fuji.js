const externalAddrs  = {
  // https://data.chain.link/avalanche/mainnet/crypto-usd/avax-usd
  CHAINLINK_ETHUSD_PROXY: "0x5498BB86BC934c8D34FDA08E81D444153d0D06aD", 
  // https://docs.tellor.io/tellor/integration/reference-page
  TELLOR_MASTER:"0x7Cea7fb3B21F9C9055094cBD9bE3cC110886De98",
  // https://uniswap.org/docs/v2/smart-contracts/factory/
  // Pangolin 
  UNISWAP_V2_FACTORY: "0xE4A575550C2b460d2307b82dCd7aFe84AD1484dd",
  UNISWAP_V2_ROUTER02: "0x2D99ABD9008Dc933ff5c0CD271B88309593aB921",
  TJ_FACTORY: "0x7eeccb3028870540EEc3D88C2259506f2d34fEE0",
  TJ_ROUTER02: "0x5db0735cf88F85E78ed742215090c465979B5006",

  WETH_ERC20: "0xd00ae08403B9bbb9124bB305C09058E32C39A48c",
}

const liquityAddrsTest = {
  GENERAL_SAFE:"0x8be7e24263c199ebfcfd6aebca83f8d7ed85a5dd",  // Hardhat dev address
  YETI_SAFE:"0x20c81d658aae3a8580d990e441a9ef2c9809be74",  //  Hardhat dev address
  // YETI_SAFE:"0x66aB6D9362d4F35596279692F0251Db635165871",
  DEPLOYER: "0x5604d5Bf34e0347921264d5475C21e2BeAFBADf5" // Mainnet test deployment address
}

const liquityAddrs = {
  GENERAL_SAFE:"0x9880671e184E908CbFDD90EDfCCEDF55593928c8", // TODO
  YETI_SAFE:"0x49B424aFFF8dDC2517A1155478F67E268A8A06C0", // TODO
  DEPLOYER: "0x5604d5Bf34e0347921264d5475C21e2BeAFBADf5",
}

const beneficiaries = {
  ADVISOR_A: "0x96AC61b54cDB56fA7f1E30E6065E9fDFaB779dfF",
  ADVISOR_B: "0xeD9b765D6638BEfF21c12F595A1AE60d3830C07c"
}

const OUTPUT_FILE = './mainnetDeployment/fujiDeploymentOutput.json'

const delay = ms => new Promise(res => setTimeout(res, ms));
const waitFunction = async () => {
  return delay(90000) // wait 90s
}

const GAS_PRICE = 225000000000 // 1 Gwei
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
