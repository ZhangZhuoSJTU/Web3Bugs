const DELTA = 0.00001
const INITIAL_LP_SUPPLY = 1000

const EMPTY_POOL_BALANCE = Object.freeze({ long: 0, short: 0 })

const EMPTY_MARKET_BALANCE = Object.freeze({
  long: 0,
  short: 0,
})

const SEC_IN_MS = 1000
const MIN_IN_MS = SEC_IN_MS * 60

export { DELTA, INITIAL_LP_SUPPLY, EMPTY_POOL_BALANCE, MIN_IN_MS, EMPTY_MARKET_BALANCE }
