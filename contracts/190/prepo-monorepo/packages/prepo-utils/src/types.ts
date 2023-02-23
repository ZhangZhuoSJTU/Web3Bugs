export type FormatNumber = (
  number: number | string,
  options?: {
    compact?: boolean
    usd?: boolean
  }
) => string
