import { ethers } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

export interface Setter {
  status: "Success" | "Failed";
  tx: string | undefined;
  gasUsed: string | undefined;
}

export type DeploymentReport = Record<string, Setter>;

export interface CollateralConfig {
  borrowRate: BigNumber;
  parDebtLimit: BigNumber;
  liquidationRatio: BigNumber;
  minCollateralRatio: BigNumber;
  originationFee: BigNumber;
  liquidationBonus: BigNumber;
  liquidationFee: BigNumber;
}

export interface NetworkConfig {
  baseToken: string;
  collaterals: Record<string, Collateral>;
  eurUsdAggregator: string;
  isTestNet: boolean;
  mimoToken: string;
  gnosisSafe: string;
}

export interface Collateral {
  address: string;
  usdAggregator: string;
  incentiveShare: number;
}

export interface BoostConfig {
  a: BigNumber;
  b: BigNumber;
  c: BigNumber;
  d: BigNumber;
  e: BigNumber;
  maxBoost: BigNumber;
}

export interface FeeConfig {
  depositFee: BigNumber;
  withdrawFee: BigNumber;
}

export interface Dex {
  proxy: string;
  router: string;
}

export interface InceptionVaultConfig {
  borrowRate: BigNumber;
  liquidationRatio: BigNumber;
  minCollateralRatio: BigNumber;
  originationFee: BigNumber;
  liquidationBonus: BigNumber;
  liquidationFee: BigNumber;
}

export const COLLATERALS: Record<string, CollateralConfig> = {
  WBTC: {
    borrowRate: ethers.BigNumber.from("1000000000534535675765102250"), // 1.7% per year
    parDebtLimit: ethers.utils.parseUnits("3000000", 18), // 3,000,000 PAR
    liquidationRatio: ethers.utils.parseUnits("1.3", 18), // 130%
    minCollateralRatio: ethers.utils.parseUnits("1.5", 18), // 150%
    originationFee: ethers.utils.parseUnits("3", 15), // 0.3%
    liquidationBonus: ethers.utils.parseUnits("5", 16), // 5%
    liquidationFee: ethers.constants.Zero,
  },
  WETH: {
    borrowRate: ethers.BigNumber.from("1000000000534535675765102250"), // 1.7% per year
    parDebtLimit: ethers.utils.parseUnits("3000000", 18), // 3,000,000 PAR
    liquidationRatio: ethers.utils.parseUnits("1.3", 18), // 130%
    minCollateralRatio: ethers.utils.parseUnits("1.5", 18), // 150%
    originationFee: ethers.utils.parseUnits("3", 15), // 0.3%
    liquidationBonus: ethers.utils.parseUnits("5", 16), // 5%
    liquidationFee: ethers.constants.Zero,
  },
  WMATIC: {
    borrowRate: ethers.BigNumber.from("1000000000534535675765102250"), // 1.7% per year
    parDebtLimit: ethers.utils.parseUnits("1000000", 18), // 1,000,000 PAR
    liquidationRatio: ethers.utils.parseUnits("2", 18), // 200%
    minCollateralRatio: ethers.utils.parseUnits("2.5", 18), // 250%
    originationFee: ethers.utils.parseUnits("3", 15), // 0.3%
    liquidationBonus: ethers.utils.parseUnits("5", 16), // 5%
    liquidationFee: ethers.constants.Zero,
  },
  USDC: {
    borrowRate: ethers.BigNumber.from("1000000000534535675765102250"), // 1.7% per year
    parDebtLimit: ethers.utils.parseUnits("3000000", 18), // 3,000,000 PAR
    liquidationRatio: ethers.utils.parseUnits("1.1", 18), // 110%
    minCollateralRatio: ethers.utils.parseUnits("1.1", 18), // 110%
    originationFee: ethers.utils.parseUnits("3", 15), // 0.3%
    liquidationBonus: ethers.utils.parseUnits("3", 16), // 3%
    liquidationFee: ethers.constants.Zero,
  },
  WFTM: {
    borrowRate: ethers.BigNumber.from("1000000000534535675765102250"), // 1.7% per year
    parDebtLimit: ethers.utils.parseUnits("1000000", 18), // 1,000,000 PAR
    liquidationRatio: ethers.utils.parseUnits("2", 18), // 200%
    minCollateralRatio: ethers.utils.parseUnits("2.5", 18), // 250%
    originationFee: ethers.utils.parseUnits("3", 15), // 0.3%
    liquidationBonus: ethers.utils.parseUnits("5", 16), // 5%
    liquidationFee: ethers.constants.Zero,
  },
};

export const NETWORK_CONFIG: Record<number, NetworkConfig> = {
  1: {
    baseToken: "WETH",
    collaterals: {
      WBTC: {
        address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        usdAggregator: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
        incentiveShare: 0,
      },
      WETH: {
        address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        usdAggregator: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
        incentiveShare: 0,
      },
      USDC: {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        usdAggregator: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
        incentiveShare: 0,
      },
    },
    eurUsdAggregator: "0xb49f677943BC038e9857d61E7d053CaA2C1734C1",
    isTestNet: false,
    mimoToken: "0x90b831fa3bebf58e9744a14d638e25b4ee06f9bc",
    gnosisSafe: "0xcc8793d5eB95fAa707ea4155e09b2D3F44F33D1E",
  },
  31337: {
    baseToken: "WETH",
    collaterals: {
      WETH: {
        address: "",
        usdAggregator: "",
        incentiveShare: 0,
      },
      WBTC: {
        address: "",
        usdAggregator: "",
        incentiveShare: 0,
      },
    },
    eurUsdAggregator: "",
    isTestNet: true,
    mimoToken: "",
    gnosisSafe: "",
  },
  1337: {
    baseToken: "WETH",
    collaterals: {
      WETH: {
        address: "",
        usdAggregator: "",
        incentiveShare: 0,
      },
    },
    eurUsdAggregator: "",
    isTestNet: true,
    mimoToken: "",
    gnosisSafe: "0xE729C221Fc62D3fe2288136BBB92cC7A6d6aFF83",
  },
  42: {
    baseToken: "WETH",
    collaterals: {
      WBTC: {
        address: "0xd3A691C852CDB01E281545A27064741F0B7f6825",
        usdAggregator: "0x6135b13325bfC4B00278B4abC5e20bbce2D6580e",
        incentiveShare: 0,
      },
      WETH: {
        address: "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
        usdAggregator: "0x9326BFA02ADD2366b30bacB125260Af641031331",
        incentiveShare: 0,
      },
      USDC: {
        address: "0x2F375e94FC336Cdec2Dc0cCB5277FE59CBf1cAe5",
        usdAggregator: "0x9211c6b3BF41A10F78539810Cf5c64e1BB78Ec60",
        incentiveShare: 0,
      },
    },
    eurUsdAggregator: "0x0c15Ab9A0DB086e062194c273CC79f41597Bbf13",
    isTestNet: true,
    mimoToken: "0xFf148a5C19b888D557A7E208aaBC0887e7486B4A",
    gnosisSafe: "",
  },
  4: {
    baseToken: "WETH",
    collaterals: {
      WETH: {
        address: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
        usdAggregator: "0xaEA2808407B7319A31A383B6F8B60f04BCa23cE2",
        incentiveShare: 0,
      },
      WBTC: {
        address: "",
        usdAggregator: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
        incentiveShare: 0,
      },
    },
    eurUsdAggregator: "0x0c15Ab9A0DB086e062194c273CC79f41597Bbf13",
    mimoToken: "",
    isTestNet: true,
    gnosisSafe: "",
  },
  5: {
    baseToken: "WETH",
    collaterals: {
      WETH: {
        address: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
        usdAggregator: "",
        incentiveShare: 0,
      },
      WBTC: {
        address: "",
        usdAggregator: "",
        incentiveShare: 0,
      },
    },
    eurUsdAggregator: "",
    isTestNet: true,
    mimoToken: "0xEe25795fDbe6c14f898a59D92BF0268a9C424B5B",
    gnosisSafe: "",
  },
  137: {
    baseToken: "WMATIC",
    collaterals: {
      WMATIC: {
        address: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
        usdAggregator: "0xab594600376ec9fd91f8e885dadf0ce036862de0",
        incentiveShare: 0,
      },
      WETH: {
        address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
        usdAggregator: "0xF9680D99D6C9589e2a93a78A04A279e509205945",
        incentiveShare: 0,
      },
      WBTC: {
        address: "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6",
        usdAggregator: "0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6",
        incentiveShare: 0,
      },
      USDC: {
        address: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
        usdAggregator: "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7",
        incentiveShare: 0,
      },
    },
    eurUsdAggregator: "0x73366Fe0AA0Ded304479862808e02506FE556a98",
    isTestNet: false,
    mimoToken: "0xADAC33f543267c4D59a8c299cF804c303BC3e4aC",
    gnosisSafe: "0xbB60ADbe38B4e6ab7fb0f9546C2C1b665B86af11",
  },
  80001: {
    baseToken: "WMATIC",
    collaterals: {
      WMATIC: {
        address: "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
        usdAggregator: "0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada",
        incentiveShare: 0,
      },
      WBTC: {
        address: "0x5B7e96A26D7d842513a9Ac398f274d46444461A1",
        usdAggregator: "0x007A22900a3B98143368Bd5906f8E17e9867581b",
        incentiveShare: 0,
      },
      USDC: {
        address: "0xcc4f6aE976dd9dFb44E741e7430b6111bF0cbCd0",
        usdAggregator: "0x572dDec9087154dC5dfBB1546Bb62713147e0Ab0",
        incentiveShare: 0,
      },
    },
    eurUsdAggregator: "",
    mimoToken: "0xA0b732E94051ACCaaed40696b1Ee2b5685B70cCE",
    isTestNet: true,
    gnosisSafe: "",
  },
  250: {
    baseToken: "WFTM",
    collaterals: {
      WFTM: {
        address: "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83",
        usdAggregator: "0xf4766552D15AE4d256Ad41B6cf2933482B0680dc",
        incentiveShare: 0,
      },
      WETH: {
        address: "0x74b23882a30290451A17c44f4F05243b6b58C76d",
        usdAggregator: "0x11DdD3d147E5b83D01cee7070027092397d63658",
        incentiveShare: 0,
      },
      WBTC: {
        address: "0x321162Cd933E2Be498Cd2267a90534A804051b11",
        usdAggregator: "0x8e94C22142F4A64b99022ccDd994f4e9EC86E4B4",
        incentiveShare: 0,
      },
      USDC: {
        address: "0x04068da6c83afcfa0e13ba15a6696662335d5b75",
        usdAggregator: "0x2553f4eeb82d5A26427b8d1106C51499CBa5D99c",
        incentiveShare: 0,
      },
    },
    eurUsdAggregator: "0xf27c78a15F20A3B90df1aB750C19aDc8263979CA",
    isTestNet: false,
    mimoToken: "0x1D1764F04DE29da6b90ffBef372D1A45596C4855",
    gnosisSafe: "0x1F1eC8d78cD802072C7a24ea8c2Dd4dcB1C4C242",
  },
  4002: {
    baseToken: "WFTM",
    collaterals: {
      WFTM: {
        address: "",
        usdAggregator: "0xe04676B9A9A2973BCb0D1478b5E1E9098BBB7f3D",
        incentiveShare: 0,
      },
      WETH: {
        address: "",
        usdAggregator: "0xB8C458C957a6e6ca7Cc53eD95bEA548c52AFaA24",
        incentiveShare: 0,
      },
      WBTC: {
        address: "",
        usdAggregator: "0x65E8d79f3e8e36fE48eC31A2ae935e92F5bBF529",
        incentiveShare: 0,
      },
      USDC: {
        address: "",
        usdAggregator: "0x9BB8A6dcD83E36726Cc230a97F1AF8a84ae5F128",
        incentiveShare: 0,
      },
    },
    eurUsdAggregator: "",
    isTestNet: true,
    mimoToken: "",
    gnosisSafe: "",
  },
};

export const DEMAND_MINER_TOKENS: Record<number, Record<string, string>> = {
  1: {},
  137: {
    PARUSDC: "0xC1DF4E2fd282e39346422e40C403139CD633Aacd",
  },
  250: {
    PARMIMO: "0x851553FD9BCd28Befe450d3cfbB3f86F13832a1d",
    PARUSDC: "0x77ecD4B23E255A78572CCfD59141D96CFC9F5FB0",
  },
  31337: {},
  1337: {},
  42: {},
  4: {},
  5: {},
  80001: {},
  4002: {},
};

export const MAINNET_COLLATERAL_AGGREGATORS: Record<string, string> = {
  WETH: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  WBTC: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
  USDC: "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4",
  WFTM: "0x2DE7E4a9488488e0058B95854CC2f7955B35dC9b",
};

export const VOTING_ESCROW_NAME = "MIMO Voting Power";

export const VOTING_ESCROW_SYMBOL = "vMIMO";

export const TIMELOCK_DELAY = 172800;

export const MAINNET_TOKEN_ADDRESSES: Record<string, string> = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  MIMO: "0x90B831fa3Bebf58E9744A14D638E25B4eE06f9Bc",
  PAR: "0x68037790A0229e9Ce6EaA8A99ea92964106C4703",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  WMATIC: "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0",
};

export const MAINNET_USD_AGGREGATORS: Record<string, string> = {
  WETH: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  WBTC: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
  USDC: "0x9211c6b3BF41A10F78539810Cf5c64e1BB78Ec60",
  WMATIC: "0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676",
  EUR: "0xb49f677943BC038e9857d61E7d053CaA2C1734C1",
};

export const MAINNET_CONTRACTS: Record<string, string> = {
  GovernanceAddressProvider: "0x718B7584D410F364fC16724027C07C617B87f2Fc",
  RootChainManager: "0xA0c68C638235ee32657e8f720a23ceC1bFc77C77",
  ERC20PredicateProxy: "0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf",
  MIMODistributor: "0xEdfAa67889DD8D0A5A9241801B53cca3206c5030",
};

export const CURRENT_NETWORK_DEPLOYMENT = {
  title: "localhost",
  chainId: 31337,
};

export const INCEPTION_VAULT_COLLATERAL = {
  address: "",
  usdAggregator: "",
};

export const INCEPTION_VAULT_CONFIG: InceptionVaultConfig = {
  liquidationRatio: ethers.utils.parseUnits("1.3", 18), // 130%
  minCollateralRatio: ethers.utils.parseUnits("1.5", 18), // 150%
  borrowRate: ethers.BigNumber.from("1000000000534535675765102250"), // 1.7% per year
  originationFee: ethers.utils.parseUnits("3", 15), // 0.3%
  liquidationBonus: ethers.utils.parseUnits("5", 16), // 5%
  liquidationFee: ethers.constants.Zero,
};

export const BOOST_CONFIG: BoostConfig = {
  a: ethers.BigNumber.from("1"),
  b: ethers.BigNumber.from("3"),
  c: ethers.BigNumber.from("1"),
  d: ethers.utils.parseEther("25000"),
  e: ethers.BigNumber.from("6"),
  maxBoost: ethers.utils.parseEther("4"),
};

export const FEE_CONFIG: FeeConfig = {
  depositFee: ethers.constants.Zero,
  withdrawFee: ethers.constants.Zero,
};

export const MULTISIG: Record<number, string> = {
  1: "0xcc8793d5eB95fAa707ea4155e09b2D3F44F33D1E",
  137: "0xbB60ADbe38B4e6ab7fb0f9546C2C1b665B86af11",
  250: "0x1F1eC8d78cD802072C7a24ea8c2Dd4dcB1C4C242",
  31337: "",
  1337: "",
  42: "",
  4: "",
  5: "",
  80001: "",
  4002: "",
};

export const DEXES: Dex[] = [
  // Paraswap
  {
    proxy: "0x216B4B4Ba9F3e719726886d34a177484278Bfcae",
    router: "0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57",
  },
  // 1inch
  {
    proxy: "0x11111112542D85B3EF69AE05771c2dCCff4fAa26",
    router: "0x11111112542D85B3EF69AE05771c2dCCff4fAa26",
  },
];
