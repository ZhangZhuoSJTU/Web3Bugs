# Overlay Protocol contest details
- $47,500 worth of ETH main award pot
- $2,500 worth of ETH gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2021-11-overlay-protocol-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts November 16, 2021 00:00 UTC
- Ends November 22, 2021 23:59 UTC

# Contest Scope

Representatives from Overlay will be available in the Code Arena Discord to answer any questions during the contest period. The focus for the contest is to try and find any logic errors or ways to drain funds from the protocol in a way that is advantageous for an attacker at the expense of users with funds invested in the protocol. Wardens should assume that governance variables are set sensibly (unless they can find a way to change the value of a governance variable, and not counting social engineering approaches for this).


# Protocol Overview

Overlay is a protocol that allows users to trade nearly any data stream without the need for traditional counterparties.

The Overlay mechanism allows traders to enter positions by staking Overlay's native token (OVL) as collateral in long or short positions on various data streams offered by the protocol. Data streams are obtained via manipulation-resistant oracles. When a trader exits that same position later, the protocol dynamically mints/burns OVL based on their net profit/loss for the trade to compensate them.

An example: Bob thinks the floor price on PUNK NFTs is not sustainable and will likely go down in ETH terms. He wishes to short the floor. As a trader, Bob enters a short position on the associated Overlay market for the PUNK/ETH floor price feed:

- Bob stakes 100 OVL short at an entry price of 80 ETH for the PUNK/ETH floor

- The PUNK/ETH floor then drops 10 ETH (-12.5%) to 70 ETH over the next week

- Bob unwinds the position to take profit: Overlay mints 12.5 OVL for the PnL and returns a total of 112.5 OVL to Bob for the trade.

If the PUNK floor had gone up 12.5% to 90 ETH, Overlay would burn 12.5 OVL from Bob's stake and return 87.5 OVL back to him.

Overlay V1 Core has three different economic mechanisms to manage the risk associated with excessive inflation of the OVL token supply:

1. Open interest caps: limit the amount of position size a market can take on at any given time

2. Payoff caps: limit the maximum change in price the protocol is willing to honor for any one trade on a market

3. Funding rates: overweight open interest side on a market pays the underweight open interest side to incentivize a drawdown in imbalance over time

To deter front-running the oracle, the protocol adds:

- Bid/ask spread to the price fetched from the oracle feed

- Market impact fee charged on the size of the position entered into

Initial data streams to be offered as markets on Overlay will be Uniswap V3 price feeds (TWAPs).


# Contracts

Contracts under audit are listed below. Any contracts not in this list are to be ignored for this contest.

**overlay-v1-core**

| Contract  | sloc | External Calls | Libraries |
| ------------- | ------------- | ------------- | ------------- |
| ovl/OverlayToken.sol  | 29  |  | [OpenZeppelin/token/ERC20](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol), [OpenZeppelin/access](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/AccessControlEnumerable.sol)  |
| OverlayV1UniswapV3Market.sol  | 307  | UniswapV3Pool  | [BalancerV2/utils/math/FixedPoint](https://github.com/balancer-labs/balancer-v2-monorepo/blob/master/pkg/solidity-utils/contracts/math/FixedPoint.sol), [UniswapV3-periphery/libraries/OracleLibrary](https://github.com/Uniswap/v3-periphery/blob/main/contracts/libraries/OracleLibrary.sol) |
| collateral/OverlayV1OVLCollateral.sol  | 337  |  OverlayV1Mothership, OverlayV1Token  | [OpenZeppelin/token/ERC1155](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC1155/extensions/ERC1155Supply.sol)  |
| market/OverlayV1Comptroller.sol  | 371  |  | [OpenZeppelin/utils/math](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/math/Math.sol) |
| market/OverlayV1Governance.sol  | 96  | OverlayV1Mothership  |  |
| market/OverlayV1Market.sol  | 106  | OverlayV1Mothership  | [BalancerV2/utils/math/FixedPoint](https://github.com/balancer-labs/balancer-v2-monorepo/blob/master/pkg/solidity-utils/contracts/math/FixedPoint.sol) |
| market/OverlayV1OI.sol  | 107  |  | [BalancerV2/utils/math/FixedPoint](https://github.com/balancer-labs/balancer-v2-monorepo/blob/master/pkg/solidity-utils/contracts/math/FixedPoint.sol) |
| market/OverlayV1PricePoint.sol  | 88  |  | [BalancerV2/utils/math/FixedPoint](https://github.com/balancer-labs/balancer-v2-monorepo/blob/master/pkg/solidity-utils/contracts/math/FixedPoint.sol), [OpenZeppelin/utils/math](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/math/Math.sol) |
| mothership/OverlayV1Mothership.sol  | 124  |  | [OpenZeppelin/access](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/AccessControlEnumerable.sol)  |
| libraries/Position.sol  | 292  |  | [BalancerV2/utils/math/FixedPoint](https://github.com/balancer-labs/balancer-v2-monorepo/blob/master/pkg/solidity-utils/contracts/math/FixedPoint.sol), [OpenZeppelin/utils/math](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/math/Math.sol) |


## Modules

See [docs/module-system.md](https://github.com/overlay-market/overlay-v1-core/blob/main/docs/module-system.md) in the `overlay-market/overlay-v1-core` repo for a detailed explanation of module interactions. Module system diagram in [docs/module-system.pdf](https://github.com/overlay-market/overlay-v1-core/blob/main/docs/module-system.pdf).

V1 Core relies on four modules:

- Collaterals Module
- Markets Module
- OVL Module
- Mothership Module


### Collaterals Module

Collaterals module consists of collateral managers specializing in different types of collateral. Trader interactions with the system occur through collateral managers.

Traders deposit collateral to the specific collateral manager supporting their collateral type. The collateral manager subsequently enters open interest on the market the trader wishes to enter a position on. On exit, collateral managers remove open interest from the market and return collateral to the trader, adjusting for PnL associated with the position. Positions are issued as shares of an ERC1155 by the collateral manager.

Collateral managers are given mint and burn permissions on the OVL token and the ability to enter/exit open interest on markets by the mothership contract.


### Markets Module

Markets module consists of markets on different data streams. Traders do not interact directly with the market contract. Only collateral managers are permitted to interact with market contracts, in order to enter or exit open interest on a market.

Each market inherits from `OverlayV1Market.sol` and tracks:

- Total open interest outstanding on long and short sides. In `OverlayV1OI.sol`:
```
uint256 internal __oiLong__; // total long open interest
uint256 internal __oiShort__; // total short open interest
```
- Accumulator snapshots for how much of the open interest cap has been entered into in the past. In `OverlayV1Comptroller.sol`:
```
Roller[60] public impactRollers;
```
- Accumulator snapshots for how much OVL has been printed in the past. In `OverlayV1Comptroller.sol`:
```
Roller[60] public brrrrdRollers;
```
- Historical prices fetched from the oracle. In `OverlayV1PricePoint.sol`:
```
// mapping from price point index to realized historical prices
PricePoint[] internal _pricePoints;
```
- Collateral managers approved by governance to add/remove open interest. In `OverlayV1Governance.sol`:
```
mapping (address => bool) public isCollateral;
```


### OVL Module

OVL module consists of an ERC20 token with permissioned mint and burn functions. Upon initialization, collateral managers are given permission to mint and burn OVL to compensate traders for their PnL on market positions.


### Mothership Module

Mothership module consists of a mothership contract through which governance can add or remove markets and collateral managers. Access control roles for governance to tune per-market risk parameters are also defined on the mothership contract.


# Mathematical Models

Updated whitepaper with underlying math can found [here](https://drive.google.com/file/d/1I8uGHwMBg8bPJ4eYrG-5U_WNIDN73TyN/view?usp=sharing).

It is most concerned with addressing the question of how to set risk parameters for each market. In particular, setting governance variables in the general `OverlayMarket.sol` contract for:

- `k`: funding constant
- `pbnj`: bid/ask static spread
- `lmbda`: market impact
- `staticCap`: open interest cap
- `priceFrameCap`: payoff cap
- `brrrrdExpected`: expected worst-case inflation rate

Original whitepaper outlining the vision for the protocol is [here](https://drive.google.com/file/d/1Jhpah-KPvX1C9bxPKxiorxsXmgT8LuMd/view?usp=sharing).


## Profit and Loss

OVL acts as the settlement currency of the system, with all PnL, value, and notional calculations made in OVL terms.

The value of a position that the collateral manager needs to return at unwind is

```
V = OI - D +/- OI * ( priceFrame - 1 )
```

where

- `OI` is the current open interest associated with the position. This can change in time due to funding payments.
- `D` is the debt associated with the position. This is static.
- `priceFrame` is the ratio of the exit price divided by the entry price

The PnL for a position that the collateral manager needs to either mint or burn at unwind is

```
PnL = V - C
```

where `C` is the initial collateral deposited, adjusted for trading fees and market impact.

If `pos.isLong = true`:

```
priceFrame = min(exitPrice / entryPrice, priceFrameCap)
```

- `+/- = +`
- `exitPrice = pricePoint.bid`
- `entryPrice = pricePoint.ask`

and if `pos.isLong = false`:

```
priceFrame = exitPrice / entryPrice
```

- `+/- = -`
- `exitPrice = pricePoint.ask`
- `entryPrice = pricePoint.bid`


### Fees

Market impact and trading fees are charged on the notional amount of the position.

#### build

On `build()`, notional amount on which fees are charged is `collateral * leverage`. Market impact and trading fees adjust the collateral amount backing a position

```
collateralAdjusted = collateral - impactFee - tradeFee
```

Open interest and debt associated with the position then use the adjusted collateral amount

```
oiAdjusted = collateralAdjusted * leverage;
debtAdjusted = oiAdjusted - collateralAdjusted;
```

for position attributes.

#### unwind

On `unwind()`, notional amount on which trading fees are charged is

```
NO = V + D
```

where
- `V` is the value of the position
- `D` is the debt

Value returned on unwind is adjusted only for trading fees (no impact on unwind):

```
valueAdjusted = V - NO * feeRate
```


## Funding and Open Interest

Funding is used to incentivize a drawdown in open interest imbalance over time as the protocol effectively takes on the profit liability associated with an imbalance in open interest.

### Funding Payments

If a `compoundingPeriod` has passed and a call to `update()` on an Overlay market is made, funding is paid from the overweight open interest side of the market to the underweight open interest side:

```
fundingPayment = k * (oiLong - oiShort)
oiLong -= fundingPayment
oiShort += fundingPayment
```

where the payment is made directly between aggregate open interest amounts on a market. If `fundingPayment > 0`, longs pay shorts. If `fundingPayment < 0`, shorts pay longs.

`oiLong` is the total open interest for all outstanding positions on a market on the long side. `oiShort` is the total open interest for all outstanding positions on a market on the short side.

### Shares of Open Interest

Each position tracks its share of the aggregate open interest amounts `(oiLong, oiShort)` through `Position.Info.oiShares`:

```
struct Info {
    address market; // the market for the position
    bool isLong; // whether long or short
    uint leverage; // discrete initial leverage amount
    uint pricePoint; // pricePointIndex
    uint256 oiShares; // shares of total open interest on long/short side, depending on isLong value
    uint256 debt; // total debt associated with this position
    uint256 cost; // total amount of collateral initially locked; effectively, cost to enter position
}
```

The market contract tracks the total of how many open interest shares are currently outstanding through `oiLongShares` and `oiShortShares` in `OverlayV1OI.sol`.

The open interest associated with a full position can then be calculated as

```
oiForLongPosition = oiLong * posLong.oiShares / oiLongShares
oiForShortPosition = oiShort * posShort.oiShares / oiShortShares
```

Traders own shares of the position itself through the ERC-1155 issued by the collateral manager.


## Pricing

For each block in which a call to `update()` of the Overlay markets on UniswapV3 pools is made, the Overlay market contract fetches two TWAPs: one at a shorter averaging window `microWindow` and one at a longer averaging window `macroWindow`.

The `macroWindow` TWAP provides security against spot manipulation after the trader has entered an Overlay position. The `microWindow` TWAP provides security against front-running of the longer TWAP, given the time-weighted average price lags spot by about the same amount of time as the averaging period.

Typical values for the averaging windows would be `macroWindow = 1 hr` and `microWindow = 10 min`.

### Bid-Ask Spread

The trader gets the worst price possible between the two TWAPs. A further static spread is applied to the worse of these two prices to protect against the time lag between the `microWindow` and the "true" spot price.

Bid and ask prices received by traders are

```
bid = min(macroPrice, microPrice) * e**(-pbnj)
ask = max(macroPrice, microPrice) * e**(pbnj)
```

where `pbnj` is the static spread calibrated to cover a majority of likely jumps to occur within the `microWindow`.

Longs get the ask on entry and the bid on exit. Shorts get the bid on entry and the ask on exit.

### Market Impact

A further market impact fee (i.e. slippage) is burned from the position's staked collateral to protect against front-running the time lag between the `microWindow` and spot when the static spread is not enough to cover a very large jump. Market impact limits the damage by charging on position size proposed. It also protects the system from being significantly exploited by traders who may have more information than the Overlay market has.

The market impact fee burned is

```
impactFee = OI * ( 1 - e**(-lmbda * pressure) )
```

where `pressure` is the fraction of the open interest cap that has been recently entered into by positions over the last `impactWindow = microWindow` rolling window

```
pressure = sum_{i} OI_i / oiCap
```

for all positions `i` built between `t = now - impactWindow` and `t = now`. Pressure is calculated using the `impactRollers` rolling accumulator snapshots.


## Open Interest Caps

Open interest caps are used to limit the total exposure the protocol takes on for each market at any given time.

Whenever a new position is built, the market contract through `addOi()` checks whether the additional open interest from the trade, adjusted for impact and fees, will push the aggregate open interest value for the side of the trade above the cap:

```
function addOi(
    bool _isLong,
    uint256 _openInterest,
    uint256 _oiCap
) internal {

    if (_isLong) {

        oiLongShares += _openInterest;

        uint _oiLong = __oiLong__ + _openInterest;

        require(_oiLong <= _oiCap, "OVLV1:>cap");

        __oiLong__ = _oiLong;

    } else {

        oiShortShares += _openInterest;

        uint _oiShort = __oiShort__ + _openInterest;

        require(_oiShort <= _oiCap, "OVLV1:>cap");

        __oiShort__ = _oiShort;

    }

}
```

If so, the build reverts.

### Dynamic Cap

The absolute maximum open interest the market can accept on either the long `oiLong` or short `oiShort` side is dictated by the static governance parameter `staticCap`.

In the event the system has printed more in the recent past than expected, the open interest cap dynamically lowers to take on less new risk in the near future.

The open interest cap is adjusted downward by

```
dynamicCap = staticCap * ( 2 - brrrrdRealized / brrrrdExpected )
```

when `brrrrdRealized > brrrrdExpected`, with a floor at `dynamicCap = 0`.

`brrrrdExpected` is the governance parameter specifying the expected amount of printing over a rolling window `brrrrdWindowMacro`. `brrrrdRealized` is the realized amount printed less burns over the last rolling window

```
brrrrdRealized = sum_{i} brrrrd_i - antiBrrrrd_i
```

for all mints or burns `i` between `t = now - brrrrdWindowMacro` and `t = now`. Realized amount printed in the past is calculated using the `brrrrdRollers` rolling accumulator snapshots.

`intake()` in the comptroller contract registers either a mint `brrrrd` or a burn `antiBrrrrd` on unwind, as well as the impact fee burned on build.


### Depth

Uni V3 and Balancer V2 have a unique manipulation attack vector that we protect against through market impact and open interest caps. A trader could front-run themselves by swapping e.g. DAI => ETH => OVL through the spot pool and immediately using the resulting OVL received as collateral for a long position on the ETH/DAI Overlay market.

Market impact makes this attack unprofitable in all cases if the open interest cap is low enough, so that slippage on the Overlay market is high enough -- lower `oiCap` means higher pressure for same amount of `oi`. To prevent this attack, the open interest cap should be bounded by

```
oiCap <= lmbda * x / 2
```

for Uniswap V3, where `x` is the OVL value of the `token0` reserves in the spot pool. For Balancer V2, where the weights are not necessary the same (`wo != wi`), the constraint is replaced by ``oiCap <= lmbda * x * wo / (wi + wo)`` for `wo <= wi`.

This adjustment is implemented at the `OverlayV1UniswapV3Market.sol` level through a function called `depth()`.


## Liquidations

Positions become liquidatable when the value of the position is less than its initial open interest times a maintenance margin factor

```
V < MM * OI_0
```

This is to protect against positions going negative in value. Any contract or user can call a collateral manager's `liquidate()` function for a position that is liquidatable. Upon liquidation, the liquidator receives a portion of the remaining value as a reward

```
reward = V * MMR;
```

A portion of the remaining value less rewards is burned to account for times when liquidators don't liquidate a negative value position in time -- the `pos.value()` function has a floor of zero so it will never result in negative values. The rest is taken as a fee by the protocol.


# Tokens

There are two token contracts used. Both inherit from the OpenZeppelin library.

`OverlayToken.sol` (ERC-20)
- Extends OpenZeppelin ERC-20 implementation for permissioned mint and burn functionality
- Defines `MINTER_ROLE` and `BURNER_ROLE` access permissions, with associated modifiers on `mint()` and `burn()` external functions
- Adds `transferMint` and `transferBurn` functions that transfer and mint/burn in the same call to save gas

`OverlayV1OVLCollateral.sol` (ERC-1155)
- Extends OpenZeppelin ERC-1155 implementation


# Areas of Concern

- Oracle attacks: front-running, manipulation. Assume for Uniswap V3 markets, the spot pool has substantially spread liquidity (e.g. USDC/WETH) or a minimum amount of liquidity at max range due to PCV on long-tail asset pools (e.g. OVL/WETH)

- Robustness of economic mechanisms: whether our risk framework will work in practice

- Gas optimizations for the most important flows: `build()` and `unwind()` on the collateral manager

- General failure of our mechanisms and constructs in Solidity — price fetching, rolling oi cap accounting, composure of our smart contract system (governance contracts, market contract integration with collateral manager)

- Collateral managers and the logic within, as all collateral will be held in there while users have an active position

If wardens are unclear on which areas to look at or which areas are important please feel free to ask in the contest Discord channel.


# Tests

Existing tests are provided in the repo. Tests use a Uniswap mock loaded in `conftest.py` with historical observations from Uniswap V3 `AXS/WETH` and `DAI/WETH` pools.


## Requirements

To run the project you need:

- Python >=3.7.2 local development environment
- [Brownie](https://github.com/eth-brownie/brownie) local environment setup
- Set env variables for [Etherscan API](https://etherscan.io/apis) and [Infura](https://eth-brownie.readthedocs.io/en/stable/network-management.html?highlight=infura%20environment#using-infura): `ETHERSCAN_TOKEN` and `WEB3_INFURA_PROJECT_ID`
- Local Ganache environment installed


## Compile

```
brownie compile
```


## Test

```
brownie test
```
