export interface Claims {
  bondInterest: bigint
  bondPrincipal: bigint
  insuranceInterest: bigint
  insurancePrincipal: bigint
}
export interface CollectParams {
  claims: Claims
}
  