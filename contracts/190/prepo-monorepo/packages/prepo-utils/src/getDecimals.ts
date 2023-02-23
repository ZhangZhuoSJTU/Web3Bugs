export const getDecimals = (value: string): number => {
  const parts = value.split('.')
  if (parts[1]) return parts[1].length
  return 0
}
