# Perennial contest details
- $47,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2021-12-perennial-finance-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts December 9, 2021 00:00 UTC
- Ends December 15, 2021 23:59 UTC

---

# Perennial Overview

Perennial is a new cash-settled perpetual synthetics protocol. It allows developers to launch any synthetic market with just a few lines of code.

Perennial creates two-party markets where takers receive exposure to a defined payoff, while makers take the opposing side of the trade while also providing liquidity. P&L is determined directly via oracle price with zero slippage, with settlement lag introduced to counter game-ability. Maker-taker utilization is balanced using a floating funding rate.

## Full documentation

Documentation on the Perennial protocol architecture and mechanism can be found on our [Gitbook](https://docs.perennial.finance/).

## Setup

See the `protocol` folder and [README](https://github.com/code-423n4/2021-12-perennial/blob/main/protocol/README.md) for details on running and testing Perennial.

---

# Contracts In Scope

| **Contract** | **LoC** |
| --- | --- |
| `/collateral/Collateral.sol` | `109` |
| `/collateral/types/OptimisticLedger.sol` | `36` |
| `/factory/Factory.sol` | `123` |
| `/factory/UFactoryProvider.sol` | `49` |
| `/incentivizer/Incentivizer.sol` | `190` |
| `/incentivizer/types/Program.sol` | `67` |
| `/incentivizer/types/ProgramInfo.sol` | `49` |
| `/oracle/ChainlinkOracle.sol` | `46` |
| `/product/Product.sol` | `194` |
| `/product/ProductProviderBase.sol` | `22` |
| `/product/types/ProductProvider.sol` | `16` |
| `/product/types/accumulator/AccountAccumulator.sol` | `22` |
| `/product/types/accumulator/Accumulator.sol` | `21` |
| `/product/types/accumulator/VersionedAccumulator.sol` | `86` |
| `/product/types/position/AccountPosition.sol` | `43` |
| `/product/types/position/Position.sol` | `53` |
| `/product/types/position/PrePosition.sol` | `75` |
| `/product/types/position/VersionedPosition.sol` | `21` |
| `/utils/types/Fixed18.sol` | `81` |
| `/utils/types/Token18.sol` | `72` |
| `/utils/types/UFixed18.sol` | `67` |
| `/utils/unstructured/UOwnable.sol` | `36` |
| `/utils/unstructured/UReentrancyGuard.sol` | `28` |
| **Total** | `1506` |

Most contracts use the latest version of the standard [Open Zeppelin](https://github.com/OpenZeppelin/openzeppelin-contracts)  libraries.

### Out Of Scope Contracts
These contracts may be useful for context, but are explicitly out of scope for the contest:

- `/examples/*.sol`
- `/interfaces/*.sol`
- `/utils/mocks/*.sol`

## External Dependencies

### Chainlink Oracles
Perennial currently uses Chainlink oracles for the underlying product price feeds.

The main entry point for these is `ChainlinkOracle.sol` which normalizes the feeds into the Perennial `IOracle` format.

One `ChainlinkOracle` is deployed per feed, but multiple Perennial products can use the same underlying `ChainlinkOracle`.

### (Trusted) ERC20 Stablecoin

A single trusted ERC20 stablecoin will be used as collateral for the system.

---

# Primary Risks

### Loss or misattribution of collateral

Lost or stolen collateral is the largest risk for the Perennial protocol.

- One product gaining access to another's collateral
  - Products should have segregated collateral account, one product being insolvent should not affect another.
- Collateral being able to be stolen globally by a bug. 
- Contracts: `Product`, `Collateral`, and their libraries (especially `OptimisticLedger`, and settlement flows).

### Loss or misattribution of incentive rewards

Not as mission-critical at launch, but lost or stolen incentive rewards would be similarly high-risk.

- One program gaining access to another's rewards
- Rewards being able to be stolen globally by a bug.
- Contracts: `Product`, `Incentivizer`, and their libraries (especially settlement flows).

### Misc. erroneous accounting
- P&L wrongly accounted for
- Liquidation triggered incorrectly
- Fee charged incorrectly
- Issues with reading the oracle

---

# Connect

- `qlo#3347` or `kbrizzle#5338` on discord from the Perennial team.
- [Website](https://www.perennial.finance)
- [Twitter](https://www.twitter.com/perennial_fi)
