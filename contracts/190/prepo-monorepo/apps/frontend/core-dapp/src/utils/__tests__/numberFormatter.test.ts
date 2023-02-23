import { numberFormatter } from '../numberFormatter'

describe('numberFormatter tests', () => {
  describe('significantDigits using SI Prefix', () => {
    const { significantDigits } = numberFormatter
    it('should return 3 significant digits', () => {
      const output1 = significantDigits(1000000000)
      const output2 = significantDigits(1230000000)
      const output3 = significantDigits(12300000000)
      const output4 = significantDigits(123000000000)
      const output5 = significantDigits(789000000)
      const output6 = significantDigits(78900000)
      const output7 = significantDigits(7890000)
      expect(output1).toBe('1.00B')
      expect(output2).toBe('1.23B')
      expect(output3).toBe('12.3B')
      expect(output4).toBe('123B')
      expect(output5).toBe('789M')
      expect(output6).toBe('78.9M')
      expect(output7).toBe('7.89M')
    })
  })

  describe('rawPercent', () => {
    const { rawPercent } = numberFormatter
    it('should return a percentage without the % preffix', () => {
      const output1 = rawPercent(0.23)
      const output2 = rawPercent('0.23')
      const output3 = rawPercent(0.32423123423)
      expect(output1).toBe('23.0')
      expect(output2).toBe('23.0')
      expect(output3).toBe('32.4')
    })

    it('should return the value with default precision of 1 decimal', () => {
      const output1 = rawPercent(0.32423123423)
      const output2 = rawPercent('0.32423123423')
      expect(output1).toBe('32.4')
      expect(output2).toBe('32.4')
    })

    it('should return the value with custom precision', () => {
      const precision = 2
      const output1 = rawPercent(0.32423123423, precision)
      const output2 = rawPercent('0.32423123423', precision)
      expect(output1).toBe('32.42')
      expect(output2).toBe('32.42')
    })

    it('should return undefined', () => {
      const output1 = rawPercent(NaN)
      const output2 = rawPercent(1.2)
      const output3 = rawPercent(-1.2)
      expect(output1).toBe(undefined)
      expect(output2).toBe(undefined)
      expect(output3).toBe(undefined)
    })
  })

  describe('percent', () => {
    const { percent } = numberFormatter
    it('should return a percentage with the % preffix', () => {
      const output1 = percent(0.23)
      const output2 = percent('0.23')
      const output3 = percent(0.32423123423)
      expect(output1).toBe('23.0%')
      expect(output2).toBe('23.0%')
      expect(output3).toBe('32.4%')
    })

    it('should return the value with default precision of 1 decimal', () => {
      const output1 = percent(0.32423123423)
      const output2 = percent('0.32423123423')
      expect(output1).toBe('32.4%')
      expect(output2).toBe('32.4%')
    })

    it('should return the value with custom precision', () => {
      const precision = 2
      const output1 = percent(0.32423123423, precision)
      const output2 = percent('0.32423123423', precision)
      expect(output1).toBe('32.42%')
      expect(output2).toBe('32.42%')
    })

    it('should return undefined', () => {
      const output1 = percent(NaN)
      const output2 = percent(1.2)
      const output3 = percent(-1.2)
      expect(output1).toBe(undefined)
      expect(output2).toBe(undefined)
      expect(output3).toBe(undefined)
    })
  })

  describe('withCommas', () => {
    const { withCommas } = numberFormatter
    it('should return a number with commas as thousands', () => {
      const output1 = withCommas(1234)
      const output2 = withCommas(12345678)
      const output3 = withCommas(12345678912)
      expect(output1).toBe('1,234')
      expect(output2).toBe('12,345,678')
      expect(output3).toBe('12,345,678,912')
    })

    it('should return 0', () => {
      const output = withCommas(0)
      expect(output).toBe('0')
    })
  })

  describe('toUsd', () => {
    const { toUsd } = numberFormatter
    it('should return a number formatted with USD and currency precision', () => {
      const output1 = toUsd(1234)
      const output2 = toUsd(12345678)
      const output3 = toUsd(12345678912)
      expect(output1).toBe('$1,234.00')
      expect(output2).toBe('$12,345,678.00')
      expect(output3).toBe('$12,345,678,912.00')
    })

    it('should return $0', () => {
      const output1 = toUsd(undefined)
      const output2 = toUsd('')
      const output3 = toUsd(NaN)
      expect(output1).toBe('$0.00')
      expect(output2).toBe('$0.00')
      expect(output3).toBe('$0.00')
    })
  })
})
