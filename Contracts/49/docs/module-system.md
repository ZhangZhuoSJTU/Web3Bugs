# Overlay V1 Core Module System

The module system has two key components:

1. Collaterals Module
2. Markets Module

### Collaterals Module

Collaterals Module consists of collateral managers specializing in different types of collateral. Trader interactions with the system occur through collateral managers. Collateral managers are given mint and burn permissions on the OVL token by the mothership contract.

Each manager has external functions:

- `build()`
- `unwind()`
- `liquidate()`

Currently, we have an OVL Collateral Manager that accepts OVL: collateral/OverlayV1OVLCollateral.sol


##### OverlayV1OVLCollateral.sol:

`build(address _market, uint256 _collateral, uint256 _leverage, bool _isLong, uint256 _oiMinimum):`

- Auth calls `IOverlayV1Market(_market).enterOI()` which adds open interest on the market contract, adjusted for trading and impact fees
- Transfers OVL collateral amount to manager from `msg.sender`
- Mints shares of ERC1155 position token for user's share of the position

`unwind(uint256 _positionId, uint256 _shares):`

- Auth calls `IOverlayV1Market(_market).exitData()` view which returns open interest occupied by position & change in price since entry
- Calculates current value less fees of position being unwound given ERC1155 `_shares`
- Mints `PnL = value - cost` in OVL to collateral manager if PnL > 0 or burns if PnL < 0 from collateral manager
- Transfers value to `msg.sender`
- Auth calls `IOverlayV1Market(_market).exitOI()` which removes open interest from market contract
- Burns ERC1155 position token shares

`liquidate(uint256 _positionId):`

- Auth calls `IOverlayV1Market(_market).exitData()` view which returns open interest occupied by position & change in price since entry
- Checks if position value is less than initial open interest times maintenance margin
- Auth calls `IOverlayV1Market(_market).exitOI()` which removes open interest from market contract
- Zeroes the position's share of total open interest on long or short side
- Burns `loss = cost - value` in OVL from collateral manager
- Transfers reward to liquidator


### Markets Module


Markets module consists of markets on different data streams.

Each market tracks:

- Total open interest outstanding on long and short sides: `OverlayV1OI.__oiLong__` and `OverlayV1OI.__oiShort__`
- Accumulator snapshots for how much of the open interest cap has been entered into: `OverlayV1Comptroller.impactRollers`
- Accumulator snapshots for how much OVL has been printed: `OverlayV1Comptroller.brrrrdRollers`
- Historical prices fetched from the oracle: `OverlayV1PricePoint._pricePoints`
- Collateral managers approved by governance to add/remove open interest: `OverlayV1Governance.isCollateral`

Each market has external functions accessible only by approved collateral managers:

- `enterOI()`
- `exitData()`
- `exitOI()`

and a public `update()` function that can be called by anyone.

Currently, we have Overlay markets on Uniswap V3 oracles: OverlayV1UniswapV3Market.sol which implements markets/OverlayV1Market.sol


##### OverlayV1Market.sol:


`enterOI(bool _isLong, uint256 _collateral, uint256 _leverage):`

- Internal calls `update()` which fetches and stores a new price from the oracle and applies funding to the open interest
- Internal calls `OverlayV1Comptroller.intake()` which calculates and records the market impact
- Internal calls `OverlayV1OI.addOi()` to add the adjusted open interest to the market


`exitData(bool _isLong, uint256 _pricePoint):`

- Internal calls `update()` which fetches and stores a new price from the oracle and applies funding to the open interest
- Returns total open interest on side of trade and ratio between exit and entry prices


`exitOI():`

- Internal calls `OverlayV1Comptroller.brrrr()` which records the amount of OVL minted or burned for trade
- Removes open interest from the long or short side

`update():`

- Internal calls `OverlayV1UniswapV3Market.fetchPricePoint()` to fetch a new price point if at least one block has passed since the last fetch
- Internal calls `OverlayV1PricePoint.setPricePointCurrent()` to store fetched price
- Internal calls `OverlayV1OI.payFunding()` if at least one `compoundingPeriod` has passed since the last funding to pay out funding


##### OverlayV1Comptroller.sol:

`intake(bool _isLong, uint _oi, uint _cap):`

- Records in accumulator snapshots `impactRollers` the amount of open interest cap occupied by the trade, adding to pressure in last `brrrrdWindowMacro` rolling window: `pressure += oi / oiCap()`
- Calculates market impact fee `_oi * (1 - e**(-lmbda * pressure))` in OVL burned from collateral manager
- Internal calls `brrrr()` to record the impact fee that will be burned

`brrrr(uint _brrrr, _antiBrrrr):`

- Records in accumulator snapshots `brrrrdRollers` an amount of OVL minted `_brrrr` or burned `_antiBrrrr`

`oiCap():`

- Returns the current open interest cap for the market: equal to min of `OverlayV1UniswapV3Market.depth()` with either or two cases:
1. `staticCap` if there has been less printing than expected in last `brrrrdWindowMacro` rolling window
2.  `dynamicCap = staticCap * ( 2 - brrrrdRealized / brrrrdExpected )` if more has been printed than expected (i.e. `brrrrdRealized > brrrrdExpected`) with a floor at `dynamicCap = 0`


##### OverlayV1OI.sol:

`payFunding(uint256 _k, uint256 _epochs):`

- Pays funding between `__oiLong__` and `__oiShort__`: open interest imbalance is drawn down by `(1-2*_k)**(_epochs)`
- For the edge case of all open interest being on one side of the market, the open interest is draw down at same rate of `(1-2*_k)**(_epochs)`

`addOi(bool _isLong, uint256 _openInterest, uint256 _oiCap):`

- Add open interest to either `__oiLong__` or `__oiShort__`
- Checks current open interest cap has not been exceeded: `__oiLong__ <= _oiCap` or `__oiShort__ <= _oiCap`


##### OverlayV1PricePoint.sol:

`setPricePointNext(PricePoint memory _pricePoint):`

- Stores a new historical price in the `_pricePoints` array
- Price points include `macroWindow` tick, `microWindow` tick, and market `depth` (spot liquidity constraints) values used for entry and exit: `PricePoint{ int24 macroTick; int24 microTick; uint depth }`. Longs receive the ask on entry, bid on exit. Shorts receive the bid on entry, ask on exit
- Tick values are the logarithm of price


`readPricePoint(uint _pricePoint)`

- Calculates bid and ask values given price point index. Uses shorter and longer TWAT (time-weighted average tick) values fetched from the oracle
- Applies the static spread `pbnj` to bid `e**(-pbnj)` and ask `e**(pbnj)`


##### OverlayV1UniswapV3Market.sol:

`fetchPricePoint():`

- External calls `IUniswapV3Pool(marketFeed).observe()` for tick cumulative snapshots from `0`, `microWindow`, and `macroWindow` seconds ago
- Calculates TWAT values for both the `macroWindow` and `microWindow` window sizes
- Calculates time-weighted average liquidity in ETH for underlying spot market
- Fetches TWAT from OVL/ETH price feed to convert liquidity in ETH to OVL in `computeDepth()`
- Returns a new price point

`computeDepth(uint _marketLiquidity, uint _ovlPrice):`

- Returns bound on open interest cap from virtual liquidity in Uniswap pool: `(lmbda * _marketLiquidity / _price) / 2`
