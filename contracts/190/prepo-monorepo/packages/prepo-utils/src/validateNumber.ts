// will test for numeric with optional decimals
export const validateNumber = (value: string): boolean =>
  (/^([0-9]+\.?[0-9]*|\.[0-9]+)$/.test(value) || value === '') &&
  // somehow the regex is allowing plus and minus
  !value.includes('+') &&
  !value.includes('-')
