# yAxis contest details
- $28,500 USDC (+ $28,500 in tokens) main award pot
- $1,500 USDC (+ $1,500 in tokens) gas optimization award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-09-yAxis-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts September 9, 2021 00:00 UTC
- Ends September 15, 2021 23:59 UTC

## Contracts

The scope of this program should be on contracts in the `v3` directory. There are contracts within `governance`, `interfaces`, `legacy`, `legacy`, `mock`, and `token`, which are all necessary for the project to build, but each have their own reasons for being in the repository directly. For example, our token contract is an ERC677 token, which inherits all functionality of ERC20, but implements `transferAndCall`. It is a direct copy from Chainlink's [LinkToken](https://github.com/smartcontractkit/LinkToken) with the supply, name, and symbol updated for yAxis. We also use contracts directly from Curve.fi for governance and gauges, which means their [docs](https://resources.curve.fi/) are the best resource for learning how they work. Any Vyper contract is directly from Curve.

Finally, if you are familiar with vaults from Yearn, Pickle, and similar projects, we follow the same architecture. Users deposit to a vault, where funds pool and can be deposited through a controller into a strategy, where yield is accrued. Strategy can be harvested which compound the gains for the depositors. Where we're different in our v3 architecture is we don't allow user deposits to directly go to a strategy, as in, deposits will pool in the vault until a strategist `earn`s the funds to a strategy.

There are a few permissioned roles to know about in the project:
- Governance: this role mainly deals with the allowing/disallowing of new entities (tokens/vaults/strategies/converters) into the protocol. Governance additions do not directly affect or add these entities to the protocol though, as that power is separated into the strategist.
- Strategist: this role can add allowed entities into the protocol. Governance and the strategist are separated to prevent a protocol takeover and risking a loss of funds to users.
- Harvester: allows for a separate entity to harvest strategies, which in the future, will be automated with keepers

Below we'll briefly go over the key contracts in the project.

## VaultHelper (93 sloc)

The VaultHelper acts as a single contract that users may set token approvals on for any token of any vault.

## Vault (351 sloc)

The Vault is where users deposit and withdraw like-kind assets that have been added by governance.

## Harvester (308 sloc)

This contract is to be used as a central point to call harvest on all strategies for any given vault. It has its own permissions for harvesters (set by the strategist or governance).

## Manager (531 sloc)

This contract serves as the central point for governance-voted variables. Fees and permissioned addresses are stored and referenced in this contract only.

## Controller (639 sloc)

This controller allows multiple strategies to be used for a single vault supporting multiple tokens.

## LegacyController (238 sloc)

Helper contract to allow the legacy MetaVault contract to be a depositor of a new v3 vault. Acts as a controller and strategy in one.

## StablesConverter (207 sloc)

Uses Curve's 3pool to swap between DAI, USDC, and USDT.

## NativeStrategyCurve3Crv (133 sloc)

Deposits stablecoins (DAI/USDC/USDT) into the 3pool, the LP token into the 3pool's gauge, and allows for harvesting (sell CRV for ETH/YAXIS then for more stablecoins for compounding).

## BaseStrategy (307 sloc)

The BaseStrategy is an abstract contract which all yAxis strategies should inherit functionality from. It gives specific security properties which make it hard to write an insecure strategy.
