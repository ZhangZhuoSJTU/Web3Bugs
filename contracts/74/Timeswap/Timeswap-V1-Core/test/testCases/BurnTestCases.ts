export function burn(): Burn {
  const testCases = burnTestCases()

  const success = testCases.filter(burnSuccessCheck)
  const failure = testCases.filter(burnFailureCheck).map(burnMessage)

  return { Success: success, Failure: failure }
}
function burnTestCases(): BurnParams[] {
  const testCases = [{ liquidityIn: 132697204941179723912n }]
  return testCases
}

export interface Burn {
  Success: BurnParams[]
  Failure: {
    params: BurnParams
    errorMessage: string
  }[]
}
export interface BurnParams {
  liquidityIn: bigint
}

function burnSuccessCheck({ liquidityIn }: { liquidityIn: bigint }): boolean {
  if (liquidityIn > 0n) {
    return true
  } else {
    return false
  }
}

function burnFailureCheck(value: { liquidityIn: bigint }): boolean {
  return burnSuccessCheck(value)
}

function burnMessage(params: BurnParams): {
  params: BurnParams
  errorMessage: string
} {
  if (params.liquidityIn > 0n) {
    return { params, errorMessage: 'Invalid' }
  } else {
    return { params, errorMessage: '' }
  }
}
