# Tally Contest 🐕

Meet [Tally](https://tally.cash), the community owned and operated Web3 wallet.
In this contest, we're looking at Tally Swap, the 0x-based DEX aggregator
embedded in the wallet.

![Tally Swap](./public/swap.gif)

## Tally contest details
- $28,500 worth of ETH award pot
- $1,500 worth of ETH gas optimization award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-10-tally-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts October 20, 2021 00:00 UTC
- Ends October 22, 2021 23:59 UTC
---

# Useful links ⭐️

🐕 [tally.cash](https://tally.cash) — 🐦 [@tallycash](https://twitter.com/tallycash) — 🤖 [Discord](https://chat.tally.cash)

# Quickstart

To build the contracts, run

```bash
yarn install
yarn build
```

## Contract overview

| Contract Name              | Lines of Code |
| -------------------------- | ------------- |
| `Swap.sol`                 | 263           |
| `Math.sol`                 | 20            |
| `EmergencyGovernable.sol`  | 64            |
| `EmergencyPausable.sol`    | 26            |
| `MockZrxExchangeProxy.sol` | 73            |
| `MockToken.sol`            | 9             |
| **Total**                  | **455**       |

### Dependencies

The main contract is `Swap.sol`, which executes quotes provided off-chain by the
[0x API](https://0x.org/docs/api) in the Tally wallet, taking swap fees for the
DAO. It relies on `SafeMath.sol`, `SafeERC20.sol`, and `ReentrancyGuard.sol`
from the OpenZeppelin contracts library.

## System overview

The Tally wallet is an EOA wallet that runs as a browser extension. Though Tally
isn't a "smart contract wallet", preferring to custody user funds outside smart
contracts to save on gas, a number of features in the wallet require paired
smart contracts. Tally Swap is one of those features.
