# Valuation

Each Notional on chain market produces an oracle rate of of the annualized interest rate traded at that particular maturity. Notional uses these oracle rates to value fCash assets in a portfolio using continuous compounding. For example, a positive fCash asset with a maturity of Jan 1 2022 will be referenced by an on chain market that is trading fCash of the same maturity. If the market produces an oracle rate of 6% annualized, the fCash asset will be valued at its present value of `fCash notional * e^(-(rate +/- haircut) * time)`.

## Oracle Rate

All AMM (automated market makers) are vulnerable to flash loan manipulation, where an attacker borrows an enormous sum of tokens for a single transaction to move a market temporarily and find arbitrage opportunities. Notional side steps this issue by recording two market rates, the `lastImpliedRate` and the `oracleRate`. The `lastImpliedRate` is the last rate the market traded at and used to calculate the liquidity curve at the next trade. `oracleRate` is calculated whenever a market is loaded from storage from trading. The formula is:

```
    lastImpliedRatePreTrade * (currentTs - previousTradeTimestamp) / timeWindow +
        oracleRatePrevious * (1 - (currentTs - previousTradeTimestamp) / timeWindow)
```

While `lastImpliedRate` will change as a result of the flash loan, the oracle rate will be a weighted average of the last oracle rate and the last traded rate within a small time window of the previous trade. For example, assume the time window is set to 1 hour and the oracle rate is 6%. An account borrows enough to push the oracle rate up to 12%. `lastImpliedRate` will now be set to 12%, `previousTradeTimestamp` is set to the block timestamp.

The same account has used a flash loan so now they attempt to liquidate another account. Interest rates have increased which means that fCash discount factors have decreased, making fCash less valuable. Perhaps this move is enough to put an account into liquidation territory. Within the same transaction, the `currentTimestamp - previousTradeTimestamp` will be set to zero. That will cancel out any effect of the new `lastImpliedRate` and the oracle rate will remain at 6%. Therefore, no accounts on the system will see the effect of this trade in the same block.

Over the next 1 hour, the effect of the new 12% interest rate will be averaged into the previous 6% rate. This forces the borrower to hold their position and gives an opportunity for other traders to lend to the market to bring the interest rate back down to its previous 6% level.

## fCash Haircuts and Buffers

Positive fCash is the result of lending, an account that lends 1000 DAI may be owed 1050 fDAI at maturity. Conversely, an account that borrows will have a negative fCash balance to represent what they owe the protocol at maturity. In Notional, all fCash assets are **marked to market**, meaning their value is based on the prevailing market interest rates. To account for the risk of market rates changing, we **haircut** positive fCash and **buffer** negative fCash.

`Positive fCash Present Value = fCash * e^(-(oracleRate + haircut) * timeToMaturity)`
`Negative fCash Present Value = fCash * e^(-(oracleRate - buffer) * timeToMaturity)`

In layman's terms, when interest rates are **higher** the present value of fCash is **lower**. For negative fCash, when interest rates are **higher** the account may hold **less** collateral against their debt. By reducing the oracle rate (to a lower bound of 0%), Notional forces an account to hold more collateral against their debt than the market rate.

fCash which has haircuts and buffers applied is referred to as **risk-adjusted fCash**.

## Idiosyncratic fCash

Markets may not always trade at the exact maturities of all fCash assets. fCash that does not fall on an exact maturity is called **idiosyncratic fCash**. To value these assets, Notional takes the linear interpolation of the rates of the two nearest markets. For example, an fCash asset at 9 months to maturity will be valued at a rate halfway between the current 6 month and 1 year markets. **Idiosyncratic fCash** cannot exist beyond the furthest on chain market by design.

## Liquidity Tokens

Liquidity tokens represent a proportional share of the cash and fCash assets in an on chain market. Liquidity token value has two components, a cash claim and an fCash claim. A **haircut** is applied to both of these claims to account for changes in their values as the market trades back and forth.

When the fCash claim increases this means that interest rates are also increasing in the market. This will be the result of more borrowing than lending. A combination of an increasing share of fCash and increasing interest rates means that present value of the liquidity token will decrease. An increasing cash claim has the opposite effect.

## nToken Value

An nToken holds and manages liquidity tokens balances on behalf of nToken holders. An nToken is managed via governance parameters that ensure it's liquidity token value can never be liquidated. For this reason, nToken valuation does not incorporate fCash haircuts and buffers. However, nToken value can increase or decrease as its liquidity token holdings shift from cash claims to fCash claims. These shifts in value are accounted for by an overall nToken haircut applied to its non-risk adjusted present value.

## Free Collateral

Free collateral represents the aggregate value of all an account's holdings. It has three components:

- Net Cash Group Value: the aggregate value of fCash and liquidity tokens within a single currency
- Net Portfolio Value: the aggregate value of **net cash group value** denominated in ETH
- Net Cash Balance: the aggregate value of cash balances held by the account denominated in ETH
- Net nToken Value: the share of the total nToken present value held by the account with the nToken haircut applied, denominated in ETH

When converting to ETH denomination, an exchange rate **haircut** or **buffer** is applied to the value to account for exchange rate risk. Buffers are applied to increase the negative collateral value, haircuts are applied to decrease positive collateral value.

In mathematical terms:

```
netPortfolioValue = convertToAssetCash(sum(riskAdjustedfCash))
netCashBalance = cashBalance
netNTokenValue = ((nTokenTotalValue * nTokenHoldings) / nTokenTotalSupply) * nTokenHaircut
freeCollateral = convertToETH(netPortfolioValue + netCashBalance + netNTokenValue, ethHaircut, ethBuffer)
```
