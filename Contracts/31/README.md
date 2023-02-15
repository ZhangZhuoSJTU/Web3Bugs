# bveCVX by BadgerDAO contest details
- $28,500 USDC + $57,000 tokens main award pot
- $1,500 USDC + $3,000 tokens gas award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-09-bvecvx-by-badgerdao-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts September 2, 2021 00:00 UTC
- Ends September 8, 2021  23:59 UTC

## Have any question?
Strategy and Architecture | CET: Alex on Discord: Alex The Entreprenerd#5686

Architecture | EST : Saj saj#8488

## Preamble
The contracts below are part of Badger's SETT system, which is a fork of Yearn V1.

If you are not familiar with Yearn V1, see a note on the architecture after the list of contracts


## Video Intro
If you like video format, this goes over the code, the goals of the audit and the architecture of Setts
https://youtu.be/q43XVyiekSk

## Intro
Badger is a decentralized autonomous organization (DAO) with a single purpose: build the products and infrastructure necessary to accelerate Bitcoin as collateral across other blockchains.

The goal of the audit is to find and mitigate security risks for our newest veCVXStrategy.

This strategy uses a token from another of our vault, the CVX Helper Vault (bCVX)
The veCVX Strategy will receive bCVX via the vault.earn call and it will then redeem the underlying CVX and then lock it in the new Convex Locker Contract.

Due to this interaction, the contracts below are in scope.

Half of the contracts are audited (the ones under Core Contracts) and provide the basic functionality and connection between the other contracts.

The other half of the contract is not audited with veCVXStrategy not even being live currently.

For the sake of completeness we also added `CvxLocker` and `CvxStakingProxy` which are contracts written by Convex.finance which is also sponsoring the contest

## Smart Contracts

| Contract                 | Link                                                                                              |
|--------------------------|---------------------------------------------------------------------------------------------------|
| veCVXStrategy.sol        | https://github.com/code-423n4/2021-09-bvecvx/tree/main/veCVX/contracts/veCVXStrategy.sol          |
| CvxLocker.sol            | https://github.com/code-423n4/2021-09-bvecvx/tree/main/veCVX/contracts/locker/CvxLocker.sol       |
| CvxStakingProxy.sol      | https://github.com/code-423n4/2021-09-bvecvx/tree/main/veCVX/contracts/locker/CvxStakingProxy.sol |
| StrategyCvxHelper.sol | https://github.com/code-423n4/2021-09-bvecvx/tree/main/bCVX/StrategyCvxHelper.sol              |
| BaseStrategy.sol         | https://github.com/code-423n4/2021-09-bvecvx/tree/main/veCVX/deps/BaseStrategy.sol                |
| SettV3.sol               | https://github.com/code-423n4/2021-09-bvecvx/tree/main/veCVX/contracts/deps/SettV3.sol            |
| Controller.sol           | https://github.com/code-423n4/2021-09-bvecvx/tree/main/veCVX/contracts/deps/Controller.sol        |


## Flow of funds for veCVXStrategy
![Flow of funds for veCVXStrategy](/.github/flow.png)


## veCVXStrategy.sol - 510 LOC

This is the most important contract for the audit.

Fundamentally we receive bCVX (see below), we then withdraw from it (to have CVX) and then we lock the CVX in the new `CvxLocker` by Convex

The goal of this audit is to determine if this strategy is safe, if there are ways to lock funds, grief depositors or if there are exploits that would lead to loss of funds.


### External Calls
- CVX_VAULT -> the CVX Helper Vault (see below), also the want for the Strategy
- LOCKER -> Contract in whcih we lock funds, see: `CvxLocker.sol`
- SUSHI_ROUTER -> To Swap funds, see: `IUniswapRouterV2.sol`
- Controller -> The Controller that can tell the strategy when to _withdraw, _withdrawAll or _deposit
- Vault -> The Vault this strategy is attached to

## CvxLocker.sol - 985 LOC

This is the contract that will lock CVX for 16 weeks
While this is not a contract we wrote, our strategy interacts with this contract and as such we need to be aware of potential vulnerabilitie in it.

### External Calls
- _tokenAddress -> The token, see `IERC20.sol`
- stakingProxy -> See `CvxStakingProxy.sol`

## CvxStakingProxy.sol - 182 LOC

This contract stakes the CVX from the CvxLocker as a way to gain staking yield.
While this is not a contract we wrote, our strategy interacts with this contract and as such we need to be aware of potential vulnerabilitie in it

### External Calls
- rewards -> The Rewards Locker from Convex, see `ICvxLocker.sol`

## StrategyCvxHelper.sol - 614 LOC

This strategy is the underlying strategy of the `want` we deposit in the `veCVXStrategy`. 
This token will also sit idle in the instance of the `SettV3` contract we will use as vault for the `veCVXStrategy`.

As such, uncovering and mitigating exploits such as stealing funds are critical to this audit.

This strategy stakes CVX in their staking contract and harvests and auto-compounds the rewards into more CVX

## External Calls
- cvxRewardsPool -> The pool for staking rewards by Convex

# Core Contracts

While the contracts below have all been audited, it's a good idea you familiarize yourself with them as they are part of the system

See [/audits](/audits) for the audits of Controller, Vault and BaseStrategy

## BaseStrategy.sol - 417 LOC

This provides some basic methods for all strategies and specifies the way in which they interact with the vault and controller

### External Calls
- want -> The `want` we want to deposit
- controller -> The Controller which handles funds
- vault -> The Vault which handles deposits and withdrawals


## SettV3.sol - 386 LOC

This is the contract for the Vault, which handles deposits and withdrawals
This contract has already been audited, but due to it's interactiong with bCVX and bveCVX it's important you understand how it works

### External Calls
- token -> The `want` we want to deposit
- controller -> The Controller which handles funds
- strategy -> The strategy we want audited, see `veCVXStrategy.sol`

## Controller.sol - 208 LOC

This is the contract for the Controller which connects vaults with strategies

This contract has already been audited, but due to it's interactiong with bCVX and bveCVX it's important you understand how it works

### External Calls
- token -> The `want` we want to deposit
- controller -> The Controller which handles funds
- strategy -> The strategy we want audited, see `veCVXStrategy.sol`


## A note on Sett's / Yearn V1's architecture

The V1 architecture has 3 contracts:
- Vault -> Used to handle deposits and withdrawals
- Strategies -> Used to use the assets and earn yield
- Controller -> A contract that connects each Vault with each respective Strategy

Loading funds into a strategy is done via `vault.earn` (also `controller.earn`)

At all times, funds should either be in the Vault (idle, not invested), or in the Strategy.

Funds in the Strategy could be idle, i.e. waiting to be invested or kept there to facilitate withdrawals, or they should be invested, earning interest.

Earning rewards, is done by calling a function called `harvest`.

