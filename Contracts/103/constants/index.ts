const tidy = (str: string): string =>
  `${str.replace(/\n/g, '').replace(/ +/g, ' ')}`

export const AuctionBidEncoding = tidy(`tuple(
    address user,
    address router,
    uint24 sendingChainId,
    address sendingAssetId,
    uint256 amount,
    uint24 receivingChainId,
    address receivingAssetId,
    uint256 amountReceived,
    address receivingAddress,
    bytes32 transactionId,
    uint256 expiry,
    bytes32 callDataHash,
    address callTo,
    bytes encryptedCallData,
    address sendingChainTxManagerAddress,
    address receivingChainTxManagerAddress,
    uint256 bidExpiry
  )`)

export const TXData = tidy(`tuple(
    address receivingChainTxManagerAddress,
    address user,
    address router,
    address sendingAssetId,
    address receivingAssetId,
    address sendingChainFallback,
    address receivingAddress,
    address callTo,
    bytes32 callDataHash,
    bytes32 transactionId,
    uint256 sendingChainId,
    uint256 receivingChainId,
    uint256 amount,
    uint256 expiry,
    uint256 preparedBlockNumber
  )`)
