export const getShortAccount = (account: string | null | undefined): string | null =>
  account
    ? `${account.substring(0, 6)}...${account.substring(account.length - 7, account.length)}`
    : null
