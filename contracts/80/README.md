# Yield-Convex contest details

- $28,500 USDC main award pot
- $1,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-01-yield-convex-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts January 28, 2022 00:00 UTC
- Ends January 30, 2022 23:59 UTC

# Contest scoping

Yield v2 is a [collateralized debt engine](https://github.com/yieldprotocol/vault-v2) paired with a [custom automated market maker](https://github.com/yieldprotocol/yieldspace-v2), using a [novel transaction building pattern](https://github.com/yieldprotocol/vault-v2/blob/4401e570d578b341f56973ea044698479b4e358f/contracts/Ladle.sol#L170).

We intend to allow our users to use their Convex tokens as a collateral and to claim the rewards for staking the Convex token with Convex finance accrued by those tokens, while deposited as collateral.

Abracadabra provides a [similar facility](https://github.com/convex-eth/platform/blob/main/contracts/contracts/wrappers/ConvexStakingWrapper.sol) which we have updated to use [our dependencies](https://www.npmjs.com/package/@yield-protocol/utils-v2), including a solidity compiler update from 0.6.12 to 0.8.6. Then that contract was extended through inheritance with the new functionality that is needed for integration with the Yield Protocol.

## Smart Contracts

There are 4 smart contracts and 1 library in scope:

### ConvexModule.sol (35 sloc)

A Ladle [module](https://github.com/yieldprotocol/vault-v2/blob/561ae9e9b2ee72ea9d43e77ed1a0c1ad3cb4b54f/contracts/Ladle.sol#L192) that allows Ladle batches to include calls to add or remove vaults from the ConvexYieldWrapper registry.

---

### ConvexStakingWrapper.sol (351 sloc)

A wrapper contract for convex tokens that stakes them on the user's behalf, allowing them to claim rewards. This is an adapted [convex wrapper contract](https://github.com/convex-eth/platform/blob/main/contracts/contracts/wrappers/ConvexStakingWrapper.sol) upgraded to use solidity 0.8.6 and the standard Yield Protocol dependencies.

#### External contracts called

1. [convexBooster](https://etherscan.io/address/0xF403C135812408BFbE8713b5A23a04b3D48AAE31)
2. [crv](https://etherscan.io/address/0xD533a949740bb3306d119CC777fa900bA034cd52)
3. [cvx](https://etherscan.io/address/0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B)

#### Libraries

1. [@yield-protocol/utils-v2](https://www.npmjs.com/package/@yield-protocol/utils-v2)
1. [CvxMining](https://github.com/convex-eth/platform/blob/main/contracts/contracts/wrappers/CvxMining.sol) (This library is also included in the scope of the competition and listed below)

---

### ConvexYieldWrapper.sol (190 sloc)

A wrapper contract inheriting from ConvexStakingWrapper that calculates an aggregated user balance from the all vaults owned by the same account in the [Cauldron](https://github.com/yieldprotocol/vault-v2/blob/master/contracts/Cauldron.sol).

#### External contracts called

1. [3CRV](https://etherscan.io/address/0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490)
2. [cvx3CRV](https://etherscan.io/address/0x30d9410ed1d5da1f6c8391af5338c93ab8d4035c)
3. [BaseRewardPool](https://etherscan.io/address/0x689440f2Ff927E1f24c72F1087E1FAF471eCe1c8)
4. [Cauldron](https://etherscan.io/address/0xc88191F8cb8e6D4a668B047c1C8503432c3Ca867)

#### Libraries

1. [@yield-protocol/vault-interfaces](https://www.npmjs.com/package/@yield-protocol/vault-interfaces)

---

### Cvx3CrvOracle.sol (128 sloc)

An oracle contract that provides a 3CRV/ETH price feed conforming to the interface and patterns from the audited [Yield Oracles](https://github.com/yieldprotocol/vault-v2/blob/master/contracts/oracles/chainlink/ChainlinkMultiOracle.sol).

#### External contracts called

1. [3CRVPool](https://etherscan.io/address/0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7)
2. [DAI/ETH Chainlink](https://etherscan.io/address/0x773616E4d11A78F511299002da57A0a94577F1f4)
3. [USDC/ETH Chainlink](https://etherscan.io/address/0x986b5E1e1755e3C2440e960477f25201B0a8bbD4)
4. [USDT/ETH Chainlink](https://etherscan.io/address/0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46)

#### Libraries

1. [@yield-protocol/utils-v2](https://www.npmjs.com/package/@yield-protocol/utils-v2)
2. [@yield-protocol/vault-interfaces](https://www.npmjs.com/package/@yield-protocol/vault-interfaces)

---

### CvxMining.sol (37 sloc)

A library used to calculate the amount of Convex to mint from a given amount of Curve. This is an adapted [CvxMining library contract](https://github.com/convex-eth/platform/blob/main/contracts/contracts/interfaces/CvxMining.sol) upgraded to use solidity 0.8.6.

---

### General Usage of the Contracts

For a generic token to be used as a collateral, Yield protocol requires them to be transferred to a dedicated Join contract and then perform a depositing and borrowing action. This is all orchestrated through the [Ladle](https://github.com/yieldprotocol/vault-v2/blob/master/contracts/Ladle.sol) is a batch of at least three steps.

1.  Approve the Ladle to move the collateral (permit)
2.  Move the collateral to the appropriate Join (transfer)
3.  Update accounting and produce debt tokens (pour)

Similarly, the repayment of debt is done in a batch through the Ladle.

1.  Approve the Ladle to move the debt tokens (permit)
2.  Move the debt tokens to the debt token contract (transfer)
3.  Update accounting, burn debt tokens and transfer out collateral (pour)

To enable Convex as a collateral we need to wrap it in an ERC20 that stakes it and keeps track of who was the original owner of the Convex tokens, which vaults do they own in the yield Protocol, and the rewards that are owed at each point in time.

The `ConvexYieldWrapper` contract includes `addVault` and `removeVault` functions to allow it to keep a lazily updated list of vaults that are owned by a given user. The `ConvexModule` contract adds the functionality to the Ladle to call these functions via the `addModule` and `moduleCall` functions in the Ladle. This integration mode is required so that the vaultId can be known in the same transaction that is created.

As a further explanation for this, vaultIds are not deterministic and it is not possible to know them in advance. To be able to include in batches vaults that have been created in the same transaction, zero can be passed as the `vaultId` and the Ladle will use a vault created in the same batch, if it exists. Since this cached vaultId resides in the LadleStorage for the duration of a transaction, it can be accessed by modules.

Therefore, to borrow with Convex collateral, staking it in the process, the user will execute through the Ladle a batch like follows:

1.  Approve the Ladle to move the convex collateral (permit)
2.  Move the collateral to the ConvexYieldWrapper (transfer)
3.  Wrap the convex into wrappedConvex and send it to the appropriate Join. This checkpoints rewards (route)
4.  If necessary, add the vault to the vaults owned by the user in the Wrapper contract (moduleCall)
5.  Update accounting and produce debt tokens (pour)

To repay a debt and withdraw Convex collateral, unstaking it in the process, the user will execute this batch through the Ladle:

1.  Approve the Ladle to move the debt tokens (permit)
2.  Call user_checkpoint to update the user rewards before any transfer that would erase them (route)
3.  Move the debt tokens to the debt token contract (transfer)
4.  Update accounting, burn debt tokens and transfer out collateral to the ConvexYieldWrapper (pour)
5.  Unwrap the wrappedConvex and send the resulting convex to the user. This checkpoints rewards. (route)
6.  If desired, claim rewards from the ConvexYieldWrapper (route)

## Design choices

### Segregation of ConvexStakingWrapper

To facilitate audit the original ConvexStakingWrapper has maintained the existing functionality, and all changes are limited to upgrades to integrate it with our codebase. New features are implemented in the ConvexYieldWrapper that inherits from it.

### Governance testing

All governance actions in the Yield Protocol are previously tested in blockchain forks and go through several layers of verification before committing them to the mainnet. Any check in smart contracts to verify that a governance change doesn't contain an error is considered superfluous.

### Interacting directly with smart contracts

Users are not expected to interact directly with the smart contracts, and it is accepted that they might suffer a loss by doing so. The smart contracts must be interacted with in very specific ways, usually by batching a number of calls in the same transaction. Recipes for borrowing and repaying debt have been included in this README, although other recipes exist and will be created in the future.

The recipes for safe interaction are implemented in our approved frontends. Interacting with the smart contracts using an unapproved frontend might lead to a loss of assets and users are not advised to do so.

However, what is never to be expected is that one user interacting with the smart contracts in any way could cause a loss for a different user.

### Adding and Removing vaults

The design of vault addition and removal is intended so that the vault registry in the ConvexYieldWrapper can be updated by anyone. An update should only benefit an account, and never represent a loss for the caller or the vault owner. Losses to an account caused by that same account failing to add or remove a vault when appropriate are accepted.

# Main areas of concern

- The math in the ConvexStakingWrapper that has been modified to not use the safe math as solidity version was upgraded.
- Mismanagement of vaults in the ConvexYieldWrapper.
- Math and decimals in `Cvx3CrvOracle._peek()`

# Final notes

## Intentional deviations from commonly cited "best practices"

- We intentionally do not check the validity of contract addresses using `isContract` or some other means.
- We intentionally did not make use of custom errors in spite of the potential gas savings.
- The length of each revert string is intentional and we do not wish to save gas by shortening them.
- We intentionally did not apply "unchecked" to the incrementing of loop counter variables, preferring readability to small runtime gas savings.
- Any "missing" address == 0 checks were intentionally omitted to save gas.
- We have intentionally inlined as much logic as we care to and do not wish to save any additional runtime gas by inlining more.
- We have abstracted as much logic as we care to and do not wish to reduce bytecode size to save deployment gas by abstracting more.
- In `Cvx3CrvOracle.sol`, `peek()` and `get()` both point to the same internal fn `_peek()`, however `get()` is transactional. This is all done intentionally to emulate behavior of Yield oracles.
- We intentionally chose not to use Yul for minor gas savings in favor of readability.
- In general, we are not going to change our code for small gas optimizations less than 100 gas

## Naming conventions:

- We intentionally use all-caps variable names instead of mixed case for state variables DAI, USDC, USDT, and IWETH9.
- We intentionally use PascalCase for certain function names to be consistent with the [contracts](https://github.com/convex-eth/platform/blob/main/contracts/contracts/wrappers/ConvexStakingWrapperAbra.sol) these were based on.
- We intentionally use snake_case for certain variable names to be consistent with the [contracts](https://github.com/convex-eth/platform/blob/main/contracts/contracts/wrappers/ConvexStakingWrapperAbra.sol) these were based on.
- We intentionally use variable name `I` to represent integral to be consistent with the [contracts](https://github.com/convex-eth/platform/blob/main/contracts/contracts/wrappers/ConvexStakingWrapperAbra.sol) these were based on.

## NatSpec

- We intentionally only include @notice and @dev comments for contracts and functions when we think it is helpful. If it is omitted, it is intentional.
