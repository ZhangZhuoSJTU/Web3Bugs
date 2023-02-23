// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeError = (errorObject: any, log = true): Error => {
  const errorMessage =
    typeof errorObject === 'string'
      ? errorObject
      : errorObject?.error?.data?.originalError.message ??
        errorObject?.reason ??
        errorObject?.message ??
        JSON.stringify(errorObject)
  // eslint-disable-next-line no-console
  if (log) console.error(errorMessage, errorObject)
  return new Error(errorMessage)
}
