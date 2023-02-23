---
title: Sushi Trident contest phase 2
sponsor: Sushi
slug: 2021-09-sushitrident-2
date: 2021-11-30
findings: https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues
contest: 35
---


# Overview

## About C4

Code4rena (C4) is an open organization consisting of security researchers, auditors, developers, and individuals with domain expertise in smart contracts.

A C4 code contest is an event in which community participants, referred to as Wardens, review, audit, or analyze smart contract logic in exchange for a bounty provided by sponsoring projects.

During the code contest outlined in this document, C4 conducted an analysis of Sushi Trident smart contract system written in Solidity. The code contest took place between September 30—October 6 2021.

## Wardens

8 Wardens contributed reports to the Sushi Trident contest  (phase 2):

1. [cmichel](https://twitter.com/cmichelio)
2. broccoli ([shw](https://github.com/x9453) and [jonah1005](https://twitter.com/jonah1005w))
3. [0xsanson](https://github.com/0xsanson)
4. [hickuphh3](https://twitter.com/HickupH)
5. [pauliax](https://twitter.com/SolidityDev)
6. WatchPug ([jtp](https://github.com/jack-the-pug) and [ming](https://github.com/mingwatch))

This contest was judged by [Alberto Cuesta Cañada](https://twitter.com/alcueca).

Final report assembled by [moneylegobatman](https://twitter.com/money_lego) and [CloudEllie](https://twitter.com/CloudEllie1).

# Summary

The C4 analysis yielded an aggregated total of 47 unique vulnerabilities and 63 total findings. All of the issues presented here are linked back to their original finding.

Of these vulnerabilities, 17 received a risk rating in the category of HIGH severity, 7 received a risk rating in the category of MEDIUM severity, and 23 received a risk rating in the category of LOW severity.

C4 analysis also identified 9 non-critical recommendations and 7 gas optimizations.

# Scope

The linkscode under review can be found within the [C4 Sushi Trident contest (phase 2) repository](https://github.com/code-423n4/2021-09-sushitrident-2), and is composed of 12 smart contracts written in the Solidity programming language.

# Severity Criteria

C4 assesses the severity of disclosed vulnerabilities according to a methodology based on [OWASP standards](https://owasp.org/www-community/OWASP_Risk_Rating_Methodology).

Vulnerabilities are divided into three primary risk categories: high, medium, and low.

High-level considerations for vulnerabilities span the following key areas when conducting assessments:

- Malicious Input Handling
- Escalation of privileges
- Arithmetic
- Gas use

Further information regarding the severity criteria referenced throughout the submission review process, please refer to the documentation provided on [the C4 website](https://code423n4.com).

# High Risk Findings (17)

## [[H-01] Unsafe cast in `ConcentratedLiquidityPool.burn` leads to attack](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/50)
_Submitted by cmichel, also found by broccoli_

The `ConcentratedLiquidityPool.burn` function performs an unsafe cast of a `uint128` type to a *signed* integer.

```solidity
(uint256 amount0fees, uint256 amount1fees) = _updatePosition(msg.sender, lower, upper, -int128(amount));
```

Note that `amount` is chosen by the caller and when choosing `amount = 2**128 - 1`, this is interpreted as `0xFFFFFFFFF... = -1` as a signed integer. Thus `-(-1)=1` adds 1 liquidity unit to the position

This allows an attacker to not only mint LP tokens for free but as this is the `burn` function it also redeems token0/1 amounts according to the unmodified `uint128` `amount` which is an extremely large value.

#### POC

I created this POC that implements a hardhat test and shows how to steal the pool tokens.

Choosing the correct `amount` of liquidity to burn and `lower, upper` ticks is not straight-forward because of two competing constraints:

1.  the `-int128(amount)` must be less than `MAX_TICK_LIQUIDITY` (see `_updatePosition`). This drives the the `amount` up to its max value (as the max `uint128` value is -1 => -(-1)=1 is very low)
2.  The redeemed `amount0, amount1` values must be less than the current pool balance as the transfers would otherwise fail. This drives the `amount` down. However, by choosing a smart `lower` and `upper` tick range we can redeem fewer tokens for the same liquidity.

[This example](https://gist.github.com/MrToph/1731dd6947073343cf6f942985d556a6) shows how to steal 99% of the `token0` pool reserves:

#### Impact

An attacker can steal the pool tokens.

#### Recommended Mitigation Steps

Even though Solidity 0.8.x is used, type casts do not throw an error.
A [`SafeCast` library](https://docs.openzeppelin.com/contracts/4.x/api/utils#SafeCast) must be used everywhere a typecast is done.

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/50)**

## [[H-02] Wrong usage of `positionId` in `ConcentratedLiquidityPoolManager`](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/86)
_Submitted by broccoli, also found by 0xsanson, cmichel, hickuphh3, and pauliax_

#### Impact
In the `subscribe` function of `ConcentratedLiquidityPoolManager`, the `incentive` to subscribed is determined as follows:

```solidity
Incentive memory incentive = incentives[pool][positionId];
```

However, `positionId` should be `incentiveId`, a counter that increases by one whenever a new incentive is added to the pool. The usage of `positionId` could cause the wrong incentive to be used, and in general, the incentive is not found, and the transaction reverts (the condition `block.timestamp < incentive.endTime` is not met). The `getReward` and `claimReward` functions have the bug of misusing `positionId` as the index of incentives.

#### Proof of Concept
Referenced code:
- [ConcentratedLiquidityPoolManager.sol#L68](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPoolManager.sol#L68)
- [ConcentratedLiquidityPoolManager.sol#L87](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPoolManager.sol#L87)
- [ConcentratedLiquidityPoolManager.sol#L105](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPoolManager.sol#L105)

#### Recommended Mitigation Steps
Change `positionId` to `incentiveId` in the referenced lines of code.

**[sarangparikh22 (Sushi) confirmed but disagreed with severity](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/86#issuecomment-940846279)**

## [[H-03] `ConcentratedLiquidityPoolManager`'s incentives can be stolen](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/37)
_Submitted by cmichel, also found by broccoli, hickuphh3, pauliax, and WatchPug_

The `ConcentratedLiquidityPoolManager` keeps all tokens for all incentives in the same contract. The `reclaimIncentive` function does not reduce the `incentive.rewardsUnclaimed` field and thus one can reclaim tokens several times.
This allows anyone to steal all tokens from all incentives by creating an incentive themself, and once it's expired, repeatedly claim the unclaimed rewards until the token balance is empty.

#### POC
*   Attacker creates an incentive for a non-existent pool using a random address for `pool` (This is done such that no other user can claim rewards as we need a non-zero `rewardsUnclaimed` balance for expiry). They choose the `incentive.token` to be the token they want to steal from other incentives. (for example, `WETH`, `USDC`, or `SUSHI`) They choose the `startTime, endTime, expiry` such that the checks pass, i.e., starting and ending in a few seconds from now, expiring in 5 weeks. Then they choose a non-zero `rewardsUnclaimed` and transfer the `incentive.token` to the `PoolManager`.
*   Attacker waits for 5 weeks until the incentive is expired
*   Attacker can now call `reclaimIncentive(pool, incentiveId, amount=incentive.rewardsUnclaimed, attacker, false)` to withdraw `incentive.rewardsUnclaimed` of `incentive.token` from the pool manager.
*   As the `incentive.rewardsUnclaimed` variable has not been decreased, they can keep calling `reclaimIncentive` until the pool is drained.

#### Impact
An attacker can steal all tokens in the `PoolManager`.

#### Recommended Mitigation Steps
In `reclaimIncentive`, reduce `incentive.rewardsUnclaimed` by the withdrawn `amount`.

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/37)**

## [[H-04] Overflow in the `mint` function of `ConcentratedLiquidityPool` causes LPs' funds to be stolen](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/84)
_Submitted by broccoli_

#### Impact
Similar to a previous finding in the `IndexPool` contract, the `mint` function of `ConcentratedLiquidityPool` allows integer overflows when checking the balance is larger or equal to the received amount of token plus the reserve. As a result, the attacker could get a large amount of liquidity but only provide a small number of tokens to the pool, effectively stealing other LPs' funds when burning his liquidity.

Notice that this bug is independent of another bug of incorrect casting `uint256` type to `uint128` in the `_getAmountsForLiquidity` function. Even if the previously mentioned bug does not exist, the attacker could still steal the funds in the pool by exploiting this bug.

#### Proof of Concept
1.  Suppose that the current price is at the tick `500000`, an attacker calls the `mint` function with the following parameters:

```solidity
mintParams.lower = 100000
mintParams.upper = 500000
mintParams.amount1Desired = (1 << 128) - 47541305835 # a carefully chosen number
mintParams.amount0Desired = 0
```
2.  Since the current price is equal to the upper price, we have

```solidity
_liquidity = mintParams.amount1Desired * (1 << 96) // (priceUpper - priceLower)
    = 4731732988155153573010127839
```
3.  The amounts of `token0` and `token1` that the attacker has to pay is

```solidity
amount0Actual = 0
amount1Actual = uint128(DyDxMath.getDy(_liquidity, priceLower, priceUpper, true))
    = uint128(_liquidity * (priceUpper - priceLower) // (1 << 96)) # round up
    = uint128(340282366920938463463374607384226905622)
    = 340282366920938463463374607384226905622
    = (1 << 128) - 47541305834
```
4.  As long as `reserve1` is greater than `47541305834`, the addition `amount1Actual + reserve1` overflows to a small number, causing the attacker to pass the balance check.

Referenced code:
- [ConcentratedLiquidityPool.sol#L204](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPool.sol#L204)
- [ConcentratedLiquidityPool.sol#L209](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPool.sol#L209)

#### Recommended Mitigation Steps
Consider removing the `unchecked` statement to check for integer overflow or casting both `amount1Actual` and `reserve1` to type `uint256` before adding them and comparing to the `_balance(token)`.

**[sarangparikh22 (Sushi) disputed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/84#issuecomment-954231077):**
 > The example is wrong, you can't add use upper tick as odd, correct the example and resubmit please.

## [[H-05] Incorrect usage of typecasting in `_getAmountsForLiquidity` lets an attacker steal funds from the pool](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/83)
_Submitted by broccoli_

#### Impact
The `_getAmountsForLiquidity` function of `ConcentratedLiquidityPool` explicitly converts the result of `DyDxMath.getDy` and `DyDxMath.getDx` from type `uint256` to type `uint128`. The explicit casting without checking whether the integer exceeds the maximum number (i.e., `type(uint128).max`) could cause incorrect results being used. Specifically, an attacker could exploit this bug to mint a large amount of liquidity but only pay a little of `token0` or `token1` to the pool and effectively steal other's funds when burning his liquidity.

#### Proof of Concept
1.  Suppose that the current price is at the tick `500000`, an attacker calls the `mint` function with the following parameters:

```solidity
mintParams.lower = 100000
mintParams.upper = 500000
mintParams.amount1Desired = (1 << 128) + 71914955423 # a carefully chosen number
mintParams.amount0Desired = 0
```
2.  Since the current price is equal to the upper price, we have

```solidity
_liquidity = mintParams.amount1Desired * (1 << 96) // (priceUpper - priceLower)
    = 4731732988155153573010127840
```
3.  The amounts of `token0` and `token1` that the attacker has to pay is

```solidity
amount0Actual = 0
amount1Actual = uint128(DyDxMath.getDy(_liquidity, priceLower, priceUpper, true))
    = uint128(_liquidity * (priceUpper - priceLower) // (1 << 96)) # round up
    = uint128(340282366920938463463374607456141861046)             # exceed the max
    = 24373649590                                                  # truncated
```
4.  The attacker only pays `24373649590` of `token1` to get `4731732988155153573010127840` of the liquidity, which he could burn to get more `token1`. As a result, the attacker is stealing the funds from the pool and could potentially drain it.

Referenced code:
- [ConcentratedLiquidityPool.sol#L480](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPool.sol#L480)
- [concentratedPool/DyDxMath.sol#L15](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/libraries/concentratedPool/DyDxMath.sol#L15)
- [concentratedPool/DyDxMath.sol#L30](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/libraries/concentratedPool/DyDxMath.sol#L30)

#### Recommended Mitigation Steps
Check whether the result of `DyDxMath.getDy` or `DyDxMath.getDx` exceeds `type(uint128).max` or not. If so, then revert the transaction. Or consider using the [`SafeCast` library](https://docs.openzeppelin.com/contracts/3.x/api/utils#SafeCast) from OpenZeppelin instead.

**[sarangparikh22 (Sushi) disputed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/83#issuecomment-954233068):**
 > The example is wrong, you can't add use upper tick as odd, correct the example and resubmit please.

**[alcueca (judge) commented](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/83#issuecomment-967016368):**
 > @sarangparikh22 (Sushi), could you confirm whether the casting to uint128 is known to be safe? Are you unconvinced of the issue?

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/83#issuecomment-970807633):**
 > @alcueca (judge) I can confirm casting to uint128 is not safe, and will lead to overflow. However, the example mentioned is wrong.

**[alcueca (judge) commented](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/83#issuecomment-972587273):**
 > Understood. I will uphold the severity 3 because the overflow happens in a critical function for the management of funds and an incorrect execution will likely lead to loss of funds.

## [[H-06] `ConcentratedLiquidityPosition.sol#collect()` Users may get double the amount of yield when they call `collect()` before `burn()`](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/53)
_Submitted by WatchPug_

When a user calls `ConcentratedLiquidityPosition.sol#collect()` to collect their yield, it calcuates the yield based on `position.pool.rangeFeeGrowth()` and `position.feeGrowthInside0, position.feeGrowthInside1`:

[`ConcentratedLiquidityPosition.sol#L75` L101](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPosition.sol#L75-L101)

When there are enough tokens in `bento.balanceOf`, it will not call `position.pool.collect()` to collect fees from the pool.

This makes the user who `collect()` their yield when there is enough balance to get double yield when they call `burn()` to remove liquidity. Because `burn()` will automatically collect fees on the pool contract.

#### Impact
The yield belongs to other users will be diluted.

#### Recommended Mitigation Steps
Consider making `ConcentratedLiquidityPosition.sol#burn()` call `position.pool.collect()` before `position.pool.burn()`. User will need to call `ConcentratedLiquidityPosition.sol#collect()` to collect unclaimed fees after `burn()`.

Or `ConcentratedLiquidityPosition.sol#collect()` can be changed into a `public` method and `ConcentratedLiquidityPosition.sol#burn()` can call it after `position.pool.burn()`.

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/53)**

## [[H-07] `ConcentratedLiquidityPosition.sol#burn()` Wrong implementation allows attackers to steal yield](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/52)
_Submitted by WatchPug_

When a user calls `ConcentratedLiquidityPosition.sol#burn()` to burn their liquidity, it calls `ConcentratedLiquidityPool.sol#burn()` -> `_updatePosition()`:

[`ConcentratedLiquidityPool.sol#L525` L553](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPool.sol#L525-L553)

The `_updatePosition()` function will return `amount0fees` and `amount1fees` of the whole position with the `lower` and `upper` tick and send them to the `recipient` alongside the burned liquidity amounts.

#### Proof of Concept
1.  Alice minted \$10000 worth of liquidity with `lower` and `upper` tick set to 99 and 199;
2.  Alice accumulated \$1000 worth of fee in token0 and token1;
3.  The attacker can mint a small amount (\$1 worth) of liquidity using the same `lower` and `upper` tick;
4.  The attacker calls `ConcentratedLiquidityPosition.sol#burn()` to steal all the unclaimed yield with the ticks of (99, 199) include the \$1000 worth of yield from Alice.

#### Recommended Mitigation Steps
Consider making `ConcentratedLiquidityPosition.sol#burn()` always use `address(this)` as `recipient` in:

```solidity
position.pool.burn(abi.encode(position.lower, position.upper, amount, recipient, unwrapBento));
```

and transfer proper amounts to the user.

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/52)**

## [[H-08] Wrong inequality when adding/removing liquidity in current price range](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/34)
_Submitted by cmichel_

The `ConcentratedLiquidityPool.mint/burn` functions add/remove `liquidity` when `(priceLower < currentPrice && currentPrice < priceUpper)`.
Shouldn't it also be changed if `priceLower == currentPrice`?

#### Impact
Pools that mint/burn liquidity at a time where the `currentPrice` is right at the lower price range do not work correctly and will lead to wrong swap amounts.

#### Recommended Mitigation Steps
Change the inequalities to `if (priceLower <= currentPrice && currentPrice < priceUpper)`.

**[sarangparikh22 (Sushi) disputed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/34#issuecomment-942790793):**
 > You shouldn't be able to reach this, can you produce a POC?

**[alcueca (judge) commented](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/34#issuecomment-967792671):**
 > @sarangparikh22 (Sushi), could you please elaborate on why this is not reachable?

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/34#issuecomment-970749777):**
 > I confused this with another similar issue, my apologies, took a look at this, and this a valid issue, we should probably even bump the severity to Sev 3, not sure if I am allowed to do so haha, I created a PoC in which users can actually loose funds, when they add liquidity in that specific range. @alcueca (judge)

**[alcueca (judge) commented](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/34#issuecomment-972590913):**
 > Sponsors are allowed to bump up severity, and I've done it myself in my past as a sponsor as well.

## [[H-09] range fee growth underflow](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/25)
_Submitted by broccoli_

#### Impact
The function `RangeFeeGrowth` ([ConcentratedLiquidityPool.sol#L601-L633](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPool.sol#L601-L633)) would revert the transaction in some cases.

When a pool cross a tick, it only updates either `feeGrowthOutside0` or `feeGrowthOutside1`. [Ticks.sol#L23-L53](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/libraries/concentratedPool/Ticks.sol#L23-L53)

`RangeFeeGrowth` calculates the fee as follow:

```solidity
    feeGrowthInside0 = _feeGrowthGlobal0 - feeGrowthBelow0 - feeGrowthAbove0;
    feeGrowthInside1 = _feeGrowthGlobal1 - feeGrowthBelow1 - feeGrowthAbove1;
```

`feeGrowthBelow + feeGrowthAbove` is not necessary smaller than `_feeGrowthGlobal`. Please see `POC`.

Users can not provide liquidity or burn liquidity. Fund will get stocked in the contract. I consider this is a high-risk issue.

#### Proof of Concept
```python
    # This is the wrapper.
    # def add_liquidity(pool, amount, lower, upper)
    # def swap(pool, buy, amount)

    add_liquidity(pool, deposit_amount, -800, 500)
    add_liquidity(pool, deposit_amount, 400, 700)
    # We cross the tick here to trigger the bug.

    swap(pool, False, deposit_amount)
    # Only tick 700's feeGrowthOutside1 is updated

    swap(pool, True, deposit_amount)
    # Only tick 500's feeGrowthOutside0 is updated

    # current tick at -800

    # this would revert
    # feeGrowthBelow1 = feeGrowthGlobal1
    # feeGrowthGlobal1 - feeGrowthBelow1 - feeGrowthAbove1 would revert
    # user would not be able to mint/withdraw/cross this tick. The pool is broken
    add_liquidity(pool, deposit_amount, 400, 700)
```

#### Tools Used
Hardhat

#### Recommended Mitigation Steps
It's either modify the tick's algo or `RangeFeeGrowth`. The quick-fix I come up with is to deal with the fee in `RangeFeeGrowth`. However, I recommend the team to go through tick's logic again.

**[sarangparikh22 (Sushi) disputed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/25#issuecomment-942800266):**
 > The example is wrong, you can't add use upper tick as odd, correct the example and resubmit please.

**[alcueca (judge) commented](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/25#issuecomment-967128882):**
 > @sarangparikh22 (Sushi), is the example invalid, or the whole issue? Is this something that you would consider fixing?

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/25#issuecomment-972242461):**
 > @alcueca (judge) The example is invalid, but the issue is valid, the fix is to swap the condition of feeGrowthGlobal

## [[H-10] `ConcentratedLiquidityPool.burn()` Wrong implementation](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/24)
_Submitted by WatchPug_

The reserves should be updated once LP tokens are burned to match the actual total bento shares hold by the pool.

However, the current implementation only updated reserves with the fees subtracted.

Makes the `reserve0` and `reserve1` smaller than the current `balance0` and `balance1`.

#### Impact
As a result, many essential features of the contract will malfunction, includes `swap()` and `mint()`.

#### Recommended Mitigation Steps

[`ConcentratedLiquidityPool.sol#L263` L267](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPool.sol#L263-L267)
Change:

```solidity
unchecked {
    reserve0 -= uint128(amount0fees);
    reserve1 -= uint128(amount1fees);
}

```

to:
```solidity
unchecked {
    reserve0 -= uint128(amount0);
    reserve1 -= uint128(amount1);
}
```

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/24)**

## [[H-11] ConcentratedLiquidityPool: incorrect `feeGrowthGlobal` accounting when crossing ticks](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/16)
_Submitted by hickuphh3_

##### Impact
Swap fees are taken from the output. Hence, if swapping token0 for token1 (`zeroForOne` is true), then fees are taken in token1. We see this to be the case in the initialization of `feeGrowthGlobal` in the swap cache

`feeGrowthGlobal = zeroForOne ? feeGrowthGlobal1 : feeGrowthGlobal0;`

and in `_updateFees()`.

However, looking at `Ticks.cross()`, the logic is the reverse, which causes wrong fee accounting.

```jsx
if (zeroForOne) {
	...
	ticks[nextTickToCross].feeGrowthOutside0 = feeGrowthGlobal - ticks[nextTickToCross].feeGrowthOutside0;
} else {
	...
	ticks[nextTickToCross].feeGrowthOutside1 = feeGrowthGlobal - ticks[nextTickToCross].feeGrowthOutside1;
}
```

##### Recommended Mitigation Steps
Switch the `0` and `1` in `Ticks.cross()`.

```jsx
if (zeroForOne) {
	...
	// `feeGrowthGlobal` = feeGrowthGlobal1
	ticks[nextTickToCross].feeGrowthOutside1 = feeGrowthGlobal - ticks[nextTickToCross].feeGrowthOutside1;
} else {
	...
	// feeGrowthGlobal = feeGrowthGlobal0
	ticks[nextTickToCross].feeGrowthOutside0 = feeGrowthGlobal - ticks[nextTickToCross].feeGrowthOutside0;
}
```

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/16)**

## [[H-12] `ConcentratedLiquidityPool`: `secondsPerLiquidity` should be modified whenever pool liquidity changes](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/15)
_Submitted by hickuphh3_

##### Impact
`secondsPerLiquidity` is updated as such: `secondsPerLiquidity += uint160((diff << 128) / liquidity);` where `diff = timestamp - uint256(lastObservation)`. Hence, whenever liquidity changes, `secondsPerLiquidity` should be updated prior to the change.

In particular, this affects the `mint()` and `burn()` functions, in the case where liquidity changes when `lowerTick <= currentTick < upperTick`.

In fact, the latest `secondsPerLiquidity` value should be calculated and used in `Ticks.insert()`. For comparison, notice how UniswapV3 fetches the latest value by calling `observations.observeSingle()` in its `_updatePosition()` function.

##### Recommended Mitigation Steps
The `secondsPerLiquidity` increment logic should be applied prior to liquidity addition in `mint()` and removal in `burn()`.

```jsx
// insert logic before these lines in mint()
unchecked {
  if (priceLower < currentPrice && currentPrice < priceUpper) liquidity += uint128(_liquidity);
}

nearestTick = Ticks.insert(
ticks,
feeGrowthGlobal0,
feeGrowthGlobal1,
secondsPerLiquidity, // should calculate and use latest secondsPerLiquidity value
    ...
);

// insert logic before before these lines in burn()
unchecked {
  if (priceLower < currentPrice && currentPrice < priceUpper) liquidity -= amount;
}
```

**[sarangparikh22 (Sushi) disputed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/15#issuecomment-954274917):**
 > The secondsPerLiquidity is same, changing the order of that will not affect anything, since it is not getting calculated at the mint or burn function.

**[alcueca (judge) commented](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/15#issuecomment-967159284):**
 > @sarangparikh22 (Sushi), could you please elaborate on why this isn't an issue?

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/15#issuecomment-970862817):**
 > @alcueca (judge) my apologies, this is an issue. I could confirm this.

## [[H-13] Burning does not update reserves](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/51)
_Submitted by cmichel, also found by 0xsanson, broccoli, and pauliax_

The `ConcentratedLiquidityPool.burn` function sends out `amount0`/`amount1` tokens but only updates the reserves by decreasing it by the **fees of these amounts**.

```solidity
unchecked {
    // @audit decreases by fees only, not by amount0/amount1
    reserve0 -= uint128(amount0fees);
    reserve1 -= uint128(amount1fees);
}
```

This leads to the pool having wrong reserves after any `burn` action.
The pool's balance will be much lower than the reserve variables.

#### Impact
As the pool's actual balance will be much lower than the reserve variables, `mint`ing and `swap`ing will not work correctly either.
This is because of the `amount0Actual + reserve0 <= _balance(token0)` check in `mint` using a much higher `reserve0` amount than the actual balance (already including the transferred assets from the user). An LP provider will have to make up for the missing reserve decrease from `burn` and pay more tokens.

The same holds true for `swap` which performs the same check in `_updateReserves`.

The pool essentially becomes unusable after a `burn` as LPs / traders need to pay more tokens.

#### Recommended Mitigation Steps
The reserve should be decreased by what is transferred out. In `burn`'s case this is `amount0` / `amount1`.

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/51)**

## [[H-14] `ConcentratedLiquidityPool`: `rangeFeeGrowth` and `secondsPerLiquidity` math needs to be unchecked](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/13)
_Submitted by hickuphh3_

##### Impact
The fee growth mechanism, and by extension, `secondsPerLiquidity` mechanism of Uniswap V3 has the ability to underflow. It is therefore a necessity for the math to (ironically) be unsafe / unchecked.

##### Proof of Concept

Assume the following scenario and initial conditions:

*   Price at parity (nearestTick is 0)
*   tickSpacing of 10
*   Swaps only increase the price (nearestTick moves up only)
*   `feeGrowthGlobal` initializes with 0, increases by 1 for every tick moved for simplicity
*   Existing positions that provide enough liquidity and enable nearestTick to be set to values in the example
*   Every tick initialized in the example is ≤ nearestTick, so that its `feeGrowthOutside` = `feeGrowthGlobal`

1.  When nearestTick is at 40, Alice creates a position for uninitialised ticks \[-20, 30]. The ticks are initialized, resulting in their `feeGrowthOutside` values to be set to 40.
2.  nearestTick moves to 50. Bob creates a position with ticks \[20, 30] (tick 20 is uninitialised, 30 was initialized from Alice's mint). tick 20 will therefore have a `feeGrowthOutside` of 50.
3.  Let us calculate `rangeFeeGrowth(20,30)`.
    *   lowerTick = 20, upperTick = 30
    *   feeGrowthBelow = 50 (lowerTick's `feeGrowthOutside`) since lowerTick < currentTick
    *   feeGrowthAbove = 50 - 40 = 10 (feeGrowthGlobal - upperTick's `feeGrowthOutside`) since upperTick < currentTick
    *   feeGrowthInside

        \= feeGrowthGlobal - feeGrowthBelow - feeGrowthAbove

        \= 50 - 50 - 10

        \= -10

We therefore have negative `feeGrowthInside`.

This behaviour is actually acceptable, because the important thing about this mechanism is the relative values to each other, not the absolute values themselves.

##### Recommended Mitigation Steps
`rangeFeeGrowth()` and `rangeSecondsInside()` has to be unchecked. In addition, the subtraction of `feeGrowthInside` values should also be unchecked in `_updatePosition()` and `ConcentratedLiquidityPosition#collect()`.

The same also applies for the subtraction of `pool.rangeSecondsInside` and `stake.secondsInsideLast` in `claimReward()` and `getReward()` of the `ConcentratedLiquidityPoolManager` contract.

**[sarangparikh22 (Sushi) disputed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/13#issuecomment-962142019):**
 > Can you give more elaborate example.

**[alcueca (judge) commented](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/13#issuecomment-967134083):**
 > @sarangparikh22 (Sushi), I find the example quite elaborate. It shows an specific example in which underflow is desired, by comparing with other platform using similar mechanics. It explains that with your current implementation you can't have negative `feeGrowthInside`, which is a possible and acceptable scenario. Could you please elaborate on what your grounds are for disputing this finding?

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/13#issuecomment-972200918):**
 > @alcueca (judge) Yes this a valid issue.

## [[H-15] `ConcentratedLiquidityPool`: `initialPrice` should be checked to be within allowable range](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/11)
_Submitted by hickuphh3_

##### Impact
No check is performed for the initial price. This means that it can be set to be below the `MIN_SQRT_RATIO` or above `MAX_SQRT_RATIO` (Eg. zero value), which will prevent the usability of all other functions (minting, swapping, burning).

For example, `Ticks.insert()` would fail when attempting to calculate `actualNearestTick = TickMath.getTickAtSqrtRatio(currentPrice);`, which means no one will be able to mint positions.

##### Recommended Mitigation Steps
Check the `initialPrice` is within the acceptable range, ie. `MIN_SQRT_RATIO <= initialPrice <= MAX_SQRT_RATIO`

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/11)**

## [[H-16] Possible attacks on Seconds * Liquidity calculation](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/8)

This is a possible line of attack on the staking contract, in particular the `claimReward()` function: [`ConcentratedLiquidityPoolManager.sol#L90` L94](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPoolManager.sol#L90-L94)

1.  A user with some spare capital mints a liquidity position with a very tight range (1-2 ticks wide) at the current price. Because the range is so small, his position.liquidity on his NFT is large (DyDxMath.sol).

2.  The user then sets up a bot to frontrun any price changes that someone else tries to do, burning his position after claiming rewards. He then mints a new liquidity position at the new price after the other persons trades go through.

3.  Rinse and repeat this process. If done correctly, no funds are at risk from the bot owner, he doesn't pay any fees for burning/minting either.

So what you have left is a sequence of positions with high position.liquidity and in the correct price range all the time, without taking on any risk. Thereby stealing incentive funds.

The lines below reward the bot owner with a large amount of the token:

[`ConcentratedLiquidityPoolManager.sol#L90` L94](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPoolManager.sol#L90-L94)
Recommendation:

Lock the positions during a set time while they are staked.

**[sarangparikh22 (Sushi) disputed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/8#issuecomment-954283114):**
 > This seems very unlikely to happen and does not affect the pool, it's equivalent to just re balancing your position.

**[alcueca (judge) commented](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/8#issuecomment-967138536):**
 > @sarangparikh22 (Sushi), Isn't the warden describing a Just In Time liquidity pattern?

**[sarangparikh22 (Sushi) acknowledged](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/8#issuecomment-970872759):**
 > @alcueca (judge) yes exactly, even done right, the bot would still face huge IL. We don't intend to solve this.

## [[H-17] Understanding the fee growth mechanism (why `nearestTick` is unsuitable)](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/1)
_Submitted by hickuphh3_

#### Introduction
Uniswap V3's whitepaper describes the fee growth mechanism, but the intuition behind it is not explained well (IMO). I've not been able to find any material that tries to describe it, so allow me the luxury of doing so. It is crucial to understand how it works, so that other issues regarding the fee growth variables (and by extension, secondsPerLiquidity) raised by fellow wardens / auditors are better understood by readers.

#### Objective
We want a way to accurately track the fees accumulated by a position. Fees should only be given to the position it is active (the current tick / price is within the lower and upper ticks of the position).

#### feeGrowthGlobal

Defined as the total amount of fees that would have been earned by 1 unit of unbounded liquidity that was deposited when the contract was first initialized. For simplicity, we can take this to be the range between `MIN_TICK` and `MAX_TICK`. We represent it visually like this:

```jsx
// <-------------------------------------------------------------------------->
// MIN_TICK                                                               MAX_TICK
```

#### feeGrowthOutside

The fee growth per unit of liquidity on the *other* side of this tick (relative to the current tick). What does this mean?

As defined, it is the fee growth **relative** to the current tick. Based on the convention, we define 2 cases:

*   Case 1: initialized tick ≤ pool tick
*   Case 2: Initialized tick > pool tick

Visually, the feeGrowthOutside will look like this:

```jsx
// CASE 1
// <--------------------|--------------------|
// MIN_TICK         INIT_TICK            POOL_TICK
// <-----------------------------------------|
// MIN_TICK                        INIT_TICK = POOL_TICK

// CASE 2
//                                           |--------------------|---------------->
//                                       POOL_TICK           INIT_TICK          MAX_TICK
```

Hence, regardless of whether the tick to initialize is either a lower or upper tick of a position, the `feeGrowthOutside` value that it is referring to is **relatve** to the pool tick.

In other words, if initialized tick ≤ pool tick, then its `feeGrowthOutside` is towards `MIN_TICK`. Otherwise, its `feeGrowthOutside` is towards `MAX_TICK`.

##### Initialization

By convention, when a tick is initialized, all fee growth is assumed to happen below it. Hence, the feeGrowthOutside is initialized to the following values:

*   Case 1: tick's feeGrowthOutside = feeGrowthGlobal
*   Case 2: tick's feeGrowthOtuside = 0

#### Implications

One should now understand why the `feeGrowthOutside` value is being flipped when crossing a tick, ie. `tick.feeGrowthOutside = feeGrowthGlobal - tick.feeGrowthOutside` in `Tick.cross()`, because it needs to follow the definition. (Case 1 becomes case 2 and vice versa).

It should hopefully become clear why **using `nearestTick` as the reference point for fee growth calculations instead of the pool tick might not a wise choice.** (Case 1 and 2 becomes rather ambiguous).

#### Range fee growth / feeGrowthInside

Going back to our objective of calculating the fee growth accumulated for a position, we can break it down into 3 cases (take caution with the boundary cases), and understand how their values are calculated. In general, we take it to be feeGrowthGlobal - fee growth below lower tick - fee growth above upper tick (see illustrations), although it can be simplified further.

1.  pool tick < lower tick

    ```jsx
    // ---------------------|---------------------|-----------------|-----------------
    //                  POOL_TICK            LOWER_TICK          UPPER_TICK
    // <---------------------------- feeGrowthGlobal -------------------------------->
    //       LOWER_TICK.feeGrowthOutside (CASE 2) |---------------------------------->
    //                         UPPER_TICK.feeGrowthOutside (CASE 2) |---------------->

    // we want the range between LOWER_TICK and UPPER_TICK
    // = LOWER_TICK.feeGrowthOutside - UPPER_TICK.feeGrowthOutside

    // alternatively, following the general formula, it is
    // = feeGrowthGLobal - fee growth below LOWER_TICK - fee growth above UPPER_TICK
    // = feeGrowthGlobal - (feeGrowthGlobal - LOWER_TICK.feeGrowthOutside) - UPPER_TICK.feeGrowthOtuside
    // = LOWER_TICK.feeGrowthOutside - UPPER_TICK.feeGrowthOutside
    ```

2.  lower tick ≤ pool tick < upper tick

    ```jsx
    // ---------------------|---------------------|-----------------|-----------------
    //                  LOWER_TICK            POOL_TICK        UPPER_TICK
    // <---------------------------- feeGrowthGlobal -------------------------------->
    // <--------------------| LOWER_TICK's feeGrowthOutside (CASE 1)
    //                       UPPER_TICK's feeGrowthOutside (CASE 2) |---------------->

    // we want the range between LOWER_TICK and UPPER_TICK
    // = feeGrowthGLobal - fee growth below LOWER_TICK - fee growth above UPPER_TICK
    // = feeGrowthGLobal - LOWER_TICK.feeGrowthOutside - UPPER_TICK.feeGrowthOutside
    ```

3.  upper tick ≤ pool tick

    ```jsx
    // ---------------------|---------------------|-----------------|-----------------
    //                  LOWER_TICK            POOL_TICK        UPPER_TICK
    // <---------------------------- feeGrowthGlobal -------------------------------->
    // <--------------------| LOWER_TICK's feeGrowthOutside (CASE 1)
    // <------------------------------------------------------------| UPPER_TICK's feeGrowthOutside (CASE 1)

    // we want the range between LOWER_TICK and UPPER_TICK
    // = UPPER_TICK.feeGrowthOutside - LOWER_TICK.feeGrowthOutside

    // alternatively, following the general formula, it is
    // = feeGrowthGLobal - fee growth below LOWER_TICK - fee growth above UPPER_TICK
    // = feeGrowthGLobal - LOWER_TICK.feeGrowthOutside - (feeGrowthGlobal - UPPER_TICK.feeGrowthOutside)
    // = UPPER_TICK.feeGrowthOutside - LOWER_TICK.feeGrowthOutside
    ```

#### Handling The Boundary Case

An under appreciated, but very critical line of Uniswap V3's pool contract is the following:

`state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext;`

It serves a dual purpose:

1.  Because of how Tick Bitmap works, the tick needs to be manually decremented by 1 so that the next tick to be found is in the next word.
2.  More importantly, it handles the boundary case, where `zeroForOne` is true (pool tick goes down). In this scenario, case 1 becomes case 2 when the tick is crossed. However, should the poolTick after the swap be equal to `step.tickNext`, then when calculating fee growth inside a position that so happens to have `step.tickNext` as one of its ticks, it will be treated as case 1 (poolTick = lowerTick / upperTick) when it is required to be treated as case 2.

#### Impact
Hopefully, this writeup helps readers understand the fee growth mechanism and its workings. More importantly, I hope it helps the team to understand why using `nearestTick` as the reference point for fee growth mechanism is unsuitable. Specifically, we have 2 high severity issues:

*   Wrong initialization value of `feeGrowthOutside` in the case either the lower or upper tick becomes the `nearestTick` upon insertion of a new tick.
    *   You are (in a sense) crossing the old nearestTick, so its `secondsPerLiquidityOutside` has to be flipped
    *   The lower / upper tick's `feeGrowthOutside` is incorrectly initialized to be `0` when it should be `feeGrowthOutside`
*   Case 1 and 2 becomes ambiguous. When a position is modified with either tick being `nearestTick`, it is treated to be case 1 when in fact there are times it should be treated as case 2.

#### Recommended Mitigation Steps
Having a pool tick counter that closely matches the current pool price is rather critical for fee growth and seconds per liquidity initializations / calculations.

Where relevant, the `nearestTick` should be replaced by `poolTick`.

**[sarangparikh22 (Sushi) acknowledged](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/1)**

# Medium Risk Findings (7)

## [[M-01] Incentive should check that it hasn't started yet](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/42)
_Submitted by cmichel, also found by pauliax_

The `ConcentratedLiquidityPoolManager.addIncentive` function can add an incentive that already has a non-zero `incentive.secondsClaimed`.

#### Impact
Rewards will be wrong.

#### Recommended Mitigation Steps
Add a check: `require(incentive.secondsClaimed == 0, "!secondsClaimed")`.

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/42)**

**[alcueca (judge) commented](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/42#issuecomment-966994095):**
 > Assets are at risk after a wrong governance action. Severity 2.

## [[M-02] Cannot claim reward](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/41)
_Submitted by cmichel, also found by 0xsanson, broccoli, hickuphh3, and WatchPug_

The `ConcentratedLiquidityPoolManager.claimReward` requires `stake.initialized` but it is never set.
It also performs a strange computation as `128 - incentive.secondsClaimed` which will almost always underflow and revert the transaction.

#### Impact
One cannot claim rewards.

#### Recommended Mitigation Steps
Rethink how claiming rewards should work.

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/41)**

## [[M-03] `ConcentratedLiquidityPoolHelper`: `getTickState()` might run out of gas](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/17)
_Submitted by hickuphh3, also found by cmichel_

##### Impact
`getTickState()` attempts to fetch the state of all inserted ticks (including `MIN_TICK` and `MAX_TICK`) of a pool. Depending on the tick spacing, this function may run out of gas.

##### Recommended Mitigation Steps
Have a starting index parameter to start the iteration from. Also, `tickCount` can be made use of more meaningfully to limit the number of iterations performed.

```jsx
function getTickState(
	IConcentratedLiquidityPool pool,
	int24 startIndex,
	uint24 tickCount
) external view returns (SimpleTick[] memory) {
  SimpleTick[] memory ticks = new SimpleTick[](tickCount);

  IConcentratedLiquidityPool.Tick memory tick;
	int24 current = startIndex;

	for (uint24 i; i < tickCount; i++) {
		tick = pool.ticks(current);
		ticks[i] = SimpleTick({index: current, liquidity: tick.liquidity});
		// reached end of linked list, exit loop
		if (current == TickMath.MAX_TICK) break;
		// else, continue with next iteration
		current = tick.nextTick;
	}

  return ticks;
}
```

**[sarangparikh22 (Sushi) acknowledged](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/17)**

**[alcueca (judge) commented](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/17#issuecomment-967004172):**
 > Functionality is affected, severity 2.

## [[M-04] Users cannot receive rewards from `ConcentratedLiquidityPoolManager` if their liquidity is too large](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/88)
_Submitted by broccoli_

#### Impact
There could be an integer underflow error when the reward of an incentive is claimed, forcing users to wait for a sufficient period or reduce their liquidity to claim the rewards.

#### Proof of Concept
The unclaimed reward that a user could claim is proportional to the `secondsInside`, which is, in fact, proportional to the position's liquidity. It is possible that the liquidity is too large and causes `secondsInside` to be larger than `secondsUnclaimed`. As a result, the rewards that the user wants to claim exceed the `incentive.rewardsUnclaimed` and causes an integer underflow error, which prevents him from getting the rewards.

Referenced code:
- [ConcentratedLiquidityPoolManager.sol#L94-L95](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPoolManager.sol#L94-L95)

#### Recommended Mitigation Steps
Check whether the `rewards` exceeds the `incentive.rewardsUnclaimed`. If so, then send only `incentive.rewardsUnclaimed` amount of rewards to the user.

**[sarangparikh22 (Sushi) acknowledged](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/88#issuecomment-942705593):**
 > The problem seems very unlikely to happen, would be great to see a POC.

## [[M-05] `TridentNFT.permit` should always check `recoveredAddress != 0`](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/44)
_Submitted by cmichel, also found by pauliax_

The `TridentNFT.permit` function ignores the `recoveredAddress != 0` check if `isApprovedForAll[owner][recoveredAddress]` is true.

#### Impact
If a user accidentally set the zero address as the operator, tokens can be stolen by anyone as a wrong signature yield `recoveredAddress == 0`.

#### Recommended Mitigation Steps
Change the `require` logic to `recoveredAddress != address(0) && (recoveredAddress == owner) || isApprovedForAll[owner][recoveredAddress])`.

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/44)**

**[alcueca (judge) commented](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/44#issuecomment-966992097):**
 > Assets are not at direct risk, but they are at risk. It wouldn't be obvious to anyone that setting the zero address to the operator would lead to loss of assets. Severity 2.

## [[M-06] ConcentratedLiquidityPoolManager.sol `claimReward()` and `reclaimIncentive()` will fail when `incentive.token` is `token0` or `token1`](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/23)
_Submitted by WatchPug_

In `ConcentratedLiquidityPosition.collect()`, balances of `token0` and `token1` in bento will be used to pay the fees.

[`ConcentratedLiquidityPosition.sol#L103` L116](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPosition.sol#L103-L116)

```solidity
uint256 balance0 = bento.balanceOf(token0, address(this));
uint256 balance1 = bento.balanceOf(token1, address(this));
if (balance0 < token0amount || balance1 < token1amount) {
    (uint256 amount0fees, uint256 amount1fees) = position.pool.collect(position.lower, position.upper, address(this), false);

    uint256 newBalance0 = amount0fees + balance0;
    uint256 newBalance1 = amount1fees + balance1;

    /// @dev Rounding errors due to frequent claiming of other users in the same position may cost us some raw
    if (token0amount > newBalance0) token0amount = newBalance0;
    if (token1amount > newBalance1) token1amount = newBalance1;
}
_transfer(token0, address(this), recipient, token0amount, unwrapBento);
_transfer(token1, address(this), recipient, token1amount, unwrapBento);

```

In the case of someone add an incentive with `token0` or `token1`, the incentive in the balance of bento will be used to pay fees until the balance is completely consumed.

As a result, when a user calls `claimReward()`, the contract may not have enough balance to pay (it supposed to have it), cause the transaction to fail.

[`ConcentratedLiquidityPoolManager.sol#L78` L100](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPoolManager.sol#L78-L100)
```solidity
function claimReward(
    uint256 positionId,
    uint256 incentiveId,
    address recipient,
    bool unwrapBento
) public {
    require(ownerOf[positionId] == msg.sender, "OWNER");
    Position memory position = positions[positionId];
    IConcentratedLiquidityPool pool = position.pool;
    Incentive storage incentive = incentives[position.pool][positionId];
    Stake storage stake = stakes[positionId][incentiveId];
    require(stake.initialized, "UNINITIALIZED");
    uint256 secondsPerLiquidityInside = pool.rangeSecondsInside(position.lower, position.upper) - stake.secondsInsideLast;
    uint256 secondsInside = secondsPerLiquidityInside * position.liquidity;
    uint256 maxTime = incentive.endTime < block.timestamp ? block.timestamp : incentive.endTime;
    uint256 secondsUnclaimed = (maxTime - incentive.startTime) << (128 - incentive.secondsClaimed);
    uint256 rewards = (incentive.rewardsUnclaimed * secondsInside) / secondsUnclaimed;
    incentive.rewardsUnclaimed -= rewards;
    incentive.secondsClaimed += uint160(secondsInside);
    stake.secondsInsideLast += uint160(secondsPerLiquidityInside);
    _transfer(incentive.token, address(this), recipient, rewards, unwrapBento);
    emit ClaimReward(positionId, incentiveId, recipient);
}
```
The same issue applies to `reclaimIncentive()` as well.
[`ConcentratedLiquidityPoolManager.sol` L49 L62](https://github.com/sushiswap/trident/blob/c405f3402a1ed336244053f8186742d2da5975e9/contracts/pool/concentrated/ConcentratedLiquidityPoolManager.sol#L49-L62)

```solidity
function reclaimIncentive(
    IConcentratedLiquidityPool pool,
    uint256 incentiveId,
    uint256 amount,
    address receiver,
    bool unwrapBento
) public {
    Incentive storage incentive = incentives[pool][incentiveId];
    require(incentive.owner == msg.sender, "NOT_OWNER");
    require(incentive.expiry < block.timestamp, "EXPIRED");
    require(incentive.rewardsUnclaimed >= amount, "ALREADY_CLAIMED");
    _transfer(incentive.token, address(this), receiver, amount, unwrapBento);
    emit ReclaimIncentive(pool, incentiveId);
}
```

#### Recommendation
Consider making adding `token0` or `token1` as incentives disallowed, or keep a record of total remaining incentive amounts for the incentive tokens and avoid consuming these revered balances when `collect()`.

**[sarangparikh22 (Sushi) confirmed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/23)**

## [[M-07] Incentives for different pools should differ by a large factor](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/10)

I'm adding this as an issue because I didn't see it mentioned anywhere in the codebase, and I think its a fair point that relates to how the protocol gives out rewards to users. As I understand , the point of staking is to provide users with additional compensation for providing liquidity (and taking on risk) for the good of the protocol. If a large fraction of rewards go to users who don't provide a huge benefit to the protocol, that's a problem.

Consider two different pools: USDC-DAI and USDC-ETH. Suppose a user has \$10K worth of tokens and decides to provide liquidity to each of these pools.

In the USDC-DAI pool the user can very safely provide the \$10K with a 1% spread between upper and lower tick. The total amount of liquidity he provides is roughly \$10K \* (1/0.01) = \$1 M dollars of liquidity per second. The impermanent loss here is going to be basically 0 in normal conditions. The liquidity will be in range all the time.

The same situation in the USDC-ETH pool on the other hand:
Suppose a user has \$10K worth of USDC+ETH, provides it with a 1% spread between upper and lower ticks at the current price => roughly \$1 M dollars of liquidity per second, the same as before. However, now there is a good chance that price ranges by more than 1% meaning he loses all of his more valuable tokens for the cheaper ones due to impermanent loss. The liquidity will be out of range for a much longer percentage of the time.

However, if the incentives for each pool are the same, the staking protocol would value the liquidity per second of each LP situation equally. To make things "fair per unit of risk/liquidity" the incentive on the USDC-ETH should be something like 10x or 20x the incentive on the USDC-DAI pool. The pools with higher volatility should have a *significantly* higher incentive.

Recommendations:
Make sure the developers are at least aware of something like this when choosing incentive amounts for different pools. Carefully choose incentive amounts for each pool.

**[sarangparikh22 (Sushi) disputed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/10#issuecomment-940867532):**
 > This is not a med-risk issue, or an issue at all, we will improve the docs, so that devs are aware on how to set the incentives.

**[alcueca (judge) commented](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/10#issuecomment-967135732):**
 > Setting the incentives wrong will make the protocol leak value, which warrants a Severity 2. The issue was not disclosed, and therefore is valid.

# Low Risk Findings (23)
- [[L-01] `addIncentive` may need more inputs checked](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/76) _Submitted by 0xsanson_
- [[L-02] Unlocked Pragma Statements](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/3) _Submitted by anon, also found by broccoli_
- [[L-03] Sanity check on the lower and upper ticks](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/93) _Submitted by broccoli_
- [[L-04] Incorrect comparison in the `_updatePosition` of `ConcentratedLiquidityPool`](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/91) _Submitted by broccoli_
- [[L-05] Timestamp underflow error in `swap` function of `ConcentratedLiquidityPool`](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/90) _Submitted by broccoli_
- [[L-06] Boundaries for timestamp values](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/68) _Submitted by pauliax_
- [[L-07] Handle of deflationary tokens](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/65) _Submitted by pauliax_
- [[L-08] Inclusive conditions](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/62) _Submitted by pauliax_
- [[L-09] `TridentNFT` signature malleability](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/48) _Submitted by cmichel_
- [[L-10] `TridentNFT.safeTransferFrom` now EIP-721 compliant](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/47) _Submitted by cmichel_
- [[L-11] `TridentNFT._mint` can mint to zero address](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/46) _Submitted by cmichel_
- [[L-12] `TridentNFT.permitAll` prviliges discrepancy for operator](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/45) _Submitted by cmichel_
- [[L-13] `TridentNFT` ignores `from`](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/43) _Submitted by cmichel_
- [[L-14] Wrong inequality when trying to subscribe to an incentive](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/40) _Submitted by cmichel_
- [[L-15] `ConcentratedLiquidityPool`s can be created with the same tokens](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/33) _Submitted by cmichel_
- [[L-16] `Ticks.cross` wrong comment?](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/31) _Submitted by cmichel_
- [[L-17] `DyDxMath.getLiquidityForAmounts` underflows](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/30) _Submitted by cmichel_
- [[L-18]  No sanity check of `_price` in the constructor](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/28) _Submitted by broccoli_
- [[L-19] ConcentratedLiquidityPool: MAX_TICK_LIQUIDITY is checked incorrectly](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/12) _Submitted by hickuphh3_
- [[L-20] Consider using solidity version 0.8.8](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/7)
- [[L-21] Implement or remove functions](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/6)
- [[L-22] `subscribe` can be called by anyone](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/77) _Submitted by 0xsanson, also found by pauliax_
- [[L-23] _burn should decrement totalSupply](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/60) _Submitted by pauliax_

# Non-Critical Findings (9)
- [[N-01] `ConcentratedLiquidityPool.Sync` event never used](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/32) _Submitted by cmichel_
- [[N-02] Style issues](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/74) _Submitted by pauliax_
- [[N-03] uint32 for timestamps](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/63) _Submitted by pauliax_
- [[N-04] Replace hex numbers with .selector](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/58) _Submitted by pauliax_
- [[N-05] `ConcentratedLiquidityPoolManager.sol#reclaimIncentive` Misleading error message](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/54) _Submitted by WatchPug_
- [[N-06] Spelling Errors](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/22) _Submitted by hickuphh3_
- [[N-07] Ticks: `getMaxLiquidity()` formula should be explained](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/21) _Submitted by hickuphh3_
- [[N-08] Possible underflow if other checks aren't used](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/5)
- [[N-09] `incentiveId <= incentiveCount[pool]` is bad and can be removed](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/79) _Submitted by 0xsanson, also found by broccoli_

# Gas Optimizations (7)
- [[G-01] Useless state variable wETH](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/73) _Submitted by pauliax_
- [[G-02] Unused import](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/72) _Submitted by pauliax_
- [[G-03] Struct could be optimized for saving gas](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/57) _Submitted by WatchPug_
- [[G-04] Cache storage variables in the stack can save gas](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/56) _Submitted by WatchPug_
- [[G-05] Adding unchecked directive can save gas](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/55) _Submitted by WatchPug_
- [[G-06] Gas: `ConcentratedLiquidityPoolManager.addIncentive` ](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/49) _Submitted by cmichel_
- [[G-07] `addIncentive` and `reclaimIncentive` can be external](https://github.com/code-423n4/2021-09-sushitrident-2-findings/issues/75) _Submitted by 0xsanson_

# Disclosures

C4 is an open organization governed by participants in the community.

C4 Contests incentivize the discovery of exploits, vulnerabilities, and bugs in smart contracts. Security researchers are rewarded at an increasing rate for finding higher-risk issues. Contest submissions are judged by a knowledgeable security researcher and solidity developer and disclosed to sponsoring developers. C4 does not conduct formal verification regarding the provided code but instead provides final verification.

C4 does not provide any guarantee or warranty regarding the security of this project. All smart contract software should be used at the sole risk and responsibility of users.
