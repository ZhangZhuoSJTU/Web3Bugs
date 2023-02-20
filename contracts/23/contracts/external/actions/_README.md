# Actions

Each contract in this folder is an externally deployable contract that exposes some actions to users.

## Account Action

Deposit, withdraw, settle assets, and enable bitmap currency.

## Batch Action

Allows accounts to perform a set of more complex actions including:

- Depositing
- Withdrawing
- Minting nTokens
- Redeeming nTokens
- Trading on active markets (lending, borrowing, providing liquidity)
- Settling negative cash debts of other accounts
- Purchasing nToken residual fCash at a discount

Actions are encoded as an array of `BalanceAction` or `BalanceActionWithTrades` objects. Actions must be sorted ascending by currency id and duplicate actions objects of the same currency are not allowed. Batch actions will settle assets and check free collateral if required. Action inputs are defined in detail in the `global/Types.sol` file.

## ERC1155 Action

fCash can be represented as an ERC1155 token with one important caveat: fCash balances can be negative and the ERC1155 specification does not allow returning a signed integer from the `balanceOf` and `batchBalanceOf` methods. Our ERC1155 implementation does return a signed integer and therefore does not strictly adhere to the ERC1155 standard. Integrating transfer operators must be aware of this difference. We guard against potentially improper integrations by only allowing global transfer operators to be whitelisted by Governance. This means that integrating contracts can be reviewed for compatibility before whitelisting. Accounts can still manually approve operators if they choose, but should do so with caution.

When ERC1155 transfers occur, the `to` account will receive a specified fCash or liquidity token balance and the `from` account's balance will be reduced accordingly. When transferring fCash, the `from` account's fCash balance may become negative (i.e. they incur debt). This is equivalent to lending OTC between the `from` and `to` accounts. The `from` account may be a market maker and include in the `data` field of `safeTransferFrom` an instruction for the Notional to then execute a trade on the liquidity curve on their behalf. This allows a market maker to trade OTC and earn the spread between an idiosyncratic fCash position and the on chain market.

ERC1155 safeTransfers can execute one of three actions: batchBalanceAction, batchBalanceActionWithTrades, or redeemNToken.

## Governance Action

Allows the owner governance contract to list currencies and set various system parameters.

## Initialize Markets Action

Every three months when markets settle they must be initialized again. Anyone may call this method and the cash balances for the nToken of the given currency will be used to initialize the markets. The process is as follows:

- nToken liquidity tokens are settled to cash and residual fCash.
- 3 month residual fCash is settled to cash.
- Recalculate amount of cash to withhold for negative residual fCash. Subtract this amount from the cash used to initialize markets.
- For each market to initialize, calculate the proportion of fCash to cash ensuring that the oracle rate is kept close to the previous oracle rate. This ensures that existing fCash assets do not experience a sudden change in their valuation. If a market is over the leverage threshold, it will be set to the leverage threshold proportion (meaning the oracle rate will shift as a result).
- Set new market state and nToken state.

At this point the markets are now active and tradable. During the period between market settlement and market initialization, free collateral for accounts cannot be calculated. When the contract attempts to load an active market's oracle rate it will get a zero, causing the contract to revert. This is a risk, but market initialization only requires a very small amount of liquidity and call be called by anyone. The expectation is that this interim state will not exist for very long.

## Liquidate Currency Action

Exposes two liquidation methods, `liquidateLocalCurrency` and `liquidateCollateralCurrency`. For a more in depth discussion see `contracts/internal/liquidation/_README.md`.

## Liquidate fCash Action

Exposes two fCash liquidation methods, `liquidatefCashLocal` and `liquidatefCashCrossCurrency`. For a more in depth discussion see `contracts/internal/liquidation/_README.md`.

## nToken Action

Exposes ERC20 logic for totalSupply, balanceOf, allowances, and transfers of nTokens. Also exposes methods to claim incentives. Each nToken has an ERC20 proxy contract that refers back to this implementation.

## nToken Mint Action

Mints nTokens given an amount of asset cash. Is a library that is only be called by BatchAction. When minting nTokens, the amount of asset cash is split into each market given the governance defined `depositShares`. If a given market's proportion is above the specified `leverageThreshold`, then the nToken will lend to the market instead to reduce the market proportion. This will have an effect of lowering the interest rate and adding more cash to the market.

## nToken Redeem Action

Redeems nTokens by converting an nToken balance into its constituent parts: cash and fCash residuals. May attempt to sell fCash residuals back to the liquidity curve if they are not idiosyncratic. Exposes an `redeemNToken` method that allows an account to absorb the residuals if they cannot be sold.

## Trading Action

This is actually a library that can only be called via BatchAction. Has two external methods that execute trades against a bitmap portfolio and an asset array portfolio. The possible trade actions are:

- Lend: deposit asset cash into a market in return for a positive fCash amount
- Borrow: withdraw asset cash from a market and incur a negative fCash amount
- Add Liquidity: deposit asset cash and positive fCash into a market, incur a negative fCash amount in the portfolio. Mints a liquidity token.
- Remove Liquidity: Withdraw asset cash and positive fCash from a market in proportion to liquidity tokens burned.
- Purchase nToken Residual: Purchase a residual amount of fCash from an nToken portfolio
- Settle Cash Debt: if an account has a negative fCash balance that matures to cash, allows a settler to place cash in that account and receive an fCash balance at a penalty interest rate to the 3 month fixed rate. Essentially forces the settled account to borrow for 3 months at a penalty rate.
