# Elastic Swap v1 - Math Documentation

This document is created to explain the technical-mathematical terms and concepts behind ElasticSwap v1.

## Introduction

Elastic Swap is the first Automated Market Maker (AMM) to natively support tokens with elastic supply. It is heavily influenced by UniSwap's implementation and diverges from their design in the fact that the `baseToken` in each `Exchange` can be a token with elastic or fixed supply.

## Technical Terms

> Note: The usage of dash notation (`'`) & delta notation (`Δ`) is explained in subsequent examples in the following sections.

- `X` - The internal balance of `baseToken`, for accounting purposes.
- `DeltaX (ΔX)` - The (incoming or outgoing) change in the quantity of `X`
- `XDash (X')` -> `X' = ΔX + X` - The new quantity of `X` post the occurrence of a trade or a liquidity event
- `Y` - The internal balance of `quoteToken`, for accounting purposes.
- `DeltaY (ΔY)` - The (incoming or outgoing) change in the quantity of `Y`
- `YDash (Y')` -> `Y' = ΔY + Y` - The new quantity of `Y` post the occurence of a trade or a liquidity event
- `Alpha (α)` - The ERC20 balance of `baseToken` currently in the exchange.
- `Beta (β)` - The ERC20 balance of `quoteToken` currently in the exchange.
- `Omega (ω)` - `X/Y` - The ratio of the internal balance of `baseToken` to the internal balance of `quoteToken`.
- `K` - `X*Y` - The product of the internal balance of `baseToken` and the internal balance of `quoteToken`. It is used to price trades between `baseToken` and `quoteToken`.
- `Sigma (σ)` - `α/β` - The ratio of the balance of `baseToken` currently in the exchange to the balance of `quoteToken` currently in the exchange.
- `AlphaDecay (α^)` - `α-X` - The amount of `Alpha(α)` not contributing to the liquidity due to an imbalance in the tokens caused by elastic supply (a rebase).
- `BetaDecay (β^)` - `β-Y` - The amount of `Beta(β)` not contributing to the liquidity due to an imbalance in the tokens caused by elastic supply (a rebase).
- `Ro (ρ)` - The total supply of the `liquidityToken`.
- `Gamma (γ)` - `ΔY / Y / 2 * ( ΔX / α^ )` - Gamma is a multiplier term that is used to issue the correct amounts of `liquidityToken` when `alphaDecay(α^)` or `BetaDecay (β^)` exists in the system.

## Further explained: Presence of `AlphaDecay(α^)` and `BetaDecay(β^)`

The presence of the terms `X`, `Y`, `Alpha(α)`, `Beta(β)` allows the ElasticSwap v1 to support stable pricing on rebase events for an elastic-non elastic supply token pair. This is done with the concept of `AlphaDecay(α^)` and `BetaDecay(β^)`.
Whenever there is a rebase event that occurs, which results in the increase or decrease in the supply of the `baseToken`, decay is introduced. The presence (or absence) of which determines how much `Ro(ρ)` is issued to liquidity providers.

- When there is an increase in the supply of the `baseToken`, essentially the quantity of `Alpha(α)` has increased, considering the situation where there was no decay prior to the rebase event, i.e initially `α = X` (and `β = Y`), implying `α^ = 0` (and `β^ = 0`). Post the rebase event: `α^ = α' - X` ( and `β^ = 0`, as there has been no change in `β` or `Y`)
  > Note: In the above scenario, initially `ω = σ`, post the rebase event, `ω' != σ'`
- When there is a contraction in the supply of the `baseToken`, essentially the quantity of `Alpha(α)` has now decreased, considering the situation where there was no decay prior to the rebase event, i.e initially `α = X` (and `β = Y`), due to the contraction in supply, the `BetaDecay (β^)` is given by `β^ = (X - α') * iω`.
  > Note: In the above scenario, initially `ω = σ`, post the rebase event, `ω' != σ'`

## Issuance of liquidity Tokens `ΔRo`

Liquidity Tokens, `Ro`, are provided to liquidity providers.
There are multiple ways to provide liquidity: creating an Elastic AMM pool, `singleAssetEntry`, `doubleAssetEntry` and a `partialSingleAndDoubleAssetEntry`.

1. **Creation of an Elastic AMM pool**:
   This case refers to the creation of an ELastic AMM pool( a pool which consists of both `baseToken` and `quoteToken`) on ElasticSwap, this differs from `doubleAssetEntry` because here there is no `Omega`, `Sigma`, until the pool has been created. The first batch of LP tokens `Ro` are also minted to the liquidity provider who bootstraps the pool.

   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:

   ```
     ΔRo = sqrt(ΔY * ΔX)
     where,
     # sqrt - Stands for the square root of the numbers provided, ex: sqrt(4) = 2
     # ΔY - The amount of quoteTokens the liquidity provider wants to provide.
     # ΔX - The amount of baseTokens the liquidity provider wants to provide.

     Note: Initially, Ro = 0, hence after creation of the pool,
            Ro' = ΔRo + Ro =>  Ro' = ΔRo + 0
            (this becomes the Ro for other liquidity events, the dash and delta notation (Ro', ΔX, ΔY) is further explained in the Double Aset entry section)


   ```

2. **Double Asset Entry**: Double asset entry occurs when the liquidity provider provides both baseToken and quoteToken (in equivalent amounts, such that Omega stays constant) to the AMM. Double asset entry is only possible when there is **_NO_** `AlphaDecay (α^)` or `BetaDecay (β^)` present in the system. Double asset entry maintains the values of `Omega` and `Sigma`.

   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:

   ```
   ΔRo = (ΔY/Y) * Ro
   where,
   # ΔRo - The amount of tokens the liquidity provider receives.
   # ΔY - The amount of quoteTokens the liquidity provider wants to provide.
   # Y - The internal balance of quoteToken.
   # Ro - The current total supply of the liquidityToken
   ```

   > Note: To understand the usage of Delta(`Δ`) and Dash(`'`) notation,
   > the above scenario initially(prior to Double Asset Entry) was:

   ```
   Y - The internal balance of the quoteToken,
   Ro - The current total supply of the liquidityToken,
   ```

   > The "change" that the system is introduced to the AMM by the liquidity provider, providing baseToken and quoteToken is given by:

   ```
   ΔY - The amount of quoteTokens the liquidity provider wants to provide.
   ΔX - The amount of baseTokens the liquidity provider has to provide. Given by ΔX = K / ΔY

   Note: The vice versa also holds true, If the liquidity provider wanted to provide a specific amount of baseTokens(ΔX), then the amount of quoteTokens(ΔY) to be provided would be given by ΔY = K / ΔX
   ```

   > As a result of which a certain amount `ΔRo`(DeltaRo) is issued to the liquidity provider (refer above). Which results in the final state being:

   ```
   Y' = Y + ΔY  - The (new) internal balance of quoteToken after this liquidity event
   X' = Y + ΔX  - The (new) internal balance of baseToken after this liquidity event
   Ro' = Ro + ΔRo - The (new) current total of the liquidity tokens

   Note: Y', X', Ro' become Y, X, Ro respectively for the next following liquidity event(regardless of it being single or double asset entry).
   ```

   The function that does this is `addLiquidity` in [Exchange.sol](https://github.com/elasticdao/elasticswap/blob/develop/src/contracts/Exchange.sol#L87)

3. **Single Asset Entry**: Single asset entry is only possible when there exists decay (alpha or beta) in the system. When there is decay in the system it means that Omega != Sigma. With Single Asset Entry, the liquidity provider is "correcting" this with their liquidity, i.e bringing Sigma in line with Omega.

   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:
   When there is `alphaDecay`:

   ```
   ΔRo = (Ro/(1 - γ)) * γ
   where,
   # ΔRo - The amount of tokens the liquidity provider receives.
   # γ = ΔY / Y / 2 * ( ΔX / α^ )
   # ΔY = α^ / ω   - The amount of quoteTokens required to completely offset alphaDecay.

   ```

   When there is `betaDecay`:

   ```
   ΔRo = (Ro/(1 - γ)) * γ
   where,
   # ΔRo - The amount of tokens the liquidity provider receives.
   # γ = ΔX / X / 2 * ( ΔX / β^ )
   # ΔX = α - X   - The amount of baseTokens required to completely offset betaDecay(and by extension alphaDecay).
   # β^ = ΔX  / ω

   ```

   The respective solidity functions can be found at [Exchange.sol](https://github.com/elasticdao/elasticswap/blob/develop/src/contracts/Exchange.sol#L87)

4. **PartialSingleAndDoubleAssetEntry**: When the liquidityProvider wants to provide both `baseToken` and `quoteToken` when decay is present, it is called a `PartialSingleAndDoubleAssetEntry`. This is because firstly a `singleAssetEntry` occurs, and then a `doubleAssetEntry` occurs. The liquidity provider receives `ΔRo`(liquidity tokens) that takes into account both the entires.

   The amount of `liquidityTokens` - (`ΔRo`) issued to the liquidity provider in this case is given by:

   ```
   ΔRo = ΔRo(SAE) + ΔRo(DAE)
   where,
   # ΔRo(SAE) - The liquidity tokens received due to the SingleAssetEntry
   # ΔRo(SAE) - The liquidity tokens received due to the DoubleAssetEntry
   ```

   > Note: In `PartialSingleAndDoubleAssetEntry` it is possible that the user might end up with a certain amount of unused `baseToken` or `quoteToken`, This is because in the presence of `AlphaDecay (α^)` the `SingleAssetEntry` uses up a certain amount of `quoteToken` and then the remaining amount of which is used along with an equivalent amount of `baseToken` for the `DoubleAssetEntry`, the quantity of which could be lower than the amount the liquidity provider wanted to provide.

## Redemption of liquidity Tokens `ΔRo`

The underlying redemption value of liquidity tokens increases due to the accrual of trading fees. At any time, they can be redeemed for equivalent amounts of `baseToken` and `quoteToken`.
The amount of `baseToken` and `quoteToken` received is given by:

```
ΔX = α * ΔRo / Ro
ΔY = β * ΔRo / Ro

where,
# ΔRo - The amount of liquidity tokens the liquidity provider wants to exchange
# ΔX - The amount of baseToken the liquidity provider receives
# ΔY - The amount of quoteTokens the liquidity provider receives
# α - The balance of baseToken currently in the exchange
# β - The balance of quoteToken currently in the exchange

```

The function that handles this is `removeLiquidity` in [Exchange.sol](https://github.com/elasticdao/elasticswap/blob/develop/src/contracts/Exchange.sol#L87).

> Note: It is possible to redeem `Ro` when there is decay (alpha or beta) present in the system.

## Fees:

As with any other AMM the incentive to provide liquidity is so that the LP tokens issued accrue fees.

There is a 30 Basis points(BP) fee for swap occurences(this is at par with other AMM's at the moment, this can be changed via vote if the ElasticSwap DAO votes to do so ), 5 BP of which goes the `feeAddress` (an address which is ElasticDAO initially, this can be changed via vote if the ElasticSwap DAO votes to do so). The remaining 25 BP is realised by the LP holders pro-rata.

The fees are accrued on swap occurences, the portion of the fees (5 BP) that the `feeAddress` receives is sent to it when liquidity events occur.

## Tokens supported by ElasticSwap:

For the rebasing token - `baseToken`, any ERC20 token which is Elastic in nature, i.e it's supply contracts and expands due to external factors can be used to create a pool with a standard ERC20 non elastic token - `quoteToken`.

> Note: Support for tokens that have Fee on transfer behaviour will **not** supported in V1.

## A complete example

This example is to illustrate all the concepts in one series of hypothetical (but plausible) chain of events

```
  Liquidity provider #1 provides 1000000 baseTokens and 1000000 quoteTokens.
  Therefore,
    X = 1000000
    Alpha = 1000000
    Y = 1000000
    Beta = 1000000
    K = 1000000000000
    Omega = 1000000/1000000 = 1
    Sigma = 1000000/1000000 = 1
    AlphaDecay = 1000000 - 1000000 = 0
    BetaDecay = 1000000 - 1000000 = 0
    deltaRo = -1000000  (because sqrt(1000000*1000000) = 1000000, Negative sign indicates that it is going out of the system)
    Ro = 1000000
  Liquidity provider #1 has now received 1000000 Ro.
----------------------------------------------------------------------------------------------------------------
Now a participant(Swapper #1)comes along and wants to swap 10000 quote tokens for baseTokens.
Swapper #1 receives deltaX baseTokens, where:
  deltaY = 10000
  X'  = K / (Y + deltaY - (deltaY*liquidityFee))
  (Assuming liquidity fee is 30 Basis points)
  X' = 1000000000000 /(1000000 + 10000 -(10000*0.003)) = 990128.419656029387
  deltaX = 990128.419656029387 - 1000000 = -9871.580343970613 (The negative sign simply indicates that the baseTokens are going to the   swapper )
  Y' = Y + deltaY = 1000000 + 10000 = 1010000
  alpha' = alpha + deltaAlpha = 1000000 + (-9871.580343970613) = 990128.419656029387 ( Note: deltaX = deltaAlpha for swap events)
  beta' = beta + betaDecay = 1000000 + 10000 = 1010000 ( Note: deltaY = deltaBeta for swap events)
  alphaDecay' = alpha' - X' = 990128.419656029387 - 990128.419656029387 = 0
  betaDecay' = beta' - Y' = 1010000 - 1010000 = 0
  K' = X' * Y' = 990128.419656029387 * 1010000 = 1000029703852.58968
  feeAddress(ElasticDAO) recieves: ((deltaY/Y)*(liquidityFee/6)*Ro) = (10000*0.003*1000000)/(6 * 1000000)

Therefore, post 1st swap, the state of the AMM is:
  X = 990128.419656029387
  Alpha = 990128.419656029387
  Y = 1010000
  Beta = 1010000
  Omega = 990128.419656029387/1010000 = 0.98032516797626672
  Sigma = 990128.419656029387/1010000 = 0.98032516797626672
  AlphaDecay = 990128.419656029387 - 990128.419656029387 = 0
  BetaDecay = 1010000 - 1010000 =  0
  K = X*Y = 990128.419656029387 * 1010000 = 1000029703852.58968
  Ro = 1000000
  feeAddress(ElasticDAO) recieves: 5 Ro
   hence total Ro the feeAddress has 5 Ro

  (Note: Omega is equal to Sigma)
----------------------------------------------------------------------------------------------------------------
Now let's assume a positive rebase occurs such that there are now 25% more `baseTokens`, as a result of which:
  Alpha = 1.25 * 990128.419656029387 = 1237660.52457003673
  X = 990128.419656029387
  alphaDecay = alpha - X = 1237660.52457003673 - 990128.4196560293874 = 247532.104914007343
  Beta = 1010000
  Y = 1010000
  K = X*Y = 990128.419656029387 * 1010000 = 1000029703852.58968
  betaDecay = beta - Y = 1010000 - 1010000 =  0
  Omega = X/Y = 990128.419656029387/1010000 = 0.98032516797626672
  Sigma = Alpha/Beta = 1237660.52457003673 / 1010000 = 1.2254064599703334
  Ro = 1000000
  (Note: Non zero alphaDecay and Omega is no longer equal to Sigma)
----------------------------------------------------------------------------------------------------------------
Now a another participant (Swapper #2) comes along and wants to swap 10000 quote tokens for baseTokens.
Swapper #2 receives deltaX baseTokens, where:
  deltaY = 10000
  X' = K / (Y + deltaY - (deltaY*liquidityFee))
  (Assuming liquidity fee is 30 Basis points)
  X' = 1000029703852.58968 / (1010000 + 10000 - (10000*0.003)) =  980450.115054942479
  deltaX = 980450.115054942479 - 990128.419656029387 = -9678.304601086908
  Y' = Y + deltaY = 1010000 + 10000 = 1020000
  alpha' = alpha + deltaAlpha = 1237660.52457003673 + (-9678.304601086908) = 1227982.21996894982
  alphaDecay' = alpha' - x' = 1227982.21996894982 - 980450.115054942479 = 247532.104914007341
  beta' = 1010000 + 10000 = 1020000
  betaDecay' = 1020000 - 1020000 = 0
  K' = X' * Y' = 980450.115054942479 * 1020000 = 1000059117356.04133
  feeAddress(ElasticDAO) recieves: ((deltaY/Y)*(liquidityFee/6)*Ro): (10000 * 0.003 * 1000000)/(6 * 1010000)

Therefore, post 2nd swap, the state of the AMM is:
  X = 980450.115054942479
  Alpha = 1227982.21996894982
  Y = 1020000
  Beta = 1020000
  K = X * Y = 980450.115054942479 * 1020000 = 1000059117356.04133
  Omega = 980450.1150549424796 / 1020000 = 0.961225602995041647
  Sigma = 1227982.21996894982 / 1020000 = 1.20390413722446061
  AlphaDecay = 247532.104914007341
  BetaDecay = 0
  Ro = 1000000
  feeAddress(ElasticDAO) recieves: 4.9504950495049505 Ro,
    hence total Ro the feeAddress has 4.9504950495049505 + 5 = 9.9504950495049505 Ro
  (Note: The swap was unaffected by the occurrence of a rebase event prior to the trade(resulting in the presence of non-zero decay))
-------------------------------------------------------------------------------------------------------------------
Now liquidity provider #2 comes along and wants to do a SingleAssetEntry(this is now possible due to presence of alphaDecay), in this case the amount of quoteTokens required to be supplied to the AMM are deltaY, where:

  deltaY = alphaDecay / Omega = 247532.104914007341 / 0.961225602995041647 = 257517.178217821776

For which the liquidity tokens issued to liquidity provider #2 (deltaRo) are given by:
  deltaRo = (Ro/(1 - gamma)) * gamma
  where Gamma is given by,
    gamma = deltaY / Y / 2 * ( deltaX / alphaDecay ),
    where deltaX is given by,
      deltaX = deltaY * Omega,

  Therefore,
  deltaX =  257517.178217821776 * 0.961225602995041647 = 247532.104914007341
  gamma =  257517.178217821776 / 1020000 / 2 * (247532.104914007341 / 247532.104914007341 ) = 0.126233910891089106
  deltaRo = (1000000 / ( 1- 0.126233910891089106) * 0.126233910891089106 = 144471.057488424266
  X' = X + deltaX = 980450.115054942479 + 247532.104914007341 = 1227982.21996894982
  Y' = Y + deltaY = 1020000 + 257517.178217821776 = 1277517.17821782178
  deltaAlpha = 0
  alpha' = alpha + deltaAlpha = 1227982.21996894982 + 0
  deltaBeta = deltaY = 257517.178217821776
  alphaDecay' = alpha' - X' = 1227982.21996894982 - 1227982.21996894982 = 0
  betaDecay = 0
  beta' = beta + deltaBeta = 1020000 + 257517.178217821776 = 1277517.17821782178
  Sigma' = alpha' / beta' = 1227982.21996894982/1277517.17821782178 = 0.961225602995041643
  K' = X' * Y' = 1227982.21996894982 * 1277517.17821782178 = 1568768380556.38929
  Omega' = X' / Y' = 1227982.21996894982/1277517.17821782178 = 0.961225602995041643
  Ro' = Ro + deltaRo = 1000000 + 144471.057488424266 = 1144471.05748842427



Therefore at the end of the SingleAssetEntry the state of the AMM is:
  X = 1227982.21996894982
  Y = 1277517.17821782178
  K = 1568768380556.38929
  Alpha = 1227982.21996894982
  Beta = 1277517.17821782178
  Omega = 0.961225602995041643
  Sigma = 0.961225602995041643
  alphaDecay = 0
  betaDecay = 0
  Ro = 1144471.05748842427
  (Note: Omega = Sigma, which is expected behaviour)

-------------------------------------------------------------------------------------------------------------------
Now, liquidity provider #2 decides to withdraw all of his liquidity, he receives a certain amount of baseTokens and quoteTokens, given by:

  deltaX = alpha * deltaRo / Ro
  deltaY = beta * deltaRo / Ro

  Where,
    deltaX - The amount of baseTokens received
    deltaY - The amount of quoteTokens received
    deltaRo - The number of liquidity tokens to be redeemed - here it is all that he had initially received

  Hence we get,
    deltaRo = (-1) * 144471.057488424266 = -144471.057488424266
    deltaX = 1227982.21996894982 * (-144471.057488424266) / 1144471.05748842427 = -155012.998131402192
    deltaY = 1277517.17821782178 * (-144471.057488424266) / 1144471.05748842427 = -161265.989636984114
    (Note: (-1) is because the  deltaRo is being redeemed for underlying quantities of deltaX and deltaY)
    deltaX = deltaAlpha
    deltaY = deltaBeta

    X' = X + deltaX = 1227982.21996894982 + (-155012.998131402192) = 1072969.22183754763
    Y' = Y + deltaY = 1277517.17821782178 + (-161265.989636984114) = 1116251.18858083767
    K' = X'* Y' = 1072969.22183754763 * 1116251.18858083767 = 1197703169186.81903
    Ro' = Ro + deltaRo = 1144471.05748842427 + (-144471.057488424266) = 1000000
    alpha' = alpha + deltaAlpha = 1227982.21996894982 + (-155012.998131402192) = 1072969.22183754763
    beta' = beta + deltaBeta = 1277517.17821782178 + (-161265.989636984114) = 1116251.18858083767
    Sigma' = alpha'/ beta' = 1072969.22183754763 /1116251.18858083767 = 0.961225602995041641
    Omega' = X'/Y' = 1072969.22183754763/1116251.18858083767 = 0.961225602995041641
    alphaDecay' = alpha' - X' = 1072969.22183754763 - 1072969.22183754763 = 0
    betaDecay = beta' - Y' =  1116251.18858083767 - 1116251.18858083767 = 0
    //(Note: Omega' = Omega = Sigma' = Sigma , this is expected behaviour)

  Therefore at the end of the redemption of liquidity tokens event the state of the AMM is:
    X = 1072969.22183754763
    Y = 1116251.18858083767
    K = 1197703169186.81903
    alpha = 1072969.22183754763
    beta = 1116251.18858083767
    Omega = 0.961225602995041641
    Sigma =  0.961225602995041641
    alphaDecay = 0
    betaDecay = 0
    Ro = 1000000
  And LP #2 has received,
    baseTokens = 155012.998131402192
    quoteTokens = 161265.989636984114

-------------------------------------------------------------------------------------------------------------------
Now, liquidity provider #1 decides to withdraw all of his liquidity, he receives a certain amount of baseTokens and quoteTokens, given by:

  deltaX = alpha * deltaRo / Ro
  deltaY = beta * deltaRo / Ro

  Where,
    deltaX - The amount of baseTokens received
    deltaY - The amount of quoteTokens received
    deltaRo - The number of liquidity tokens to be redeemed - here it is all that he had initially received

  Hence we get,
    deltaRo = (-1) * 1000000 = -1000000
    deltaX = 1072969.22183754763 * (-1000000)/1000000 = -1072969.22183754763
    deltaY = 1116251.18858083767 * (-1000000)/1000000 = -1116251.18858083767
    (Note: (-1) is because the  deltaRo is being redeemed for underlying quantities of deltaX and deltaY)

  Hence LP#1 receives 1072969.22183754763 amount of baseTokens and 1116251.18858083767 amount of quoteTokens, he has benefitted from the trades(accrual of fees) and the rebase event.

  LP#1 initial v final state:
  baseTokens -> final - initial = 1072969.22183754763 - 1000000 = 72969.22183754763
  quoteTokens -> final - initial = 1116251.18858083767 - 1000000 = 116251.18858083767


```
