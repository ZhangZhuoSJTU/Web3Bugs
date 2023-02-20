![logo](https://user-images.githubusercontent.com/22816913/140889449-5c5afc92-0d4d-43c8-9d02-b3489eab093f.png)

_https://nested.finance_

# Nested Finance contest details
- $45,000 USDC main award pot
- $5,000 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2021-11-nested-finance-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts November 11, 2021 00:00 UTC
- Ends November 17, 2021 23:59 UTC

## Introduction

Nested Finance is a decentralized protocol providing customizable financial products in the form of NFTs.
The platform allows users to put several digital assets, i.e. ERC20 tokens, inside an NFT (abbreviated as `NestedNFT`).
<br/>

Each NestedNFT is backed by underlying assets:
- Purchased or sold on a decentralized exchange (AMM).
- Collected/earned after adding liquidity or staking.
- Exchanged/Minted on a protocol that is not a decentralized exchange.
- (...)

The main idea is to allow adding modules (**operators**) to interact with new protocols
and enable new assets, without re-deploying.

> The tokens are stored on a self-custodian smart contract.

At the end of the creation process, the user receives the NFT which allows to control all underlying assets of the portfolio.
Furthermore, we allow users to copy other users’ NestedNFTs. The creator of the initial NestedNFT earns royalties.

#### _Further documentation and details can be found here: https://docs.nested.finance/_

## Architecture 🏗️

![diagram](https://user-images.githubusercontent.com/22816913/140886706-ee9e18f8-de84-4bcf-af20-5847b79cc508.png)

![fee_diagram](https://user-images.githubusercontent.com/22816913/141099030-473533d6-2b17-48b2-9f18-cf4e310a1d6d.png)

### Core contracts

| Name             | LOC | Purpose  |
|------------------|-----|----------|
| **NestedFactory**    | **561** | Entry point to the protocol. Holds the business logic. Responsible for interactions with operators (submit orders). |
| **NestedAsset**      | **154** | Collection of ERC721 tokens. Called NestedNFT across the codebase. |
| **NestedReserve**    | **70**  | Holds funds for the user. Transferred from the NestedFactory. |
| **NestedRecords**    | **233** | Tracks underlying assets of NestedNFTs. (Amount, NestedReserve). |
| **FeeSplitter**      | **276** | Receives payments in ERC20 tokens from the factory when fees are sent. Allows each party to claim the amount they are due. |
| **NestedBuyBacker**  | **121** | Pulls tokens from the FeeSplitter, buys back NST tokens on the market, and burns a part of it. |

> Nested Finance will launch a token (NST). The contract is out of the scope of this audit.

### Operators (modularization)

#### What is an operator?

`NestedFactory` is the main smart contract, but it can't work without the Operators.

As mentioned in the introduction, we designed the protocol to be **modular**.
We want to be able to interact with any protocol in exchange for an ERC20 token.

So, we had to deal with two issues :
- How to interact with 5, 10, or 20 protocols without blowing up the bytecode size and having too much logic?
- How to add new interactions without redeploying the `NestedFactory` contract?

Our solution is called the "**Operator**"... A new interaction is a new operator and can be added on the fly.
They kind of work like [libraries](https://docs.soliditylang.org/en/v0.8.9/contracts.html#libraries), but since we don't want to redeploy the factory,
they are contracts that are called via `delegatecall` and referenced by the `OperatorResolver`.

#### One language
To interact with new operators on the fly, they must speak the same language.
Let's define the "interactions" common to all operators: `commit` and `revert`.

An operator allows performing a precise action, like _"swap my token A for a token B"_. When we want to perform this action, we will "**commit**".
On the other hand, all the actions in DeFi can be carried out in the opposite direction, like "_swap my token B against a token A_".
When we want to "reverse" an action that we have "committed", we will "**revert**".

**Some examples:**

| Name     | Commit  |  Revert  |
|----------|---------|----------|
| Swap     | Swap token A for token B | Swap token B for token A |
| Add Liquidity | - Swap half of token A for token B. <br> - Add liquidity to A-B pool. | - Remove liquidity from A-B pool. <br>- Swap (all) token B for token A. |
| Liquidity Mining | - Swap half of token A for token B. <br>- Add liquidity to A-B pool. <br>- Stake LP token (for token C reward). | - Unstake LP Token. <br>- **(optional)** Swap token C for token A. <br>- Remove liquidity from A-B Pool. <br>- Swap (all) token B for token A. |

#### Storage

Since the operators are called via `delegatecall`: _how can we store/retrieve useful data?_
<br>In fact, we cannot trust the Factory to provide all the data, like the address of the protocol. It must be stored and managed by the owner.

When deploying an operator, it will also deploy the storage contract using `CREATE2` and transfer the ownership to `msgSender()`.

This way, the operator can retrieve the storage address (without storing it) and get the data.

#### Diagram

![image](https://user-images.githubusercontent.com/22816913/140764920-42418305-c919-4194-9891-52f2f33122f2.png)

#### Contracts

| Name                  | LOC  | Purpose  |
|-----------------------|------|----------|
| OperatorResolver      | **61** | Allows the factory to identify which operator to interact with. |
| MixinOperatorResolver | **67** | Abstract contract to load authorized operators in cache (instead of calling `OperatorResolver`). |
| ZeroExOperator        | **77** | Performs token swaps through 0x ([read more](contracts/operators/ZeroEx/README.md)). |
| ZeroExStorage         | **20** | ZeroExOperator storage contract. Must store the 0x `swapTarget`. |
| FlatOperator          | **41** | Handles deposits and withdraws. No interaction with any third parties ([read more](contracts/operators/Flat/README.md)). |

_More operators will be added. e.g. CurveOperator or SynthetixOperator_

### Ownership & Governance
Some functions of the protocol require admin rights (`onlyOwner`).

The contracts are owned by the [TimelockController](https://docs.openzeppelin.com/contracts/4.x/api/governance#TimelockController) contract from OpenZeppelin, set with a **7-days** delay.
This ensures the community has time to review any changes made to the protocol.

The owner of the TimelockController is a three-party multisignature wallet.
> During the next phase of the protocol, the ownership will be transferred to a fully decentralized DAO.

### Deflationary tokens

The protocol is incompatible with deflationary tokens.
In fact, you can add a deflationary token to your portfolio but it can lead to unpredictable behaviors (positive or negative).

We have chosen to manage the tokens with a fixed amount (the input) after considering several solutions.

**So, how can we mitigate that ?**

We're going to maintain a list of all rebase tokens (source coingecko, which is well maintained) and prevent users from adding them to their portfolio on the platform, 
as well as showing warnings about any rebase tokens that we wouldn't be able to track.

## Main concerns 🤔

Our main concerns are : 
- The modular architecture (Factory => Operator). 
- Protection against malicious calldatas (`Order[] calldata _orders`).
- Funds safety in `NestedReserve` and `FeeSplitter`.

## ⚠️ Audits _(already completed)_ ⚠️

Two audits have already been completed by [Red4Sec](https://red4sec.com/) and [Peckshield](https://peckshield.com).

### Links
- [Peckshield Audit Report v1.0](audits/PeckShield-Audit-Report-Nested-v1.0.pdf)
- [Red4Sec Audit Report v1.0](audits/Red4Sec_Nested_Finance_Security_Audit_Report_v3.pdf)

## Development & Testing

### Setup
- Install Node > 12
- Install Yarn
- `yarn install`
- Copy `.env.example` to a new file `.env` and insert a dummy mnemonic and a mainnet api key

### Commands

- Start a local blockchain
  `yarn run`

- Start a hardhat console
  `yarn console`

- Compile
  `yarn compile`

- Generate typechain files
  `yarn typechain`

- Run tests
  `yarn test`

## Links

- **Website** : https://nested.finance
- **Documentation** : https://docs.nested.finance/
- **Medium** : https://nestedfinance.medium.com/
- **Twitter** : https://twitter.com/NestedFinance
- **Telegram** : https://t.me/NestedFinanceChannel
- **Discord** : https://discord.gg/VW8ZZsACzd

## Contact us 📝

Wardens! If you have any questions, please contact us!

#### Axxe (Smart contract engineer)
- **Telegram** : @axxedev
- **Discord** : axxe#8561
- **Schedule a call** : [Calendly](https://calendly.com/maxime-brugel/lets-talk)

#### Adrien (CTO)

- **Telegram** : @adrienspt
- **Discord** : Adrien | Nested Finance#6564
- **Schedule a call** : [Calendly](https://calendly.com/adrien-supizet/30min)

## Beta access β

If you want to access the beta version of Nested Finance, contact [Adrien](#adrien-cto) or [Axxe](#axxe-smart-contract-engineer).
It can help to better understand the protocol context.

**_Note :_ The Beta is running on the v1 (puzzle) of the protocol. The version of this contest is the v2 (lego).**
