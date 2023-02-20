# Hubble Exchange contest details
[Hubble](https://twitter.com/HubbleExchange) is a vAMM based perpetual futures exchange on Avalanche.

- $71,250 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-02-hubble-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts February 17, 2022 00:00 UTC
- Ends February 23, 2022 23:59 UTC

## Contract Overview
Here is the list of main contracts in the protocol.

| Contract Path                       | Lines of Code |
| ----------------------------------- | ------------- |
| `contracts/ClearingHouse.sol`       |  355          |
| `contracts/MarginAccount.sol`       |  621          |
| `contracts/AMM.sol`                 |  739          |
| `contracts/InsuranceFund.sol`       |  120          |
| `contracts/Oracle.sol`              |  173          |
| `contracts/Registry.sol`            |  25           |
| `contracts/VUSD.sol`                |  76           |
| `contracts/curve-v2/Swap.vy`        |  1170         |
| `contracts/curve-v2/CurveMath.vy`   |  265          |
| `contracts/curve-v2/Views.vy`       |  126          |

## System Overview
There are 4 major entities in the system at a high level

* `ClearingHouse`: This contract is used for opening/closing positions, adding/removing liquidity, liquidation for all AMMs
* `MarginAccount`: Used for accounting purposes, keeps track of the margin of all users, liquidating margin account, settling bad debt.
* `AMM`: This is a virtual AMM that consists of two components. One component is the `Swap.vy` which is inspired from curve-v2 [triCrypto2](https://curve.fi/tricrypto2) pool but modified for two coins and the other is `AMM.sol` which consists of functionalities required for perp exchange.
* `InsuranceFund`: Used to settle bad debts

There are two types of user personas in the system
* Takers: takes long/short position on leverage
* Makers: add/remove liquidity in the pool on leverage

A user can be both a taker as well a maker. For more information about makers, refer to [this](https://medium.com/hubbleexchange/makers-in-hubble-vamm-c2dbae445ed9) blog.


## Dev setup guideline

### One-Time vyper setup
Vyper compilation with hardhat takes a ton of time and is performed on every run (no caching). Therefore, we manually compile the .vy files and dump the abi and bytecode in files that are then picked up in the tests.

```
python3 -m venv venv
source venv/bin/activate
pip install vyper==0.2.12
npm run vyper-compile
```

### Compile
```
npm run vyper-compile
npm run compile
```

### Local Deployment
```
# starts node on `http://127.0.0.1:8545/` with 10K ETH in 20 accounts generated from mnemonic: "test test test test test test test test test test test junk"

npx hardhat node
npx hardhat run scripts/deploy.js --network local
```

### Documentation
```
npx hardhat docgen
```
Open `./docgen/index.html` in a browser.
