import { constants } from 'ethers'

interface HopConfig {
  [key: string]: {
    chainId: number
    USDC?: {
      bridge: string
      token: string
      ammWrapper: string
    }
    USDT?: {
      bridge: string
      token: string
      ammWrapper: string
    }
    MATIC?: {
      bridge: string
      token: string
      ammWrapper: string
    }
    DAI?: {
      bridge: string
      token: string
      ammWrapper: string
    }
    ETH?: {
      bridge: string
      token: string
      ammWrapper: string
    }
  }
}

const config: HopConfig = {
  hardhat: {
    chainId: 1,
    USDC: {
      bridge: '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a',
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      ammWrapper: constants.AddressZero,
    },
    USDT: {
      bridge: '0x3E4a3a4796d16c0Cd582C382691998f7c06420B6',
      token: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      ammWrapper: constants.AddressZero,
    },
    MATIC: {
      bridge: '0x22B1Cbb8D98a01a3B71D034BB899775A76Eb1cc2',
      token: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
      ammWrapper: constants.AddressZero,
    },
    DAI: {
      bridge: '0x3d4Cc8A61c7528Fd86C55cfe061a78dCBA48EDd1',
      token: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      ammWrapper: constants.AddressZero,
    },
    ETH: {
      bridge: '0xb8901acB165ed027E32754E0FFe830802919727f',
      token: '0x0000000000000000000000000000000000000000',
      ammWrapper: constants.AddressZero,
    },
  },
  mainnet: {
    chainId: 1,
    USDC: {
      bridge: '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a',
      token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      ammWrapper: constants.AddressZero,
    },
    USDT: {
      bridge: '0x3E4a3a4796d16c0Cd582C382691998f7c06420B6',
      token: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      ammWrapper: constants.AddressZero,
    },
    MATIC: {
      bridge: '0x22B1Cbb8D98a01a3B71D034BB899775A76Eb1cc2',
      token: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
      ammWrapper: constants.AddressZero,
    },
    DAI: {
      bridge: '0x3d4Cc8A61c7528Fd86C55cfe061a78dCBA48EDd1',
      token: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      ammWrapper: constants.AddressZero,
    },
    ETH: {
      bridge: '0xb8901acB165ed027E32754E0FFe830802919727f',
      token: '0x0000000000000000000000000000000000000000',
      ammWrapper: constants.AddressZero,
    },
  },
  polygon: {
    chainId: 137,
    USDC: {
      bridge: '0x25D8039bB044dC227f741a9e381CA4cEAE2E6aE8',
      token: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      ammWrapper: '0x76b22b8C1079A44F1211D867D68b1eda76a635A7',
    },
    USDT: {
      bridge: '0x6c9a1ACF73bd85463A46B0AFc076FBdf602b690B',
      token: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      ammWrapper: '0x8741Ba6225A6BF91f9D73531A98A89807857a2B3',
    },
    MATIC: {
      bridge: '0x553bC791D746767166fA3888432038193cEED5E2',
      // token: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      token: '0x0000000000000000000000000000000000000000',
      ammWrapper: '0x884d1Aa15F9957E1aEAA86a82a72e49Bc2bfCbe3',
    },
    DAI: {
      bridge: '0xEcf268Be00308980B5b3fcd0975D47C4C8e1382a',
      token: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      ammWrapper: '0x28529fec439cfF6d7D1D5917e956dEE62Cd3BE5c',
    },
    ETH: {
      bridge: '0xb98454270065A31D71Bf635F6F7Ee6A518dFb849',
      token: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      ammWrapper: '0xc315239cFb05F1E130E7E28E603CEa4C014c57f0',
    },
  },
  xdai: {
    chainId: 100,
    USDC: {
      bridge: '0x25D8039bB044dC227f741a9e381CA4cEAE2E6aE8',
      token: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
      ammWrapper: '0x76b22b8C1079A44F1211D867D68b1eda76a635A7',
    },
    USDT: {
      bridge: '0xFD5a186A7e8453Eb867A360526c5d987A00ACaC2',
      token: '0x4ECaBa5870353805a9F068101A40E0f32ed605C6',
      ammWrapper: '0x49094a1B3463c4e2E82ca41b8e6A023bdd6E222f',
    },
    MATIC: {
      bridge: '0x7ac71c29fEdF94BAc5A5C9aB76E1Dd12Ea885CCC',
      token: '0x7122d7661c4564b7C6Cd4878B06766489a6028A2',
      ammWrapper: '0x86cA30bEF97fB651b8d866D45503684b90cb3312',
    },
    DAI: {
      bridge: '0x0460352b91D7CF42B0E1C1c30f06B602D9ef2238',
      // token: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
      token: '0x0000000000000000000000000000000000000000',
      ammWrapper: '0x6C928f435d1F3329bABb42d69CCF043e3900EcF1',
    },
    ETH: {
      bridge: '0xD8926c12C0B2E5Cd40cFdA49eCaFf40252Af491B',
      token: '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
      ammWrapper: '0x03D7f750777eC48d39D080b020D83Eb2CB4e3547',
    },
  },
  arbitrum: {
    chainId: 42161,
    USDC: {
      bridge: '0x0e0E3d2C5c292161999474247956EF542caBF8dd',
      token: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      ammWrapper: '0xe22D2beDb3Eca35E6397e0C6D62857094aA26F52',
    },
    USDT: {
      bridge: '0x72209Fe68386b37A40d6bCA04f78356fd342491f',
      token: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      ammWrapper: '0xCB0a4177E0A60247C0ad18Be87f8eDfF6DD30283',
    },
    DAI: {
      bridge: '0x7aC115536FE3A185100B2c4DE4cb328bf3A58Ba6',
      token: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      ammWrapper: '0xe7F40BF16AB09f4a6906Ac2CAA4094aD2dA48Cc2',
    },
    ETH: {
      bridge: '0x3749C4f034022c39ecafFaBA182555d4508caCCC',
      // token: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      token: '0x0000000000000000000000000000000000000000',
      ammWrapper: '0x33ceb27b39d2Bb7D2e61F7564d3Df29344020417',
    },
  },
  optimism: {
    chainId: 10,
    USDC: {
      bridge: '0xa81D244A1814468C734E5b4101F7b9c0c577a8fC',
      token: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
      ammWrapper: '0x2ad09850b0CA4c7c1B33f5AcD6cBAbCaB5d6e796',
    },
    USDT: {
      bridge: '0x46ae9BaB8CEA96610807a275EBD36f8e916b5C61',
      token: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
      ammWrapper: '0x7D269D3E0d61A05a0bA976b7DBF8805bF844AF3F',
    },
    DAI: {
      bridge: '0x7191061D5d4C60f598214cC6913502184BAddf18',
      token: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      ammWrapper: '0xb3C68a491608952Cb1257FC9909a537a0173b63B',
    },
    ETH: {
      bridge: '0x83f6244Bd87662118d96D9a6D44f09dffF14b30E',
      // token: '0x4200000000000000000000000000000000000006',
      token: '0x0000000000000000000000000000000000000000',
      ammWrapper: '0x86cA30bEF97fB651b8d866D45503684b90cb3312',
    },
  },
}

export default config
