# Arbitrage Strategies

To keep $L + S = 1 preCT$, when the price of $L$ or $S$ moves in one pool, price movement needs to occur in the opposite direction in the other pool.

Much like how natural arbitrage opportunities keep the price of Bitcoin balanced across exchanges, there are natural arbitrage opportunities which keep $1 L + 1 S = 1 preCT$.

Arbitrageurs can execute these arbitrage opportunities atomically without taking any market position.

## Redeem Strategy

The **redeem** strategy is used when $1 L + 1 S < 1 preCT.$

In strategy, the arbitrageur purchases $n(L + S)$ for $<n(preCT)$ from their respective pools.

The arbitrageur then redeems the $n(L + S)$ for $n(preCT)$ directly from the market, booking a profit.

By executing the redeem strategy arbitrageurs push the prices of $L$ and $S$ up, until $1 L + 1 S = 1 preCT$.

The amount of $preCT$ to redeem that will perfectly balance the pools can be derived by solving this equation for $n$

- $C_l$ (Long Pool $preCT$ Reserves)
- $M_l$ (Long Pool Virtual $L$ Reserves)
- $C_s$ (Short Pool $preCT$ Reserves)
- $M_s$ (Short Pool Virtual $S$ Reserves)
- $F$ (Swap fee)

$$$
\frac{M_l * C_l}{(M_l - n(1 - F))^2} + \frac{M_s * C_s}{(M_s - n(1 - F))^2} = 1
$$$

## Mint Strategy

The **mint** strategy is used when $1 L + 1 S > 1 preCT.$

In this strategy, an arbitrageur mints $n(L + S)$ for $n(preCT)$ directly from the market.

The arbitrageur then sells the $n(L + S)$ for $> n(preCT)$ to their respective pools, booking a profit.

By executing the mint strategy arbitrageurs push the prices of $L$ and $S$ down, until $1 L + 1 S = 1 preCT$.

The amount of $preCT$ to mint that will perfectly balance the pools can be derived by solving this equation for $n$

$$$
\frac{M_l * C_l}{(M_l + n(1 - F))^2} + \frac{M_s * C_s}{(M_s + n(1 - F))^2} = 1
$$$

## Automation

These types of strategy are best automated.

prePO will release an open-source arbitrage bot capable of executing these strategies prior to launching.
