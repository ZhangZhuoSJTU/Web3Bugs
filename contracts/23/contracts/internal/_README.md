# Account Context

Account contexts are used to improve the gas efficiency of interactions with Notional. The different interactions the context governs are described below.

## Next Settle Time

If an account has assets in its portfolio, they must be settled at some time in the future. Ensuring that there are no matured assets is a simplifying assumption that much of the contract code uses. When an account issues a transaction that may change its portfolio or free collateral position, the `nextSettleTime` timestamp is checked to determine if settlement is required.

In bitmapped portfolios, the `nextSettleTime` refers to the maturity minus one day of the first bit in the assets bitmap. On each transaction, `nextSettleTime` will be updated to the current block time at UTC midnight and the assets bitmap will be updated accordingly.

## Has Debt

If an account has debt, it requires a free collateral check on every transaction to ensure that it does not become undercollateralized. However, accounts that do not have debt cannot be undercollateralized and will benefit from significant gas savings of skipping this check.

Accounts can have debt in their portfolio (borrowing), their cash balances (a borrow that has matured to cash), or both. The has two bits to represent debt in either of these states. These bits can be updated in the following ways:

- HAS_ASSET_DEBT:

  - If account uses asset arrays, will be set to true or false whenever the portfolio is updated
  - If account uses asset bitmaps, will be set to true whenever a single fCash asset has a negative notional
  - If account uses asset bitmaps, will be set to false during a free collateral check if all none of the assets in the bitmap are negative

- HAS_CASH_DEBT:

  - Will be set to true whenever a single cash balance is stored as negative
  - Will be set to false during a free collateral check if all of an account's cash balances are greater than or equal to zero

## Asset Array Length

Solidity storage arrays use an entire storage slot to store the length, which costs 20k gas to initialize and 5k gas to update every time the length of an array changes. The max array length of a portfolio is 7 so 32 bytes is significant overkill. The account context holds a uint8 for the array length of a portfolio. When an account is using asset bitmaps, portfolio arrays are disabled and this will be set to zero.

## Bitmap Currency Id

Notional has a second portfolio type called the bitmap portfolio which allows for more fCash assets than an asset array. These portfolio types are limited to fCash of a single currency only (no liquidity tokens). The bitmap currency id set on the account context determines if this is active, if set to zero then there is no bitmap portfolio and the account is using an asset array portfolio.

## Active Currencies

During a free collateral check, all account assets including cash, nToken and portfolio assets must be aggregated and converted into an ETH denominated value in order to determine if the account has enough aggregate collateral to accept the new trade. In order to allow for a large number of supported currencies on the platform while remaining gas efficient, an account is limited to 9 potential active currencies (while the system may potentially list thousands of supported currencies). Each currency the account is active in is stored as two bytes in in the account context, with two high order bits set to denote if the account has active assets in its portfolio and if the account has active cash or nToken balances in the specified currency.

Active currencies are updated:

- Whenever an individual cash balance changes.
- Whenever an asset array portfolio is updated

If bitmap currency id is set, then it will be considered an active currency and the bitmap currency id will not be set in the active currency bytes. In this case, the account is given access to 10 potential active currencies (9 + 1 bitmap currency).

# nToken Account Context

nTokens are special accounts in the Notional system. For every currency than can be actively traded, there will be one nToken account that provides liquidity across all actively traded maturities for that currency. For example, DAI may trade at 3 months, 6 months, 1 year and 2 years. There will be one DAI nToken that users may deposit DAI (or cDAI) into and mint a corresponding amount of DAI nTokens (nDAI). This nDAI represents a share of liquidity across all 4 actively traded maturities.

On a 90 day cadence, actively traded markets settle to cash and new markets are initialized. This allows Notional to always have markets that are within 90 days of their target maturity (i.e. a 2 year maturity will always be available on chain between 1.75 years and 2 years away). The nToken account's liquidity will be used to settle and initialize markets on this 90 day cadence.

Initializing markets, minting nTokens and redeeming nTokens are discussed in depth in the `contracts/external/action/_README.md` file.

`nTokenHandler.sol` contains getters and setters for the parameters required to manage the nToken context. They are:

- Currency ID: the currency id that is managed by this nToken. Cannot be reset once initialized.
- nToken Address: address of the nToken ERC20 proxy that identifies this nToken
- Total Supply: the total active supply of nTokens
- Incentive Annual Emission Rate: the target annual rate of incentives issued to holders of the nToken. This rate is denominated in whole tokens (dropping the 1e8 precision) to fit in a single storage slot. This emission rate is not exact due to a fluctuating token supply and incentive multipliers given to long term nToken holders.
- Last Initialized Time: references the last time markets were initialized for this nToken. Used to determine if the nToken's assets must be settled.
- Collateral Parameters: a set of `uint8` parameters that govern how it can be used as collateral

  - PV Haircut Percentage: nToken can be used as collateral to borrow against, it's value is the present value of all assets held by the nToken multiplied by this haircut. For example, the present value of the total supply of DAI nTokens is 100M DAI and an account holds 1% of total nDAI supply. If the haircut percentage is 95%, this account has 950,000 DAI worth of nDAI collateral.
  - Liquidation Haircut Percentage: A discount given to liquidators for purchasing nToken collateral during liquidation. Must be greater than PV haircut percentage. With a PV haircut of 95% and a liquidation haircut of 96%, a liquidator would purchase nTokens at a 4% discount to present value and 1% of the present value would be credited back to the liquidated account's free collateral position.
  - Residual Purchase Incentive: As a consequence of providing liquidity, nTokens may become net lenders or borrowers at the end of every 90 day cadence. When these positions settle they leave a residual amount of fCash in the nToken account. This fCash is not liquid and cannot be used as liquidity in newly initialized markets. Over time these fCash residuals will become a drag on the nToken's total available liquidity. To resolve this, Notional allows accounts to purchase nToken residuals at a discount to market value in exchange for cash. This purchase incentive is the discount to market value denominated in 10 basis point increments.
  - Residual Purchase Time Buffer: An arbitrage opportunity exists due to the residual purchase incentive, a trader may trade markets out of line to generate significant fCash residuals only to repurchase them immediately after at a significant discount. The residual purchase time buffer will be set to a number of hours to allow for other traders to come and move markets back in line so that this arbitrage does not exist.
  - Cash Withholding Buffer: If an nToken generates negative fCash residuals, residual purchasers will take cash from the nToken's cash balance based on the residual fCash's present value. The cash withholding buffer is denominated in basis points from the current market rate and defines how much cash an nToken should safely withhold for a given negative fCash residual.

- Other parameters:

  - Deposit Shares: percentage of deposited assets that will be used to provide liquidity at corresponding market indexes
  - Leverage Thresholds: if a market has a proportion above the specified leverage threshold, providing liquidity may result in the nToken account taking on additional risk. In this case, the market is over leveraged and instead of providing liquidity, the nToken will lend to the market instead to decrease the proportion. This does not have an effect on the amount of nTokens that will be minted.
  - Rate Anchors and Proportions: During market initialization, rate anchors and proportions are used to set initial rates. See the corresponding section in the Initialize Markets.

## nToken Present Value

nTokens are designed such that they can never be liquidated even though they hold negative fCash positions as a result of providing liquidity. This can be guaranteed by setting the leverage threshold such that the nToken never provides liquidity at excessive risk. Because of this, when a calculating the present value of an nToken, Notional uses the present value and does not do any risk adjustments.

## nToken Portfolio

An nToken has a special portfolio that uses asset arrays for liquidity tokens but keeps fCash in a bitmap. This is because fCash residuals become idiosyncratic after markets settle every 90 days and the nToken must then initialize the markets again. If there are 7 tradable markets, this means a minimum of 14 assets. If there are residuals after market settlement, this means 20 assets in the portfolio.

Keeping track and calculating the present value of all these assets is easier to do when separating fCash from liquidity tokens.
