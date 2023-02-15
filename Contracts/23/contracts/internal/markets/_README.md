# Markets

Notional enables fixed rate lending and borrowing via on chain liquidity pools we call **markets**. Each currency may have a **Cash Group** which holds all the configuration related to the set of markets that host lending and borrowing for that currency. In order to enable high capital efficiency for liquidity providers, liquidity is denominated in money market tokens (i.e. cTokens) that bear some underlying variable rate of interest. This is referred to as **asset cash** in the codebase and it has an exchange rate back to the underlying asset we call the **asset rate**

## Asset Rate

Liquidity in markets is provided (wherever possible) in asset cash, which means that it is a token that bears some amount of money market interest. fCash, however, is denominated in underlying terms such that it is a fixed amount of tokens redeemable at a fixed term. Asset rates enable the conversion of asset cash to underlying denomination for the purposes of settlement and trading.

Asset rates will change every block, therefore there are nearly identical view and stateful methods for getting asset rates (`buildAssetRateView` and `buildAssetRateStateful`). The view version should only ever be used during view methods, **never** during trading or the exchange rate will not be accurate.

When fCash settles at it's maturity, it settles to asset cash (not the underlying asset). For this to occur, we set **settlement rates** when the first fCash asset of a given maturity settles. All other fCash assets of the same maturity and currency will settle to asset cash at the same rate. Because total fCash of a maturity and currency will always net to zero, we know that the total amount of asset cash (positive and negative) will net to zero. It is not crucial that the settlement rate occurs exactly on the maturity date.

## Cash Group

A cash group has a number of parameters that dictate how markets and fCash assets in it behave. Each parameter is stored as a uint8 for gas efficiency. They are scaled up to the necessary denomination when they are used.

Used during trade calculations:

- TOTAL_FEE: stored as basis points, scaled up to RATE_PRECISION
- RESERVE_FEE_SHARE: stored as an integer percentage
- RATE_SCALAR: stored as an integer in increments of 10, multiplied by 10

Used during valuation of fCash assets (see the **valuation** module):

- RATE_ORACLE_TIME_WINDOW: stored as minutes, scaled up to seconds
- DEBT_BUFFER: stored as a number in 5 basis point increments, scaled up to RATE_PRECISION
- FCASH_HAIRCUT: stored as a number in 5 basis point increments, scaled up to RATE_PRECISION
- LIQUIDITY_TOKEN_HAIRCUT: stored as an integer percentage

Used during settlement and liquidation:

- SETTLEMENT_PENALTY: stored as a number in 5 basis point increments, scaled up to RATE_PRECISION
- LIQUIDATION_FCASH_HAIRCUT: stored as a number in 5 basis point increments, scaled up to RATE_PRECISION

## Market

A market is a liquidity curve between asset cash and fCash for a particular maturity. Accounts can add and remove liquidity or trade fCash for asset cash. There are three key factors that govern trading dynamics:

- Exchange Rate: the rate at which fCash is exchanged for underlying cash (this is calculated from the current asset cash balance)
  `exchangeRate = rateScalar^-1 * ln(proportion / (1 - proportion)) + rateAnchor`
  `exchangeRate = fCash / cash`
- Implied Rate: the annualized, continuously compounded interest rate implied by the exchange rate and the time until maturity
  `exchangeRate = e^(impliedRate * timeToMaturity)`
  `impliedRate = ln(exchangeRate) / timeToMaturity`
- Proportion: the ratio of fCash to cash in the market
  `proportion = fCash / (fCash + cash)`

NOTE: in all of these calculations, we use **underlying cash** not **asset cash** for the calculations.

## Settlement Date and Settlement Markets

In Notional, markets will settle every quarter rather than at maturity. fCash will continue to settle at maturity, however, liquidity tokens will settle every quarter to cash and residual fCash. This ensures that a 2 year market will always be between 2 years and 1.75 years away at worst. However, it does require some additional logic when storing and loading markets as there may be two or more markets with the same maturity and different settlement dates.

For example, an fCash asset with a maturity of Jan 2022 will be traded in four markets starting Jan 2020 to Mar 2020 (2 year), Jan 2021 to Mar 2021 (1 year), Jun 2021 to Aug 2021 (6 month), Sep 2021 to Dec 2021 (3 month).

## Invariants and Test Cases

- System wide fCash of a currency and maturity will net to zero
- Market liquidity curve must work out to 20 years without overflows
