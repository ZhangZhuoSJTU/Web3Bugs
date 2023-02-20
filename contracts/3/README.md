# MarginSwap Contest
- $40k USDC main award pot
- $10k USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://c4-marginswap.netlify.app/)
- [Read our guidelines for more details](https://code423n4.com/compete)
- Starts Apr 2 00:00 UTC
- Ends Apr 7 23:59 UTC

## Protocol summary

Marginswap offers margin trading on top of uniswap and sushiswap liquidity.
Lenders provide funds in terms of bonds (hourly recurring or fixed term), borrowers can trade on uni/sushi (as well as other compatible dexes) with leverage.

Traders on marginswap will have the choice of two different paradigms in which the solvency of accounts is ensured:
* Cross margin: A select collection of tokens are held and borrowed in an account where the liquidation threshold is computed jointly across the value of all assets in that account.
* Isolated margin: Traders can choose one specific short/long token pair and the liquidation of this trade is determined solely by whether prices develop for or against the trader in this pair.

Lending happens either into the cross margin side of the protocol, or into one specific token associated with one spsecific isolated margin trading contract.

## Architecture

In the interest of time, so you can focus on the most important aspects of the protocol, we have only placed the core contracts in this repo. Please assume a working apparatus for initialization and managing ownership up to governance.


### Core Focus

Please pay close attention to the following contracts:

* `MarginRouter.sol` A router contract resembling the `UniswapV2Router`. Pay attention to the significantly different `_swap` function with mixing of pairs from any compatible AMM.
* `Cross*.sol` and `PriceAware.sol`: All these contracts form one inheritance tree, modeling cross margin trading, including liquidation and a stingy price oracle. Please keep your eye on the liquidation mechanism and any gas we could save in this rather voluminous system.
* `*Lending.sol`: Fixed-term and hourly bond lending. We would like particular attention paid to the velocity-based interest update mechanism.

### Also of interest

* `IncentiveDistribution.sol`: Called every time a borrow / lending action is taken. We don't want to waste gas here.
* `Isolated*.sol`: These contracts mirror the cross margin trading contracts closely, but are significantly simpler. Checking these first may be a good way to get the lay of the land before diving into cross margin. Note that there will be one contract per short/long choice. Isolated margin trading is not yet integrated with the `MarginRouter`. Liquidity failures in isolated margin should not affect the rest of the system.
* `Fund.sol` holds the money.
* `Admin.sol` Maintenance stakers, FYI.
* `Roles.sol` provides loose coupling of the main contracts in the protocol providing some measure of upgradability.

If you're curious you can look at the entirety of our contracts [here](https://github.com/marginswap/marginswap-core).
