# Tribe Turbo contest details
- $71,250 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-02-tribe-turbo-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts February 17, 2022 00:00 UTC
- Ends February 23, 2022 23:59 UTC

## Scope
[src/TurboMaster.sol](https://github.com/code-423n4/2022-02-tribe-turbo/blob/main/src/TurboMaster.sol) (1 contracts)
[src/TurboSafe.sol](https://github.com/code-423n4/2022-02-tribe-turbo/blob/main/src/TurboSafe.sol) (1 contracts)
[src/modules/*](https://github.com/code-423n4/2022-02-tribe-turbo/blob/main/src/modules) (4 contracts)

[src/TurboRouter.sol](https://github.com/code-423n4/2022-02-tribe-turbo/blob/main/src/TurboRouter.sol) (1 contracts)
[lib/ERC4626/src/ERC4626RouterBase.sol](https://github.com/fei-protocol/ERC4626/blob/5b786fe0317f65f5b716f577c28092fa349c4903/src/ERC4626RouterBase.sol) (1 contracts)

[lib/solmate/src/mixins/ERC4626.sol](https://github.com/Rari-Capital/solmate/blob/1205a9067ff957ef8b0b003ff9d77c20ef9f2e0b/src/mixins/ERC4626.sol) (1 contract)

Note that ERC4626.sol is not fully up to date with [EIP-4626](https://eips.ethereum.org/EIPS/eip-4626). In particular it includes `assetsOf` and `assetsPerShare` which will be removed, and it is missing `convertToShares` and `convertToAssets` which should use identical logic to `previewDeposit` and `previewRedeem` for this contract, because the solmate vault has no slippage.

The default access control will allow the TurboRouter and TurboSavior to interface with the user Safes, but users can set their own access control policy by changing the "Authority" on their Safe.

## Overview Videos
- [Turbo Architecture](https://youtu.be/vcuhOVeReTY)
- [Turbo Code](https://www.youtube.com/watch?v=EdzKAvq2dJg)

# tribe-turbo

Fuse liquidity accelerator for friends of the Tribe.

![Diagram](https://lucid.app/publicSegments/view/25002d8e-f4ed-4ba7-bec0-cdd3720f9add/image.png)

## Terminology

- `boost`: borrow fei and deposit it into an authorized vault
- `less`: redeem fei from a deposited vault and repay fei loan
- `sweep`: claim fei accrued as interest or other tokens laying idle in a safe
- `gib`: impound the collateral of a safe (requires special auth from the master)
- `slurp`: accrue fees earned on fei deposited in a vault and split them with the master

## Getting Started

```sh
git clone https://github.com/fei-protocol/tribe-turbo.git
cd tribe-turbo
make
```
