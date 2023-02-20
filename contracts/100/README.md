# prePO contest details
- $28,500 USDC main award pot
- $1,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-03-prepo-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts March 17, 2022 00:00 UTC
- Ends March 19, 2022 23:59 UTC

# Protocol Overview
prePO is a decentralized trading platform allowing anyone to speculate on the valuation of any pre-IPO company or pre-token crypto project.

prePO markets function similarly to scalar prediction markets, with traders speculating (by going long or short) on the fully-diluted market capitalization that a pre-IPO company or pre-token crypto project will have when it eventually goes public.

Recommended reading:

- [Blog: Introducing prePO](https://prepo.io/blog/introducing-prepo/)
- [Blog: How does prePO Work?](https://prepo.io/blog/how-does-prepo-work/)
- [prePO Documentation](https://docs.prepo.io/)
- [prePO Developer Docs](https://docs.prepo.io/developer/core-contracts) (contains architecture diagrams, sequence diagrams, and contract documentation)
- [Blog: Augur market economics (particularly the ‘Scalar markets’ section)](https://medium.com/veil-blog/a-guide-to-augur-market-economics-16c66d956b6c)

Recommended viewing:
- [prePO Documentation and Contract Video Walkthrough](https://candle-orbit-4fb.notion.site/prePO-C4-Contest-Video-Walkthrough-2387fc0f305746c091291bcdc7b9437f)

# Smart Contracts
All the contracts in this section are to be reviewed. Any contracts not in this list are to be ignored for this contest.  

## Collateral Layer

#### `AccountAccessController.sol` + `IAccountAccessController.sol` (87 + 18 sloc)
- External contracts called: None
- Libraries used: None

#### `CollateralDepositRecord.sol` + `ICollateralDepositRecord.sol` (104 + 16 sloc)
- External contracts called: None
- Libraries used: None

#### `DepositHook.sol` + `IHook.sol` (53 + 10 sloc)
- External contracts called: `AccountAccessController.sol`, `CollateralDepositRecord.sol`
- Libraries used: None

#### `WithdrawHook.sol` + `IHook.sol` (53 + 10 sloc)
- External contracts called: `CollateralDepositRecord.sol`
- Libraries used: None

#### `SingleStrategyController.sol` + `IStrategyController.sol` + `IStrategy.sol` (79 + 19 + 10 sloc)
- External contracts called: ERC20 serving as BaseToken (e.g. USDC), strategy contract that implements `IStrategy.sol`
- Libraries used: None

#### `Collateral.sol` + `ICollateral.sol` (276 + 59 sloc)
- External contracts called: ERC20 serving as BaseToken (e.g. USDC), `SingleStrategyController.sol`, `DepositHook.sol`, `WithdrawHook.sol`
- Libraries used: None

## Outcome Layer

#### `LongShortToken.sol` + `ILongShortToken.sol` (12 + 7 sloc)
- External contracts called: None
- Libraries used: None

#### `PrePOMarket.sol` + `IPrePOMarket.sol` (223 + 46 sloc)
- External contracts called: `Collateral.sol`, 2x `LongShortToken.sol`
- Libraries used: None

#### `PrePOMarketFactory.sol` + `IPrePOMarketFactory.sol` (107 + 28 sloc)
- External contracts called: None
- Libraries used: None

# Setup

`yarn hardhat node` will launch a JSON-RPC node locally on `localhost:8545`. 

Running `yarn hardhat node` without the `--no-deploy` tag will also execute everything defined in the `deploy` folder.

It is advised to instead run deployments separately using `yarn hardhat deploy` with specific `--tags` to ensure you only
deploy what you need, e.g. `yarn hardhat deploy --network 'localhost' --tags 'Collateral'`

Because our scripts use `hardhat-upgrades` to deploy our upgradeable contracts, they are not managed by `hardhat-deploy`.  
Upgradeable deployment addresses are kept track of separately in a local `.env` file.

`hardhat-deploy` will automatically call deployment scripts for any dependencies of a specified `tag`.  
Per the tag dependency tree below, specifying `PrePOMarketFactory` under `--tags`, will deploy the entire PrePO core stack.  
A mock strategy can be deployed as well for testing purposes with the `MockStrategy` tag.

     CollateralDepositRecord   AccountAccessController
         ^              ^                  ^
         |              |                  |
         |              |                  |
    WithdrawHook   DepositHook-------------+              SingleStrategyController   BaseToken
         ^              ^                                             ^                  ^
         |              |                                             |                  |
         |              |                                             |                  |
         +--------------+-----------------------Collateral------------+------------------+
                                                    ^
                                                    |
                                                    |
                                          +---------+---------+
                                          |                   |
                                          |                   |
                                          |                   |
                                 PrePOMarketFactory     MockStrategy
                                                         (optional)

# Protections

The `Collateral` vault, consisting of `AccountAccessController.sol`, `Collateral.sol`, `CollateralDepositRecord.sol` , `DepositHook.sol` , and `WithdrawHook.sol`, has the following features to protect itself from malicious actors:

- Withdrawals must be requested in a prior block via `initiateWithdrawal(uint256 amount)` . The number of blocks until a request expires is settable by the vault `owner()` . This is mainly for mitigating the feasibility of a flash loan attack.
- Global and per-user deposit caps. The net `BaseToken` amount deposited by each account is kept track of by `CollateralDepositRecord.sol`.
- An allow/blocklist to only allow certain accounts to deposit into the `Collateral` vault. Allowed and Blocked accounts are managed by `AccountAccessController.sol` .
- The owner of the `Collateral` vault can disable `deposit` and `withdraw` in the case of an emergency.
- All `onlyOwner` functions will be executed by a timelocked executor smart contract (out of audit scope), which itself will only be callable by the DAO multisig.

# Areas of Concern

The following are potential areas of concern which could benefit from focus during the audit:

- Vulnerabilities in `Collateral.sol` and `SingleStrategyController.sol` that could result in a malicious actor being able to mint/redeem an outsized amount of shares/`BaseToken`. The actual `Strategy` to be used in production is not under the scope of this review and is still in development, so you will have to analyze the security of our vault-strategy architecture without a particular underlying `Strategy`. For our testnet, we are using a mock `Strategy` (`MockStrategy.sol`).
- Ways an unauthorized address could manipulate `AccountAccessController.sol` or `DepositHook.sol` into allowing it to deposit assets into `Collateral.sol`.
- Each deployment of `PrePOMarket.sol` will be initialized with its own parameters, dictating the terms for minting/redeeming positions within the market. We want to ensure these parameters cannot be bypassed (i.e. A trader minting positions after expiry or redeeming their position for an outsized amount of `Collateral`).
- Our contracts utilize OpenZeppelin's `Ownable.sol` to prevent anyone besides `owner()` from modifying sensitive parameters. We want to be sure this restriction cannot be bypassed and want to be alerted to any sensitive parameters in our contracts that are unprotected.

# Known Issues

We are aware the following state variables in `PrePOMarket.sol`:
    
`_mintingFee`, `_redemptionFee`, `_expiryTime`, `_floorValuation`, `_ceilingValuation`, `_floorLongPrice`, `_ceilingLongPrice`, `_finalLongPrice`, `_publicMinting` 

and constants: 

`MAX_PRICE`, `FEE_DENOMINATOR`, `FEE_LIMIT` 

could use smaller types to save on deployment/initialization costs via struct packing. We will not be awarding optimizations found related to condensing types for these variables.

# Upgradability

`Collateral.sol` and `PrePOMarketFactory.sol` are the only upgradeable contracts. If we ever need to update `PrePOMarket.sol` to add new features for future markets, we can upgrade `PrePOMarketFactory.sol` with the new `PrePOMarket.sol` implementation. In production, our upgradeable contracts will be deployed using OpenZeppelin’s Hardhat Upgrades API.

# Gas Optimization Notes

Any gas optimization suggestions should focus on reducing costs for functions that will be called many times. If an optimization increases the deployment cost for a contract, the savings provided by that optimization over a reasonable timeframe should outweigh the increased deployment cost.

Functions that would likely be called often are listed below:

### AccountAccessController.sol

`isAccountAllowed`, `isAccountBlocked`, `allowAccounts`, `blockAccounts` 

### Collateral.sol

`deposit`, `initiateWithdrawal`, `_processDelayedWithdrawal`, `withdraw` 

### CollateralDepositRecord.sol

`recordDeposit`, `recordWithdrawal` 

### PrePOMarket.sol

`mintLongShortTokens`, `redeem` 

### PrePOMarketFactory.sol

`createMarket`

### SingleStrategyController.sol

`deposit`, `withdraw` 

