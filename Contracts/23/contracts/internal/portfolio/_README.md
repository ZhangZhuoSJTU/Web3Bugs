# Portfolio

Notional fCash assets are stored in a central portfolio for gas efficiency and to make free collateral valuation easy. For users, it simplifies lending and borrowing by ensuring that users don't need to transfer lending tokens into a different contract for collateral -- anything that can be collateral in Notional is automatically credited as collateral for maximum capital efficiency and low user friction.

Notional has two types of portfolios to hold fCash assets and liquidity tokens. Each has trade offs and is targeted towards different users.

## Portfolio Array

`PortfolioHandler.sol` contains the logic required to manage an array based portfolio. It is not stored as a solidity array, however. The reason is that the array index in a solidity array consumes an entire storage slot of 32 bytes, far too much. In Notional, the array length is stored in the **account context** object as a uint8 and used to determine the storage offsets to load for the portfolio array.

The portfolio array is not stored in a sorted order (this would be prohibitively expensive), but is sorted every time it is loaded. This makes operating over assets much simpler. The sort order is currency id, maturity and then asset type. This ensures a few nice qualities:

- When a currency id does not equal the previous currency id, we know that we will need to load a new cash group.
- Because fCash has an asset type of 1 and liquidity tokens have asset types of 2+ we know that a matching fCash asset to liquidity token will always immediately precede it if it exists.

The benefits of the portfolio array are:

- Somewhat cheaper gas costs for smaller portfolios (most accounts will only have 1 asset)
- Allows lending and borrowing in multiple currencies
- Allows accounts to hold liquidity tokens in addition to nTokens

## Bitmap Portfolio

`BitmapAssetsHandler.sol` contains logic required to manage a bitmap based portfolio. This portfolio is stored as a combination of a bitmap and a mapping, where the bitmap is an index of which maturities a portfolio has an asset. The bitmap is broken down into discrete time chunks of days, 6 day weeks, 30 day months, and 90 day quarters. Only fCash can be stored in a bitmap portfolio.

The are some advantages to this construction:

- Reading assets does not require large memory allocation
- Only a single currency simplifies free collateral calculation
- Restricts account from holding liquidity tokens, which also simplifies free collateral calculation
- Can guarantee that assets are always read chronologically

The benefits to the account for using this type of portfolio are:

- Allows the account to hold significantly more assets in a single currency than a portfolio array
- Current costs to value a bitmap portfolio are still ~5k gas per asset, this is a limiting factor
