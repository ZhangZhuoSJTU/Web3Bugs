export const PROJECT_NAME = 'core-dapp'
export const PREPO_WEBSITE = 'https://prepo.io'
export const PREPO_TWITTER = 'https://twitter.com/prepo_io'
export const PREPO_DISCORD = 'https://url.prepo.io/discord-dapp'
export const PREPO_MEDIUM = 'https://medium.com/prepo'
export const PREPO_TESTNET_FORM = 'https://url.prepo.io/whitelist-dapp'

export const FEE_DENOMINATOR = 1000000
export const VALUATION_DENOMINATOR = 1000000
export const TWO_DECIMAL_DENOMINATOR = 100
export const DECIMAL_LIMIT = 0.01
export const ONE_DAY_UNIX = 24 * 60 * 60
export const ONE_HOUR_UNIX = 60 * 60
export const CURRENCY_PRECISION = 2

export const USDC_SYMBOL = 'FAKEUSD'
export const FAKEUSD_AIRDROPPED_ON_TESTNET = 100

// this will directly affect query data of market chart
// when querying historical data from subgraphs, if we're expecting large amount of data
// it's better to specify from what time onwards we want to query to reduce the number of data we're searching
export const PROJECT_START_TIMESTAMP = 1619170975

export const TRANSACTION_SETTING = {
  DEFAULT_AMOUNT: 1000,
  MIN_TRADE_AMOUNT: 0,
  MAX_TRADE_AMOUNT: 20000,
}

export enum BigNumberPadding {
  ONE = 10,
  TWO = 100,
  THREE = 1000,
  FOUR = 10000,
}

export const CURRENTPRICE_MULTIPLIER = BigNumberPadding.THREE
export const SLIPPAGE_MULTIPLIER = BigNumberPadding.THREE

export const ERC20_UNITS = 18

export const CHARACTERS_ON_WALLET = 42
