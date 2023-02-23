export const makeRepeatedValue = (symbol: string, length: number): string => {
  let value = ''
  new Array(length).fill('').forEach(() => {
    value = `${value}${symbol}`
  })
  return value
}
