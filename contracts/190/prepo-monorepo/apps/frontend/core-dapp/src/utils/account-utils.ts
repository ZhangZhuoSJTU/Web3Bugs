export const getShortAccount = (
  account: string | null | undefined,
  size: 'small' | 'medium' = 'small'
): string | null => {
  const subtractValue = size === 'small' ? [6, 3] : [6, 7]
  return account
    ? `${account.substring(0, subtractValue[0])}...${account.substring(
        account.length - subtractValue[1],
        account.length
      )}`
    : null
}

export const isEns = (name: string): boolean => name.endsWith('.eth')
