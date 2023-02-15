# Sherlock contest details

- $68,000 USDC main award pot
- $4,000 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-01-sherlock-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts January 20, 2022 00:00 UTC
- Ends Janaury 26, 2022 23:59 UTC

Code can also be viewed at https://github.com/sherlock-protocol/sherlock-v2-core @ `25b0897c236a`

Docs are available at https://docs.sherlock.xyz

An audit has been performed on `8ae51c5a2ec`, (unaudited) fixes have been included up until `4f022062a502`

## Areas of concern

- Previous audit fixes have not been re-audited
- This PR has been included in `Sherlock.sol` after the audit https://github.com/sherlock-protocol/sherlock-v2-core/pull/7/files
- `SherBuy.sol` is unaudited
- `SherClaim.sol` is unaudited

## Contracts

> Lines are calculated using `solidity-coverage`

| Contract                               | Lines | Info                                             |
| -------------------------------------- | ----- | ------------------------------------------------ |
| `Sherlock.sol`                         | 152   | Main contract using ERC721                       |
| `managers/AaveV2Strategy.sol`          | 28    | Contract to move stakers funds to AaveV2         |
| `managers/Manager.sol`                 | 14    | Abstract contract used by all managers           |
| `managers/SherDistributionManager.sol` | 27    | Contract for SHER incentives                     |
| `managers/SherlockClaimManager.sol`    | 155   | Using UMA to handle payouts                      |
| `managers/SherlockProtocolManager.sol` | 179   | Managing protocol coverage and protocol payments |
| `SherBuy.sol`                          | 39    | Standalone contract together with `SherClaim`    |
| `SherClaim.sol`                        | 18    | Standalone contract together with `SherBuy`      |
