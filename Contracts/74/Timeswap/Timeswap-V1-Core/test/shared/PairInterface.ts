export interface Tokens {
  asset: bigint
  collateral: bigint
}
export interface TotalClaims {
  bond: bigint
  insurance: bigint
}

export interface Due {
  debt: bigint
  collateral: bigint
  startBlock: bigint
}

export interface Liquidity {
  liquidityProvider: string
  liquidity: bigint
}
export interface Claims {
  lender: string
  claims: TotalClaims
}
export interface Dues {
  borrower: string
  due: Due[]
}

export interface ConstantProduct {
  asset: bigint
  interest: bigint
  cdp: bigint
}
export interface State {
  reserves: Tokens
  totalLiquidity: bigint
  totalClaims: TotalClaims
  totalDebtCreated: bigint
  asset: bigint
  interest: bigint
  cdp: bigint
}
export interface Pool {
  state: State
  liquidities: Liquidity[]
  claims: Claims[]
  dues: Dues[]
  maturity: bigint
}

export interface Factory {
  contractAddress: string
  owner: string
}

export function initFactory(factoryContract: string, owner: string): Factory {
  return { contractAddress: factoryContract, owner: owner }
}

export function tokensDefault(): Tokens {
  return { asset: 0n, collateral: 0n }
}

export function totalClaimsDefault(): TotalClaims {
  return { bond: 0n, insurance: 0n }
}

export function dueDefault(): Due {
  return { debt: 0n, collateral: 0n, startBlock: 0n }
}

export function stateDefault(): State {
  return {
    reserves: tokensDefault(),
    totalLiquidity: 0n,
    totalClaims: totalClaimsDefault(),
    totalDebtCreated: 0n,
    asset: 0n,
    interest: 0n,
    cdp: 0n,
  }
}

export function poolDefault(maturity = 0n): Pool {
  return {
    state: stateDefault(),
    liquidities: [],
    claims: [],
    dues: [],
    maturity: maturity,
  }
}

export default {
  tokensDefault,
  totalClaimsDefault,
  dueDefault,
  stateDefault,
  poolDefault,
}
