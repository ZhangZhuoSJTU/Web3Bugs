# Vader contest details
- 24 ETH main award pot
- 3 ETH gas optimization award pot
- 1000 VETH bonus pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://c4-vader.netlify.app/)
- [Read our guidelines for more details](https://code423n4.com/compete)
- Starts 2021-04-22 00:00:00 UTC
- Ends 2021-04-28 23:59:00 UTC

This repo will be made public before the start of the contest.

## Overview
VADER Protocol is an implemenation of the ideas discussed here:

https://docs.google.com/document/d/1O10Pay1ZjBJwEjeHulp924-Cuustjatl7OoH-sGkDs8/edit?usp=sharing

## USDV
* Same concept as LUNA<>UST

https://terra.money/Terra_White_paper.pdf

## Liquidity
* Same concept as THORChain CLP 

https://github.com/thorchain/Resources/blob/master/Audits/THORChain-Gauntlet-CLPReport-Nov2020.pdf

## Synths
* Synthetic Assets minted from liquidity collateral using a formula that mints on the assymetric value of the deposited asset, based on the mean of the deposit values, but where one side is 0.

Synthetic Asset && Liquidity Ownership formula:
```
How to derive liquidity units
// Get MEAN
P = poolUnits
b = baseAdded, B = baseDepthBefore, baseAddedRate = b / B
a = assetAdded, A = assetDepthBefore, assetAddedRate = a / A

/ Get SLIP
slipAdjustment = 1- abs(Ba−bA / ((b+B) * (a+A))) // Change in price irrespective of direction

// Get units
units = P * average(baseAddedRate + assetAddedRate) * slipAdjustment
units = P*(( b /  B) + ( a /  A))/2 * slipAdjustment
units = (P (a B + A b))/(2 A B) * slipAdjustment
units = (P (a B + A b))/(2 A B) * 1 - abs(Ba−bA / ((b+B) * (a+A)))

Special case when a = 0 (such as when minting synths)
a = 0
units = (P (0 B + A b))/(2 A B) * 1- abs(B0−bA / ((b+B) * (a0+A)))
units = (P (A b))/(2 A B) * 1 - abs(bA / ((b+B) * (A)))
units = (P b)/(2 B) * 1 - (b /(b+B))
units = (P b)/(2 (b + B))
```

## Lending
* Borrowing debt is faciliated by depositing an asset (VADER, USDV, SYNTH) and borrowing BASE collateral from the protocol. The collateral is priced in its respective BASE asset. 
* The member then has to pay it back, but priced in Debt Value and not in Base Value. Thus the protocol takes the short position on its own asset. 
* The throttle on lending (since the protocol is shorting its own asset) is the member's resistance to paying high interest rates. 
* All members are put in a Giant CDP (collateral-debt paired) alongside each other to share in the collateristation rate, the liquidation risk and the interest paid

## Non-standard ERC20
* VADER, USDV, SYNTHS all employ the `transferTo()` function, which interrogates for `tx.origin` and skips approvals. The author does not subscribe to the belief that this is dangerous, although users should be warned that they can be phished and stolen from *if they interact with attack contracts*. Since all these assets are intended to be used in the system itself, the risk of a user interacting with an attack contract is extremely low. 
* There are some discussion whether `tx.origin` will be deprecated, but the author believes that there is a really low chance it will, and if so, it will likely be replaced with `tx.orgin = msg.sender` which means the contracts will still work. Compatibility function have been added to anticipate this. 

## Unique
VADER is an implementation of various ideas across the space. There is nothing *new*, just a more cohesive system that takes advantage of several key concepts. 

## Known Deviations From Spec
*will be updated if this list changes*
1) *removed*
2) Anchor pool creation is not curated
3) *removed*
4) Interest Rate deductions not yet added
5) Liquidation logic not yet added
6) Purge Member logic not yet added
7) DEPLOYER privs not yet added
8) Full DAO functionality not yet added
9) Liquidity Limits not yet added

## Areas of Review

Ideally, the following is reviewed:
* Any attack vectors that can siphon funds from the system
* Any attack vectors that can lock funds in the system
* Any attack vectors using flash loans on Anchor price, synths or lending
* Any attack vectors by Anchor Price manipulation to cause run-away inflation or erosion of the VADER<>USDV peg
* Any attack vectors by VADER<>USDV mint/burn that can exploit synths/lending

## Known Issues

1) VADER may inflate if the price reduces, and lots of USDV is redeemed back to VADER, causing the system to hit maxSupply and thus lose the ability to redeem. The solution could be to bump the maxSupply cap, or have a reflexive emission policy that takes into account burnt VADER
2) Some members who run out of collateral after borrowing debt, may not have enough (1% fee) to entice being purged, thus are never purged, and cause other members to receive unfavourable positions. The solution may be batch-purging, or increasing the liquidation fee for smaller members
3) The last synth-holder cannot redeem if they are also the last LP





