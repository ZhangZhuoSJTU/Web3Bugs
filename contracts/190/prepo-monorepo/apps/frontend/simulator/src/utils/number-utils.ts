export const bigAmountToUsd = (number: number, digits = 2): string => {
  const lookup = [
    { value: 1, symbol: '' },
    { value: 1e3, symbol: 'k' },
    { value: 1e6, symbol: 'M' },
  ]
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/
  const item = lookup
    .slice()
    .reverse()
    .find((itemLookup) => Math.abs(number) >= itemLookup.value)

  const newFormatValue = item
    ? Number(number / item.value)
        .toFixed(digits)
        .replace(rx, '$1')
    : Number(number).toFixed(digits)
  const valueToUsd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  })
    .format(parseFloat(newFormatValue))
    .replace(/[.,]00$/, '') // Removes the decimals if it's [number].00

  return item ? `${valueToUsd}${item?.symbol}` : valueToUsd
}
