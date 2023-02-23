import { numFormatter, formatPercent, normalizeDecimalPrecision } from '../number-utils'

describe('formatPercent tests', () => {
  it('should return undefined if the input is NaN', () => {
    const output = formatPercent('abc')
    expect(output).toBe(undefined)
  })

  it('should return undefined if the input is larger than 1', () => {
    const output = formatPercent('15')
    expect(output).toBe(undefined)
  })

  it('should return correct value if the input is valid', () => {
    const output = formatPercent('0.432')
    expect(output).toBe('43.2')
  })

  it('should return correct precision value', () => {
    const output = formatPercent('0.43244567', 2)
    expect(output).toBe('43.24')
  })
})

// https://en.wikipedia.org/wiki/Metric_prefix#List_of_SI_prefixes
describe('replace large numbers with SI Prefix', () => {
  it('should have same number as string', () => {
    const output = numFormatter(100)
    expect(output).toBe('100')
  })

  it('should replace with k letter', () => {
    const output1 = numFormatter(1234)
    const output2 = numFormatter(12345)
    const output3 = numFormatter(123456)
    const output4 = numFormatter(1000)
    const output5 = numFormatter(10000)

    expect(output1).toBe('1.234K')
    expect(output2).toBe('12.345K')
    expect(output3).toBe('123.456K')
    expect(output4).toBe('1K')
    expect(output5).toBe('10K')
  })

  it('should replace with M letter', () => {
    const output1 = numFormatter(1234567)
    const output2 = numFormatter(12345678)
    const output3 = numFormatter(1000000)
    const output4 = numFormatter(10000000)
    const output5 = numFormatter(123456789)

    expect(output1).toBe('1.23457M')
    expect(output2).toBe('12.3457M')
    expect(output3).toBe('1M')
    expect(output4).toBe('10M')
    expect(output5).toBe('123.457M')
  })

  it('should replace with B letter', () => {
    const output1 = numFormatter(1000000000)
    const output2 = numFormatter(123456789012)
    expect(output1).toBe('1B')
    expect(output2).toBe('123.457B')
  })

  it('should return significant digits', () => {
    const output1 = numFormatter(1000000000, { significantDigits: 3 })
    const output2 = numFormatter(1230000000, { significantDigits: 3 })
    const output3 = numFormatter(12300000000, { significantDigits: 3 })
    const output4 = numFormatter(123000000000, { significantDigits: 3 })
    const output5 = numFormatter(789000000, { significantDigits: 3 })
    const output6 = numFormatter(78900000, { significantDigits: 3 })
    const output7 = numFormatter(7890000, { significantDigits: 3 })
    expect(output1).toBe('1.00B')
    expect(output2).toBe('1.23B')
    expect(output3).toBe('12.3B')
    expect(output4).toBe('123B')
    expect(output5).toBe('789M')
    expect(output6).toBe('78.9M')
    expect(output7).toBe('7.89M')
  })
})

describe('normalizeDecimalPrecision tests', () => {
  it('should return a number as string with 2 decimals', () => {
    const output = normalizeDecimalPrecision('14.999999999999999999')
    expect(output).toBe('14.99')
  })
  it('should return number with only 1 decimal', () => {
    const output = normalizeDecimalPrecision('14.9')
    expect(output).toBe('14.9')
  })
  it('should return 0', () => {
    const output = normalizeDecimalPrecision('0')
    expect(output).toBe('0')
  })
})
