interface DEXConfig {
  [key: string]: string[]
}

// dodo: https://dodoex.github.io/docs/docs/deployedInfo
// paraswap: https://developers.paraswap.network/smart-contracts
// openocean: https://docs.openocean.finance/smart-contract-address-update-notice
// 1inch: https://docs.1inch.io/docs/aggregation-protocol/api/swagger
// 0x: https://docs.0x.org/developer-resources/contract-addresses
// other: https://github.com/lifinance/types/blob/main/src/exchanges.ts

const config: DEXConfig = {
  hardhat: [],
  mainnet: [
    '0xCB859eA579b28e02B87A1FDE08d087ab9dbE5149', // dodo - Approve
    '0xa356867fDCEa8e71AEaF87805808803806231FdC', // dodo - V2Proxy02
    '0xa2398842F37465f89540430bDC00219fA9E4D28a', // dodo - RouteProxy
    '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57', // paraswap - AugustusSwapper
    '0x216b4b4ba9f3e719726886d34a177484278bfcae', // paraswap - TokenTransferProxy
    '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64', // openocean
    '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x - ExchangeProxy v4
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // uniswap
    '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // sushiswap
  ],
  polygon: [
    '0x6D310348d5c12009854DFCf72e0DF9027e8cb4f4', // dodo - Approve
    '0xa222e6a71D1A1Dd5F279805fbe38d5329C1d0e70', // dodo - V2Proxy02
    '0x2fA4334cfD7c56a0E7Ca02BD81455205FcBDc5E9', // dodo - RouteProxy
    '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57', // paraswap - AugustusSwapper
    '0x216b4b4ba9f3e719726886d34a177484278bfcae', // paraswap - TokenTransferProxy
    '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64', // openocean
    '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x - ExchangeProxy v4
    '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // sushiswap
    '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // quickswap
    '0xaD340d0CD0B117B0140671E7cB39770e7675C848', // honeyswap
  ],
  xdai: [
    '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64', // openocean
    '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch
    '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // sushiswap
    '0x1C232F01118CB8B424793ae03F870aa7D0ac7f77', // honeyswap
  ],
  bsc: [
    '0xa128Ba44B2738A558A1fdC06d6303d52D3Cef8c1', // dodo - Approve
    '0x8F8Dd7DB1bDA5eD3da8C9daf3bfa471c12d58486', // dodo - V2Proxy02
    '0x6B3D817814eABc984d51896b1015C0b89E9737Ca', // dodo - RouteProxy
    '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57', // paraswap - AugustusSwapper
    '0x216b4b4ba9f3e719726886d34a177484278bfcae', // paraswap - TokenTransferProxy
    '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64', // openocean
    '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x - ExchangeProxy v4
    '0x10ED43C718714eb63d5aA57B78B54704E256024E', // pancakeswap
    '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // sushiswap
  ],
  fuse: [
    '0xF4d73326C13a4Fc5FD7A064217e12780e9Bd62c3', // sushiswap
  ],
  fantom: [
    '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57', // paraswap - AugustusSwapper
    '0x216b4b4ba9f3e719726886d34a177484278bfcae', // paraswap - TokenTransferProxy
    '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64', // openocean
    '0xdef189deaef76e379df891899eb5a00a94cbc250', // 0x - ExchangeProxy v4 (different)
    '0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52', // spiritswap
    '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // sushiswap
    '0xF491e7B69E4244ad4002BC14e878a34207E38c29', // spookyswap
  ],
  avax: [
    '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57', // paraswap - AugustusSwapper
    '0x216b4b4ba9f3e719726886d34a177484278bfcae', // paraswap - TokenTransferProxy
    '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64', // openocean
    '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x - ExchangeProxy v4
    '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // sushiswap
  ],
  moon_river: [
    '0xE8C9A78725D0451FA19878D5f8A3dC0D55FECF25', // dodo - Approve
    '0xd9deC7c3C06e62a4c1BeEB07CadF568f496b14c2', // dodo - V2Proxy02
    '0x0125Cd41312F72a0774112Ca639D65A2C02e3627', // dodo - RouteProxy
    '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // sushiswap
    '0xAA30eF758139ae4a7f798112902Bf6d65612045f', // solarbeam
  ],
  arbitrum: [
    '0xA867241cDC8d3b0C07C85cC06F25a0cD3b5474d8', // dodo - Approve
    '0x88CBf433471A0CD8240D2a12354362988b4593E5', // dodo - V2Proxy02
    '0x3B6067D4CAa8A14c63fdBE6318F27A0bBc9F9237', // dodo - RouteProxy
    '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64', // openocean ??
    '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch
    '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // sushiswap
  ],
  optimism: [
    '0x1111111254760f7ab3f16433eea9304126dcd199', // 1inch (different)
    '0xdef1abe32c034e558cdd535791643c58a13acc10', // 0x - ExchangeProxy v4 (different)
  ],
  celo: [
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x - ExchangeProxy v4
    '0x1421bDe4B10e8dd459b3BCb598810B1337D56842', // sushiswap
    '0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121', // ubeswap
  ],
  boba: [
    '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64', // openocean
    '0x17C83E2B96ACfb5190d63F5E46d93c107eC0b514', // oolongswap
  ],
  heco: [
    '0x68b6c06Ac8Aa359868393724d25D871921E97293', // dodo - Approve
    '0xAc7cC7d2374492De2D1ce21e2FEcA26EB0d113e7', // dodo - V2Proxy02
    '0xEc0fA5746E37dE75bDA9C1F874F2B75C12e505F6', // dodo - RouteProxy
    '0x67Cfc574A3ed38Bf1d1EAB05F0dB3fDEd1EcBA18', // openocean (different)
  ],
  oec: [
    '0x7737fd30535c69545deeEa54AB8Dd590ccaEBD3c', // dodo - Approve
    '0x6B4Fa0bc61Eddc928e0Df9c7f01e407BfcD3e5EF', // dodo - V2Proxy02
    '0xd9deC7c3C06e62a4c1BeEB07CadF568f496b14c2', // dodo - RouteProxy
    '0xc0006Be82337585481044a7d11941c0828FFD2D4', // openocean (different)
  ],
  aurora: [
    '0x335aC99bb3E51BDbF22025f092Ebc1Cf2c5cC619', // dodo - Approve
    '0xd9deC7c3C06e62a4c1BeEB07CadF568f496b14c2', // dodo - V2Proxy02
    '0x0125Cd41312F72a0774112Ca639D65A2C02e3627', // dodo - RouteProxy
  ],

  // testnets
  rinkeby: [
    '0xcC8d87A7C747eeE4242045C47Ef25e0A81D56ae3', // dodo - Approve
    '0xba001E96AF87bF9d8D0BDA667067A9921FE6d294', // dodo - V2Proxy02
    '0xe2b538a781eB5a115a1359B8f363B9703Fd19dE6', // dodo - RouteProxy
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // uniswap
  ],
  ropsten: [
    '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57', // paraswap - AugustusSwapper
    '0x216b4b4ba9f3e719726886d34a177484278bfcae', // paraswap - TokenTransferProxy
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x - ExchangeProxy v4
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // uniswap
  ],
}

export default config
